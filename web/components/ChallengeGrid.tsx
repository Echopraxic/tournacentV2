import { CHALLENGES } from '@/lib/presets';

export default function ChallengeGrid() {
  return (
    <section className="py-20 px-6 bg-surface/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">Six challenges, zero excuses</h2>
          <p className="text-subtext text-lg max-w-xl mx-auto">
            Every challenge is designed by financial experts with tasks that build real habits.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CHALLENGES.map((challenge) => (
            <div
              key={challenge.id}
              className="bg-surface rounded-2xl p-6 border border-border hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{challenge.emoji}</span>
                <span className="text-xs text-subtext bg-bg px-3 py-1 rounded-full">
                  {challenge.duration_days}d · ${challenge.buy_in_amount} buy-in
                </span>
              </div>

              <h3 className="text-base font-semibold text-text mb-2 group-hover:text-primary transition-colors">
                {challenge.name}
              </h3>
              <p className="text-subtext text-sm mb-4 leading-relaxed">{challenge.tagline}</p>

              <ul className="space-y-1.5">
                {challenge.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-xs text-subtext">
                    <span className="text-primary">✓</span>
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-subtext">
                <span>{challenge.task_count} tasks</span>
                <span className="text-primary font-medium">Coming soon →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
