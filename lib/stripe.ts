import { supabase } from '@/lib/supabase';

export const stripeApi = {
  async createPaymentIntent(challengeId: string): Promise<{ client_secret: string; payment_intent_id: string }> {
    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: { challenge_id: challengeId },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async createStripeAccount(): Promise<{ url: string; account_id: string }> {
    const { data, error } = await supabase.functions.invoke('create-stripe-account', {
      body: {},
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async getStripeAccountStatus(): Promise<{ stripe_account_id: string | null; stripe_onboarding_complete: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { stripe_account_id: null, stripe_onboarding_complete: false };

    const { data } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('id', user.id)
      .single();

    return {
      stripe_account_id: data?.stripe_account_id ?? null,
      stripe_onboarding_complete: data?.stripe_onboarding_complete ?? false,
    };
  },
};
