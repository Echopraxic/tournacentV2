import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react-native';

interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  is_mandatory: boolean;
  task_type: string;
  completed: boolean;
}

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [maxPoints, setMaxPoints] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      const { data: participantData } = await supabase
        .from('challenge_participants')
        .select('challenge_id, points, challenges(*)')
        .eq('user_id', user.id)
        .eq('challenges.status', 'active')
        .maybeSingle();

      if (participantData) {
        setChallengeId(participantData.challenge_id);
        setTotalPoints(participantData.points);

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('challenge_id', participantData.challenge_id)
          .order('points', { ascending: false });

        const { data: completionsData } = await supabase
          .from('task_completions')
          .select('task_id')
          .eq('user_id', user.id)
          .eq('challenge_id', participantData.challenge_id);

        const completedIds = new Set(
          completionsData?.map((c) => c.task_id) || []
        );

        const tasksWithCompletion = tasksData?.map((task) => ({
          ...task,
          completed: completedIds.has(task.id),
        })) || [];

        setTasks(tasksWithCompletion);
        setCompletedCount(completedIds.size);

        const max = tasksData?.reduce((sum, task) => sum + task.points, 0) || 0;
        setMaxPoints(max);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handleTaskPress = (task: Task) => {
    if (!task.completed) {
      setSelectedTask(task);
      setModalVisible(true);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !challengeId || !user) return;

    try {
      await supabase.from('task_completions').insert({
        task_id: selectedTask.id,
        user_id: user.id,
        challenge_id: challengeId,
      });

      await supabase
        .from('challenge_participants')
        .update({ points: totalPoints + selectedTask.points })
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId);

      setModalVisible(false);
      setSelectedTask(null);
      setFeedback({ message: `Task completed! +${selectedTask.points} points`, isError: false });
      setTimeout(() => setFeedback(null), 3000);
      fetchTasks();
    } catch (error: any) {
      setFeedback({ message: error.message || 'Failed to complete task', isError: true });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      savings: '#A78BFA',
      no_spend: '#84CC16',
      budget: '#3B82F6',
      tracking: '#8B5CF6',
      cooking: '#F59E0B',
      subscription: '#EF4444',
      reading: '#10B981',
      custom: '#6B7280',
    };
    return colors[type] || colors.custom;
  };

  const progressPercentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
  const totalTasksCount = tasks.length;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tasks</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!challengeId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tasks</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Active Challenge</Text>
          <Text style={styles.emptyText}>
            Join a challenge to see your tasks
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
      </View>

      <View style={styles.statsHeader}>
        <View style={styles.pointsRow}>
          <View>
            <Text style={styles.pointsLabel}>Total Points</Text>
            <Text style={styles.pointsValue}>{totalPoints}</Text>
          </View>
          <View style={styles.maxPoints}>
            <Text style={styles.maxPointsText}>out of {maxPoints}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercentage}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedCount} of {totalTasksCount} tasks completed
          </Text>
        </View>
      </View>

      {feedback && (
        <View style={[styles.feedbackBanner, feedback.isError ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.taskCard,
              task.completed && styles.taskCardCompleted,
            ]}
            onPress={() => handleTaskPress(task)}
            disabled={task.completed}
          >
            <View style={styles.taskContent}>
              <View style={styles.taskLeft}>
                {task.completed ? (
                  <CheckCircle2 color="#10B981" size={24} />
                ) : (
                  <Circle color="#D1D5DB" size={24} />
                )}
                <View style={styles.taskInfo}>
                  <View style={styles.taskTitleRow}>
                    <Text
                      style={[
                        styles.taskTitle,
                        task.completed && styles.taskTitleCompleted,
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.is_mandatory && (
                      <AlertTriangle color="#EF4444" size={16} />
                    )}
                  </View>
                  <Text style={styles.taskDescription}>
                    {task.description}
                  </Text>
                  <View
                    style={[
                      styles.taskTypeBadge,
                      { backgroundColor: `${getTaskTypeColor(task.task_type)}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.taskTypeText,
                        { color: getTaskTypeColor(task.task_type) },
                      ]}
                    >
                      {task.task_type}
                    </Text>
                  </View>
                </View>
              </View>
              <View
                style={[
                  styles.pointsBadge,
                  task.completed && styles.pointsBadgeCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.pointsText,
                    task.completed && styles.pointsTextCompleted,
                  ]}
                >
                  {task.points}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Task?</Text>
            <Text style={styles.modalDescription}>
              This will add {selectedTask?.points} points to your score.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={handleCompleteTask}
              >
                <Text style={styles.modalButtonConfirmText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  statsHeader: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  maxPoints: {
    alignItems: 'flex-end',
  },
  maxPointsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressSection: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  feedbackBanner: {
    padding: 12,
    alignItems: 'center',
  },
  feedbackSuccess: {
    backgroundColor: '#D1FAE5',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  taskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  taskInfo: {
    flex: 1,
    gap: 8,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  taskTitleCompleted: {
    color: '#059669',
  },
  taskDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  taskTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taskTypeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pointsBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  pointsBadgeCompleted: {
    backgroundColor: '#D1FAE5',
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  pointsTextCompleted: {
    color: '#059669',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  modalDescription: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
