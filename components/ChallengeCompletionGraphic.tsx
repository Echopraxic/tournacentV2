import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share as RNShare,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Share2, Copy } from 'lucide-react-native';

interface CompletionGraphicProps {
  challengeId: string;
  userId: string;
  userRank?: number;
  totalParticipants?: number;
  onClose?: () => void;
}

export function ChallengeCompletionGraphic({
  challengeId,
  userId,
  userRank,
  totalParticipants,
  onClose,
}: CompletionGraphicProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetchCompletionData();
  }, [challengeId, userId]);

  const fetchCompletionData = async () => {
    try {
      // Fetch challenge info
      const { data: challenge } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      // Fetch user's task completions
      const { data: completions } = await supabase
        .from('task_completions')
        .select('task_id, tasks(is_mandatory, points, task_type)')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId);

      // Fetch all tasks to calculate metrics
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('id, is_mandatory, points, task_type, form_id')
        .eq('challenge_id', challengeId);

      // Calculate metrics
      const totalPoints = completions?.reduce((sum, c: any) => sum + (c.tasks?.points || 0), 0) || 0;
      const maxPoints = allTasks?.reduce((sum, t) => sum + (t.points || 0), 0) || 0;
      const mandatoryCompleted = completions?.filter((c: any) => c.tasks?.is_mandatory).length || 0;
      const optionalCompleted = completions?.filter((c: any) => !c.tasks?.is_mandatory).length || 0;

      // Calculate days elapsed
      const createdAt = new Date(challenge.created_at);
      const endDate = new Date(challenge.end_date);
      const daysElapsed = Math.floor((endDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate challenge-specific metrics
      let estimatedImpact = '';
      if (challenge.preset_id === 'debt-destroyer-sprint') {
        const estimatedDebtPaid = totalPoints * 3.5;
        estimatedImpact = `$${estimatedDebtPaid.toFixed(0)} paid toward debt`;
      } else if (challenge.preset_id === 'investment-starter') {
        const estimatedInvested = totalPoints * 4;
        estimatedImpact = `$${estimatedInvested.toFixed(0)} invested`;
      } else if (challenge.preset_id === 'bill-negotiation-blitz') {
        const estimatedSavings = totalPoints * 2;
        estimatedImpact = `$${(estimatedSavings * 12).toFixed(0)}/year saved`;
      } else if (challenge.preset_id === 'no-spend-reset') {
        const estimatedSpendingReduced = totalPoints * 2.5;
        estimatedImpact = `$${estimatedSpendingReduced.toFixed(0)} saved`;
      } else if (challenge.preset_id === 'emergency-fund-sprint') {
        const estimatedSaved = totalPoints * 2;
        estimatedImpact = `$${estimatedSaved.toFixed(0)} saved`;
      } else if (challenge.preset_id === 'mini-rate-check') {
        const estimatedMonthlySavings = totalPoints * 3;
        estimatedImpact = `$${estimatedMonthlySavings.toFixed(0)}/month saved`;
      }

      setData({
        challenge,
        totalPoints,
        maxPoints,
        mandatoryCompleted,
        optionalCompleted,
        daysElapsed,
        estimatedImpact,
      });
    } catch (error) {
      console.error('Error fetching completion data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const summary = buildShareSummary();
      await RNShare.share({
        message: summary,
        title: 'Challenge Complete!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setSharing(false);
    }
  };

  const buildShareSummary = () => {
    const { challenge, totalPoints, maxPoints, mandatoryCompleted, optionalCompleted, daysElapsed, estimatedImpact } = data;
    return `I just completed ${challenge.name}! 🎉\n\nScore: ${totalPoints}/${maxPoints}\nTasks: ${mandatoryCompleted} mandatory, ${optionalCompleted} optional\nTime: ${daysElapsed} days\nImpact: ${estimatedImpact}\n\nvia Tournacent`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!data) {
    return null;
  }

  const isSoloChallenge = !totalParticipants || totalParticipants <= 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={[styles.graphicRoot, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.graphicHeader, { backgroundColor: theme.primary }]}>
          <Text style={styles.headerEmoji}>🎉</Text>
          <Text style={styles.headerTitle}>Challenge Complete!</Text>
        </View>

        {/* Points Card */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardLabel, { color: theme.subtext }]}>TOTAL SCORE</Text>
          <View style={styles.pointsDisplay}>
            <Text style={[styles.pointsValue, { color: theme.primary }]}>
              {data.totalPoints}
            </Text>
            <Text style={[styles.pointsMax, { color: theme.subtext }]}>
              / {data.maxPoints}
            </Text>
          </View>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: `${theme.subtext}20`,
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.primary,
                  width: `${(data.totalPoints / data.maxPoints) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Tasks Card */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardLabel, { color: theme.subtext }]}>TASKS COMPLETED</Text>
          <View style={styles.tasksGrid}>
            <View style={styles.taskStat}>
              <Text style={[styles.statValue, { color: '#EC4899' }]}>
                {data.mandatoryCompleted}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>Mandatory</Text>
            </View>
            <View style={styles.taskStat}>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>
                {data.optionalCompleted}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>Optional</Text>
            </View>
          </View>
        </View>

        {/* Time & Impact Card */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardLabel, { color: theme.subtext }]}>IMPACT & TIME</Text>
          <View style={styles.impactRow}>
            <View style={styles.impactItem}>
              <Text style={[styles.impactValue, { color: '#10B981' }]}>
                {data.daysElapsed}
              </Text>
              <Text style={[styles.impactLabel, { color: theme.subtext }]}>Days</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactItem}>
              <Text style={[styles.impactValue, { color: '#F59E0B' }]}>
                {data.estimatedImpact}
              </Text>
            </View>
          </View>
        </View>

        {/* Leaderboard Card (if multiplayer) */}
        {!isSoloChallenge && userRank && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardLabel, { color: theme.subtext }]}>YOUR RANK</Text>
            <View style={styles.rankDisplay}>
              <Text style={[styles.rankValue, { color: theme.primary }]}>
                #{userRank}
              </Text>
              <Text style={[styles.rankLabel, { color: theme.subtext }]}>
                of {totalParticipants} competitors
              </Text>
            </View>
          </View>
        )}

        {/* Challenge Name */}
        <View style={[styles.card, { backgroundColor: `${theme.primary}10` }]}>
          <Text style={[styles.challengeName, { color: theme.text }]}>
            {data.challenge.name}
          </Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.subtext }]}>
          <Text style={styles.footerText}>via Tournacent</Text>
        </View>
      </View>

      {/* Share Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Share2 color="#FFFFFF" size={20} />
              <Text style={styles.buttonText}>Share</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { borderColor: theme.subtext, borderWidth: 1 }]}
          onPress={() => {
            const summary = buildShareSummary();
            Alert.alert('Share Summary', summary);
          }}
        >
          <Copy color={theme.primary} size={20} />
          <Text style={[styles.buttonText, { color: theme.primary }]}>Copy</Text>
        </TouchableOpacity>
      </View>

      {onClose && (
        <TouchableOpacity
          style={[styles.closeButton, { borderColor: theme.subtext }]}
          onPress={onClose}
        >
          <Text style={[styles.closeText, { color: theme.subtext }]}>Close</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphicRoot: {
    width: 1080,
    padding: 60,
    alignItems: 'center',
    gap: 40,
  },
  graphicHeader: {
    width: '100%',
    paddingVertical: 80,
    paddingHorizontal: 40,
    borderRadius: 20,
    alignItems: 'center',
    gap: 20,
  },
  headerEmoji: {
    fontSize: 72,
  },
  headerTitle: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 1,
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  pointsValue: {
    fontSize: 72,
    fontWeight: '700',
  },
  pointsMax: {
    fontSize: 32,
    fontWeight: '600',
    marginLeft: 8,
  },
  progressBar: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  tasksGrid: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 40,
  },
  taskStat: {
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  impactRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
  },
  impactItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  impactValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  impactLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  impactDivider: {
    width: 2,
    height: 60,
    backgroundColor: '#E5E7EB',
  },
  rankDisplay: {
    alignItems: 'center',
    gap: 8,
  },
  rankValue: {
    fontSize: 56,
    fontWeight: '700',
  },
  rankLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  challengeName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    paddingVertical: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
