import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Target, Clock } from 'lucide-react-native';

interface Challenge {
  id: string;
  name: string;
  prize_pool: number;
  end_date: string;
  status: string;
}

interface Participant {
  points: number;
  rank: number;
}

interface Task {
  id: string;
  title: string;
  points: number;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [highestTask, setHighestTask] = useState<Task | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: participantData } = await supabase
        .from('challenge_participants')
        .select('challenge_id, points, rank, challenges(*)')
        .eq('user_id', user.id)
        .eq('challenges.status', 'active')
        .maybeSingle();

      if (participantData) {
        const challengeData = participantData.challenges as any;
        setChallenge(challengeData);
        setParticipant({
          points: participantData.points,
          rank: participantData.rank || 1,
        });

        const endDate = new Date(challengeData.end_date);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(diffDays > 0 ? diffDays : 0);

        const { count } = await supabase
          .from('challenge_participants')
          .select('*', { count: 'exact', head: true })
          .eq('challenge_id', challengeData.id);
        setParticipantCount(count || 0);

        const { data: completedTaskIds } = await supabase
          .from('task_completions')
          .select('task_id')
          .eq('user_id', user.id)
          .eq('challenge_id', challengeData.id);

        const completedIds = completedTaskIds?.map((t) => t.task_id) || [];

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, points')
          .eq('challenge_id', challengeData.id)
          .not('id', 'in', `(${completedIds.join(',') || 'null'})`)
          .order('points', { ascending: false })
          .limit(1)
          .maybeSingle();

        setHighestTask(tasksData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCompleteTask = async () => {
    if (!highestTask || !challenge || !user) return;

    try {
      await supabase.from('task_completions').insert({
        task_id: highestTask.id,
        user_id: user.id,
        challenge_id: challenge.id,
      });

      await supabase.rpc('increment', {
        row_id: user.id,
        x: highestTask.points,
      });

      Alert.alert('Success', `Task completed! +${highestTask.points} points`);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete task');
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FCD34D';
    if (rank >= participantCount - 1) return '#FCA5A5';
    return '#E5E7EB';
  };

  const getRankText = (rank: number) => {
    const ordinals = ['', '1st', '2nd', '3rd'];
    return rank <= 3 ? ordinals[rank] : `${rank}th`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tournacent</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tournacent</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Trophy color="#D1D5DB" size={64} />
          <Text style={styles.emptyTitle}>No Active Challenge</Text>
          <Text style={styles.emptyText}>
            Join or create a challenge to get started
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/challenges')}
          >
            <Text style={styles.browseButtonText}>Browse Challenges</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tournacent</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeName}>{challenge.name}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>ACTIVE</Text>
            </View>
          </View>

          <View style={styles.prizeSection}>
            <Text style={styles.prizeLabel}>Prize Pool</Text>
            <Text style={styles.prizeAmount}>${challenge.prize_pool}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Clock color="#6B7280" size={20} />
              <Text style={styles.statValue}>{daysRemaining}</Text>
              <Text style={styles.statLabel}>days left</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statItem}>
              <Trophy color="#6B7280" size={20} />
              <Text style={styles.statValue}>{participantCount}</Text>
              <Text style={styles.statLabel}>players</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statItem}>
              <Target color="#6B7280" size={20} />
              <Text style={styles.statValue}>{participant?.points || 0}</Text>
              <Text style={styles.statLabel}>points</Text>
            </View>
          </View>
        </View>

        {highestTask && (
          <View style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskLabel}>Highest Value Task</Text>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsText}>{highestTask.points} pts</Text>
              </View>
            </View>
            <Text style={styles.taskTitle}>{highestTask.title}</Text>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteTask}
            >
              <Text style={styles.completeButtonText}>Complete Task</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.rankBanner,
            { backgroundColor: getRankColor(participant?.rank || 1) },
          ]}
          onPress={() => router.push('/(tabs)/leaderboard')}
        >
          <Text style={styles.rankText}>
            You're in {getRankText(participant?.rank || 1)} place
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
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
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  challengeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  prizeSection: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  prizeLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  prizeAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#10B981',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    height: 180,
    justifyContent: 'space-between',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  pointsBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  completeButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rankBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rankText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
});
