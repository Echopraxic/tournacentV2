'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'What is Tournacent?',
    a: "Tournacent is a gamified financial accountability app. You join challenges, complete real financial tasks verified by bank data and photos, and compete for a prize pool funded by buy-ins. The highest scorer wins the full pool.",
  },
  {
    q: 'How do buy-ins work?',
    a: "When you join a group challenge, you pay a buy-in (typically $5–$25) via credit or debit card. All participants' buy-ins pool together. The highest-scoring participant at the end of the challenge wins the entire pool, minus Stripe processing fees.",
  },
  {
    q: 'How is task completion verified?',
    a: "Tasks use one of six verification methods: Plaid bank data (savings deposits, debt payments, no-spend streaks), photo uploads (subscriptions canceled, negotiations documented), quizzes, form submissions, habit counters, or text entries. Verification is automated — no human review delays.",
  },
  {
    q: 'What if I drop out of a challenge?',
    a: "If you drop out, your buy-in is forfeited and added to the prize pool for remaining participants. You'll be marked as dropped out on the leaderboard and can no longer submit tasks.",
  },
  {
    q: 'When do I receive my payout?',
    a: "Payouts are initiated within 24 hours of a challenge ending via Stripe Connect. You need to connect a bank account to receive winnings. If you win without a connected account, you'll be prompted to set one up — your funds are held safely until you do.",
  },
  {
    q: 'Is my bank data safe?',
    a: "Bank connections are powered by Plaid, trusted by tens of millions of users. We receive read-only access to transaction data — we cannot move money from your account. All data is encrypted in transit (TLS 1.2+) and at rest.",
  },
  {
    q: 'What devices is Tournacent available on?',
    a: "iOS and Android. The app launches soon — join the waitlist to get notified.",
  },
  {
    q: 'What is the age requirement?',
    a: "You must be at least 13 years old to use Tournacent, in compliance with COPPA. Age is verified at signup.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 px-6 bg-surface/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-border/30 transition-colors"
              >
                <span className="font-medium text-text text-sm">{item.q}</span>
                <span className="text-subtext text-lg ml-4 shrink-0">
                  {open === i ? '−' : '+'}
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-subtext text-sm leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
