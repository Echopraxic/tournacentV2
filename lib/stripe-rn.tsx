// Native (iOS/Android) entry point for Stripe React Native.
// Metro resolves this file on native and `stripe-rn.web.tsx` on web, so the
// native-only @stripe/stripe-react-native module never enters the web bundle.
// Named .tsx (not .ts) so Metro's platform-extension resolution prefers
// `stripe-rn.web.tsx` on web — the same pattern used by PlaidLink.
export { StripeProvider, usePaymentSheet } from '@stripe/stripe-react-native';
