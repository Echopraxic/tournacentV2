import WaitlistForm from '@/components/WaitlistForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the Waitlist — Tournacent',
  description: 'Get early access to Tournacent. Financial challenges with friends — real stakes, real accountability.',
};

export default function WaitlistPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="max-w-md w-full text-center">
        <p className="text-4xl mb-6">🏆</p>
        <h1 className="text-3xl font-bold text-text mb-3">Join the Waitlist</h1>
        <p className="text-subtext mb-8 leading-relaxed">
          Be the first to know when Tournacent launches. Financial challenges with real stakes — and
          the full prize pool goes to the winner.
        </p>
        <WaitlistForm />
        <p className="mt-4 text-xs text-subtext">No spam. Launch notification only.</p>
      </div>
    </div>
  );
}
