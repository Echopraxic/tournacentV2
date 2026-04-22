import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextTask {
  id: string;
  title: string;
  description: string;
  points: number;
}

interface TextEntryModalProps {
  visible: boolean;
  task: TextTask | null;
  challengeId: string;
  userId: string;
  totalPoints: number;
  onClose: () => void;
  onComplete: (points: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMinWords(description: string): number {
  const match = description.match(/(\d+)\+?\s*words?/i);
  return match ? parseInt(match[1], 10) : 0;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── TextEntryModal ───────────────────────────────────────────────────────────

export function TextEntryModal({
  visible,
  task,
  challengeId,
  userId,
  totalPoints,
  onClose,
  onComplete,
}: TextEntryModalProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minWords = task ? parseMinWords(task.description) : 0;
  const words = countWords(text);
  const hasMinWords = minWords === 0 || words >= minWords;
  const canSubmit = text.trim().length > 0 && hasMinWords;

  const wordCountColor = () => {
    if (minWords === 0) return '#6B7280';
    if (words >= minWords) return '#059669';
    if (words >= minWords * 0.75) return '#F59E0B';
    return '#9CA3AF';
  };

  const handleClose = () => {
    setText('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!task || !canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: textErr } = await supabase.from('task_text_submissions').insert({
        user_id: userId,
        task_id: task.id,
        challenge_id: challengeId,
        content: text.trim(),
        word_count: words,
      });
      if (textErr) throw textErr;

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

      setText('');
      onComplete(task.points);
    } catch (err: any) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.header}>
              <Text style={s.title}>{task.title}</Text>
              <Text style={s.desc}>{task.description}</Text>
            </View>

            <ScrollView
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={s.textArea}
                value={text}
                onChangeText={setText}
                placeholder="Start typing here…"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                autoFocus
              />

              {/* Word count row */}
              <View style={s.wordCountRow}>
                <Text style={[s.wordCount, { color: wordCountColor() }]}>
                  {words} {words === 1 ? 'word' : 'words'}
                  {minWords > 0 && ` / ${minWords} minimum`}
                  {minWords > 0 && words >= minWords ? ' ✓' : ''}
                </Text>
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.buttonRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.submitBtn, (!canSubmit || submitting) && s.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit || submitting}
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
    maxHeight: '90%',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  desc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  body: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    minHeight: 200,
    lineHeight: 22,
  },
  wordCountRow: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  wordCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
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
