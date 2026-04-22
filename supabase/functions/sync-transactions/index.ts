import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!;
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!;
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

// ── Encryption helpers ────────────────────────────────────────────────────────

const ENC_PREFIX = 'enc:v1:';

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

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};
const PLAID_BASE_URL = PLAID_BASE_URLS[PLAID_ENV] ?? 'https://sandbox.plaid.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// How long to wait before allowing another manual sync (milliseconds)
const MANUAL_SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Authenticate the calling user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Enforce 1-hour cooldown on manual syncs (pass force=true to bypass, e.g. post-link)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const force = body.force === true;
    const itemType: string = body.item_type ?? 'savings';

    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('access_token, cursor, last_synced_at')
      .eq('user_id', user.id)
      .eq('item_type', itemType)
      .maybeSingle();

    if (itemError || !plaidItem) {
      return new Response(JSON.stringify({ error: 'No linked bank account found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (!force && plaidItem.last_synced_at) {
      const msSinceLast = Date.now() - new Date(plaidItem.last_synced_at).getTime();
      if (msSinceLast < MANUAL_SYNC_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((MANUAL_SYNC_COOLDOWN_MS - msSinceLast) / 60000);
        return new Response(
          JSON.stringify({
            error: 'rate_limited',
            message: `Sync available again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
            last_synced_at: plaidItem.last_synced_at,
            retry_after_minutes: minutesLeft,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }
    }

    // Only sync if the user is in an active challenge
    const { data: activeParticipant } = await supabase
      .from('challenge_participants')
      .select('challenge_id, challenges!inner(status)')
      .eq('user_id', user.id)
      .eq('challenges.status', 'active')
      .maybeSingle();

    if (!activeParticipant && !force) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, skipped: 'no_active_challenge' }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // Decrypt access token before use
    const encKey = await getEncKey();
    const accessToken = encKey
      ? await decryptAccessToken(plaidItem.access_token, encKey)
      : plaidItem.access_token;

    // Incremental sync using /transactions/sync with stored cursor
    const { added, modified, removed, nextCursor } = await syncIncremental(
      accessToken,
      plaidItem.cursor ?? null
    );

    const now = new Date().toISOString();

    // Upsert added and modified transactions
    if (added.length + modified.length > 0) {
      const rows = [...added, ...modified].map((tx: any) => ({
        user_id: user.id,
        plaid_transaction_id: tx.transaction_id,
        account_id: tx.account_id,
        amount: tx.amount,
        date: tx.date,
        name: tx.name,
        category: tx.personal_finance_category
          ? [tx.personal_finance_category.primary]
          : (tx.category ?? []),
        pending: tx.pending ?? false,
        item_type: itemType,
      }));

      await supabase
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' });
    }

    // Remove transactions Plaid has deleted or reversed
    if (removed.length > 0) {
      const removedIds = removed.map((tx: any) => tx.transaction_id);
      await supabase
        .from('bank_transactions')
        .delete()
        .in('plaid_transaction_id', removedIds)
        .eq('user_id', user.id);
    }

    // Persist cursor and last_synced_at
    await supabase
      .from('plaid_items')
      .update({ cursor: nextCursor, last_synced_at: now })
      .eq('user_id', user.id)
      .eq('item_type', itemType);

    return new Response(
      JSON.stringify({
        success: true,
        synced: added.length + modified.length,
        removed: removed.length,
        last_synced_at: now,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});

/**
 * Calls /transactions/sync in a loop until has_more is false.
 * Returns the combined added, modified, removed arrays and the final cursor.
 */
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
