declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      // Plaid environment for display purposes ('sandbox' | 'development' | 'production')
      // Plaid secrets (PLAID_CLIENT_ID, PLAID_SECRET) are set as Supabase Edge Function secrets
      // and are never exposed to the client.
      EXPO_PUBLIC_PLAID_ENV?: string;
    }
  }
}

export {};
