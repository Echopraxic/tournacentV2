import WaitlistForm from './WaitlistForm';

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface text-subtext text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Early Access — Join the Waitlist
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-text leading-tight mb-6">
          Win at your{' '}
          <span className="text-primary">finances.</span>
        </h1>

        <p className="text-lg text-subtext leading-relaxed mb-10 max-w-xl mx-auto">
          Financial challenges with friends — real stakes, real accountability.
          Complete verified tasks, climb the leaderboard, and take home the prize pool.
        </p>

        <WaitlistForm />

        <p className="mt-4 text-xs text-subtext">No spam. We&apos;ll only reach out when we launch.</p>

        <div className="mt-16 grid grid-cols-3 gap-6 max-w-sm mx-auto">
          {[
            { value: '6', label: 'Preset Challenges' },
            { value: '0%', label: 'Platform Fee' },
            { value: '7', label: 'Verification Methods' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-primary">{value}</p>
              <p className="text-xs text-subtext mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
