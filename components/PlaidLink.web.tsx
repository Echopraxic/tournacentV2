import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { usePlaidLink } from 'react-plaid-link';
import type { PlaidMetadata } from '@/lib/plaid';

interface PlaidLinkProps {
  linkToken: string;
  onSuccess: (publicToken: string, metadata: PlaidMetadata) => void;
  onExit: () => void;
}

/**
 * Web implementation of PlaidLink using react-plaid-link.
 * Metro automatically serves this file over PlaidLink.tsx on web builds.
 *
 * Stores the link token in sessionStorage so the OAuth redirect page
 * (/plaid-oauth) can re-initialize Plaid after the bank redirects back.
 */
export function PlaidLink({ linkToken, onSuccess, onExit }: PlaidLinkProps) {
  // Persist token for OAuth redirect flow
  useEffect(() => {
    sessionStorage.setItem('plaid_link_token', linkToken);
    return () => sessionStorage.removeItem('plaid_link_token');
  }, [linkToken]);

  const receivedRedirectUri =
    typeof window !== 'undefined' &&
    window.location.search.includes('oauth_state_id')
      ? window.location.href
      : undefined;

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: (publicToken, metadata) => {
      sessionStorage.removeItem('plaid_link_token');
      onSuccess(publicToken, metadata as unknown as PlaidMetadata);
    },
    onExit: () => onExit(),
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={styles.text}>
        {ready ? 'Opening bank connection...' : 'Loading Plaid...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
  },
  text: {
    fontSize: 16,
    color: '#6B7280',
  },
});
