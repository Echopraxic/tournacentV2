import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!;
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!;
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};
const PLAID_BASE_URL = PLAID_BASE_URLS[PLAID_ENV] ?? 'https://sandbox.plaid.com';

// Ignore webhook-triggered syncs if one ran within this window
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// Minimum debit amount to trigger savings disqualification (matches task-verification.ts)
const SAVINGS_WITHDRAWAL_THRESHOLD = 15;

// Webhook codes that mean new transaction data is available
const TRANSACTION_WEBHOOK_CODES = new Set([
  'SYNC_UPDATES_AVAILABLE',
  'DEFAULT_UPDATE',
  'INITIAL_UPDATE',
  'HISTORICAL_UPDATE',
]);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (body.webhook_type !== 'TRANSACTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (!TRANSACTION_WEBHOOK_CODES.has(body.webhook_code)) {
    return new Response('ok', { status: 200 });
  }

  const itemId: string | undefined = body.item_id;
  if (!itemId) return new Response('ok', { status: 200 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: plaidItem } = await supabase
    .from('plaid_items')
    .select('user_id, access_token, cursor, last_synced_at')
    .eq('item_id', itemId)
    .maybeSingle();

  if (!plaidItem) {
    return new Response('ok', { status: 200 });
  }

  // Debounce: skip if a sync already ran within the last 5 minutes
  if (plaidItem.last_synced_at) {
    const msSinceLast = Date.now() - new Date(plaidItem.last_synced_at).getTime();
    if (msSinceLast < DEBOUNCE_MS) {
      return new Response('ok', { status: 200 });
    }
  }

  // Only sync if the user is currently in an active challenge
  const { data: activeParticipant } = await supabase
    .from('challenge_participants')
    .select('challenge_id, challenges!inner(status)')
    .eq('user_id', plaidItem.user_id)
    .eq('challenges.status', 'active')
    .maybeSingle();

  if (!activeParticipant) {
    return new Response('ok', { status: 200 });
  }

  try {
    const { added, modified, removed, nextCursor } = await syncIncremental(
      plaidItem.access_token,
      plaidItem.cursor ?? null
    );

    if (added.length + modified.length > 0) {
      const rows = [...added, ...modified].map((tx: any) => ({
        user_id: plaidItem.user_id,
        plaid_transaction_id: tx.transaction_id,
        account_id: tx.account_id,
        amount: tx.amount,
        date: tx.date,
        name: tx.name,
        category: tx.personal_finance_category
          ? [tx.personal_finance_category.primary]
          : (tx.category ?? []),
        pending: tx.pending ?? false,
      }));

      await supabase
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' });
    }

    if (removed.length > 0) {
      const removedIds = removed.map((tx: any) => tx.transaction_id);
      await supabase
        .from('bank_transactions')
        .delete()
        .in('plaid_transaction_id', removedIds)
        .eq('user_id', plaidItem.user_id);
    }

    await supabase
      .from('plaid_items')
      .update({ cursor: nextCursor, last_synced_at: new Date().toISOString() })
      .eq('item_id', itemId);

    // Check for disqualification on new (non-pending) debits
    if (added.length > 0) {
      await checkDisqualification(supabase, plaidItem.user_id, added);
    }
  } catch (err: any) {
    // Log but return 200 so Plaid doesn't keep retrying for non-transient errors
    console.error('plaid-webhook sync error:', err.message);
  }

  return new Response('ok', { status: 200 });
});

/**
 * Checks whether any newly added transactions should immediately disqualify the user.
 *
 * Two violation types are detected:
 *
 * 1. Savings withdrawal — any debit > $15 in an active challenge that contains savings tasks.
 *    Covers the Emergency Fund Sprint rules where withdrawing from the savings account
 *    is a disqualifying event.
 *
 * 2. No-spend category violation — any debit in a category the user declared they'd avoid.
 *    Covers the No-Spend Reset Challenge. Requires the user to have already completed
 *    the "Declare 3 Spending Categories" task; if not declared yet, no check is run.
 *
 * Disqualification deletes the relevant task completions, recalculates points,
 * and sets is_disqualified = true on the participant record.
 */
