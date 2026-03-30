import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Target, Clock, Users, Share2 } from 'lucide-react-native';

const APP_STORE_URL = 'https://apps.apple.com/app/tournacent/id000000000'; // placeholder
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tournacent'; // placeholder
const INVITE_BASE_URL = 'https://tournacent.app/join';

interface Challenge {
  id: string;
  name: string;
  prize_pool: number;
  buy_in_amount: number;
  end_date: string;
  status: string;
  challenge_type: string;
  invite_code: string | null;
  pending_expires_at: string | null;
  buyin_deadline: string | null;
  join_deadline: string | null;
}

interface Participant {
  points: number;
  rank: number;
  payment_status: string;
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
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [showDropWarning, setShowDropWarning] = useState(false);
  const [droppingOut, setDroppingOut] = useState(false);
  const [pendingPlayerCount, setPendingPlayerCount] = useState(0);
  const [payingIn, setPayingIn] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch all participations, find the most relevant active/pending one
      const { data: allParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id, points, rank, payment_status, challenges(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      const participantData =
        allParticipations?.find((p: any) => p.challenges?.status === 'pending') ||
        allParticipations?.find((p: any) => p.challenges?.status === 'active') ||
        null;

      if (participantData) {
        const challengeData = participantData.challenges as any;
        setChallenge(challengeData);
        setParticipant({
          points: participantData.points,
          rank: participantData.rank || 1,
          payment_status: participantData.payment_status,
        });

        const endDate = new Date(challengeData.end_date || Date.now());
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(diffDays > 0 ? diffDays : 0);

        const { count } = await supabase
          .from('challenge_participants')
          .select('*', { count: 'exact', head: true })
          .eq('challenge_id', challengeData.id);
        setParticipantCount(count || 0);
        setPendingPlayerCount(count || 0);

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

      setFeedback({ message: `Task completed! +${highestTask.points} points`, isError: false });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch (error: any) {
      setFeedback({ message: error.message || 'Failed to complete task', isError: true });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const hoursUntil = (iso: string | null) => {
    if (!iso) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60)));
  };

  const handleBuyIn = async () => {
    if (!challenge || !user) return;
    setPayingIn(true);
    try {
      await supabase
        .from('challenge_participants')
        .update({ payment_status: 'paid' })
        .eq('challenge_id', challenge.id)
        .eq('user_id', user.id);

      await supabase
        .from('challenges')
        .update({ prize_pool: challenge.prize_pool + challenge.buy_in_amount })
        .eq('id', challenge.id);

      fetchData();
    } catch (error: any) {
      setFeedback({ message: error.message || 'Buy-in failed', isError: true });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setPayingIn(false);
    }
  };

  const handleShareAgain = async () => {
    if (!challenge?.invite_code) return;
    const inviteUrl = `${INVITE_BASE_URL}/${challenge.invite_code}`;
    const storeLink = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    const message = [
      `I'm challenging you on Tournacent! 🏆`,
      ``,
      `Join my "${challenge.name}" challenge.`,
      ``,
      `Your invite code: ${challenge.invite_code}`,
      ``,
      `📱 Download & join automatically:`,
      storeLink,
      ``,
      `Already have Tournacent? Open: ${inviteUrl}`,
    ].join('\n');
    try {
      await Share.share({ message, url: inviteUrl });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDropOut = async () => {
    if (!challenge || !user) return;
    setDroppingOut(true);
    try {
      await supabase
        .from('challenge_participants')
        .delete()
        .eq('challenge_id', challenge.id)
        .eq('user_id', user.id);
      setShowDropWarning(false);
      setChallenge(null);
      setParticipant(null);
    } catch (error: any) {
      setFeedback({ message: error.message || 'Failed to drop out', isError: true });
      setTimeout(() => setFeedback(null), 3000);
      setShowDropWarning(false);
    } finally {
      setDroppingOut(false);
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

  // ── Pending group challenge: waiting for players ──────────────────────────
  if (challenge.status === 'pending') {
    const hoursLeft = hoursUntil(challenge.pending_expires_at);
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tournacent</Text>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.pendingCard}>
            <View style={styles.pendingIconRow}>
              <Users color="#10B981" size={32} />
            </View>
            <Text style={styles.pendingTitle}>Waiting for Players</Text>
            <Text style={styles.pendingName}>{challenge.name}</Text>

            <View style={styles.pendingStats}>
              <View style={styles.pendingStat}>
                <Text style={styles.pendingStatValue}>{pendingPlayerCount}</Text>
                <Text style={styles.pendingStatLabel}>joined</Text>
              </View>
              <Text style={styles.pendingStatSep}>/</Text>
              <View style={styles.pendingStat}>
                <Text style={styles.pendingStatValue}>3</Text>
                <Text style={styles.pendingStatLabel}>needed</Text>
              </View>
            </View>

            {challenge.invite_code && (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Invite Code</Text>
                <Text style={styles.codeValue}>{challenge.invite_code}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.shareBtn} onPress={handleShareAgain}>
              <Share2 size={18} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Invitation</Text>
            </TouchableOpacity>

            <Text style={styles.pendingExpiry}>
              {hoursLeft > 0
                ? `Challenge cancels in ${hoursLeft}h if 3 players don't join`
                : 'Challenge has expired — not enough players joined'}
            </Text>

            <TouchableOpacity
              style={styles.dropOutButton}
              onPress={() => setShowDropWarning(true)}
            >
              <Text style={styles.dropOutButtonText}>Leave Challenge</Text>
            </TouchableOpacity>
          </View>

          {showDropWarning && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Leave this challenge?</Text>
              <Text style={styles.warningBody}>
                You'll be removed from the challenge. If it later activates without you, you won't participate.
              </Text>
              <View style={styles.warningActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDropWarning(false)}>
                  <Text style={styles.cancelButtonText}>Stay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmDropButton}
                  onPress={handleDropOut}
                  disabled={droppingOut}
                >
                  <Text style={styles.confirmDropButtonText}>
                    {droppingOut ? 'Leaving…' : 'Yes, Leave'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Active group challenge, buy-in still pending ──────────────────────────
  if (
    challenge.status === 'active' &&
    challenge.challenge_type === 'group' &&
    participant?.payment_status === 'pending'
  ) {
    const hoursLeft = hoursUntil(challenge.buyin_deadline);
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tournacent</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.buyinEmoji}>💸</Text>
          <Text style={styles.emptyTitle}>Buy-In Required</Text>
          <Text style={styles.buyinChallengeName}>{challenge.name}</Text>
          <Text style={styles.emptyText}>
            Your challenge is live! Complete your buy-in to secure your spot.
          </Text>
          <View style={styles.buyinDeadline}>
            <Clock size={16} color="#D97706" />
            <Text style={styles.buyinDeadlineText}>
              {hoursLeft > 0
                ? `${hoursLeft} hours left to pay`
                : 'Buy-in window has closed'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.buyinButton, (payingIn || hoursLeft === 0) && styles.buttonDisabled]}
            onPress={handleBuyIn}
            disabled={payingIn || hoursLeft === 0}
          >
            <Text style={styles.buyinButtonText}>
              {payingIn
                ? 'Processing…'
                : `Confirm Buy-In — $${Number(challenge.buy_in_amount).toFixed(2)}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropOutButton}
            onPress={() => setShowDropWarning(true)}
          >
            <Text style={styles.dropOutButtonText}>Drop Out</Text>
          </TouchableOpacity>
          {showDropWarning && (
            <View style={[styles.warningCard, { width: '100%', marginTop: 16 }]}>
              <Text style={styles.warningTitle}>Are you sure?</Text>
              <Text style={styles.warningBody}>
                Dropping out is permanent. Your buy-in (if paid) stays in the pool.
              </Text>
              <View style={styles.warningActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDropWarning(false)}>
                  <Text style={styles.cancelButtonText}>Stay In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmDropButton}
                  onPress={handleDropOut}
                  disabled={droppingOut}
                >
                  <Text style={styles.confirmDropButtonText}>
                    {droppingOut ? 'Dropping out…' : 'Yes, Drop Out'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tournacent</Text>
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

          <TouchableOpacity
            style={styles.dropOutButton}
            onPress={() => setShowDropWarning(true)}
          >
            <Text style={styles.dropOutButtonText}>Drop Out</Text>
          </TouchableOpacity>
        </View>

        {showDropWarning && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Are you sure?</Text>
            <Text style={styles.warningBody}>
              Dropping out is permanent. Your buy-in will remain in the prize pool and go to the other players. You will not receive a refund.
            </Text>
            <View style={styles.warningActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDropWarning(false)}
              >
                <Text style={styles.cancelButtonText}>Stay In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDropButton}
                onPress={handleDropOut}
                disabled={droppingOut}
              >
                <Text style={styles.confirmDropButtonText}>
                  {droppingOut ? 'Dropping out…' : 'Yes, Drop Out'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
  dropOutButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dropOutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B91C1C',
  },
  warningBody: {
    fontSize: 14,
    color: '#7C2D12',
    lineHeight: 20,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confirmDropButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmDropButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Pending group state ───────────────────────────────────────────────────
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pendingIconRow: {
    backgroundColor: '#D1FAE5',
    borderRadius: 50,
    padding: 16,
  },
  pendingTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  pendingName: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  pendingStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pendingStat: { alignItems: 'center' },
  pendingStatValue: { fontSize: 36, fontWeight: '800', color: '#111827' },
  pendingStatLabel: { fontSize: 12, color: '#6B7280' },
  pendingStatSep: { fontSize: 28, color: '#D1D5DB', fontWeight: '300' },
  codeBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    width: '100%',
  },
  codeLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  codeValue: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: 3 },
  shareBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  pendingExpiry: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  // ── Buy-in state ──────────────────────────────────────────────────────────
  buyinEmoji: { fontSize: 56, marginBottom: 8 },
  buyinChallengeName: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginTop: -8 },
  buyinDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buyinDeadlineText: { fontSize: 13, color: '#D97706', fontWeight: '600' },
  buyinButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  buyinButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
});
