import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Share,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/constants/tokens';
import { Trophy, Target, Clock, Users, Share2, Sun, Moon } from 'lucide-react-native';

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
  const { theme, mode, setMode } = useTheme();
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

  // Animated prize pool counter
  const prizeDisplayValue = useSharedValue(0);
  const prizeAnimStyle = useAnimatedStyle(() => ({})); // drives re-render for text
  const [displayedPrize, setDisplayedPrize] = useState(0);

  const animatePrizeTo = (target: number) => {
    prizeDisplayValue.value = withTiming(target, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) {
        // sync display value on completion — runs on JS thread via callback
      }
    });
    // Approximate the displayed value by stepping — simple and effective
    let start = displayedPrize;
    const steps = 20;
    const step = (target - start) / steps;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedPrize(Math.round(start + step * i));
      if (i >= steps) clearInterval(interval);
    }, 800 / steps);
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: allParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id, points, rank, payment_status, challenges(*)')
        .eq('user_id', user.id)
        .is('dropped_out_at', null)
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

        animatePrizeTo(challengeData.prize_pool ?? 0);

        const endDate = new Date(challengeData.end_date || Date.now());
        const today = new Date();
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

  useEffect(() => { fetchData(); }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchData();
    }, [user])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleCompleteTask = async () => {
    if (!highestTask || !challenge || !user) return;
    try {
      await supabase.from('task_completions').insert({
        task_id: highestTask.id,
        user_id: user.id,
        challenge_id: challenge.id,
      });
      await supabase.rpc('increment', { row_id: user.id, x: highestTask.points });
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
      const { data, error } = await supabase.rpc('drop_out_of_challenge', {
        p_challenge_id: challenge.id,
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to drop out');
      }

      setShowDropWarning(false);
      setChallenge(null);
      setParticipant(null);
    } catch (error: any) {
      setFeedback({ message: error.message || 'Failed to drop out', isError: true });
      setTimeout(() => setFeedback(null), 8000);
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

  const ThemeToggle = () => (
    <TouchableOpacity onPress={() => setMode(mode === 'light' ? 'dark' : 'light')} hitSlop={12}>
      {mode === 'light'
        ? <Moon color={theme.subtext} size={22} />
        : <Sun color={theme.subtext} size={22} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Tournacent</Text>
          <ThemeToggle />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Tournacent</Text>
          <ThemeToggle />
        </View>
        <View style={styles.emptyContainer}>
          <Trophy color={theme.subtext} size={64} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Challenge</Text>
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            Join or create a challenge to get started
          </Text>
          <Button
            title="Browse Challenges"
            variant="primary"
            onPress={() => router.push('/(tabs)/browse')}
            style={styles.browseButton}
          />
        </View>
      </View>
    );
  }

  // ── Pending group challenge ───────────────────────────────────────────────
  if (challenge.status === 'pending') {
    const hoursLeft = hoursUntil(challenge.pending_expires_at);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Tournacent</Text>
          <ThemeToggle />
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Card>
            <View style={styles.pendingIconRow}>
              <Users color={theme.primary} size={32} />
            </View>
            <Text style={[styles.pendingTitle, { color: theme.text }]}>Waiting for Players</Text>
            <Text style={[styles.pendingName, { color: theme.subtext }]}>{challenge.name}</Text>

            <View style={styles.pendingStats}>
              <View style={styles.pendingStat}>
                <Text style={[styles.pendingStatValue, { color: theme.text }]}>{pendingPlayerCount}</Text>
                <Text style={[styles.pendingStatLabel, { color: theme.subtext }]}>joined</Text>
              </View>
              <Text style={[styles.pendingStatSep, { color: theme.subtext }]}>/</Text>
              <View style={styles.pendingStat}>
                <Text style={[styles.pendingStatValue, { color: theme.text }]}>3</Text>
                <Text style={[styles.pendingStatLabel, { color: theme.subtext }]}>needed</Text>
              </View>
            </View>

            {challenge.invite_code && (
              <View style={[styles.codeBox, { borderColor: theme.primary }]}>
                <Text style={[styles.codeLabel, { color: theme.subtext }]}>Invite Code</Text>
                <Text style={[styles.codeValue, { color: theme.text }]}>{challenge.invite_code}</Text>
              </View>
            )}

            <Button
              title="Share Invitation"
              variant="primary"
              onPress={handleShareAgain}
              style={styles.fullWidth}
            />

            <Text style={[styles.pendingExpiry, { color: theme.subtext }]}>
              {hoursLeft > 0
                ? `Challenge cancels in ${hoursLeft}h if 3 players don't join`
                : 'Challenge has expired — not enough players joined'}
            </Text>

            <Button
              title="Leave Challenge"
              variant="danger"
              onPress={() => setShowDropWarning(true)}
              style={styles.fullWidth}
            />
          </Card>

          {showDropWarning && (
            <Card style={styles.warningCard}>
              <Text style={[styles.warningTitle, { color: theme.danger }]}>Leave this challenge?</Text>
              <Text style={[styles.warningBody, { color: theme.text }]}>
                You'll be removed from the challenge. If it later activates without you, you won't participate.
              </Text>
              <View style={styles.warningActions}>
                <Button title="Stay" variant="secondary" onPress={() => setShowDropWarning(false)} style={styles.flex1} />
                <Button title={droppingOut ? 'Leaving…' : 'Yes, Leave'} variant="danger" onPress={handleDropOut} disabled={droppingOut} style={styles.flex1} />
              </View>
            </Card>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Buy-in pending ────────────────────────────────────────────────────────
  if (
    challenge.status === 'active' &&
    challenge.challenge_type === 'group' &&
    participant?.payment_status === 'pending'
  ) {
    const hoursLeft = hoursUntil(challenge.buyin_deadline);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Tournacent</Text>
          <ThemeToggle />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.buyinEmoji}>💸</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Buy-In Required</Text>
          <Text style={[styles.buyinChallengeName, { color: theme.text }]}>{challenge.name}</Text>
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            Your challenge is live! Complete your buy-in to secure your spot.
          </Text>
          <View style={[styles.buyinDeadline, { backgroundColor: '#FEF3C7' }]}>
            <Clock size={16} color="#D97706" />
            <Text style={styles.buyinDeadlineText}>
              {hoursLeft > 0 ? `${hoursLeft} hours left to pay` : 'Buy-in window has closed'}
            </Text>
          </View>
          <Button
            title={payingIn ? 'Processing…' : `Confirm Buy-In — $${Number(challenge.buy_in_amount).toFixed(2)}`}
            variant="primary"
            onPress={handleBuyIn}
            disabled={payingIn || hoursLeft === 0}
            style={styles.fullWidth}
          />
          <Button
            title="Drop Out"
            variant="danger"
            onPress={() => setShowDropWarning(true)}
            style={[styles.fullWidth, { marginTop: 8 }]}
          />
          {showDropWarning && (
            <Card style={[styles.warningCard, { marginTop: 16, width: '100%' }]}>
              <Text style={[styles.warningTitle, { color: theme.danger }]}>Are you sure?</Text>
              <Text style={[styles.warningBody, { color: theme.text }]}>
                Dropping out is permanent. Your buy-in (if paid) stays in the pool.
              </Text>
              <View style={styles.warningActions}>
                <Button title="Stay In" variant="secondary" onPress={() => setShowDropWarning(false)} style={styles.flex1} />
                <Button title={droppingOut ? 'Dropping out…' : 'Yes, Drop Out'} variant="danger" onPress={handleDropOut} disabled={droppingOut} style={styles.flex1} />
              </View>
            </Card>
          )}
        </View>
      </View>
    );
  }

  // ── Active challenge ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Tournacent</Text>
        <ThemeToggle />
      </View>

      {feedback && (
        <View style={[
          styles.feedbackBanner,
          { backgroundColor: feedback.isError ? '#FEE2E2' : '#D1FAE5' },
        ]}>
          <Text style={[styles.feedbackText, { color: theme.text }]}>{feedback.message}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card>
          <View style={styles.challengeHeader}>
            <Text style={[styles.challengeName, { color: theme.text }]}>{challenge.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[styles.statusText, { color: '#059669' }]}>ACTIVE</Text>
            </View>
          </View>

          <View style={styles.prizeSection}>
            <Text style={[styles.prizeLabel, { color: theme.subtext }]}>Prize Pool</Text>
            <Text style={[styles.prizeAmount, { color: theme.primary }]}>${displayedPrize}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Clock color={theme.subtext} size={20} />
              <Text style={[styles.statValue, { color: theme.text }]}>{daysRemaining}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>days left</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: '#E5E7EB' }]} />
            <View style={styles.statItem}>
              <Trophy color={theme.subtext} size={20} />
              <Text style={[styles.statValue, { color: theme.text }]}>{participantCount}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>players</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: '#E5E7EB' }]} />
            <View style={styles.statItem}>
              <Target color={theme.subtext} size={20} />
              <Text style={[styles.statValue, { color: theme.text }]}>{participant?.points || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>points</Text>
            </View>
          </View>

          <Button
            title="Drop Out"
            variant="danger"
            onPress={() => setShowDropWarning(true)}
            style={{ marginTop: tokens.spacing[3] }}
          />
        </Card>

        {showDropWarning && (
          <Card style={styles.warningCard}>
            <Text style={[styles.warningTitle, { color: theme.danger }]}>Are you sure?</Text>
            <Text style={[styles.warningBody, { color: theme.text }]}>
              Dropping out is permanent. Your buy-in will remain in the prize pool. You will not receive a refund.
            </Text>
            <View style={styles.warningActions}>
              <Button title="Stay In" variant="secondary" onPress={() => setShowDropWarning(false)} style={styles.flex1} />
              <Button title={droppingOut ? 'Dropping out…' : 'Yes, Drop Out'} variant="danger" onPress={handleDropOut} disabled={droppingOut} style={styles.flex1} />
            </View>
          </Card>
        )}

        {highestTask && (
          <Card>
            <View style={styles.taskHeader}>
              <Text style={[styles.taskLabel, { color: theme.subtext }]}>Highest Value Task</Text>
              <View style={[styles.pointsBadge, { backgroundColor: '#DBEAFE' }]}>
                <Text style={[styles.pointsText, { color: '#1D4ED8' }]}>{highestTask.points} pts</Text>
              </View>
            </View>
            <Text style={[styles.taskTitle, { color: theme.text }]}>{highestTask.title}</Text>
            <Button
              title="Complete Task"
              variant="primary"
              onPress={handleCompleteTask}
              style={{ marginTop: tokens.spacing[3] }}
            />
          </Card>
        )}

        <Animated.View
          style={[
            styles.rankBanner,
            { backgroundColor: getRankColor(participant?.rank || 1) },
          ]}
        >
          <Text
            style={[styles.rankText, { color: theme.text }]}
            onPress={() => router.push('/(tabs)/leaderboard')}
          >
            You're in {getRankText(participant?.rank || 1)} place
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  feedbackBanner: { padding: 12, alignItems: 'center' },
  feedbackText: { fontSize: 14, fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 24, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  emptyText: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  browseButton: { width: '100%' },
  fullWidth: { width: '100%' },
  flex1: { flex: 1 },
  // Pending state
  pendingIconRow: { alignSelf: 'center', backgroundColor: '#D1FAE5', borderRadius: 50, padding: 16, marginBottom: 8 },
  pendingTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  pendingName: { fontSize: 15, textAlign: 'center' },
  pendingStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 8 },
  pendingStat: { alignItems: 'center' },
  pendingStatValue: { fontSize: 36, fontWeight: '800' },
  pendingStatLabel: { fontSize: 12 },
  pendingStatSep: { fontSize: 28, fontWeight: '300' },
  codeBox: {
    borderRadius: tokens.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#F3F4F6',
    width: '100%',
    marginVertical: 4,
  },
  codeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  codeValue: { fontSize: 28, fontWeight: '800', letterSpacing: 3 },
  pendingExpiry: { fontSize: 12, textAlign: 'center' },
  // Buy-in state
  buyinEmoji: { fontSize: 56, marginBottom: 8 },
  buyinChallengeName: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  buyinDeadline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 8,
  },
  buyinDeadlineText: { fontSize: 13, color: '#D97706', fontWeight: '600' },
  // Active challenge
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  challengeName: { fontSize: 20, fontWeight: '700', flex: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  prizeSection: {
    alignItems: 'center', paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', marginBottom: 20,
  },
  prizeLabel: { fontSize: 14, marginBottom: 8 },
  prizeAmount: { fontSize: 48, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  divider: { width: 1, height: 40 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  taskLabel: { fontSize: 14, fontWeight: '600' },
  pointsBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  pointsText: { fontSize: 12, fontWeight: '600' },
  taskTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  rankBanner: {
    borderRadius: tokens.radius.md, padding: 24, alignItems: 'center',
    justifyContent: 'center', height: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  rankText: { fontSize: 24, fontWeight: '700' },
  // Warning card
  warningCard: { borderWidth: 1, borderColor: '#FCA5A5' },
  warningTitle: { fontSize: 18, fontWeight: '700' },
  warningBody: { fontSize: 14, lineHeight: 20 },
  warningActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
