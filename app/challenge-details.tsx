import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Zap, TrendingUp, Shield } from 'lucide-react-native';

interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  is_mandatory: boolean;
  task_type: string;
}

interface CompletionGuidance {
  taskType: string;
  challengeName: string;
  title: string;
  howToComplete: string;
  antiGamingRules: string;
  verification: string;
}

const COMPLETION_GUIDANCE: Record<string, CompletionGuidance> = {
  'savings-deposit': {
    taskType: 'savings',
    challengeName: '30-Day Emergency Fund Sprint',
    title: 'Deposit at Least $25',
    howToComplete:
      'Transfer $25 or more from your external bank account to your emergency fund via the Wallet section.',
    antiGamingRules:
      'Deposits must remain in your account until the challenge ends. Any withdrawals reduce your milestone eligibility and will disqualify you from this task.',
    verification:
      'We verify deposits via your linked bank account. Only net positive increases count toward milestones.',
  },
  'savings-progressive': {
    taskType: 'savings',
    challengeName: '30-Day Emergency Fund Sprint',
    title: 'Progressive Deposit Milestones',
    howToComplete:
      'Complete deposits in order: $25, then $100 total, then $250 total. You cannot skip tiers.',
    antiGamingRules:
      'Points unlock only when you reach each milestone. Deposits cannot be withdrawn without disqualification. You must maintain each tier throughout the challenge.',
    verification:
      'Real-time verification of total account balance. We check for new deposits daily and verify they remain in the account.',
  },
  'no-spend-streak': {
    taskType: 'no_spend',
    challengeName: 'No-Spend Reset Challenge',
    title: '7-Day and 14-Day No-Spend Streaks',
    howToComplete:
      'Select 3 spending categories to avoid (e.g., dining out, subscriptions, shopping). Then maintain zero spending in those categories for 7 consecutive days, then 14 consecutive days.',
    antiGamingRules:
      'A single purchase breaks the streak and resets the counter to day 1. You must log every purchase daily. Only purchases in your declared categories reset the streak.',
    verification:
      'You log spending daily. A single transaction in any of your target categories breaks the streak immediately. We enforce this with real-time transaction monitoring.',
  },
  'tracker-requirement': {
    taskType: 'tracking',
    challengeName: 'Both Challenges',
    title: 'Daily Spending Tracking',
    howToComplete:
      'Log every purchase you make, even those in allowed categories. Be specific: amount, category, and time.',
    antiGamingRules:
      'Failure to log for even one day breaks tracking streaks. We validate real transactions against your logs using linked accounts.',
    verification:
      'Automated verification against your linked bank account. Discrepancies flag your account for review.',
  },
  'auto-withdrawal-rule': {
    taskType: 'savings',
    challengeName: '30-Day Emergency Fund Sprint',
    title: 'No Withdrawals Policy',
    howToComplete:
      'Keep all deposits in your linked savings account until the challenge ends.',
    antiGamingRules:
      'Any withdrawal from your account triggers automatic disqualification from deposit milestones. Interest or dividends are allowed and do not break the rule.',
    verification:
      'We monitor all account activity in real-time via Plaid integration.',
  },
};

export default function ChallengeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuidance, setSelectedGuidance] = useState<CompletionGuidance | null>(null);

  useEffect(() => {
    if (id) {
      loadTasks();
    }
  }, [id]);

  const loadTasks = async () => {
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('challenge_id', id as string)
        .order('points', { ascending: false });

      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenge Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Zap size={20} color="#10B981" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Completion Verification</Text>
              <Text style={styles.infoText}>
                Tasks are verified through real-time account monitoring and daily logging
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Shield size={20} color="#10B981" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Anti-Gaming Rules</Text>
              <Text style={styles.infoText}>
                Deposits are locked, streaks reset on violations, and tracking is mandatory
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tasks & How to Complete Them</Text>

        {tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={styles.taskCard}
            onPress={() => {
              const key =
                task.task_type === 'savings'
                  ? task.points >= 60
                    ? 'savings-progressive'
                    : task.points >= 40
                      ? 'auto-withdrawal-rule'
                      : 'savings-deposit'
                  : task.task_type === 'no_spend'
                    ? task.points >= 40
                      ? 'no-spend-streak'
                      : 'no-spend-streak'
                    : task.task_type === 'tracking'
                      ? 'tracker-requirement'
                      : task.task_type;
              setSelectedGuidance(COMPLETION_GUIDANCE[key] || null);
            }}
          >
            <View style={styles.taskHeader}>
              <View style={styles.taskTitleContainer}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.is_mandatory && (
                  <View style={styles.mandatoryBadge}>
                    <AlertTriangle size={14} color="#EF4444" />
                    <Text style={styles.mandatoryText}>Required</Text>
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.pointsBadge,
                  { backgroundColor: `${getTaskTypeColor(task.task_type)}20` },
                ]}
              >
                <Text
                  style={[
                    styles.pointsText,
                    { color: getTaskTypeColor(task.task_type) },
                  ]}
                >
                  {task.points}
                </Text>
              </View>
            </View>
            <Text style={styles.taskDescription}>{task.description}</Text>
            <View
              style={[
                styles.taskType,
                { backgroundColor: `${getTaskTypeColor(task.task_type)}15` },
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
            <Text style={styles.tappingHint}>Tap for completion guidance</Text>
          </TouchableOpacity>
        ))}

        {selectedGuidance && (
          <View style={styles.guidanceCard}>
            <TouchableOpacity
              onPress={() => setSelectedGuidance(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            <Text style={styles.guidanceTitle}>{selectedGuidance.title}</Text>

            <View style={styles.guidanceSection}>
              <Text style={styles.guidanceSectionTitle}>How to Complete</Text>
              <Text style={styles.guidanceText}>{selectedGuidance.howToComplete}</Text>
            </View>

            <View style={styles.guidanceSection}>
              <Text style={styles.guidanceSectionTitle}>Anti-Gaming Rules</Text>
              <Text style={styles.guidanceText}>{selectedGuidance.antiGamingRules}</Text>
            </View>

            <View style={styles.guidanceSection}>
              <Text style={styles.guidanceSectionTitle}>Verification Method</Text>
              <Text style={styles.guidanceText}>{selectedGuidance.verification}</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  backButton: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskTitleContainer: {
    flex: 1,
    gap: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  mandatoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  pointsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 45,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '700',
  },
  taskDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  taskType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  taskTypeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tappingHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  guidanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#10B981',
    gap: 16,
    marginTop: 8,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  guidanceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  guidanceSection: {
    gap: 8,
  },
  guidanceSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  guidanceText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});