async function checkDisqualification(
  supabase: any,
  userId: string,
  addedTransactions: any[]
): Promise<void> {
  // Only check non-disqualified, active, non-dropped-out participants
  const { data: participation } = await supabase
    .from('challenge_participants')
    .select('challenge_id, challenges!inner(start_date, status)')
    .eq('user_id', userId)
    .eq('is_disqualified', false)
    .is('dropped_out_at', null)
    .eq('challenges.status', 'active')
    .maybeSingle();

  if (!participation) return;

  const challengeId = participation.challenge_id;
  const challengeStart: string = (participation.challenges as any).start_date;

  // Only consider settled debits on or after the challenge start date
  const newDebits = addedTransactions.filter(
    (tx: any) =>
      !tx.pending &&
      tx.amount > 0 &&
      tx.date >= challengeStart.split('T')[0]
  );

  if (newDebits.length === 0) return;

  // ── Savings violation ─────────────────────────────────────────────────────
  const { count: savingsTaskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('task_type', 'savings');

  if ((savingsTaskCount ?? 0) > 0) {
    const hasLargeWithdrawal = newDebits.some(
      (tx: any) => tx.amount > SAVINGS_WITHDRAWAL_THRESHOLD
    );
    if (hasLargeWithdrawal) {
      await disqualifyUser(
        supabase,
        userId,
        challengeId,
        'Withdrawal detected from linked savings account',
        ['savings']
      );
      return; // No need to check no-spend after a savings disqualification
    }
  }

  // ── No-spend category violation ───────────────────────────────────────────
  const { data: declaredCategories } = await supabase
    .from('user_no_spend_categories')
    .select('plaid_category')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);

  if (!declaredCategories || declaredCategories.length === 0) return;

  const categorySet = new Set(declaredCategories.map((c: any) => c.plaid_category));

  const violatingTx = newDebits.find((tx: any) => {
    const primary = tx.personal_finance_category?.primary;
    return primary && categorySet.has(primary);
  });

  if (violatingTx) {
    const categoryLabel = violatingTx.personal_finance_category?.primary ?? 'declared category';
    await disqualifyUser(
      supabase,
      userId,
      challengeId,
      `Spending detected in declared no-spend category: ${categoryLabel} (${violatingTx.name} on ${violatingTx.date})`,
      ['no_spend']
    );
  }
}

/**
 * Marks a participant as disqualified.
 * Deletes task completions for the affected task types, recalculates total points,
 * then sets is_disqualified = true with the given reason.
 */
async function disqualifyUser(
  supabase: any,
  userId: string,
  challengeId: string,
  reason: string,
  affectedTaskTypes: string[]
): Promise<void> {
  // Fetch tasks of the affected types for this challenge
  const { data: affectedTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('challenge_id', challengeId)
    .in('task_type', affectedTaskTypes);

  if (affectedTasks && affectedTasks.length > 0) {
    await supabase
      .from('task_completions')
      .delete()
      .eq('user_id', userId)
      .in('task_id', affectedTasks.map((t: any) => t.id));
  }

  // Recalculate points from remaining completions
  const { data: remaining } = await supabase
    .from('task_completions')
    .select('tasks!inner(points)')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);

  const newPoints = (remaining ?? []).reduce(
    (sum: number, c: any) => sum + ((c.tasks as any)?.points ?? 0),
    0
  );

  await supabase
    .from('challenge_participants')
    .update({
      is_disqualified: true,
      disqualification_reason: reason,
      points: newPoints,
    })
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);
}

async function syncIncremental(accessToken: string, cursor: string | null) {
  const added: any[] = [];
  const modified: any[] = [];
  const removed: any[] = [];
  let nextCursor = cursor;

  do {
    const body: Record<string, any> = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      access_token: accessToken,
      options: { include_personal_finance_category: true },
    };
    if (nextCursor) body.cursor = nextCursor;

    const res = await fetch(`${PLAID_BASE_URL}/transactions/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_message || 'Plaid /transactions/sync failed');

    added.push(...(data.added ?? []));
    modified.push(...(data.modified ?? []));
    removed.push(...(data.removed ?? []));
    nextCursor = data.next_cursor;

    if (!data.has_more) break;
  } while (true);

  return { added, modified, removed, nextCursor };
}
