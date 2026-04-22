export interface QuizChoice {
  id: string;
  text: string;
  score: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  choices: QuizChoice[];
}

export interface QuizProfile {
  label: string;
  description: string;
  color: string;
  minScore: number;
  maxScore: number;
}

export interface QuizDefinition {
  id: string;
  title: string;
  questions: QuizQuestion[];
  profiles: QuizProfile[];
}

export function scoreToProfile(
  quiz: QuizDefinition,
  totalScore: number
): QuizProfile {
  return (
    quiz.profiles.find(p => totalScore >= p.minScore && totalScore <= p.maxScore) ??
    quiz.profiles[0]
  );
}

// ─── Risk Assessment Quiz ─────────────────────────────────────────────────────

const RISK_ASSESSMENT: QuizDefinition = {
  id: 'risk_assessment',
  title: 'Investment Risk Assessment',
  questions: [
    {
      id: 'q1',
      text: "How long do you plan to keep your money invested before you'll need it?",
      choices: [
        { id: 'q1a', text: 'Less than 2 years', score: 1 },
        { id: 'q1b', text: '2–5 years', score: 2 },
        { id: 'q1c', text: '5–10 years', score: 3 },
        { id: 'q1d', text: 'More than 10 years', score: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Your portfolio drops 20% in a single month. What do you do?',
      choices: [
        { id: 'q2a', text: 'Sell everything and move to cash', score: 1 },
        { id: 'q2b', text: 'Sell some holdings to reduce exposure', score: 2 },
        { id: 'q2c', text: 'Hold steady and wait for recovery', score: 3 },
        { id: 'q2d', text: 'Buy more while prices are low', score: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'What is your primary investment goal?',
      choices: [
        { id: 'q3a', text: 'Preserve capital — avoid any loss', score: 1 },
        { id: 'q3b', text: 'Steady income with minimal volatility', score: 2 },
        { id: 'q3c', text: 'Balanced growth and income over time', score: 3 },
        { id: 'q3d', text: 'Maximum long-term growth', score: 4 },
      ],
    },
    {
      id: 'q4',
      text: 'How stable is your current income?',
      choices: [
        { id: 'q4a', text: 'Very unstable — irregular or uncertain', score: 1 },
        { id: 'q4b', text: 'Somewhat unstable — varies significantly', score: 2 },
        { id: 'q4c', text: 'Mostly stable with occasional dips', score: 3 },
        { id: 'q4d', text: 'Very stable — consistent and predictable', score: 4 },
      ],
    },
    {
      id: 'q5',
      text: 'How would you describe your investment experience?',
      choices: [
        { id: 'q5a', text: "None — I'm just starting out", score: 1 },
        { id: 'q5b', text: 'Limited — savings account or CDs only', score: 2 },
        { id: 'q5c', text: "Moderate — I've held stocks or mutual funds", score: 3 },
        { id: 'q5d', text: 'Experienced — I actively manage a diversified portfolio', score: 4 },
      ],
    },
    {
      id: 'q6',
      text: 'What is the maximum annual loss you could accept without losing sleep?',
      choices: [
        { id: 'q6a', text: 'Any loss would be unacceptable', score: 1 },
        { id: 'q6b', text: 'Up to 5%', score: 2 },
        { id: 'q6c', text: 'Up to 15%', score: 3 },
        { id: 'q6d', text: 'More than 20% if the long-term upside is there', score: 4 },
      ],
    },
    {
      id: 'q7',
      text: 'You invested $10,000 and it falls to $7,000. What do you do?',
      choices: [
        { id: 'q7a', text: 'Sell and move to something safer', score: 1 },
        { id: 'q7b', text: 'Sell part of it to cut losses', score: 2 },
        { id: 'q7c', text: 'Do nothing and wait for recovery', score: 3 },
        { id: 'q7d', text: 'Invest more at the lower price', score: 4 },
      ],
    },
    {
      id: 'q8',
      text: 'Do you have an emergency fund to cover 3–6 months of expenses?',
      choices: [
        { id: 'q8a', text: 'No emergency fund at all', score: 1 },
        { id: 'q8b', text: "Less than 1 month's expenses saved", score: 2 },
        { id: 'q8c', text: '1–3 months covered', score: 3 },
        { id: 'q8d', text: 'Fully funded — 3–6+ months covered', score: 4 },
      ],
    },
    {
      id: 'q9',
      text: 'Which investment scenario sounds most appealing to you?',
      choices: [
        { id: 'q9a', text: 'Guaranteed 3% return with zero chance of loss', score: 1 },
        { id: 'q9b', text: 'Likely 6% return with a small chance of a 2% loss', score: 2 },
        { id: 'q9c', text: 'Likely 10% return with a chance of an 8% loss', score: 3 },
        { id: 'q9d', text: 'Likely 15% return with a chance of a 20% loss', score: 4 },
      ],
    },
    {
      id: 'q10',
      text: 'If your investments lost significant value, how long could you wait for them to recover before needing the money?',
      choices: [
        { id: 'q10a', text: "I can't wait at all — I need the money soon", score: 1 },
        { id: 'q10b', text: 'Up to 1 year', score: 2 },
        { id: 'q10c', text: '2–4 years', score: 3 },
        { id: 'q10d', text: '5 or more years', score: 4 },
      ],
    },
  ],
  // Score range: 10 (all 1s) – 40 (all 4s), split into 5 profiles of 6 pts each
  profiles: [
    {
      label: 'Conservative',
      description:
        'Capital preservation is your top priority. You prefer stable, low-risk vehicles like bonds, CDs, and money market funds — even if it means lower returns.',
      color: '#3B82F6',
      minScore: 10,
      maxScore: 15,
    },
    {
      label: 'Moderately Conservative',
      description:
        'You value stability but are willing to accept modest risk for slightly better returns. A mix of bonds with a small equity allocation suits you well.',
      color: '#8B5CF6',
      minScore: 16,
      maxScore: 21,
    },
    {
      label: 'Moderate',
      description:
        'You seek a balance between growth and stability. A diversified portfolio of stocks and bonds helps you grow wealth while managing short-term swings.',
      color: '#F59E0B',
      minScore: 22,
      maxScore: 27,
    },
    {
      label: 'Moderately Aggressive',
      description:
        'Growth is your primary focus and you can tolerate meaningful short-term losses. A stock-heavy portfolio with some diversification fits your profile.',
      color: '#F97316',
      minScore: 28,
      maxScore: 33,
    },
    {
      label: 'Aggressive Growth',
      description:
        "You're focused on maximum long-term returns and can absorb significant volatility. Equities, growth funds, and higher-risk assets are well-suited to your goals.",
      color: '#EF4444',
      minScore: 34,
      maxScore: 40,
    },
  ],
};

export const QUIZZES: Record<string, QuizDefinition> = {
  risk_assessment: RISK_ASSESSMENT,
};
