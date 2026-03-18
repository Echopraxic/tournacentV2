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

    const { public_token, institution_name, institution_id } = await req.json();

    if (!public_token) {
      return new Response(JSON.stringify({ error: 'public_token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Exchange public_token for access_token
    const exchangeResponse = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });

    const exchangeData = await exchangeResponse.json();

    if (!exchangeResponse.ok) {
      throw new Error(exchangeData.error_message || 'Failed to exchange token');
    }

    const { access_token, item_id } = exchangeData;

    // Upsert plaid item — one linked account per user
    const { error: upsertError } = await supabase
      .from('plaid_items')
      .upsert(
        {
          user_id: user.id,
          access_token,
          item_id,
          institution_name: institution_name ?? null,
          institution_id: institution_id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return new Response(JSON.stringify({ success: true, item_id }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
