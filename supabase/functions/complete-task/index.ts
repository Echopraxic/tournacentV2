import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-authoritative task completion. The client can no longer insert
// task_completions or set points directly (locked down by RLS). All completion
// goes through here so verification runs server-side and points are derived
// from real completions by a DB trigger.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    // Service-role client (bypasses RLS) for the privileged writes below.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Identify the caller from their JWT.
    const { data: { user }, error: authErr } = await admin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return json({ success: false, message: 'Unauthorized' }, 401);

    const { task_id, evidence_url } = await req.json();
    if (!task_id) return json({ success: false, message: 'task_id required' }, 400);

    // Load the task.
    const { data: task } = await admin
      .from('tasks')
      .select('id, challenge_id, task_type, verification_type, points, title, is_mandatory')
      .eq('id', task_id)
      .maybeSingle();
    if (!task) return json({ success: false, message: 'Task not found' }, 404);

    const challengeId = task.challenge_id;

    // Load the challenge and the caller's participation.
    const { data: challenge } = await admin
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();
    if (!challenge) return json({ success: false, message: 'Challenge not found' }, 404);
    if (challenge.status !== 'active') {
      return json({ success: false, message: 'Challenge is not active.' });
    }

    const { data: participant } = await admin
      .from('challenge_participants')
      .select('payment_status, dropped_out_at, is_disqualified, joined_at')
      .eq('user_id', user.id)
      .eq('challenge_id', challengeId)
      .maybeSingle();
    if (!participant) return json({ success: false, message: 'You are not in this challenge.' });
    if (participant.dropped_out_at) return json({ success: false, message: 'You have dropped out of this challenge.' });
    if (participant.is_disqualified) return json({ success: false, message: 'You have been disqualified from this challenge.' });
    if (participant.payment_status !== 'paid') {
      return json({ success: false, message: 'Complete your buy-in before completing tasks.' });
    }

    // Idempotency: already completed?
    const { data: existing } = await admin
      .from('task_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', task_id)
      .maybeSingle();
    if (existing) return json({ success: true, message: 'Task already completed.' });

    // 24-hour gate for the final mandatory task on mini-rate-check challenges.
    if (task.is_mandatory && challenge.preset_id === 'mini-rate-check') {
      const { data: allTasks } = await admin
        .from('tasks').select('id, is_mandatory').eq('challenge_id', challengeId);
      const mandatoryIds = (allTasks ?? []).filter((t: any) => t.is_mandatory).map((t: any) => t.id);
      const { data: doneMandatory } = await admin
        .from('task_completions').select('task_id')
        .eq('user_id', user.id).eq('challenge_id', challengeId).in('task_id', mandatoryIds);
      if ((doneMandatory?.length ?? 0) >= 4 && participant.joined_at) {
        const hrs = (Date.now() - new Date(participant.joined_at).getTime()) / 3.6e6;
        if (hrs < 24) {
          const left = Math.ceil(24 - hrs);
          return json({ success: false, message: `Come back in ${left} hour${left !== 1 ? 's' : ''} to complete the final mandatory task.` });
        }
      }
    }

    // ── Per-type verification ────────────────────────────────────────────────
    if (task.verification_type === 'plaid') {
      const v = await verifyPlaid(admin, user.id, challengeId, task, challenge);
      if (!v.success) return json(v);
    } else if (task.task_type === 'no_spend_declare') {
      const { count } = await admin
        .from('user_no_spend_categories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('challenge_id', challengeId);
      if ((count ?? 0) < 3) return json({ success: false, message: 'Declare 3 no-spend categories first.' });
    } else if (task.verification_type === 'photo') {
      if (!evidence_url) return json({ success: false, message: 'Photo evidence is required.' });
    } else if (['form', 'quiz', 'counter', 'text'].includes(task.verification_type)) {
      const tableMap: Record<string, string> = {
        form: 'task_form_submissions',
        quiz: 'task_quiz_submissions',
        counter: 'task_counters',
        text: 'task_text_submissions',
      };
      const { count } = await admin
        .from(tableMap[task.verification_type])
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('task_id', task_id);
      if ((count ?? 0) === 0) return json({ success: false, message: 'Submit your response before completing this task.' });
    }
    // else: self-report / passthrough — allowed.

    // Record the completion (points are recomputed by the DB trigger).
    const { error: insertErr } = await admin.from('task_completions').insert({
      task_id,
      user_id: user.id,
      challenge_id: challengeId,
      ...(evidence_url ? { evidence_url } : {}),
    });
    if (insertErr) return json({ success: false, message: insertErr.message }, 500);

    return json({ success: true, message: `Task completed! +${task.points} points` });
  } catch (e: any) {
    return json({ success: false, message: e.message ?? 'Unexpected error' }, 500);
  }
});

