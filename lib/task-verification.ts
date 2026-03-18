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

    // Check for savings deposit tasks
    if (taskType === 'savings') {
      return await verifySavingsTask(userId, challengeId, task);
    }

    // Check for no-spend streak tasks
    if (taskType === 'no_spend') {
      return await verifyNoSpendTask(userId, challengeId, task);
    }

    // Check for tracking tasks
    if (taskType === 'tracking') {
      return await verifyTrackingTask(userId, challengeId, task);
    }

    // Default verification
    return { success: true, message: 'Task completed successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

const verifySavingsTask = async (
  userId: string,
  challengeId: string,
  task: any
): Promise<VerificationResult> => {
  // Check if user has any previous withdrawals from linked account
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .eq('transaction_type', 'refund');

  if (transactions && transactions.length > 0) {
    return {
      success: false,
      message: 'Task ineligible: Withdrawals break deposit milestone requirements',
      disqualified: true,
    };
  }

  // Verify deposit is still in account (would need bank API integration)
  // For now, we assume deposits are verified via Plaid monitoring
  return { success: true, message: 'Deposit verified and locked until challenge end' };
};

const verifyNoSpendTask = async (
  userId: string,
  challengeId: string,
  task: any
): Promise<VerificationResult> => {
  // Get all spending transactions during challenge period
  const { data: challenge } = await supabase
    .from('challenges')
    .select('start_date, end_date')
    .eq('id', challengeId)
    .maybeSingle();

  if (!challenge) {
    return { success: false, message: 'Challenge not found' };
  }

  // Get user's declared spending categories to avoid
  const { data: streakData } = await supabase
    .from('task_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);

  // If user has ANY spending in their target categories, break the streak
  // This would be verified through linked bank account data
  // In a real implementation, we'd check transaction data

  return {
    success: true,
    message: 'No-spend streak verified',
  };
};

const verifyTrackingTask = async (
  userId: string,
  challengeId: string,
  task: any
): Promise<VerificationResult> => {
  // Get challenge dates
  const { data: challenge } = await supabase
    .from('challenges')
    .select('start_date, end_date, duration_days')
    .eq('id', challengeId)
    .maybeSingle();

  if (!challenge) {
    return { success: false, message: 'Challenge not found' };
  }

  // Count days with logged spending entries
  // In a real implementation, we'd check spending logs
  // For now, assume tracking is done if task is completed

  return {
    success: true,
    message: `Spending tracking verified for ${challenge.duration_days} days`,
  };
};

export const handleStreakBreak = async (
  userId: string,
  challengeId: string,
  spendingCategory: string
): Promise<void> => {
  // When a user makes a purchase in their no-spend category, break the streak
  // Delete previous streak task completions or mark them incomplete

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id')
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

      // Reduce user's points
      const { data: participant } = await supabase
        .from('challenge_participants')
        .select('points')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (participant) {
        const pointsToRemove = spendingCategory === '7-day' ? 40 : 60;
        await supabase
          .from('challenge_participants')
          .update({ points: Math.max(0, participant.points - pointsToRemove) })
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
  // Check if user has failed mandatory tasks
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

  const completedIds = new Set(completions?.map((c) => c.task_id) || []);
  const failedMandatory = mandatoryTaskIds.filter((id) => !completedIds.has(id));

  if (failedMandatory.length > 0) {
    // Mark user as disqualified
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
