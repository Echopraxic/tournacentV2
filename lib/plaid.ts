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
  last_synced_at: string | null;
}

export interface SyncResult {
  synced: number;
  removed: number;
  last_synced_at: string;
}

export const plaidApi = {
  /**
   * Creates a Plaid Link token via the Supabase edge function.
   * The token is passed to the PlaidLink component to initialize the Link flow.
   */
  async createLinkToken(): Promise<string> {
    const token = await getAuthToken();

    // On web, send redirect_uri so Plaid can support OAuth banks.
    // The URI must be registered in your Plaid dashboard before going to production.
    const body: Record<string, string> = {};
    if (typeof window !== 'undefined' && window.location?.origin) {
      body.redirect_uri = `${window.location.origin}/plaid-oauth`;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-link-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}: Failed to create link token`);
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
    if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}: Failed to exchange token`);
  },

  /**
   * Syncs bank transactions incrementally using the stored cursor.
   * Passes force=true to bypass the 1-hour cooldown (used immediately after linking).
   */
  async syncTransactions(force = false): Promise<SyncResult> {
    const token = await getAuthToken();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force }),
    });
    const data = await response.json();
    if (response.status === 429) {
      throw Object.assign(new Error(data.message || 'Rate limited'), {
        rateLimited: true,
        retryAfterMinutes: data.retry_after_minutes ?? null,
        lastSyncedAt: data.last_synced_at ?? null,
      });
    }
    if (!response.ok) throw new Error(data.error || 'Failed to sync transactions');
    return {
      synced: data.synced ?? 0,
      removed: data.removed ?? 0,
      last_synced_at: data.last_synced_at,
    };
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
   * Returns the linked institution info and last sync time for the current user.
   */
  async getLinkedAccount(): Promise<LinkedAccount | null> {
    const { data } = await supabase
      .from('plaid_items')
      .select('institution_name, last_synced_at')
      .maybeSingle();
    return data ?? null;
  },
};
