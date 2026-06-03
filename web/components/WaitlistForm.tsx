'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type Status = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;
    setStatus('loading');

    const { error } = await getSupabase().from('waitlist_emails').insert({ email });

    if (!error) {
      setStatus('success');
    } else if (error.code === '23505') {
      setStatus('duplicate');
    } else {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center">
        <p className="text-2xl font-bold text-primary mb-2">You&apos;re on the list!</p>
        <p className="text-subtext">We&apos;ll reach out when Tournacent launches. Get your finances ready.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-text placeholder-subtext focus:outline-none focus:border-primary text-sm"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-6 py-3 rounded-xl bg-primary text-bg font-semibold text-sm hover:bg-primary-muted transition-colors disabled:opacity-60 whitespace-nowrap"
      >
        {status === 'loading' ? 'Joining...' : 'Get Early Access'}
      </button>
      {status === 'duplicate' && (
        <p className="w-full text-center text-sm text-subtext mt-1">You&apos;re already on the list!</p>
      )}
      {status === 'error' && (
        <p className="w-full text-center text-sm text-danger mt-1">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
