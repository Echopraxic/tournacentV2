import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { usePlaidLink } from 'react-plaid-link';
import { useRouter } from 'expo-router';
import { plaidApi } from '@/lib/plaid';

/**
 * Handles the OAuth redirect back from the bank on web.
 *
 * Flow:
 *   1. User initiates Plaid Link → selects an OAuth bank
 *   2. Plaid redirects user to bank's auth page
 *   3. Bank redirects back to /plaid-oauth?oauth_state_id=...
 *   4. This component reads the link token from sessionStorage,
 *      re-initializes Plaid with receivedRedirectUri, and lets
 *      Plaid complete the OAuth handshake automatically.
 *   5. On success, exchanges the token and navigates back to the wallet.
 */
export function PlaidOAuthHandler() {
  const router = useRouter();
  const linkToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('plaid_link_token')
      : null;

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? '',
    receivedRedirectUri:
      typeof window !== 'undefined' ? window.location.href : undefined,
    onSuccess: async (publicToken, metadata) => {
      sessionStorage.removeItem('plaid_link_token');
      try {
        await plaidApi.exchangeToken(publicToken, metadata as any);
        await plaidApi.syncTransactions(true);
      } catch {
        // Best-effort — wallet page will reflect state on next load
      }
      router.replace('/(tabs)/wallet');
    },
    onExit: () => {
      router.replace('/(tabs)/wallet');
    },
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  if (!linkToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Session expired. Please return to the app and try connecting your bank again.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Connection error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={styles.text}>Completing bank connection...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: '#ffffff',
  },
  text: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
    lineHeight: 22,
  },
});
