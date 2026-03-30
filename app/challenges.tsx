import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Clock, DollarSign, Users, Share2 } from 'lucide-react-native';

interface Challenge {
  id: string;
  name: string;
  duration_days: number;
  buy_in_amount: number;
  prize_pool: number;
  status: string;
}

type ModalStep = 'choose_type' | 'group_info' | 'group_sharing';

const APP_STORE_URL = 'https://apps.apple.com/app/tournacent/id000000000'; // placeholder
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tournacent'; // placeholder
const INVITE_BASE_URL = 'https://tournacent.app/join';

export default function ChallengesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Challenge | null>(null);
  const [step, setStep] = useState<ModalStep | null>(null);
  const [joining, setJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (user) loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    try {
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_template', true)
        .order('created_at', { ascending: false });
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyTasksFromTemplate = async (templateId: string, newChallengeId: string) => {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('title, description, points, is_mandatory, task_type')
      .eq('challenge_id', templateId);
    if (tasks?.length) {
      await supabase.from('tasks').insert(
        tasks.map((t) => ({ ...t, challenge_id: newChallengeId }))
      );
    }
  };

  const handleJoinSolo = async () => {
    if (!selectedTemplate || !user) return;
    setJoining(true);
    try {
      const now = new Date();
      const endDate = new Date(
        now.getTime() + selectedTemplate.duration_days * 24 * 60 * 60 * 1000
      );

      const { data: newChallenge, error } = await supabase
        .from('challenges')
        .insert({
          name: selectedTemplate.name,
          organizer_id: user.id,
          buy_in_amount: selectedTemplate.buy_in_amount,
          duration_days: selectedTemplate.duration_days,
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
        copyTasksFromTemplate(selectedTemplate.id, newChallenge.id),
        supabase.from('challenge_participants').insert({
          challenge_id: newChallenge.id,
          user_id: user.id,
          payment_status: 'paid',
        }),
      ]);

      closeModal();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error joining solo challenge:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!selectedTemplate || !user) return;
    setJoining(true);
    try {
      const { data: code, error: codeError } = await supabase.rpc('generate_invite_code');
      if (codeError) throw codeError;

      const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { data: newChallenge, error } = await supabase
        .from('challenges')
        .insert({
          name: selectedTemplate.name,
          organizer_id: user.id,
          buy_in_amount: selectedTemplate.buy_in_amount,
          duration_days: selectedTemplate.duration_days,
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
        copyTasksFromTemplate(selectedTemplate.id, newChallenge.id),
        supabase.from('challenge_participants').insert({
          challenge_id: newChallenge.id,
          user_id: user.id,
          payment_status: 'pending',
        }),
      ]);

      setInviteCode(code);
      setStep('group_sharing');
    } catch (error) {
      console.error('Error creating group challenge:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    if (!selectedTemplate || !inviteCode) return;
    const inviteUrl = `${INVITE_BASE_URL}/${inviteCode}`;
    const storeLink = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    const message = [
      `I'm challenging you on Tournacent! 🏆`,
      ``,
      `Join my "${selectedTemplate.name}" challenge and compete for the prize pool.`,
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
    setSelectedTemplate(null);
    setStep(null);
    setInviteCode('');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
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
        {templates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No challenges available</Text>
          </View>
        ) : (
          templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={styles.challengeCard}
              onPress={() => {
                setSelectedTemplate(template);
                setStep('choose_type');
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.challengeName}>{template.name}</Text>
                <ChevronRight color="#D1D5DB" size={24} />
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Clock size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{template.duration_days} days</Text>
                </View>
                <View style={styles.detailItem}>
                  <DollarSign size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    ${Number(template.buy_in_amount).toFixed(2)} buy-in
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Users size={16} color="#6B7280" />
                  <Text style={styles.detailText}>Solo or Group</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ── Bottom-sheet modal ── */}
      {selectedTemplate && step && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBackdrop} onPress={closeModal} />
          <View style={styles.sheet}>

            {/* Step 1 — Choose type */}
            {step === 'choose_type' && (
              <>
                <Text style={styles.sheetTitle}>{selectedTemplate.name}</Text>
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
                    ['💸', `Buy-in ($${Number(selectedTemplate.buy_in_amount).toFixed(2)}) is only collected when the challenge activates`],
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  backButton: { fontSize: 16, color: '#10B981', fontWeight: '600', paddingHorizontal: 8 },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, color: '#6B7280' },
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

  // ── Modal ──────────────────────────────────────────────────────────────────
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

  typeCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
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

  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },

  cancelLink: { alignItems: 'center', paddingVertical: 4 },
  cancelLinkText: { fontSize: 14, color: '#6B7280' },
});
