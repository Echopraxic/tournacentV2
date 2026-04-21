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
    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (!challenge) return { success: false, message: 'Challenge not found' };

    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (!task) return { success: false, message: 'Task not found' };

    if (taskType === 'savings') return verifySavingsTask(userId, challengeId, task, challenge);
    if (taskType === 'no_spend') return verifyNoSpendTask(userId, challengeId, task, challenge);
    if (taskType === 'tracking') return verifyTrackingTask(userId, challengeId, task, challenge);

    return { success: true, message: 'Task completed successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

/**
 * Verifies savings tasks. Behavior splits on whether the task title contains a
 * dollar amount:
 *
 * - Title has "$N"  →  deposit milestone: verify net deposits ≥ N and no
 *                      withdrawals have occurred since challenge start.
 * - No dollar amount →  passthrough (connect-account, goal-setting, automate
 *                      tasks): return success immediately so the user can
 *                      self-report without a Plaid gate.
 *
 * Plaid sign convention: negative amount = credit (deposit), positive = debit
 * (withdrawal). Only withdrawals above $15 are flagged to ignore small fees.
 */
const verifySavingsTask = async (
  userId: string,
  challengeId: string,
  task: any,
  challenge: any
): Promise<VerificationResult> => {
  // Extract the first dollar figure from the task title, e.g. "$250" → 250
  const dollarMatch = task.title.match(/\$(\d[\d,]*)/);
  const requiredAmount = dollarMatch
    ? parseFloat(dollarMatch[1].replace(',', ''))
    : null;

  // No dollar threshold → connect/goal/automate task; self-report, no Plaid needed
  if (requiredAmount === null) {
    return { success: true, message: 'Task completed successfully.' };
  }

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

  // Withdrawals (positive Plaid amounts > $15) disqualify the user
  const { data: withdrawals } = await supabase
    .from('bank_transactions')
    .select('amount, date, name')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .gt('amount', 15)
    .eq('pending', false);

  if (withdrawals && withdrawals.length > 0) {
    await supabase
      .from('challenge_participants')
      .update({
        is_disqualified: true,
        disqualification_reason: 'Withdrawal detected during savings challenge',
      })
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    return {
      success: false,
      message: 'Disqualified: a withdrawal was detected from your linked account.',
      disqualified: true,
    };
  }

  // Net deposits = sum of all credits (negative Plaid amounts) since challenge start
  const { data: deposits } = await supabase
    .from('bank_transactions')
    .select('amount')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .lt('amount', 0)
    .eq('pending', false);

  const totalDeposited = deposits
    ? deposits.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    : 0;

  if (totalDeposited < requiredAmount) {
    return {
      success: false,
      message: `Deposit milestone not met. You've deposited $${totalDeposited.toFixed(2)} of the required $${requiredAmount.toFixed(2)}.`,
    };
  }

  return {
    success: true,
    message: `Deposit verified. $${totalDeposited.toFixed(2)} confirmed in your linked account.`,
  };
};

/**
 * Verifies a no-spend streak.
 *
 * Required days are read from the task title (e.g. "21-Day Spending Freeze"
 * → 21), falling back to 7 if no match is found.
 *
 * If the user has declared categories (user_no_spend_categories), only
 * transactions in those categories are checked. If no categories are declared
 * (challenges that have no declare step), ALL spending above $1 is treated as
 * a violation — matching the intent of a blanket spending freeze.
 *
 * Plaid sign convention: positive amount = debit (spending).
 */
const verifyNoSpendTask = async (
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

  // Read required streak length from title: "7-Day", "14-Day", "21-Day", etc.
  const dayMatch = task.title.match(/(\d+)-Day/i);
  const requiredDays = dayMatch ? parseInt(dayMatch[1], 10) : 7;

  const challengeStart = challenge.start_date.split('T')[0];
  const streakEnd = new Date(
    new Date(challengeStart).getTime() + requiredDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  if (today < streakEnd) {
    const daysLeft = Math.ceil(
      (new Date(streakEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return {
      success: false,
      message: `${requiredDays}-day streak not complete yet. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`,
    };
  }

  // Load any declared categories for this user + challenge
  const { data: declaredCategories } = await supabase
    .from('user_no_spend_categories')
    .select('plaid_category')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);

  const categoryList = declaredCategories?.map((c: any) => c.plaid_category as string) ?? [];
  const filterByCategory = categoryList.length > 0;

  // Fetch settled debits during the streak window
  const { data: debits } = await supabase
    .from('bank_transactions')
    .select('name, date, amount, category')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .lte('date', streakEnd)
    .gt('amount', 0)
    .eq('pending', false);

  const violatingTx = debits?.find((tx: any) => {
    if (filterByCategory) {
      const primary = Array.isArray(tx.category) ? tx.category[0] : null;
      return primary && categoryList.includes(primary);
    }
    // No declared categories: flag any spending above $1 (blanket freeze)
    return tx.amount > 1;
  });

  if (violatingTx) {
    return {
      success: false,
      message: filterByCategory
        ? `Spending detected in a declared no-spend category (${violatingTx.name} on ${violatingTx.date}). Streak broken.`
        : `Spending detected during your freeze period (${violatingTx.name} on ${violatingTx.date}). Streak broken.`,
      streakBroken: true,
    };
  }

  return {
    success: true,
    message: `${requiredDays}-day no-spend streak verified — no qualifying spending detected.`,
  };
};

/**
 * Verifies a daily expense tracking task by checking that the user has at
 * least N consecutive days with bank activity via their linked Plaid account,
 * where N is extracted from the task title (e.g. "7-Day Expense Tracking" → 7).
 *
 * A "tracked day" is any date with at least one settled transaction. The check
 * finds the longest consecutive-day run in the transaction history and requires
 * it to be ≥ N.
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

  // Extract required days from task title: "7-Day", "21 Days", "Track Every Purchase for 21 Days", etc.
  const dayMatch = task.title.match(/(\d+)/);
  const requiredDays = dayMatch ? parseInt(dayMatch[1], 10) : 7;

  const challengeStart = challenge.start_date.split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Enough calendar time must have elapsed before the streak can be claimed
  const daysSinceStart = Math.floor(
    (Date.now() - new Date(challengeStart).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceStart < requiredDays) {
    const daysLeft = requiredDays - daysSinceStart;
    return {
      success: false,
      message: `${requiredDays}-day tracking streak not complete yet. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`,
    };
  }

  const { data: txs } = await supabase
    .from('bank_transactions')
    .select('date')
    .eq('user_id', userId)
    .gte('date', challengeStart)
    .lte('date', today)
    .eq('pending', false);

  const uniqueDates = [...new Set(txs?.map((tx: any) => tx.date as string) ?? [])].sort();

  if (uniqueDates.length < requiredDays) {
    return {
      success: false,
      message: `Tracking incomplete. Activity found on ${uniqueDates.length} of the required ${requiredDays} days.`,
    };
  }

  // Find the longest run of consecutive calendar dates
  let longestStreak = 1;
  let currentStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const diffMs =
      new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i - 1]).getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  if (longestStreak < requiredDays) {
    return {
      success: false,
      message: `Consecutive tracking streak not met. Longest unbroken streak: ${longestStreak} day${longestStreak !== 1 ? 's' : ''} (${requiredDays} required). A gap in activity was detected.`,
    };
  }

  return {
    success: true,
    message: `${requiredDays}-day expense tracking streak verified via linked bank account.`,
  };
};

/**
 * Resets no-spend streak completions and deducts points when a streak is
 * broken. Intended to be called from a Supabase edge function or webhook
 * that detects a disqualifying transaction in real time.
 */
export const handleStreakBreak = async (
  userId: string,
  challengeId: string,
  spendingCategory: string
): Promise<void> => {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, points')
    .eq('challenge_id', challengeId)
    .eq('task_type', 'no_spend');

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

/**
 * Checks whether a user has failed any mandatory tasks at challenge end and
 * disqualifies them if so. Intended to be called from a scheduled Supabase
 * function when a challenge's end_date is reached.
 */
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

  const mandatoryTaskIds = mandatoryTasks.map((t: any) => t.id);

  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id')
    .eq('user_id', userId)
    .in('task_id', mandatoryTaskIds);

  const completedIds = new Set(completions?.map((c: any) => c.task_id) ?? []);
  const anyFailed = mandatoryTaskIds.some((id: string) => !completedIds.has(id));

  if (anyFailed) {
    await supabase
      .from('challenge_participants')
      .update({
        is_disqualified: true,
        disqualification_reason: 'Failed to complete all mandatory tasks',
      })
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    return true;
  }

  return false;
};

/**
 * Scans a user's linked bank account for withdrawal violations and
 * disqualifies them if any are found. Intended to be called on a recurring
 * schedule (e.g. nightly pg_cron or Supabase scheduled function) for active
 * savings challenge participants.
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
    .gt('amount', 15)
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

    return true;
  }

  return false;
};
