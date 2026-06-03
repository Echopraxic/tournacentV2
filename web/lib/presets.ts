export interface MarketingChallenge {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  duration_days: number;
  buy_in_amount: number;
  task_count: number;
  highlights: string[];
}

export const CHALLENGES: MarketingChallenge[] = [
  {
    id: 'emergency-fund-sprint',
    name: '30-Day Emergency Fund Sprint',
    emoji: '🛡️',
    tagline: 'Build your safety net with verified savings milestones.',
    duration_days: 30,
    buy_in_amount: 10,
    task_count: 10,
    highlights: ['Plaid-verified deposits', 'No-impulse-buy streak', 'Automate savings'],
  },
  {
    id: 'no-spend-reset',
    name: 'No-Spend Reset',
    emoji: '🔒',
    tagline: 'Cut spending in 3 custom categories for 21 days.',
    duration_days: 21,
    buy_in_amount: 5,
    task_count: 7,
    highlights: ['Bank-verified streaks', 'Cook-at-home counter', 'Save $150+'],
  },
  {
    id: 'debt-destroyer-sprint',
    name: 'Debt Destroyer Sprint',
    emoji: '💥',
    tagline: 'Eliminate debt with Plaid-verified payoff milestones.',
    duration_days: 30,
    buy_in_amount: 25,
    task_count: 11,
    highlights: ['Track $500+ payoff', 'Negotiate lower APR', '21-day spending freeze'],
  },
  {
    id: 'investment-starter',
    name: 'Investment Starter',
    emoji: '📈',
    tagline: 'Open and fund an investment account with guided tasks.',
    duration_days: 30,
    buy_in_amount: 20,
    task_count: 14,
    highlights: ['Risk assessment quiz', 'Invest $300+', 'Automate contributions'],
  },
  {
    id: 'bill-negotiation-blitz',
    name: 'Bill Negotiation Blitz',
    emoji: '📞',
    tagline: 'Call providers, negotiate rates, and document every win.',
    duration_days: 30,
    buy_in_amount: 15,
    task_count: 12,
    highlights: ['Script your calls', 'Secure 2+ wins', 'Calculate annual savings'],
  },
  {
    id: 'mini-rate-check',
    name: 'Mini Rate Check Sprint',
    emoji: '⚡',
    tagline: 'Quick wins — negotiate 2+ subscriptions in 7 days.',
    duration_days: 7,
    buy_in_amount: 5,
    task_count: 10,
    highlights: ['Research competitor rates', 'Negotiate or cancel', 'Automate savings'],
  },
];
