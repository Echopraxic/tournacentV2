import { readFileSync } from 'fs';
import path from 'path';
import { marked } from 'marked';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Tournacent',
  description: 'How Tournacent collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  const filePath = path.join(process.cwd(), '..', 'PRIVACY_POLICY.md');
  const raw = readFileSync(filePath, 'utf8');
  const html = marked(raw) as string;

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 pt-28">
      <article
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
