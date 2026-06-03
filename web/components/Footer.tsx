import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-subtext text-sm">© 2026 Tournacent. All rights reserved.</p>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/privacy" className="text-subtext hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-subtext hover:text-primary transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
