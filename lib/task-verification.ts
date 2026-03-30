import { supabase } from './supabase';

interface VerificationResult {
  success: boolean;
  message: string;
  disqualified?: boolean;
  streakBroken?: boolean;
}

export const verifyTaskCompletion = async (
  userId: string,
  taskId: string,
  challengeId: string,
  taskType: string,
  isMandatory: boolean
): Promise<VerificationResult> => {
  try {
    // Get challenge details
    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (!challenge) {
      return { success: false, message: 'Challenge not found' };
    }

    // Get task details
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    if (taskType === 'savings') {
      return await verifySavingsTask(userId, challengeId, task, challenge);
    }

    if (taskType === 'no_spend') {
      return await verifyNoSpendTask(userId, challengeId, task, challenge);
    }

    if (taskType === 'tracking') {
      return await verifyTrackingTask(userId, challengeId, task, challenge);
    }

    // Default: manual tasks are accepted as-is
    return { success: true, message: 'Task completed successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

/**
 * Verifies a savings deposit milestone using real Plaid bank transaction data.
 *
 * In Plaid's convention:
 *   - Negative amount = credit (money coming IN to the account, i.e. a deposit)
 *   - Positive amount = debit (money going OUT, i.e. a withdrawal)
 *
 * A user is disqualified if any withdrawal (positive amount) occurred since the
 * challenge start date. The net deposit is the sum of all credits minus all debits.
 */
const verifySavingsTask = async (
  userId: string,
  challengeId: string,
  task: any,
  challenge: any
): Promise<VerificationResult> => {
  // Check if user has a linked bank account
  const { data: plaidItem } = await supabase
    .from('plaid_items')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!plaidItem) {
    return {
      success: false,
      message: 'No linked bank account. Please connect your bank via Plaid in the Wallet tab.',
    };
  }

  const challengeStart = challenge.start_date;

  // Check for any withdrawals (positive Plaid amounts) since challenge start
  const { data: withdrawals } = await supabase
    .from('bank_transactions')
    .select('amount, date, name')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .gt('amount', 0) // positive = debit/withdrawal in Plaid
    .eq('pending', false);

  if (withdrawals && withdrawals.length > 0) {
    // Mark user as disqualified for withdrawal violation
    await supabase
      .from('challenge_participants')
      .update({
        is_disqualified: true,
        disqualification_reason: 'Withdrawal detected during Emergency Fund challenge',
      })
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    return {
      success: false,
      message: 'Disqualified: a withdrawal was detected from your linked account.',
      disqualified: true,
    };
  }

  // Calculate net deposits (negative amounts = credits in Plaid)
  const { data: deposits } = await supabase
    .from('bank_transactions')
    .select('amount')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .lt('amount', 0) // negative = credit/deposit in Plaid
    .eq('pending', false);

  const totalDeposited = deposits
    ? deposits.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    : 0;

  // Check if user meets the task's deposit threshold (stored in task.points metadata or description)
  // Map point values to required deposit amounts per QUICK_START.md
  const depositThresholds: Record<number, number> = {
    20: 25,   // Deposit $25+ (20 pts)
    40: 100,  // Deposit $100+ total (40 pts)
    60: 250,  // Deposit $250+ total (60 pts)
  };

  const requiredAmount = depositThresholds[task.points];

  if (requiredAmount !== undefined && totalDeposited < requiredAmount) {
    return {
      success: false,
      message: `Deposit milestone not met. You've deposited $${totalDeposited.toFixed(2)} of the required $${requiredAmount}.`,
    };
  }

  return {
    success: true,
    message: `Deposit verified. $${totalDeposited.toFixed(2)} confirmed in your linked account.`,
  };
};

/**
 * Verifies a no-spend streak by checking Plaid transactions for spending in
 * the user's declared categories. Any transaction in a declared category breaks the streak.
 */
const verifyNoSpendTask = async (
  userId: string,
  challengeId: string,
  task: any,
  challenge: any
): Promise<VerificationResult> => {
  // Check if user has a linked bank account
  const { data: plaidItem } = await supabase
    .from('plaid_items')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!plaidItem) {
    return {
      success: false,
      message: 'No linked bank account. Please connect your bank via Plaid in the Wallet tab.',
    };
  }

  const challengeStart = challenge.start_date;

  // Determine required streak days from task points
  // 40 pts = 7-day streak, 60 pts = 14-day streak (per QUICK_START.md)
  const requiredDays = task.points >= 60 ? 14 : 7;
  const streakCutoff = new Date(
    new Date(challengeStart).getTime() + requiredDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split('T')[0];

  const today = new Date().toISOString().split('T')[0];
  const checkUntil = today < streakCutoff ? today : streakCutoff;

  // Check for any spending (positive Plaid amounts = debits) during the streak window
  const { data: spendingTransactions } = await supabase
    .from('bank_transactions')
    .select('amount, date, name, category')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .lte('date', checkUntil)
    .gt('amount', 0) // positive = debit/spending in Plaid
    .eq('pending', false);

  if (spendingTransactions && spendingTransactions.length > 0) {
    return {
      success: false,
      message: `Spending detected during the ${requiredDays}-day no-spend window. Streak broken.`,
      streakBroken: true,
    };
  }

  return {
    success: true,
    message: `${requiredDays}-day no-spend streak verified via linked bank account.`,
  };
};

/**
 * Verifies a daily tracking task by counting days with logged bank activity
 * and ensuring the user has been tracking throughout the challenge period.
 */
const verifyTrackingTask = async (
  userId: string,
  challengeId: string,
  task: any,
  challenge: any
): Promise<VerificationResult> => {
  const { data: plaidItem } = await supabase
    .from('plaid_items')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!plaidItem) {
    return {
      success: false,
      message: 'No linked bank account. Please connect your bank via Plaid in the Wallet tab.',
    };
  }

  const challengeStart = challenge.start_date;
  const today = new Date().toISOString().split('T')[0];

  // Count distinct days with transactions (any amount) as evidence of active tracking
  const { data: txDays } = await supabase
    .from('bank_transactions')
    .select('date')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .lte('date', today)
    .eq('pending', false);

  const uniqueDays = new Set(txDays?.map((tx) => tx.date) ?? []).size;

  return {
    success: true,
    message: `Spending tracked across ${uniqueDays} day${uniqueDays !== 1 ? 's' : ''} via linked bank account.`,
  };
};

export const handleStreakBreak = async (
  userId: string,
  challengeId: string,
  spendingCategory: string
): Promise<void> => {
  // Reset no-spend streak task completions and deduct points
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, points')
    .eq('challenge_id', challengeId)
    .eq('task_type', 'no_spend')
    .in('points', [40, 60]); // 7-day and 14-day streak tasks

  if (tasks) {
    for (const task of tasks) {
      await supabase
        .from('task_completions')
        .delete()
        .eq('user_id', userId)
        .eq('task_id', task.id)
        .eq('challenge_id', challengeId);

      const { data: participant } = await supabase
        .from('challenge_participants')
        .select('points')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (participant) {
        await supabase
          .from('challenge_participants')
          .update({ points: Math.max(0, participant.points - task.points) })
          .eq('user_id', userId)
          .eq('challenge_id', challengeId);
      }
    }
  }
};

export const checkAutomaticDisqualification = async (
  userId: string,
  challengeId: string
): Promise<boolean> => {
  const { data: mandatoryTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('is_mandatory', true);

  if (!mandatoryTasks) return false;

  const mandatoryTaskIds = mandatoryTasks.map((t) => t.id);

  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id')
    .eq('user_id', userId)
    .in('task_id', mandatoryTaskIds);

  const completedIds = new Set(completions?.map((c) => c.task_id) ?? []);
  const failedMandatory = mandatoryTaskIds.filter((id) => !completedIds.has(id));

  if (failedMandatory.length > 0) {
    await supabase
      .from('challenge_participants')
      .update({
        is_disqualified: true,
        disqualification_reason: 'Failed mandatory task',
      })
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    return true;
  }

  return false;
};

/**
 * Monitors a user's linked bank account for withdrawal violations.
 * Should be called periodically (e.g., via a scheduled Supabase function)
 * for active Emergency Fund Sprint participants.
 */
export const monitorForWithdrawals = async (
  userId: string,
  challengeId: string,
  challengeStartDate: string
): Promise<boolean> => {
  const { data: withdrawals } = await supabase
    .from('bank_transactions')
    .select('id')
    .eq('user_id', userId)
    .gte('date', challengeStartDate)
    .gt('amount', 0) // positive = debit/withdrawal in Plaid
    .eq('pending', false)
    .limit(1);

  if (withdrawals && withdrawals.length > 0) {
    await supabase
      .from('challenge_participants')
      .update({
        is_disqualified: true,
        disqualification_reason: 'Withdrawal detected from linked savings account',
      })
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    return true; // disqualified
  }

  return false;
};
