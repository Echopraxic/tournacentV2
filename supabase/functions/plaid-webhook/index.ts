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

// Webhook codes that mean new transaction data is available
const TRANSACTION_WEBHOOK_CODES = new Set([
  'SYNC_UPDATES_AVAILABLE',
  'DEFAULT_UPDATE',
  'INITIAL_UPDATE',
  'HISTORICAL_UPDATE',
]);

serve(async (req) => {
  // Plaid only POSTs webhooks
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Only handle transaction webhooks
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

  // Look up the item — confirms the item_id belongs to a known user
  const { data: plaidItem } = await supabase
    .from('plaid_items')
    .select('user_id, access_token, cursor, last_synced_at')
    .eq('item_id', itemId)
    .maybeSingle();

  if (!plaidItem) {
    // Unknown item — could be a spoofed request, silently ignore
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

  } catch (err: any) {
    // Log but return 200 so Plaid doesn't keep retrying for non-transient errors
    console.error('plaid-webhook sync error:', err.message);
  }

  return new Response('ok', { status: 200 });
});

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