// ── Plaid verification (ported from lib/task-verification.ts) ────────────────

type V = { success: boolean; message: string };

async function verifyPlaid(admin: any, userId: string, challengeId: string, task: any, challenge: any): Promise<V> {
  switch (task.task_type) {
    case 'savings': return verifySavings(admin, userId, challengeId, task, challenge);
    case 'no_spend': return verifyNoSpend(admin, userId, challengeId, task, challenge);
    case 'tracking': return verifyTracking(admin, userId, challengeId, task, challenge);
    case 'debt_payment': return verifyDebt(admin, userId, task, challenge);
    default: return { success: true, message: 'Task completed successfully.' };
  }
}

async function verifySavings(admin: any, userId: string, challengeId: string, task: any, challenge: any): Promise<V> {
  const m = task.title.match(/\$(\d[\d,]*)/);
  const required = m ? parseFloat(m[1].replace(',', '')) : null;
  if (required === null) return { success: true, message: 'Task completed successfully.' };

  const { data: plaidItem } = await admin.from('plaid_items').select('id').eq('user_id', userId).maybeSingle();
  if (!plaidItem) return { success: false, message: 'No linked bank account. Connect your bank via Plaid in the Wallet tab.' };

  const start = challenge.start_date;
  const { data: withdrawals } = await admin.from('bank_transactions')
    .select('amount').eq('user_id', userId).gte('date', start).gt('amount', 15).eq('pending', false);
  if (withdrawals && withdrawals.length > 0) {
    await admin.from('challenge_participants')
      .update({ is_disqualified: true, disqualification_reason: 'Withdrawal detected during savings challenge' })
      .eq('user_id', userId).eq('challenge_id', challengeId);
    return { success: false, message: 'Disqualified: a withdrawal was detected from your linked account.' };
  }

  const { data: deposits } = await admin.from('bank_transactions')
    .select('amount').eq('user_id', userId).gte('date', start).lt('amount', 0).eq('pending', false);
  const total = (deposits ?? []).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  if (total < required) {
    return { success: false, message: `Deposit milestone not met. You've deposited $${total.toFixed(2)} of the required $${required.toFixed(2)}.` };
  }
  return { success: true, message: `Deposit verified. $${total.toFixed(2)} confirmed.` };
}

