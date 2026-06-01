import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/tokens';
import { useLeaderboardReorder } from '@/hooks/animations/useLeaderboardReorder';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChallengeCompletionGraphic } from '@/components/ChallengeCompletionGraphic';
import { Crown } from 'lucide-react-native';

interface Participant {
  id: string;
  user_id: string;
  points: number;
  rank: number;
  is_disqualified: boolean;
  dropped_out_at: string | null;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
  completed_tasks: number;
}

// ── Per-row subcomponent so useAnimatedStyle is called at a component's top
// level, not inside a loop in the parent. ─────────────────────────────────────
interface AnimatedRowProps {
  participant: Participant;
  isCurrentUser: boolean;
  totalTasks: number;
  theme: ThemeColors;
  translateY: SharedValue<number> | undefined;
  rankScale: SharedValue<number> | undefined;
  getInitials: (name: string) => string;
}

function AnimatedParticipantRow({
  participant,
  isCurrentUser,
  totalTasks,
  theme,
  translateY,
  rankScale,
  getInitials,
}: AnimatedRowProps) {
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY?.value ?? 0 }],
  }));
  const rankPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rankScale?.value ?? 1 }],
  }));

  const isInactive = participant.is_disqualified || !!participant.dropped_out_at;

  return (
    <Animated.View
      style={[
        styles.participantCard,
        { backgroundColor: theme.surface },
        isCurrentUser && styles.participantCardHighlight,
        isInactive && styles.participantCardDisqualified,
        rowStyle,
      ]}
    >
      <View style={styles.participantLeft}>
        <View style={styles.rankContainer}>
          {participant.rank === 1 && !participant.is_disqualified ? (
            <Crown color="#F59E0B" size={20} />
          ) : (
            <Animated.Text style={[styles.rankNumber, { color: theme.subtext }, rankPulseStyle]}>
              {participant.rank}
            </Animated.Text>
          )}
        </View>

        <View style={[styles.avatar, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.avatarText, { color: '#1D4ED8' }]}>
            {getInitials(participant.profiles.display_name)}
          </Text>
        </View>

        <View style={styles.participantInfo}>
          <Text
            style={[
              styles.participantName,
              { color: isInactive ? theme.subtext : theme.text },
            ]}
          >
            {participant.profiles.display_name}
            {isCurrentUser && ' (You)'}
          </Text>
          {participant.is_disqualified && (
            <View style={styles.disqualifiedBadge}>
              <Text style={styles.disqualifiedText}>Disqualified</Text>
            </View>
          )}
          {participant.dropped_out_at && (
            <View style={styles.droppedOutBadge}>
              <Text style={styles.droppedOutText}>Dropped Out</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.participantRight}>
        <Text style={[styles.participantPoints, { color: isInactive ? theme.subtext : theme.text }]}>
          {participant.points} pts
        </Text>
        <ProgressBar
          progress={totalTasks > 0 ? participant.completed_tasks / totalTasks : 0}
          height={4}
          trackColor={isInactive ? '#E5E7EB' : undefined}
        />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number>(1);
  const [currentUserPoints, setCurrentUserPoints] = useState<number>(0);
  const [maxPoints, setMaxPoints] = useState<number>(0);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDroppedOut, setIsDroppedOut] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<string>('active');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [showCompletionGraphic, setShowCompletionGraphic] = useState(false);

  const fetchLeaderboard = async () => {
    if (!user?.id) return;

    try {
      const { data: allParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id, challenges(*)')
        .eq('user_id', user.id)
        .is('dropped_out_at', null)
        .order('joined_at', { ascending: false });

      let participantData: any =
        allParticipations?.find((p: any) => p.challenges?.status === 'active') || null;
      let droppedOutFlag = false;

      if (!participantData) {
        const { data: droppedParticipations } = await supabase
          .from('challenge_participants')
          .select('challenge_id, challenges(*)')
          .eq('user_id', user.id)
          .not('dropped_out_at', 'is', null)
          .order('joined_at', { ascending: false });

        const droppedData =
          droppedParticipations?.find((p: any) => p.challenges?.status === 'active') || null;
        if (droppedData) {
          participantData = droppedData;
          droppedOutFlag = true;
        }
      }

      setIsDroppedOut(droppedOutFlag);

      if (participantData) {
        const cId = participantData.challenge_id;
        setChallengeId(cId);
        setChallengeStatus(participantData.challenges?.status || 'active');

        // Show completion graphic automatically if challenge is completed
        if (participantData.challenges?.status === 'completed' && !droppedOutFlag) {
          setShowCompletionGraphic(true);
        }

        const { data: allParticipants } = await supabase
          .from('challenge_participants')
          .select('*, profiles(display_name, avatar_url)')
          .eq('challenge_id', cId)
          .order('points', { ascending: false });

        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, points')
          .eq('challenge_id', cId);

        const totalMaxPoints = allTasks?.reduce((sum, task) => sum + task.points, 0) || 0;
        setMaxPoints(totalMaxPoints);
        setTotalTasks(allTasks?.length || 0);

        // One query for all completions in this challenge, tallied per user —
        // avoids an N+1 (previously one count query per participant).
        const { data: completionRows } = await supabase
          .from('task_completions')
          .select('user_id')
          .eq('challenge_id', cId);

        const completionCountByUser = new Map<string, number>();
        (completionRows ?? []).forEach((row) => {
          completionCountByUser.set(row.user_id, (completionCountByUser.get(row.user_id) ?? 0) + 1);
        });

        const participantsWithCounts = (allParticipants || []).map((participant) => ({
          ...participant,
          completed_tasks: completionCountByUser.get(participant.user_id) ?? 0,
        }));

        // Rank is competitive among active players only: a disqualified or
        // dropped-out player with a high score must not outrank (or take the
        // crown from) the leading active player. Inactive players sort last.
        const qualified = participantsWithCounts.filter(p => !p.is_disqualified && !p.dropped_out_at);
        const disqualified = participantsWithCounts.filter(p => p.is_disqualified && !p.dropped_out_at);
        const droppedOut = participantsWithCounts.filter(p => p.dropped_out_at);

        const sortedParticipants = [...qualified, ...disqualified, ...droppedOut].map(
          (p, index) => ({ ...p, rank: index + 1 })
        );

        setParticipants(sortedParticipants as any);

        const currentUser = sortedParticipants.find(p => p.user_id === user.id);
        if (currentUser) {
          setCurrentUserRank(currentUser.rank);
          setCurrentUserPoints(currentUser.points);
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  // Re-fetch every time this tab comes into focus so points stay in sync after
  // task completions (points are recomputed server-side by the DB trigger).
  useFocusEffect(
    useCallback(() => {
      if (user) fetchLeaderboard();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const getRankOrdinal = (rank: number) => {
    const ordinals = ['', '1st', '2nd', '3rd'];
    return rank <= 3 ? ordinals[rank] : `${rank}th`;
  };

  const getRankBannerColor = (rank: number) => {
    if (rank === 1) return '#FCD34D';
    const totalQualified = participants.filter(p => !p.is_disqualified).length;
    if (rank >= totalQualified - 1 && totalQualified > 2) return '#FCA5A5';
    return '#E5E7EB';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const progressPercentage = maxPoints > 0 ? (currentUserPoints / maxPoints) * 100 : 0;

  // Animated reorder — hook must always be called, even before early returns
  const rowAnimations = useLeaderboardReorder(
    participants.map((p) => ({ user_id: p.user_id, rank: p.rank }))
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Leaderboard</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Show completion graphic if challenge is completed
  if (showCompletionGraphic && challengeId && user?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Challenge Complete!</Text>
        </View>
        <ChallengeCompletionGraphic
          challengeId={challengeId}
          userId={user.id}
          userRank={currentUserRank}
          totalParticipants={participants.length}
          onClose={() => setShowCompletionGraphic(false)}
        />
      </View>
    );
  }

  if (participants.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Leaderboard</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../assets/images/trophy_icon.png')}
            style={styles.emptyIcon}
            resizeMode="contain"
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Challenge</Text>
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            Join a challenge to compete on the leaderboard
          </Text>
        </View>
      </View>
    );
  }

  const completedByCurrentUser = participants.find(p => p.user_id === user?.id)?.completed_tasks ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Leaderboard</Text>
      </View>

      <View
        style={[
          styles.rankBanner,
          { backgroundColor: isDroppedOut ? '#F3F4F6' : getRankBannerColor(currentUserRank) },
        ]}
      >
        <Text style={[styles.rankBannerText, { color: theme.text }]}>
          {isDroppedOut ? 'You dropped out of this challenge' : `You're in ${getRankOrdinal(currentUserRank)} place`}
        </Text>
      </View>

      {!isDroppedOut && (
        <View style={[styles.statsSection, { backgroundColor: theme.surface }]}>
          <View style={styles.pointsDisplay}>
            <Text style={[styles.pointsValue, { color: theme.primary }]}>{currentUserPoints}</Text>
            <Text style={[styles.pointsLabel, { color: theme.subtext }]}>out of {maxPoints} points</Text>
          </View>
          <View style={styles.progressSection}>
            <ProgressBar progress={maxPoints > 0 ? currentUserPoints / maxPoints : 0} />
            <Text style={[styles.progressText, { color: theme.subtext }]}>
              {completedByCurrentUser} of {totalTasks} tasks completed
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {participants.map((participant) => {
          const anim = rowAnimations[participant.user_id];
          return (
            <AnimatedParticipantRow
              key={participant.id}
              participant={participant}
              isCurrentUser={participant.user_id === user?.id}
              totalTasks={totalTasks}
              theme={theme}
              translateY={anim?.translateY}
              rankScale={anim?.rankScale}
              getInitials={getInitials}
            />
          );
        })}
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
  rankBanner: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBannerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pointsDisplay: {
    alignItems: 'center',
    gap: 8,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#10B981',
  },
  pointsLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  progressSection: {
    gap: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    gap: 4,
    height: 8,
  },
  progressSegment: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressSegmentCompleted: {
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 8,
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
  emptyIcon: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  participantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  participantCardHighlight: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  participantCardDisqualified: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  participantInfo: {
    gap: 4,
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  participantNameDisqualified: {
    color: '#6B7280',
  },
  disqualifiedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  disqualifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  droppedOutBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  droppedOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  participantRight: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 80,
  },
  participantPoints: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  participantPointsDisqualified: {
    color: '#6B7280',
  },
  miniProgressBar: {
    width: 80,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  miniProgressFillDisqualified: {
    backgroundColor: '#9CA3AF',
  },
});
