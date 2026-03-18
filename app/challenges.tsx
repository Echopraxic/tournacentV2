import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Clock, DollarSign, Target } from 'lucide-react-native';

interface Challenge {
  id: string;
  name: string;
  duration_days: number;
  buy_in_amount: number;
  prize_pool: number;
  status: string;
}

export default function ChallengesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userChallengeIds, setUserChallengeIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadChallenges();
    }
  }, [user]);

  const loadChallenges = async () => {
    try {
      const { data: userParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user!.id);

      const userIds = userParticipations?.map((p) => p.challenge_id) || [];
      setUserChallengeIds(userIds);

      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setChallenges(data || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await supabase.from('challenge_participants').insert({
        challenge_id: challengeId,
        user_id: user!.id,
        payment_status: 'pending',
      });

      await supabase
        .from('challenges')
        .update({
          prize_pool: supabase.rpc('increment_prize_pool', {
            challenge_id: challengeId,
          }),
        })
        .eq('id', challengeId);

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error joining challenge:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Challenges</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {challenges.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No challenges available</Text>
          </View>
        ) : (
          challenges.map((challenge) => {
            const isJoined = userChallengeIds.includes(challenge.id);
            return (
              <View key={challenge.id} style={styles.challengeCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.challengeName}>{challenge.name}</Text>
                    {isJoined && (
                      <View style={styles.joinedBadge}>
                        <Text style={styles.joinedText}>Joined</Text>
                      </View>
                    )}
                  </View>
                  {!isJoined && <ChevronRight color="#D1D5DB" size={24} />}
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.detailText}>{challenge.duration_days} days</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <DollarSign size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      ${challenge.buy_in_amount.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Target size={16} color="#6B7280" />
                    <Text style={styles.detailText}>${challenge.prize_pool.toFixed(0)} pool</Text>
                  </View>
                </View>

                {!isJoined && (
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => handleJoinChallenge(challenge.id)}
                  >
                    <Text style={styles.joinButtonText}>Join Challenge</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
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
    paddingHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleContainer: {
    flex: 1,
    gap: 8,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  joinedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  joinedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
