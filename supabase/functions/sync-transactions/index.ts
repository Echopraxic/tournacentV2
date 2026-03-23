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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    // Fetch user's Plaid access token
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (itemError || !plaidItem) {
      return new Response(JSON.stringify({ error: 'No linked bank account found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Fetch transactions from the last 90 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const txResponse = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: plaidItem.access_token,
        start_date: startDate,
        end_date: endDate,
        options: { count: 500, include_personal_finance_category: true },
      }),
    });

    const txData = await txResponse.json();

    if (!txResponse.ok) {
      throw new Error(txData.error_message || 'Failed to fetch transactions');
    }

    const transactions: any[] = txData.transactions ?? [];

    if (transactions.length > 0) {
      const rows = transactions.map((tx: any) => ({
        user_id: user.id,
        plaid_transaction_id: tx.transaction_id,
        account_id: tx.account_id,
        // Plaid: positive = debit (money leaving), negative = credit (money entering)
        amount: tx.amount,
        date: tx.date,
        name: tx.name,
        category: tx.category ?? [],
        pending: tx.pending ?? false,
      }));

      const { error: upsertError } = await supabase
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' });

      if (upsertError) {
        throw new Error(upsertError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: transactions.length }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
