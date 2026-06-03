export default function Pricing() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">Simple, honest pricing</h2>
          <p className="text-subtext text-lg max-w-xl mx-auto">
            We don&apos;t take a cut. Every dollar of your buy-in goes to the winner.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          <div className="bg-surface rounded-2xl p-8 border border-primary/40 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-primary" />
            <p className="text-primary text-5xl font-bold mb-2">0%</p>
            <h3 className="text-lg font-semibold text-text mb-3">Tournacent Platform Fee</h3>
            <p className="text-subtext text-sm leading-relaxed">
              We take nothing. The full prize pool goes to the winner. Our revenue model doesn&apos;t
              depend on skimming your winnings.
            </p>
          </div>

          <div className="bg-surface rounded-2xl p-8 border border-border">
            <p className="text-subtext text-sm font-mono mb-2">Stripe Processing</p>
            <p className="text-3xl font-bold text-text mb-2">
              ~2.9% <span className="text-lg text-subtext font-normal">+ $0.30</span>
            </p>
            <h3 className="text-lg font-semibold text-text mb-3">Per Transaction</h3>
            <p className="text-subtext text-sm leading-relaxed">
              Standard Stripe payment processing fee, deducted automatically from each buy-in. This
              is Stripe&apos;s fee, not ours.
            </p>
          </div>
        </div>

        <div className="bg-surface/50 rounded-xl p-6 border border-border text-center">
          <p className="text-xs text-subtext leading-relaxed max-w-2xl mx-auto">
            <strong className="text-text">Disclaimer:</strong> Tournacent is not a bank, financial
            advisor, or money transmitter. All payments are processed by{' '}
            <strong className="text-text">Stripe, Inc.</strong>, a licensed payment service provider.
            Prize pool funds are held by Stripe. Past challenge performance does not guarantee future
            results.
          </p>
        </div>
      </div>
    </section>
  );
}
