import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { QUIZZES, scoreToProfile, type QuizDefinition } from '@/lib/quizzes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizTask {
  id: string;
  title: string;
  description: string;
  form_id: string | null;
  points: number;
}

interface QuizModalProps {
  visible: boolean;
  task: QuizTask | null;
  challengeId: string;
  userId: string;
  totalPoints: number;
  onClose: () => void;
  onComplete: (points: number) => void;
}

// ─── QuizModal ────────────────────────────────────────────────────────────────

export function QuizModal({
  visible,
  task,
  challengeId,
  userId,
  totalPoints,
  onClose,
  onComplete,
}: QuizModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quiz: QuizDefinition | null = task?.form_id ? QUIZZES[task.form_id] ?? null : null;

  const totalScore = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.reduce((sum, q) => {
      const choiceId = answers[q.id];
      if (!choiceId) return sum;
      const choice = q.choices.find(c => c.id === choiceId);
      return sum + (choice?.score ?? 0);
    }, 0);
  }, [quiz, answers]);

  const answeredCount = quiz ? Object.keys(answers).length : 0;
  const allAnswered = quiz ? answeredCount === quiz.questions.length : false;
  const profile = quiz && allAnswered ? scoreToProfile(quiz, totalScore) : null;

  const handleSelect = (questionId: string, choiceId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
  };

  const handleClose = () => {
    setAnswers({});
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!task || !quiz || !allAnswered || !profile || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: quizErr } = await supabase.from('task_quiz_submissions').insert({
        user_id: userId,
        task_id: task.id,
        challenge_id: challengeId,
        quiz_id: task.form_id,
        answers,
        score: totalScore,
        profile_label: profile.label,
      });
      if (quizErr) throw quizErr;

      const { error: completionErr } = await supabase.from('task_completions').insert({
        task_id: task.id,
        user_id: userId,
        challenge_id: challengeId,
      });
      if (completionErr) throw completionErr;

      const { error: pointsErr } = await supabase
        .from('challenge_participants')
        .update({ points: totalPoints + task.points })
        .eq('user_id', userId)
        .eq('challenge_id', challengeId);
      if (pointsErr) throw pointsErr;

      setAnswers({});
      onComplete(task.points);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (!task || !quiz) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.headerTitle}>{task.title}</Text>
              <Text style={s.headerDesc}>{task.description}</Text>
              <View style={s.progressRow}>
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      { width: `${(answeredCount / quiz.questions.length) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={s.progressLabel}>
                  {answeredCount} / {quiz.questions.length}
                </Text>
              </View>
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {quiz.questions.map((question, qIndex) => {
                const selected = answers[question.id];
                return (
                  <View key={question.id} style={s.questionCard}>
                    <Text style={s.questionNumber}>Question {qIndex + 1}</Text>
                    <Text style={s.questionText}>{question.text}</Text>
                    <View style={s.choiceList}>
                      {question.choices.map(choice => {
                        const isSelected = selected === choice.id;
                        return (
                          <TouchableOpacity
                            key={choice.id}
                            style={[s.choiceBtn, isSelected && s.choiceBtnSelected]}
                            onPress={() => handleSelect(question.id, choice.id)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[s.choiceRadio, isSelected && s.choiceRadioSelected]}
                            >
                              {isSelected && <View style={s.choiceRadioDot} />}
                            </View>
                            <Text
                              style={[s.choiceText, isSelected && s.choiceTextSelected]}
                            >
                              {choice.text}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {/* Profile result — appears once all questions are answered */}
              {profile && (
                <View style={[s.profileCard, { borderColor: profile.color }]}>
                  <Text style={s.profileHeading}>Your Investment Profile</Text>
                  <View style={[s.profileBadge, { backgroundColor: profile.color }]}>
                    <Text style={s.profileBadgeText}>{profile.label}</Text>
                  </View>
                  <Text style={s.profileScore}>Score: {totalScore} / {quiz.questions.length * 4}</Text>
                  <Text style={s.profileDescription}>{profile.description}</Text>
                </View>
              )}

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.buttonRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    (!allAnswered || submitting) && s.submitBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!allAnswered || submitting}
                >
                  <Text style={s.submitBtnText}>
                    {submitting ? 'Submitting…' : `Submit (+${task.points} pts)`}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 36,
    textAlign: 'right',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  questionNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
  },
  choiceList: {
    gap: 8,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
  },
  choiceBtnSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  choiceRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceRadioSelected: {
    borderColor: '#10B981',
  },
  choiceRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  choiceText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  choiceTextSelected: {
    color: '#065F46',
    fontWeight: '600',
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    gap: 10,
    alignItems: 'center',
  },
  profileHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profileBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  profileScore: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  profileDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  submitBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
