import { readFileSync } from 'fs';
import path from 'path';
import { marked } from 'marked';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Tournacent',
  description: 'Tournacent Terms of Service — rules for challenges, payments, and account use.',
};

export default function TermsPage() {
  const filePath = path.join(process.cwd(), 'content', 'terms.md');
  const raw = readFileSync(filePath, 'utf8');
  const html = marked(raw) as string;

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 pt-28">
      <article
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
