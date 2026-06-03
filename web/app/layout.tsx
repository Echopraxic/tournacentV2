import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { Analytics } from '@vercel/analytics/next';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'Tournacent — Win at your finances',
  description:
    'Financial challenges with friends. Complete verified tasks, climb the leaderboard, and win the prize pool. Join the waitlist for early access.',
  metadataBase: new URL('https://tournacent.com'),
  openGraph: {
    title: 'Tournacent — Win at your finances',
    description: 'Financial challenges with friends — real stakes, real accountability.',
    url: 'https://tournacent.com',
    siteName: 'Tournacent',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tournacent — Win at your finances',
    description: 'Financial challenges with friends — real stakes, real accountability.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
