import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, Trophy } from 'lucide-react-native';

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

export default function Leaderboard() {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number>(1);
  const [currentUserPoints, setCurrentUserPoints] = useState<number>(0);
  const [maxPoints, setMaxPoints] = useState<number>(0);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDroppedOut, setIsDroppedOut] = useState(false);

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
      let droppedOut = false;

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
          droppedOut = true;
        }
      }

      setIsDroppedOut(droppedOut);

      if (participantData) {
        const challengeId = participantData.challenge_id;

        const { data: allParticipants } = await supabase
          .from('challenge_participants')
          .select('*, profiles(display_name, avatar_url)')
          .eq('challenge_id', challengeId)
          .order('points', { ascending: false });

        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, points')
          .eq('challenge_id', challengeId);

        const totalMaxPoints = allTasks?.reduce((sum, task) => sum + task.points, 0) || 0;
        setMaxPoints(totalMaxPoints);
        setTotalTasks(allTasks?.length || 0);

        const participantsWithRank = await Promise.all(
          (allParticipants || []).map(async (participant, index) => {
            const { count } = await supabase
              .from('task_completions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', participant.user_id)
              .eq('challenge_id', challengeId);

            return {
              ...participant,
              rank: index + 1,
              completed_tasks: count || 0,
            };
          })
        );

        const qualified = participantsWithRank.filter(p => !p.is_disqualified && !p.dropped_out_at);
        const disqualified = participantsWithRank.filter(p => p.is_disqualified && !p.dropped_out_at);
        const droppedOut = participantsWithRank.filter(p => p.dropped_out_at);

        const sortedParticipants = [...qualified, ...disqualified, ...droppedOut];

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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (participants.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Trophy color="#D1D5DB" size={64} />
          <Text style={styles.emptyTitle}>No Active Challenge</Text>
          <Text style={styles.emptyText}>
            Join a challenge to compete on the leaderboard
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      <View
        style={[
          styles.rankBanner,
          { backgroundColor: isDroppedOut ? '#F3F4F6' : getRankBannerColor(currentUserRank) },
        ]}
      >
        <Text style={styles.rankBannerText}>
          {isDroppedOut ? 'You dropped out of this challenge' : `You're in ${getRankOrdinal(currentUserRank)} place`}
        </Text>
      </View>

      {!isDroppedOut && (
        <View style={styles.statsSection}>
          <View style={styles.pointsDisplay}>
            <Text style={styles.pointsValue}>{currentUserPoints}</Text>
            <Text style={styles.pointsLabel}>out of {maxPoints} points</Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressBarContainer}>
              {Array.from({ length: totalTasks }).map((_, index) => {
                const currentUser = participants.find(p => p.user_id === user?.id);
                const completed = currentUser ? index < currentUser.completed_tasks : false;
                return (
                  <View
                    key={index}
                    style={[
                      styles.progressSegment,
                      completed && styles.progressSegmentCompleted,
                    ]}
                  />
                );
              })}
            </View>
            <Text style={styles.progressText}>
              {participants.find(p => p.user_id === user?.id)?.completed_tasks || 0} of {totalTasks} tasks completed
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
        {participants.map((participant) => (
          <View
            key={participant.id}
            style={[
              styles.participantCard,
              participant.user_id === user?.id && styles.participantCardHighlight,
              (participant.is_disqualified || participant.dropped_out_at) && styles.participantCardDisqualified,
            ]}
          >
            <View style={styles.participantLeft}>
              <View style={styles.rankContainer}>
                {participant.rank === 1 && !participant.is_disqualified ? (
                  <Crown color="#F59E0B" size={20} />
                ) : (
                  <Text style={styles.rankNumber}>{participant.rank}</Text>
                )}
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(participant.profiles.display_name)}
                </Text>
              </View>

              <View style={styles.participantInfo}>
                <Text
                  style={[
                    styles.participantName,
                    (participant.is_disqualified || participant.dropped_out_at) && styles.participantNameDisqualified,
                  ]}
                >
                  {participant.profiles.display_name}
                  {participant.user_id === user?.id && ' (You)'}
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
              <Text
                style={[
                  styles.participantPoints,
                  (participant.is_disqualified || participant.dropped_out_at) && styles.participantPointsDisqualified,
                ]}
              >
                {participant.points} pts
              </Text>
              <View style={styles.miniProgressBar}>
                <View
                  style={[
                    styles.miniProgressFill,
                    {
                      width: `${totalTasks > 0 ? (participant.completed_tasks / totalTasks) * 100 : 0}%`,
                    },
                    (participant.is_disqualified || participant.dropped_out_at) && styles.miniProgressFillDisqualified,
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
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
