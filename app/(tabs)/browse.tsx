import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PRESET_CHALLENGES, PresetChallenge } from '@/lib/presets';
import { ChevronRight, Clock, DollarSign, Users, Share2 } from 'lucide-react-native';

type ModalStep = 'choose_type' | 'group_info' | 'group_sharing';

const APP_STORE_URL = 'https://apps.apple.com/app/tournacent/id000000000'; // placeholder
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tournacent'; // placeholder
const INVITE_BASE_URL = 'https://tournacent.app/join';

export default function BrowseScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedPreset, setSelectedPreset] = useState<PresetChallenge | null>(null);
  const [step, setStep] = useState<ModalStep | null>(null);
  const [joining, setJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Join-with-code modal
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const insertTasksFromPreset = async (preset: PresetChallenge, challengeId: string) => {
    await supabase.from('tasks').insert(
      preset.tasks.map((t) => ({ ...t, challenge_id: challengeId }))
    );
  };

  const checkNoActiveChallenge = async (): Promise<boolean> => {
    const { data } = await supabase
      .from('challenge_participants')
      .select('challenge_id, challenges(status)')
      .eq('user_id', user!.id)
      .is('dropped_out_at', null);
    return !data?.some((p: any) => ['pending', 'active'].includes(p.challenges?.status));
  };

  const handleJoinWithCode = async () => {
    if (!codeInput || !user) return;
    setLookingUp(true);
    setCodeError(null);
    try {
      const { data, error } = await supabase.rpc('get_challenge_by_invite_code', { code: codeInput });
      if (error || !data?.length) {
        setCodeError('Invalid invite code or the challenge has expired.');
        return;
      }
      setShowCodeEntry(false);
      setCodeInput('');
      router.push(`/join/${codeInput}`);
    } catch {
      setCodeError('Something went wrong. Please try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleJoinSolo = async () => {
    if (!selectedPreset || !user) return;
    setJoining(true);
    setJoinError(null);
    try {
      const canJoin = await checkNoActiveChallenge();
      if (!canJoin) {
        setJoinError('You are already in an active challenge. Drop out first to join a new one.');
        return;
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + selectedPreset.duration_days * 24 * 60 * 60 * 1000);

      const { data: newChallenge, error } = await supabase
        .from('challenges')
        .insert({
          name: selectedPreset.name,
          organizer_id: user.id,
          buy_in_amount: selectedPreset.buy_in_amount,
          duration_days: selectedPreset.duration_days,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          challenge_type: 'solo',
          prize_pool: 0,
          is_template: false,
        })
        .select()
        .single();

      if (error) throw error;

      await Promise.all([
        insertTasksFromPreset(selectedPreset, newChallenge.id),
        supabase.from('challenge_participants').insert({
          challenge_id: newChallenge.id,
          user_id: user.id,
          payment_status: 'paid',
        }),
      ]);

      closeModal();
      router.replace('/(tabs)');
    } catch (error: any) {
      setJoinError(error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!selectedPreset || !user) return;
    setJoining(true);
    setJoinError(null);
    try {
      const canJoin = await checkNoActiveChallenge();
      if (!canJoin) {
        setJoinError('You are already in an active challenge. Drop out first to start a new one.');
        return;
      }

      const { data: code, error: codeError } = await supabase.rpc('generate_invite_code');
      if (codeError) throw codeError;

      const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { data: newChallenge, error } = await supabase
        .from('challenges')
        .insert({
          name: selectedPreset.name,
          organizer_id: user.id,
          buy_in_amount: selectedPreset.buy_in_amount,
          duration_days: selectedPreset.duration_days,
          status: 'pending',
          challenge_type: 'group',
          invite_code: code,
          pending_expires_at: pendingExpiresAt,
          prize_pool: 0,
          is_template: false,
        })
        .select()
        .single();

      if (error) throw error;

      await Promise.all([
        insertTasksFromPreset(selectedPreset, newChallenge.id),
        supabase.from('challenge_participants').insert({
          challenge_id: newChallenge.id,
          user_id: user.id,
          payment_status: 'pending',
        }),
      ]);

      setInviteCode(code);
      setStep('group_sharing');
    } catch (error: any) {
      setJoinError(error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    if (!selectedPreset || !inviteCode) return;
    const inviteUrl = `${INVITE_BASE_URL}/${inviteCode}`;
    const storeLink = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    const message = [
      `I'm challenging you on Tournacent! 🏆`,
      ``,
      `Join my "${selectedPreset.name}" challenge and compete for the prize pool.`,
      ``,
      `Your invite code: ${inviteCode}`,
      ``,
      `📱 Download the app & join automatically:`,
      storeLink,
      ``,
      `Already have Tournacent? Open: ${inviteUrl}`,
    ].join('\n');

    try {
      await Share.share(
        { message, url: inviteUrl },
        { dialogTitle: 'Invite friends to your challenge' }
      );
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const closeModal = () => {
    setSelectedPreset(null);
    setStep(null);
    setInviteCode('');
    setJoinError(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Browse Challenges</Text>
        <TouchableOpacity onPress={() => { setShowCodeEntry(true); setCodeError(null); }}>
          <Text style={styles.enterCodeButton}>Enter Code</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {PRESET_CHALLENGES.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={styles.challengeCard}
            onPress={() => {
              setSelectedPreset(preset);
              setStep('choose_type');
            }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.challengeName}>{preset.name}</Text>
              <ChevronRight color="#D1D5DB" size={24} />
            </View>
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.detailText}>{preset.duration_days} days</Text>
              </View>
              <View style={styles.detailItem}>
                <DollarSign size={16} color="#6B7280" />
                <Text style={styles.detailText}>${preset.buy_in_amount.toFixed(2)} buy-in</Text>
              </View>
              <View style={styles.detailItem}>
                <Users size={16} color="#6B7280" />
                <Text style={styles.detailText}>Solo or Group</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Join with code modal ── */}
      {showCodeEntry && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => { setShowCodeEntry(false); setCodeInput(''); setCodeError(null); }}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Join with Invite Code</Text>
            <Text style={styles.sheetSubtitle}>Enter a TC-XXXX code shared by a friend</Text>
            <TextInput
              style={styles.codeInputField}
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="TC-XXXX"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
            />
            {codeError && <Text style={styles.errorText}>{codeError}</Text>}
            <TouchableOpacity
              style={[styles.primaryButton, (lookingUp || codeInput.length < 7) && styles.buttonDisabled]}
              onPress={handleJoinWithCode}
              disabled={lookingUp || codeInput.length < 7}
            >
              <Text style={styles.primaryButtonText}>
                {lookingUp ? 'Looking up…' : 'Find Challenge'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowCodeEntry(false); setCodeInput(''); setCodeError(null); }}
              style={styles.cancelLink}
            >
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Preset selection modal ── */}
      {selectedPreset && step && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBackdrop} onPress={closeModal} />
          <View style={styles.sheet}>

            {/* Step 1 — Choose type */}
            {step === 'choose_type' && (
              <>
                <Text style={styles.sheetTitle}>{selectedPreset.name}</Text>
                <Text style={styles.sheetSubtitle}>How do you want to play?</Text>

                <TouchableOpacity
                  style={styles.typeCard}
                  onPress={handleJoinSolo}
                  disabled={joining}
                >
                  <Text style={styles.typeCardTitle}>Solo</Text>
                  <Text style={styles.typeCardDesc}>
                    Start immediately. Track your own progress — no waiting, no group needed.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeCard, styles.typeCardGroup]}
                  onPress={() => setStep('group_info')}
                  disabled={joining}
                >
                  <Text style={[styles.typeCardTitle, { color: '#FFFFFF' }]}>Group</Text>
                  <Text style={[styles.typeCardDesc, { color: '#D1FAE5' }]}>
                    Compete with friends. Pool your buy-ins and the winner takes all.
                  </Text>
                </TouchableOpacity>

                {joining && <ActivityIndicator color="#10B981" style={{ marginTop: 8 }} />}
                {joinError && <Text style={styles.errorText}>{joinError}</Text>}

                <TouchableOpacity onPress={closeModal} style={styles.cancelLink}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2 — Group info */}
            {step === 'group_info' && (
              <>
                <Text style={styles.sheetTitle}>Group Challenge Rules</Text>

                <View style={styles.rulesList}>
                  {[
                    ['👥', 'Requires at least 3 players to activate'],
                    ['⏰', 'Friends have 48 hours to join using your invite code — then the challenge auto-cancels if fewer than 3 joined'],
                    ['💸', `Buy-in ($${selectedPreset.buy_in_amount.toFixed(2)}) is only collected when the challenge activates`],
                    ['🕒', 'Once active, players have 48 hours to complete their buy-in or they are removed'],
                    ['🏆', 'Additional players can join for the first 48 hours after activation'],
                  ].map(([icon, text], i) => (
                    <View key={i} style={styles.ruleRow}>
                      <Text style={styles.ruleBullet}>{icon}</Text>
                      <Text style={styles.ruleText}>{text}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, joining && styles.buttonDisabled]}
                  onPress={handleCreateGroup}
                  disabled={joining}
                >
                  <Text style={styles.primaryButtonText}>
                    {joining ? 'Creating challenge…' : 'Create & Get Invite Code'}
                  </Text>
                </TouchableOpacity>

                {joinError && <Text style={styles.errorText}>{joinError}</Text>}

                <TouchableOpacity onPress={() => setStep('choose_type')} style={styles.cancelLink}>
                  <Text style={styles.cancelLinkText}>Back</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 3 — Share */}
            {step === 'group_sharing' && (
              <>
                <Text style={styles.sheetTitle}>Invite Your Friends</Text>
                <Text style={styles.sheetSubtitle}>
                  Share this code — 3 players needed to start the challenge
                </Text>

                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{inviteCode}</Text>
                </View>

                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                  <Share2 size={20} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>Share via SMS, Snapchat, Instagram, Email…</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    closeModal();
                    router.replace('/(tabs)');
                  }}
                >
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#111827' },
  enterCodeButton: { fontSize: 15, color: '#10B981', fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  detailsRow: { flexDirection: 'row', gap: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // ── Modals ─────────────────────────────────────────────────────────────────
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  sheetSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginTop: -8 },

  typeCard: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, gap: 6 },
  typeCardGroup: { backgroundColor: '#10B981', borderColor: '#10B981' },
  typeCardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  typeCardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  rulesList: { gap: 12 },
  ruleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ruleBullet: { fontSize: 18, width: 28 },
  ruleText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },

  codeBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  codeText: { fontSize: 32, fontWeight: '800', color: '#111827', letterSpacing: 4 },

  codeInputField: {
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 6,
    backgroundColor: '#F3F4F6',
  },

  shareButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shareButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  primaryButton: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },

  cancelLink: { alignItems: 'center', paddingVertical: 4 },
  cancelLinkText: { fontSize: 14, color: '#6B7280' },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', paddingHorizontal: 8 },
});
