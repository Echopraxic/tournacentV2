const steps = [
  {
    number: '01',
    title: 'Pick a Challenge',
    description:
      'Choose from 6 expert-designed financial challenges — emergency savings, debt payoff, no-spend resets, bill negotiation, and more. Go solo or compete in a group of 3+.',
    icon: '🎯',
  },
  {
    number: '02',
    title: 'Compete with Real Accountability',
    description:
      'Every task uses verified evidence: Plaid bank data for savings and debt payments, photo uploads for negotiations, quizzes for education, and counters for daily habits.',
    icon: '🔬',
  },
  {
    number: '03',
    title: 'Win the Prize Pool',
    description:
      'The leaderboard ranks every participant by points. When the challenge ends, the top scorer wins the full buy-in pool — paid out automatically via Stripe to their bank.',
    icon: '🏆',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">How it works</h2>
          <p className="text-subtext text-lg max-w-xl mx-auto">
            Three steps from signup to payout.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative bg-surface rounded-2xl p-8 border border-border">
              <span className="text-4xl mb-4 block">{step.icon}</span>
              <span className="text-xs font-mono text-primary mb-2 block">{step.number}</span>
              <h3 className="text-xl font-semibold text-text mb-3">{step.title}</h3>
              <p className="text-subtext text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