async function verifyNoSpend(admin: any, userId: string, challengeId: string, task: any, challenge: any): Promise<V> {
  const { data: plaidItem } = await admin.from('plaid_items').select('id').eq('user_id', userId).maybeSingle();
  if (!plaidItem) return { success: false, message: 'No linked bank account. Connect your bank via Plaid in the Wallet tab.' };

  const m = task.title.match(/(\d+)-Day/i);
  const requiredDays = m ? parseInt(m[1], 10) : 7;
  const start = challenge.start_date.split('T')[0];
  const streakEnd = new Date(new Date(start).getTime() + requiredDays * 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  if (today < streakEnd) {
    const left = Math.ceil((new Date(streakEnd).getTime() - Date.now()) / 86400000);
    return { success: false, message: `${requiredDays}-day streak not complete yet. ${left} day${left !== 1 ? 's' : ''} remaining.` };
  }

  const { data: declared } = await admin.from('user_no_spend_categories')
    .select('plaid_category').eq('user_id', userId).eq('challenge_id', challengeId);
  const cats = (declared ?? []).map((c: any) => c.plaid_category as string);
  const byCat = cats.length > 0;

  const { data: debits } = await admin.from('bank_transactions')
    .select('name, date, amount, category').eq('user_id', userId)
    .gte('date', start).lte('date', streakEnd).gt('amount', 0).eq('pending', false);
  const bad = (debits ?? []).find((tx: any) => {
    if (byCat) { const p = Array.isArray(tx.category) ? tx.category[0] : null; return p && cats.includes(p); }
    return tx.amount > 1;
  });
  if (bad) return { success: false, message: `Spending detected during your freeze period (${bad.name} on ${bad.date}). Streak broken.` };
  return { success: true, message: `${requiredDays}-day no-spend streak verified.` };
}

async function verifyTracking(admin: any, userId: string, challengeId: string, task: any, challenge: any): Promise<V> {
  const { data: plaidItem } = await admin.from('plaid_items').select('id').eq('user_id', userId).maybeSingle();
  if (!plaidItem) return { success: false, message: 'No linked bank account. Connect your bank via Plaid in the Wallet tab.' };

  const m = task.title.match(/(\d+)/);
  const requiredDays = m ? parseInt(m[1], 10) : 7;
  const start = challenge.start_date.split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const since = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
  if (since < requiredDays) {
    return { success: false, message: `${requiredDays}-day tracking streak not complete yet. ${requiredDays - since} day(s) remaining.` };
  }
  const { data: txs } = await admin.from('bank_transactions')
    .select('date').eq('user_id', userId).gte('date', start).lte('date', today).eq('pending', false);
  const dates = [...new Set((txs ?? []).map((t: any) => t.date as string))].sort();
  if (dates.length < requiredDays) {
    return { success: false, message: `Tracking incomplete. Activity found on ${dates.length} of the required ${requiredDays} days.` };
  }
  let longest = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const d = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
    if (d === 1) { cur++; longest = Math.max(longest, cur); } else cur = 1;
  }
  if (longest < requiredDays) {
    return { success: false, message: `Consecutive tracking streak not met. Longest: ${longest} day(s) of ${requiredDays}.` };
  }
  return { success: true, message: `${requiredDays}-day expense tracking streak verified.` };
}

async function verifyDebt(admin: any, userId: string, task: any, challenge: any): Promise<V> {
  const { data: debtItem } = await admin.from('plaid_items')
    .select('item_id').eq('user_id', userId).eq('item_type', 'debt').maybeSingle();
  if (!debtItem) return { success: false, message: 'No credit card linked. Connect your debt account in the Wallet tab first.' };

  const start = challenge.start_date.split('T')[0];
  const m = task.title.match(/\$(\d[\d,]*)/);
  const required = m ? parseFloat(m[1].replace(',', '')) : null;

  if (required === null) {
    const { data: accts } = await admin.from('plaid_accounts')
      .select('current_balance, name').eq('plaid_item_id', debtItem.item_id).order('current_balance', { ascending: true });
    if (!accts || accts.length === 0) return { success: false, message: 'Balance data not available yet. Wait for your next sync.' };
    const low = accts[0].current_balance ?? Infinity;
    if (low > 5) return { success: false, message: `Outstanding balance: $${low.toFixed(2)} on ${accts[0].name}.` };
    return { success: true, message: `Debt paid off! Balance $${low.toFixed(2)}.` };
  }

  const { data: payments } = await admin.from('bank_transactions')
    .select('amount').eq('user_id', userId).eq('item_type', 'debt').gte('date', start).lt('amount', 0).eq('pending', false);
  const total = (payments ?? []).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  if (total < required) return { success: false, message: `Payment milestone not met. $${total.toFixed(2)} of $${required.toFixed(2)}.` };
  return { success: true, message: `Payment verified. $${total.toFixed(2)} paid toward debt.` };
}
