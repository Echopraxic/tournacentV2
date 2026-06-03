import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import ChallengeGrid from '@/components/ChallengeGrid';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import WaitlistForm from '@/components/WaitlistForm';

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ChallengeGrid />
      <Pricing />
      <FAQ />

      <section id="waitlist" className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
            Ready to win at money?
          </h2>
          <p className="text-subtext text-lg mb-8">
            Join the waitlist and be the first to know when we launch.
          </p>
          <WaitlistForm />
        </div>
      </section>
    </>
  );
}
