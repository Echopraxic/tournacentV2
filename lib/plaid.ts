import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export interface PlaidMetadata {
  institution?: {
    name: string;
    institution_id: string;
  };
}

export interface LinkedAccount {
  institution_name: string | null;
}

export const plaidApi = {
  /**
   * Creates a Plaid Link token via the Supabase edge function.
   * The token is passed to the PlaidLink component to initialize the Link flow.
   */
  async createLinkToken(): Promise<string> {
    const token = await getAuthToken();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-link-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create link token');
    return data.link_token;
  },

  /**
   * Exchanges the public_token from Plaid Link for a permanent access token.
   * Stores the access token server-side (never exposed to the client).
   */
  async exchangeToken(publicToken: string, metadata: PlaidMetadata): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/exchange-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_token: publicToken,
        institution_name: metadata.institution?.name,
        institution_id: metadata.institution?.institution_id,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to exchange token');
  },

  /**
   * Syncs bank transactions from Plaid into the bank_transactions table.
   * Fetches the last 90 days of transactions.
   * Returns the number of transactions synced.
   */
  async syncTransactions(): Promise<number> {
    const token = await getAuthToken();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to sync transactions');
    return data.synced ?? 0;
  },

  /**
   * Returns whether the current user has a linked bank account via Plaid.
   */
  async isLinked(): Promise<boolean> {
    const { data } = await supabase
      .from('plaid_items')
      .select('id')
      .maybeSingle();
    return !!data;
  },

  /**
   * Returns the linked institution info for the current user.
   */
  async getLinkedAccount(): Promise<LinkedAccount | null> {
    const { data } = await supabase
      .from('plaid_items')
      .select('institution_name')
      .maybeSingle();
    return data ?? null;
  },
};
