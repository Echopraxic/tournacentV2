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

const DEBOUNCE_MS = 5 * 60 * 1000;
const SAVINGS_WITHDRAWAL_THRESHOLD = 15;
const DEBT_PURCHASE_THRESHOLD = 50;

const TRANSACTION_WEBHOOK_CODES = new Set([
  'SYNC_UPDATES_AVAILABLE',
  'DEFAULT_UPDATE',
  'INITIAL_UPDATE',
  'HISTORICAL_UPDATE',
]);

// ── Encryption helpers ────────────────────────────────────────────────────────

const ENC_PREFIX = 'enc:v1:';

function b64Encode(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getEncKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get('PLAID_ENCRYPTION_KEY');
  if (!raw) return null;
  return crypto.subtle.importKey('raw', b64Decode(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function decryptAccessToken(stored: string, key: CryptoKey): Promise<string> {
  if (!stored.startsWith(ENC_PREFIX)) return stored; // backwards-compat: plaintext
  const combined = b64Decode(stored.slice(ENC_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plain);
}

// ── Webhook signature verification ───────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function b64UrlDecode(s: string): Uint8Array {
  return b64Decode(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '='));
}

/**
 * Verifies the Plaid-Verification JWT attached to incoming webhooks.
 *
 * Steps per Plaid docs:
 * 1. Parse JWT header → get key_id
 * 2. Fetch Plaid's public JWK for that key_id
 * 3. Verify RS256 signature over header.payload
 * 4. Verify SHA-256 of raw request body matches payload.request_body_sha256
 * 5. Verify token is not older than 5 minutes
 *
 * In sandbox mode webhook verification is skipped (Plaid doesn't sign sandbox webhooks).
 */
async function verifyWebhookSignature(jwtToken: string, rawBody: string): Promise<boolean> {
  const parts = jwtToken.split('.');
  if (parts.length !== 3) return false;

  try {
    const header = JSON.parse(new TextDecoder().decode(b64UrlDecode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(b64UrlDecode(parts[1])));

    // Fetch Plaid's verification key
    const keyRes = await fetch(`${PLAID_BASE_URL}/webhook_verification_key/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, key_id: header.kid }),
    });
    if (!keyRes.ok) return false;
    const { key } = await keyRes.json();
    if (!key) return false;

    // Import JWK
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = b64UrlDecode(parts[2]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, signed);
    if (!valid) return false;

    // Verify body hash
    const bodyHash = await sha256Hex(rawBody);
    if (bodyHash !== payload.request_body_sha256) return false;

    // Verify freshness (5-minute window)
    const now = Math.floor(Date.now() / 1000);
    if (payload.iat && now > payload.iat + 300) return false;

    return true;
  } catch (e) {
    console.error('webhook signature verification error:', e);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Verify Plaid webhook signature (skip in sandbox — Plaid doesn't sign sandbox webhooks)
  if (PLAID_ENV !== 'sandbox') {
    const jwtToken = req.headers.get('Plaid-Verification');
    if (!jwtToken) {
      console.error('plaid-webhook: missing Plaid-Verification header');
      return new Response('Unauthorized', { status: 401 });
    }
    const valid = await verifyWebhookSignature(jwtToken, rawBody);
    if (!valid) {
      console.error('plaid-webhook: invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
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
    .select('user_id, access_token, cursor, last_synced_at, item_type')
    .eq('item_id', itemId)
    .maybeSingle();

  if (!plaidItem) {
    return new Response('ok', { status: 200 });
  }

  if (plaidItem.last_synced_at) {
    const msSinceLast = Date.now() - new Date(plaidItem.last_synced_at).getTime();
    if (msSinceLast < DEBOUNCE_MS) {
      return new Response('ok', { status: 200 });
    }
  }

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
    // Decrypt access token before use
    const encKey = await getEncKey();
    const accessToken = encKey
      ? await decryptAccessToken(plaidItem.access_token, encKey)
      : plaidItem.access_token;

    const { added, modified, removed, nextCursor } = await syncIncremental(
      accessToken,
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
        item_type: plaidItem.item_type ?? 'savings',
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

    if (plaidItem.item_type === 'debt') {
      await refreshAccountBalances(supabase, accessToken, plaidItem.user_id, itemId);
    }

    if (added.length > 0) {
      await checkViolations(supabase, plaidItem.user_id, added, plaidItem.item_type ?? 'savings');
    }
  } catch (err: any) {
    console.error('plaid-webhook sync error:', err.message);
  }

  return new Response('ok', { status: 200 });
});

async function refreshAccountBalances(
  supabase: any,
  accessToken: string,
  userId: string,
  plaidItemId: string
): Promise<void> {
  try {
    const res = await fetch(`${PLAID_BASE_URL}/accounts/balance/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: accessToken,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const accounts: any[] = data.accounts ?? [];

    const rows = accounts.map((a: any) => ({
      user_id: userId,
      plaid_item_id: plaidItemId,
      account_id: a.account_id,
      name: a.name,
      account_type: a.type,
      account_subtype: a.subtype,
      current_balance: a.balances?.current ?? null,
      available_balance: a.balances?.available ?? null,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      await supabase
        .from('plaid_accounts')
        .upsert(rows, { onConflict: 'account_id' });
    }
  } catch (err: any) {
    console.error('refreshAccountBalances error:', err.message);
  }
}

async function checkViolations(
  supabase: any,
  userId: string,
  addedTransactions: any[],
  itemType: string
): Promise<void> {
  if (itemType === 'debt') {
    await checkDebtViolations(supabase, userId, addedTransactions);
    return;
  }

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

  const newDebits = addedTransactions.filter(
    (tx: any) => !tx.pending && tx.amount > 0 && tx.date >= challengeStart.split('T')[0]
  );

  if (newDebits.length === 0) return;

  const { count: savingsTaskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('task_type', 'savings');

  if ((savingsTaskCount ?? 0) > 0) {
    const hasLargeWithdrawal = newDebits.some((tx: any) => tx.amount > SAVINGS_WITHDRAWAL_THRESHOLD);
    if (hasLargeWithdrawal) {
      await disqualifyUser(supabase, userId, challengeId, 'Withdrawal detected from linked savings account', ['savings']);
      return;
    }
  }

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
    await breakStreak(
      supabase,
      userId,
      challengeId,
      `Spending detected in declared no-spend category: ${categoryLabel} (${violatingTx.name} on ${violatingTx.date})`
    );
  }
}

async function checkDebtViolations(supabase: any, userId: string, addedTransactions: any[]): Promise<void> {
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

  const { count: debtTaskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('task_type', 'debt_payment');

  if ((debtTaskCount ?? 0) === 0) return;

  const largePurchase = addedTransactions.find(
    (tx: any) => !tx.pending && tx.amount > DEBT_PURCHASE_THRESHOLD && tx.date >= challengeStart.split('T')[0]
  );

  if (largePurchase) {
    await breakStreak(
      supabase,
      userId,
      challengeId,
      `New credit card purchase detected: ${largePurchase.name} ($${largePurchase.amount}) on ${largePurchase.date}`
    );
  }
}

async function breakStreak(supabase: any, userId: string, challengeId: string, reason: string): Promise<void> {
  const { data: noSpendTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('task_type', 'no_spend');

  if (noSpendTasks && noSpendTasks.length > 0) {
    await supabase
      .from('task_completions')
      .delete()
      .eq('user_id', userId)
      .in('task_id', noSpendTasks.map((t: any) => t.id));
  }

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
    .update({ points: newPoints })
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);

  console.log(`Streak broken for user ${userId} in challenge ${challengeId}: ${reason}`);
}

async function disqualifyUser(
  supabase: any,
  userId: string,
  challengeId: string,
  reason: string,
  affectedTaskTypes: string[]
): Promise<void> {
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
    .update({ is_disqualified: true, disqualification_reason: reason, points: newPoints })
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
