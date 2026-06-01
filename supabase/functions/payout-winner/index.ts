import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Called by a Supabase Database Webhook when challenge.status = 'completed'.
// The webhook sends the service role JWT automatically — we verify it here.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the caller is Supabase (service role JWT), not an arbitrary HTTP client
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    // Service role tokens return null user but no error — anon/user tokens return a user object
    // A missing or forged token returns an auth error, which we catch below
    if (authHeader && user) {
      // Regular user JWT — reject, only service role allowed
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Database Webhook sends the full challenge row as the body
    const body = await req.json();
    // Support both direct call ({ challenge_id }) and webhook payload ({ record: { id } })
    const challenge_id: string = body.challenge_id ?? body.record?.id;
    if (!challenge_id) {
      return new Response(JSON.stringify({ error: 'challenge_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Find all pending payout transactions for this challenge
    const { data: payouts, error: payoutsError } = await supabase
      .from('transactions')
      .select('id, user_id, amount')
      .eq('challenge_id', challenge_id)
      .eq('transaction_type', 'payout')
      .eq('status', 'pending')
      .is('stripe_transfer_id', null);

    if (payoutsError) throw new Error(payoutsError.message);
    if (!payouts || payouts.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending payouts' }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const results: { user_id: string; status: string; detail?: string }[] = [];

    for (const payout of payouts) {
      // Look up the winner's Stripe connected account
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', payout.user_id)
        .single();

      if (!profile?.stripe_account_id || !profile.stripe_onboarding_complete) {
        // Winner hasn't set up a payout account — leave as pending so they can claim later
        results.push({ user_id: payout.user_id, status: 'pending_stripe_setup' });
        await supabase
          .from('transactions')
          .update({ status: 'pending' })
          .eq('id', payout.id);
        continue;
      }

      const amountCents = Math.round(payout.amount * 100);

      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: profile.stripe_account_id,
        transfer_group: challenge_id,
        metadata: {
          challenge_id,
          user_id: payout.user_id,
          transaction_id: payout.id,
        },
      });

      await supabase
        .from('transactions')
        .update({ status: 'verified', stripe_transfer_id: transfer.id })
        .eq('id', payout.id);

      // Notify the winner — fire-and-forget, don't block the response
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          event: 'payout_arrived',
          user_id: payout.user_id,
          amount: payout.amount,
        }),
      }).catch(() => {});

      results.push({ user_id: payout.user_id, status: 'transferred', detail: transfer.id });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
