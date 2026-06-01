import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Snapshot webhook secret — payment_intent.succeeded / payment_failed
const SNAPSHOT_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
// Thin webhook secret — v2.core.account.updated (thin events only)
const THIN_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET_THIN')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  // Determine which webhook this came from by trying each secret in turn.
  // Each endpoint has a unique signing secret, so only the right one will verify.
  let event: Stripe.Event | null = null;
  let isThinEvent = false;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, SNAPSHOT_SECRET);
  } catch {
    // not from the snapshot endpoint — try the thin endpoint
  }

  if (!event && THIN_SECRET) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, THIN_SECRET);
      isThinEvent = true;
    } catch {
      // neither secret matched
    }
  }

  if (!event) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // ── Snapshot events (v1) ────────────────────────────────────────────────
    if (!isThinEvent) {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const { challenge_id, user_id } = pi.metadata;
          if (!challenge_id || !user_id) break;

          // Atomic + idempotent: marks paid, increments prize pool, and records
          // the transaction in a single DB transaction. Duplicate webhook
          // deliveries return false and have no effect (no double-count).
          const { error: rpcError } = await supabase.rpc('record_buyin_payment', {
            p_challenge_id: challenge_id,
            p_user_id: user_id,
          });
          if (rpcError) throw new Error(rpcError.message);

          break;
        }

        case 'payment_intent.payment_failed': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const { challenge_id, user_id } = pi.metadata;
          if (!challenge_id || !user_id) break;

          await supabase.from('transactions').insert({
            user_id,
            challenge_id,
            amount: pi.amount / 100,
            transaction_type: 'buy_in',
            status: 'denied',
            denial_reason: pi.last_payment_error?.message ?? 'Payment failed',
          });

          break;
        }
      }
    }

    // ── Thin events (v2) ────────────────────────────────────────────────────
    if (isThinEvent) {
      switch (event.type) {
        case 'v2.core.account.updated': {
          // Thin event — fetch the full account data from Stripe API
          const accountId = (event.data as any)?.object?.id ?? (event as any).related_object?.id;
          if (!accountId) break;

          const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
            headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET')}` },
          });
          const account = await accountRes.json() as Stripe.Account;

          const isComplete =
            account.charges_enabled &&
            account.payouts_enabled &&
            !account.requirements?.currently_due?.length;

          if (isComplete) {
            await supabase
              .from('profiles')
              .update({ stripe_onboarding_complete: true })
              .eq('stripe_account_id', account.id);

            // Just-in-time payout: now that this user can receive transfers,
            // process any winnings left pending because they had no payout
            // account when their challenge(s) completed. Re-trigger payout-winner
            // for each such challenge (fire-and-forget; payout-winner is idempotent).
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('stripe_account_id', account.id)
              .maybeSingle();

            if (profile) {
              const { data: pending } = await supabase
                .from('transactions')
                .select('challenge_id')
                .eq('user_id', profile.id)
                .eq('transaction_type', 'payout')
                .eq('status', 'pending')
                .is('stripe_transfer_id', null);

              const challengeIds = [...new Set((pending ?? []).map((p: any) => p.challenge_id))];
              for (const cid of challengeIds) {
                fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/payout-winner`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({ challenge_id: cid }),
                }).catch(() => {});
              }
            }
          }
          break;
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('stripe-webhook handler error:', error.message);
    // Return 500 so Stripe retries (exponential backoff). The handlers are
    // idempotent, so a retry of an already-processed event is a safe no-op,
    // while a transient DB failure no longer silently drops a paid buy-in.
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
