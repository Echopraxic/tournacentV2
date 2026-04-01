import { PlaidOAuthHandler } from '@/components/PlaidOAuthHandler';

/**
 * OAuth redirect landing page for Plaid on web.
 * Plaid redirects the user here after they authenticate with their bank.
 * The PlaidOAuthHandler component (web-only) completes the handshake.
 */
export default function PlaidOAuth() {
  return <PlaidOAuthHandler />;
}
