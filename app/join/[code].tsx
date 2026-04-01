import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, DollarSign, Users } from 'lucide-react-native';

interface ChallengePreview {
  id: string;
  name: string;
  duration_days: number;
  buy_in_amount: number;
  status: string;
  challenge_type: string;
  invite_code: string;
  pending_expires_at: string | null;
  buyin_deadline: string | null;
  join_deadline: string | null;
}

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<ChallengePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [droppedOut, setDroppedOut] = useState(false);   // dropped out of active — cannot rejoin
  const [canRejoin, setCanRejoin] = useState(false);      // dropped out of pending — can rejoin
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (code) lookupChallenge();
  }, [code]);

  const lookupChallenge = async () => {
    try {
      // Uses SECURITY DEFINER RPC — safe for unauthenticated users
      const { data, error } = await supabase.rpc('get_challenge_by_invite_code', { code });
      if (error || !data?.length) {
        setError('This invite link is invalid or the challenge has expired.');
        return;
      }
      const c = data[0] as ChallengePreview;
      setChallenge(c);

      // Check participation status (only if logged in)
      if (user) {
        const { data: existing } = await supabase
          .from('challenge_participants')
          .select('challenge_id, dropped_out_at')
          .eq('challenge_id', c.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (existing) {
          if (existing.dropped_out_at) {
            // Dropped out of a pending challenge → allow rejoin
            // Dropped out of an active challenge → permanently blocked
            if (c.status === 'pending') {
              setCanRejoin(true);
            } else {
              setDroppedOut(true);
            }
          } else {
            setAlreadyJoined(true);
          }
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkNoActiveChallenge = async (): Promise<boolean> => {
    const { data } = await supabase
      .from('challenge_participants')
      .select('challenge_id, challenges(status)')
      .eq('user_id', user!.id)
      .is('dropped_out_at', null);
    return !data?.some((p: any) => ['pending', 'active'].includes(p.challenges?.status));
  };

  const handleJoin = async () => {
    if (!user || !challenge) return;
    setJoining(true);
    try {
      const canJoin = await checkNoActiveChallenge();
      if (!canJoin) {
        setError('You are already in an active challenge. Drop out first to join a new one.');
        return;
      }
      const { error } = await supabase.from('challenge_participants').insert({
        challenge_id: challenge.id,
        user_id: user.id,
        payment_status: 'pending',
      });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.replace('/(tabs)'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to join challenge.');
    } finally {
      setJoining(false);
    }
  };

  const handleRejoin = async () => {
    if (!user || !challenge) return;
    setJoining(true);
    try {
      const canJoin = await checkNoActiveChallenge();
      if (!canJoin) {
        setError('You are already in an active challenge. Drop out first to rejoin.');
        return;
      }
      // Clear dropped_out_at to restore participation
      const { error } = await supabase
        .from('challenge_participants')
        .update({ dropped_out_at: null })
        .eq('challenge_id', challenge.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.replace('/(tabs)'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to rejoin challenge.');
    } finally {
      setJoining(false);
    }
  };

  const hoursUntil = (iso: string | null) => {
    if (!iso) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60)));
  };

  const isJoinable = () => {
    if (!challenge) return false;
    if (challenge.status === 'pending') return true;
    if (challenge.status === 'active' && challenge.join_deadline) {
      return hoursUntil(challenge.join_deadline) > 0;
    }
    return false;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>🔗</Text>
        <Text style={styles.errorTitle}>Invalid Link</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Go to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>GROUP CHALLENGE</Text>
        </View>

        <Text style={styles.challengeName}>{challenge?.name}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Clock size={20} color="#6B7280" />
            <Text style={styles.statValue}>{challenge?.duration_days}</Text>
            <Text style={styles.statLabel}>days</Text>
          </View>
          <View style={styles.stat}>
            <DollarSign size={20} color="#6B7280" />
            <Text style={styles.statValue}>
              ${Number(challenge?.buy_in_amount ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>buy-in</Text>
          </View>
          <View style={styles.stat}>
            <Users size={20} color="#6B7280" />
            <Text style={styles.statValue}>3+</Text>
            <Text style={styles.statLabel}>players</Text>
          </View>
        </View>

        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Invite Code</Text>
          <Text style={styles.codeValue}>{challenge?.invite_code}</Text>
        </View>

        {challenge?.status === 'pending' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ⏰ {hoursUntil(challenge.pending_expires_at)}h left to recruit players before this
              challenge auto-cancels
            </Text>
          </View>
        )}

        {challenge?.status === 'active' && challenge.join_deadline && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🏃 Challenge is live! {hoursUntil(challenge.join_deadline)}h left to join
            </Text>
          </View>
        )}

        {/* Not logged in */}
        {!user && (
          <>
            <Text style={styles.authPrompt}>
              Create an account or sign in to join this challenge.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Dropped out of active challenge — permanently blocked */}
        {user && droppedOut && (
          <>
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>You dropped out of this challenge and cannot rejoin once it is active.</Text>
            </View>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.secondaryButtonText}>Back to App</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Dropped out of pending challenge — can rejoin */}
        {user && canRejoin && !success && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                You previously left this challenge. You can rejoin while it's still waiting for players.
              </Text>
            </View>
            {isJoinable() ? (
              <TouchableOpacity
                style={[styles.primaryButton, joining && styles.buttonDisabled]}
                onPress={handleRejoin}
                disabled={joining}
              >
                <Text style={styles.primaryButtonText}>
                  {joining ? 'Rejoining…' : 'Rejoin Challenge'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.closedBadge}>
                <Text style={styles.closedText}>This challenge is no longer accepting players</Text>
              </View>
            )}
          </>
        )}

        {/* Already joined */}
        {user && alreadyJoined && (
          <>
            <View style={styles.joinedBadge}>
              <Text style={styles.joinedText}>✓ You're already in this challenge</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.primaryButtonText}>Go to Challenge</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Success */}
        {user && success && (
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedText}>✓ Joined! Taking you to your challenge…</Text>
          </View>
        )}

        {/* Join button — new participants only */}
        {user && !alreadyJoined && !droppedOut && !canRejoin && !success && (
          <>
            {isJoinable() ? (
              <TouchableOpacity
                style={[styles.primaryButton, joining && styles.buttonDisabled]}
                onPress={handleJoin}
                disabled={joining}
              >
                <Text style={styles.primaryButtonText}>
                  {joining ? 'Joining…' : 'Join Challenge'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.closedBadge}>
                <Text style={styles.closedText}>This challenge is no longer accepting players</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#059669', letterSpacing: 1 },
  challengeName: { fontSize: 26, fontWeight: '800', color: '#111827' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  codeRow: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  codeLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  codeValue: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: 3 },
  infoBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
  },
  infoText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  authPrompt: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  joinedBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  joinedText: { fontSize: 14, color: '#059669', fontWeight: '600' },
  closedBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  closedText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  errorEmoji: { fontSize: 48 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
