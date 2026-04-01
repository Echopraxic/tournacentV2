export type TaskType =
  | 'savings'
  | 'no_spend'
  | 'no_spend_declare'
  | 'budget'
  | 'tracking'
  | 'cooking'
  | 'subscription'
  | 'reading'
  | 'custom';

export interface PresetTask {
  title: string;
  description: string;
  points: number;
  is_mandatory: boolean;
  task_type: TaskType;
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
      },
      {
        title: 'Set Emergency Fund Goal',
        description: 'Set your emergency fund target amount in the app',
        points: 10,
        is_mandatory: true,
        task_type: 'savings',
      },
      {
        title: 'Deposit at Least $25',
        description: 'Make your first deposit of $25 or more',
        points: 20,
        is_mandatory: true,
        task_type: 'savings',
      },
      {
        title: 'Deposit at Least $100 Total',
        description: 'Reach a total deposit balance of $100',
        points: 40,
        is_mandatory: true,
        task_type: 'savings',
      },
      {
        title: 'Deposit at Least $250 Total',
        description: 'Reach a total deposit balance of $250',
        points: 60,
        is_mandatory: true,
        task_type: 'savings',
      },
      {
        title: '7-Day Expense Tracking Streak',
        description: 'Log your expenses every day for 7 consecutive days',
        points: 30,
        is_mandatory: false,
        task_type: 'tracking',
      },
      {
        title: 'Cancel One Subscription',
        description: 'Identify and cancel at least one unused subscription service',
        points: 25,
        is_mandatory: false,
        task_type: 'subscription',
      },
      {
        title: 'Automate Weekly Transfer',
        description: 'Set up automatic weekly transfers to your savings account',
        points: 40,
        is_mandatory: false,
        task_type: 'savings',
      },
      {
        title: 'Watch Savings Fundamentals Lesson',
        description: 'Complete a personal finance education module',
        points: 20,
        is_mandatory: false,
        task_type: 'reading',
      },
      {
        title: '14-Day No-Impulse-Buy Streak',
        description: 'Avoid impulse purchases over $20 for 14 consecutive days',
        points: 35,
        is_mandatory: false,
        task_type: 'no_spend',
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
      },
      {
        title: '7-Day No-Spend Streak',
        description: 'Complete 7 consecutive days with zero spending in your target categories',
        points: 40,
        is_mandatory: true,
        task_type: 'no_spend',
      },
      {
        title: '14-Day No-Spend Streak',
        description: 'Complete 14 consecutive days with zero spending in target categories',
        points: 60,
        is_mandatory: true,
        task_type: 'no_spend',
      },
      {
        title: 'Cook at Home 10 Times',
        description: 'Prepare meals at home instead of ordering delivery or eating out',
        points: 30,
        is_mandatory: false,
        task_type: 'cooking',
      },
      {
        title: 'Replace Purchase with Free Alternative',
        description: 'Find a free alternative to a purchase you normally make',
        points: 25,
        is_mandatory: false,
        task_type: 'no_spend',
      },
      {
        title: 'Track Every Purchase for 21 Days',
        description: 'Log all spending entries throughout the entire challenge',
        points: 40,
        is_mandatory: false,
        task_type: 'tracking',
      },
      {
        title: 'Save at Least $150 During Challenge',
        description: 'Reduce spending enough to save $150 or more',
        points: 35,
        is_mandatory: false,
        task_type: 'savings',
      },
    ],
  },
];
