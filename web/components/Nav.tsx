'use client';

import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight text-primary">
          Tournacent
        </Link>
        <a
          href="#waitlist"
          className="px-5 py-2 rounded-full text-sm font-semibold bg-primary text-bg hover:bg-primary-muted transition-colors"
        >
          Join Waitlist
        </a>
      </div>
    </nav>
  );
}
