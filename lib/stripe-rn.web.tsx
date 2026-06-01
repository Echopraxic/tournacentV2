// Web stub for Stripe React Native. The native SDK imports react-native
// internals that don't exist on web, which crashes the web bundle. Stripe's
// in-app PaymentSheet is mobile-only anyway, so on web we render children
// untouched and surface a clear "mobile only" error if a payment is attempted.
import React from 'react';

type StripeError = { error: { message: string } };

const UNSUPPORTED: StripeError = {
  error: { message: 'Payments are only available in the Tournacent mobile app.' },
};

export function StripeProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function usePaymentSheet() {
  return {
    loading: false,
    initPaymentSheet: async (): Promise<StripeError> => UNSUPPORTED,
    presentPaymentSheet: async (): Promise<StripeError> => UNSUPPORTED,
    resetPaymentSheetCustomer: async (): Promise<void> => {},
  };
}
