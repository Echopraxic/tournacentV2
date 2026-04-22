export type TaskType =
  | 'savings'
  | 'no_spend'
  | 'no_spend_declare'
  | 'budget'
  | 'tracking'
  | 'cooking'
  | 'subscription'
  | 'reading'
  | 'debt_payment'
  | 'investment'
  | 'negotiation'
  | 'custom';

export type VerificationType =
  | 'plaid'
  | 'photo'
  | 'self_report'
  | 'form'
  | 'quiz'
  | 'counter'
  | 'text';

export interface PresetTask {
  title: string;
  description: string;
  points: number;
  is_mandatory: boolean;
  task_type: TaskType;
  verification_type: VerificationType;
  form_id?: string;
}

export interface PresetChallenge {
  id: string;
  name: string;
  duration_days: number;
  buy_in_amount: number;
  tasks: PresetTask[];
}

export const PRESET_CHALLENGES: PresetChallenge[] = [
  {
    id: 'emergency-fund-sprint',
    name: '30-Day Emergency Fund Sprint',
    duration_days: 30,
    buy_in_amount: 10.00,
    tasks: [
      {
        title: 'Connect Savings Account',
        description: 'Link your savings account to the app',
        points: 20,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'self_report',
      },
      {
        title: 'Set Emergency Fund Goal',
        description: 'Set your emergency fund target amount in the app',
        points: 10,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'self_report',
      },
      {
        title: 'Deposit at Least $25',
        description: 'Make your first deposit of $25 or more',
        points: 20,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'plaid',
      },
      {
        title: 'Deposit at Least $100 Total',
        description: 'Reach a total deposit balance of $100',
        points: 40,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'plaid',
      },
      {
        title: 'Deposit at Least $250 Total',
        description: 'Reach a total deposit balance of $250',
        points: 60,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'plaid',
      },
      {
        title: '7-Day Expense Tracking Streak',
        description: 'Log your expenses every day for 7 consecutive days',
        points: 30,
        is_mandatory: false,
        task_type: 'tracking',
        verification_type: 'plaid',
      },
      {
        title: 'Cancel One Subscription',
        description: 'Identify and cancel at least one unused subscription service',
        points: 25,
        is_mandatory: false,
        task_type: 'subscription',
        verification_type: 'photo',
      },
      {
        title: 'Automate Weekly Transfer',
        description: 'Set up automatic weekly transfers to your savings account',
        points: 40,
        is_mandatory: false,
        task_type: 'savings',
        verification_type: 'self_report',
      },
      {
        title: 'Watch Savings Fundamentals Lesson',
        description: 'Complete a personal finance education module',
        points: 20,
        is_mandatory: false,
        task_type: 'reading',
        verification_type: 'self_report',
      },
      {
        title: '14-Day No-Impulse-Buy Streak',
        description: 'Avoid impulse purchases over $20 for 14 consecutive days',
        points: 35,
        is_mandatory: false,
        task_type: 'no_spend',
        verification_type: 'plaid',
      },
    ],
  },
  {
    id: 'debt-destroyer-sprint',
    name: 'Debt Destroyer Sprint',
    duration_days: 30,
    buy_in_amount: 25.00,
    tasks: [
      {
        title: 'Connect Debt Account',
        description: 'Link your credit card or loan account via Plaid to enable balance monitoring',
        points: 25,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'self_report',
      },
      {
        title: 'Calculate Interest Cost',
        description: 'Input your APR to see your monthly interest cost and target payoff amount',
        points: 15,
        is_mandatory: true,
        task_type: 'budget',
        verification_type: 'form',
        form_id: 'apr_calculator',
      },
      {
        title: 'Pay $100 Toward Debt',
        description: 'Submit your first $100 payment to your target debt account',
        points: 30,
        is_mandatory: true,
        task_type: 'debt_payment',
        verification_type: 'plaid',
      },
      {
        title: 'Pay $500 Total Toward Debt',
        description: 'Accumulate $500 in net principal payments on your target account',
        points: 50,
        is_mandatory: true,
        task_type: 'debt_payment',
        verification_type: 'plaid',
      },
      {
        title: 'Pay Off One Debt Completely',
        description: 'Reach a zero balance on your smallest debt account within 30 days',
        points: 100,
        is_mandatory: true,
        task_type: 'debt_payment',
        verification_type: 'plaid',
      },
      {
        title: '21-Day Spending Freeze Streak',
        description: 'Zero discretionary spending for 21 consecutive days',
        points: 40,
        is_mandatory: false,
        task_type: 'no_spend',
        verification_type: 'plaid',
      },
      {
        title: 'Negotiate Lower APR',
        description: 'Call your issuer and upload a screenshot confirming your new lower rate',
        points: 35,
        is_mandatory: false,
        task_type: 'subscription',
        verification_type: 'photo',
      },
      {
        title: 'Side Hustle $200+',
        description: 'Earn extra income and upload a deposit screenshot, invoice, or payment proof',
        points: 50,
        is_mandatory: false,
        task_type: 'custom',
        verification_type: 'photo',
      },
      {
        title: 'Cut 3 Monthly Bills',
        description: 'Reduce or cancel 3 recurring services and upload cancellation confirmations',
        points: 30,
        is_mandatory: false,
        task_type: 'subscription',
        verification_type: 'photo',
      },
      {
        title: 'Debt Avalanche Calculation',
        description: 'Input all your debts to generate a prioritized payoff order by interest rate',
        points: 25,
        is_mandatory: false,
        task_type: 'budget',
        verification_type: 'form',
        form_id: 'debt_avalanche',
      },
      {
        title: 'No-New-Debt 30 Days',
        description: 'Zero new credit applications or hard inquiries throughout the entire challenge',
        points: 45,
        is_mandatory: false,
        task_type: 'custom',
        verification_type: 'self_report',
      },
    ],
  },
  {
    id: 'investment-starter',
    name: 'Investment Starter Challenge',
    duration_days: 30,
    buy_in_amount: 20.00,
    tasks: [
      {
        title: 'Complete Risk Assessment Quiz',
        description: 'Answer 10 questions about your risk tolerance to determine your investment profile',
        points: 20,
        is_mandatory: true,
        task_type: 'reading',
        verification_type: 'quiz',
        form_id: 'risk_assessment',
      },
      {
        title: 'Open Investment Account',
        description: 'Create a brokerage or retirement account (IRA/401k) and upload a screenshot of confirmation',
        points: 30,
        is_mandatory: true,
        task_type: 'custom',
        verification_type: 'photo',
      },
      {
        title: 'Connect Investment Account',
        description: 'Link your brokerage or retirement account via Plaid or manual connection',
        points: 25,
        is_mandatory: true,
        task_type: 'savings',
        verification_type: 'self_report',
      },
      {
        title: 'Set Investment Goal',
        description: 'Define your target investment amount and timeline of 5+ years',
        points: 15,
        is_mandatory: true,
        task_type: 'budget',
        verification_type: 'form',
        form_id: 'investment_goal',
      },
      {
        title: 'Invest $100 Initial',
        description: 'Transfer and invest your first $100 into your account (must be invested, not cash)',
        points: 35,
        is_mandatory: true,
        task_type: 'investment',
        verification_type: 'photo',
      },
      {
        title: 'Automate Monthly Contribution',
        description: 'Set up a recurring auto-deposit of $50 or more per month',
        points: 50,
        is_mandatory: true,
        task_type: 'investment',
        verification_type: 'photo',
      },
      {
        title: 'Invest $300 Total',
        description: 'Reach $300 in total invested contributions by day 30',
        points: 60,
        is_mandatory: true,
        task_type: 'investment',
        verification_type: 'photo',
      },
      {
        title: 'Read "Investing 101" Lesson',
        description: 'Complete the educational module and quiz on investment fundamentals',
        points: 25,
        is_mandatory: false,
        task_type: 'reading',
        verification_type: 'self_report',
      },
      {
        title: 'Research & Select 3 ETFs',
        description: 'Document 3 ETF ticker symbols with a 50-word rationale for each selection',
        points: 30,
        is_mandatory: false,
        task_type: 'reading',
        verification_type: 'form',
        form_id: 'etf_research',
      },
      {
        title: '30-Day Market News Fast',
        description: 'Avoid checking portfolio or stock prices for the entire 30-day challenge',
        points: 35,
        is_mandatory: false,
        task_type: 'custom',
        verification_type: 'self_report',
      },
      {
        title: 'Increase Auto-Contribution to $100',
        description: 'Raise your recurring deposit to $100 or more per month',
        points: 40,
        is_mandatory: false,
        task_type: 'investment',
        verification_type: 'photo',
      },
      {
        title: 'Invest $600 Total',
        description: 'Reach $600 in total invested contributions by day 30',
        points: 50,
        is_mandatory: false,
        task_type: 'investment',
        verification_type: 'photo',
      },
      {
        title: 'Join Investment Community Discussion',
        description: 'Post a question or insight (50+ words) in a community investment forum',
        points: 20,
        is_mandatory: false,
        task_type: 'custom',
        verification_type: 'text',
      },
      {
        title: 'Calculate Compound Growth Projection',
        description: 'Use the in-app calculator and screenshot your 10-year compound growth projection',
        points: 25,
        is_mandatory: false,
        task_type: 'budget',
        verification_type: 'form',
        form_id: 'compound_growth',
      },
    ],
  },
  {
    id: 'bill-negotiation-blitz',
    name: 'Bill Negotiation Blitz',
    duration_days: 30,
    buy_in_amount: 15.00,
    tasks: [
      {
        title: 'Complete Bill Audit Worksheet',
        description: 'List all recurring bills with provider names, current rates, and contract end dates (5+ bills required)',
        points: 20,
        is_mandatory: true,
        task_type: 'budget',
        verification_type: 'form',
        form_id: 'bill_audit',
      },
      {
        title: 'Research Market Rates',
        description: 'Find competitor pricing for 3+ services and upload screenshots with URLs',
        points: 25,
        is_mandatory: true,
        task_type: 'reading',
        verification_type: 'photo',
      },
      {
        title: 'Script Your First Call',
        description: 'Write a 60-second negotiation opener and save it in the app',
        points: 15,
        is_mandatory: true,
        task_type: 'custom',
        verification_type: 'text',
      },
      {
        title: 'Make First Negotiation Call',
        description: 'Call a provider and attempt a rate reduction — upload a screenshot of the call log with date, provider, and outcome',
        points: 35,
        is_mandatory: true,
        task_type: 'negotiation',
        verification_type: 'photo',
      },
      {
        title: 'Secure First Win',
        description: 'Get any rate reduction or credit applied — upload screenshot of confirmation email or new rate',
        points: 50,
        is_mandatory: true,
        task_type: 'negotiation',
        verification_type: 'photo',
      },
      {
        title: 'Negotiate Second Bill',
        description: 'Call a different provider category and upload call log with outcome documentation',
        points: 40,
        is_mandatory: true,
        task_type: 'negotiation',
        verification_type: 'photo',
      },
      {
        title: 'Document Total Annual Savings',
        description: 'Calculate and submit 12-month savings across all confirmed rate reductions',
        points: 45,
        is_mandatory: true,
        task_type: 'budget',
        verification_type: 'form',
        form_id: 'annual_savings',
      },
      {
        title: 'Negotiate Third Bill',
        description: 'Call an additional provider and upload confirmation of savings',
        points: 45,
        is_mandatory: false,
        task_type: 'negotiation',
        verification_type: 'photo',
      },
      {
        title: 'Threaten to Cancel (Retention Dept)',
        description: 'Escalate a call to the cancellation/retention team and upload proof of result',
        points: 30,
        is_mandatory: false,
        task_type: 'negotiation',
        verification_type: 'photo',
      },
      {
        title: 'Switch Providers for Better Rate',
        description: 'Complete a service transfer to a cheaper provider and upload proof of switch',
        points: 50,
        is_mandatory: false,
        task_type: 'subscription',
        verification_type: 'photo',
      },
      {
        title: 'Negotiate Annual Payment Discount',
        description: 'Switch a monthly bill to annual billing for a discount — upload confirmation of new rate',
        points: 35,
        is_mandatory: false,
        task_type: 'negotiation',
        verification_type: 'photo',
      },
      {
        title: '7-Day Call Streak',
        description: 'Make at least one negotiation call per day for 7 consecutive days',
        points: 40,
        is_mandatory: false,
        task_type: 'custom',
        verification_type: 'self_report',
      },
    ],
  },
  {
    id: 'no-spend-reset',
    name: 'No-Spend Reset Challenge',
    duration_days: 21,
    buy_in_amount: 5.00,
    tasks: [
      {
        title: 'Declare 3 Spending Categories to Avoid',
        description: 'Choose 3 categories you will not purchase from during the challenge',
        points: 20,
        is_mandatory: true,
        task_type: 'no_spend_declare',
        verification_type: 'self_report',
      },
      {
        title: '7-Day No-Spend Streak',
        description: 'Complete 7 consecutive days with zero spending in your target categories',
        points: 40,
        is_mandatory: true,
        task_type: 'no_spend',
        verification_type: 'plaid',
      },
      {
        title: '14-Day No-Spend Streak',
        description: 'Complete 14 consecutive days with zero spending in target categories',
        points: 60,
        is_mandatory: true,
        task_type: 'no_spend',
        verification_type: 'plaid',
      },
      {
        title: 'Cook at Home 10 Times',
        description: 'Prepare meals at home instead of ordering delivery or eating out',
        points: 30,
        is_mandatory: false,
        task_type: 'cooking',
        verification_type: 'counter',
      },
      {
        title: 'Replace Purchase with Free Alternative',
        description: 'Find a free alternative to a purchase you normally make',
        points: 25,
        is_mandatory: false,
        task_type: 'custom',
        verification_type: 'self_report',
      },
      {
        title: 'Track Every Purchase for 21 Days',
        description: 'Log all spending entries throughout the entire challenge',
        points: 40,
        is_mandatory: false,
        task_type: 'tracking',
        verification_type: 'plaid',
      },
      {
        title: 'Save at Least $150 During Challenge',
        description: 'Reduce spending enough to save $150 or more',
        points: 35,
        is_mandatory: false,
        task_type: 'savings',
        verification_type: 'plaid',
      },
    ],
  },
];
