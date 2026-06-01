import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, Plus, Minus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CounterTask {
  id: string;
  title: string;
  description: string;
  points: number;
}

interface CounterModalProps {
  visible: boolean;
  task: CounterTask | null;
  challengeId: string;
  userId: string;
  totalPoints: number;
  initialCount: number;
  onClose: () => void;
  onComplete: (points: number) => void;
  onCounterUpdate: (taskId: string, count: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseCounterTarget(title: string): number {
  const match = title.match(/(\d+)\s*times?/i);
  return match ? parseInt(match[1], 10) : 10;
}

// ─── CounterModal ─────────────────────────────────────────────────────────────

export function CounterModal({
  visible,
  task,
  challengeId,
  userId,
  totalPoints,
  initialCount,
  onClose,
  onComplete,
  onCounterUpdate,
}: CounterModalProps) {
  const [count, setCount] = useState(initialCount);
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [evidenceMime, setEvidenceMime] = useState<string>('image/jpeg');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = task ? parseCounterTarget(task.title) : 10;
  const atTarget = count >= target;
  const progressPct = `${Math.min((count / target) * 100, 100)}%`;

  useEffect(() => {
    if (visible) {
      setCount(initialCount);
      setEvidenceUri(null);
      setEvidenceMime('image/jpeg');
      setError(null);
    }
  }, [visible, initialCount]);

  const upsert = async (newCount: number) => {
    if (!task) return;
    await supabase.from('task_counters').upsert(
      {
        user_id: userId,
        task_id: task.id,
        challenge_id: challengeId,
        count: newCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,task_id' }
    );
    onCounterUpdate(task.id, newCount);
  };

  const handleIncrement = async () => {
    const newCount = count + 1;
    setCount(newCount);
    await upsert(newCount);
  };

  const handleDecrement = async () => {
    if (count <= 0) return;
    const newCount = count - 1;
    setCount(newCount);
    await upsert(newCount);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library access is required to upload evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mime = asset.mimeType ?? 'image/jpeg';
      const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
      if (!ALLOWED_IMAGE_TYPES.includes(mime.toLowerCase())) {
        setError('Only JPEG, PNG, HEIC, or WebP images are allowed.');
        return;
      }
      setEvidenceUri(asset.uri);
      setEvidenceMime(mime);
      setError(null);
    }
  };

  const handleComplete = async () => {
    if (!task || !atTarget || !evidenceUri || completing) return;
    setCompleting(true);
    setError(null);
    try {
      const response = await fetch(evidenceUri);
      const blob = await response.blob();
      const path = `${userId}/${task.id}`;
      const { error: uploadErr } = await supabase.storage
        .from('task-evidence')
        .upload(path, blob, { contentType: evidenceMime, upsert: true });
      if (uploadErr) throw uploadErr;

      // Completion + scoring are server-authoritative (complete-task verifies
      // the counter submission exists and the points trigger derives the score).
      const { data: result, error: fnErr } = await supabase.functions.invoke('complete-task', {
        body: { task_id: task.id, evidence_url: path },
      });
      if (fnErr) throw fnErr;
      if (!result?.success) { setError(result?.message || 'Could not complete task'); return; }

      setEvidenceUri(null);
      onComplete(task.points);
    } catch (err: any) {
      setError(err.message || 'Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
            {/* Progress bar */}
            <View style={s.progressSection}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: progressPct as any }]} />
              </View>
              <Text style={s.progressLabel}>
                {count} / {target} times
              </Text>
            </View>

            {/* Counter */}
            <View style={s.counterRow}>
              <TouchableOpacity
                style={[s.counterBtn, s.decrementBtn, count <= 0 && s.counterBtnDisabled]}
                onPress={handleDecrement}
                disabled={count <= 0}
                activeOpacity={0.7}
              >
                <Minus size={28} color={count <= 0 ? '#D1D5DB' : '#EF4444'} />
              </TouchableOpacity>

              <View style={s.countDisplay}>
                <Text style={[s.countNumber, atTarget && s.countNumberDone]}>{count}</Text>
                <Text style={s.countTarget}>of {target}</Text>
              </View>

              <TouchableOpacity
                style={[s.counterBtn, s.incrementBtn]}
                onPress={handleIncrement}
                activeOpacity={0.7}
              >
                <Plus size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Goal reached banner */}
            {atTarget && (
              <View style={s.achievedBanner}>
                <Text style={s.achievedText}>
                  Goal reached! Upload a photo to complete the task.
                </Text>
              </View>
            )}

            {/* Photo evidence — only shown once target is reached */}
            {atTarget && (
              <>
                <Text style={s.photoLabel}>Upload Evidence</Text>
                <TouchableOpacity style={s.uploadArea} onPress={handlePickPhoto}>
                  {evidenceUri ? (
                    <Image
                      source={{ uri: evidenceUri }}
                      style={s.evidencePreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={s.uploadPlaceholder}>
                      <ImageIcon size={32} color="#9CA3AF" />
                      <Text style={s.uploadPlaceholderText}>Tap to choose a photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {evidenceUri && (
                  <TouchableOpacity onPress={handlePickPhoto}>
                    <Text style={s.changePhotoText}>Change photo</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {error && <Text style={s.errorText}>{error}</Text>}

            <View style={s.buttonRow}>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Text style={s.closeBtnText}>Close</Text>
              </TouchableOpacity>
              {atTarget && (
                <TouchableOpacity
                  style={[
                    s.completeBtn,
                    (!evidenceUri || completing) && s.completeBtnDisabled,
                  ]}
                  onPress={handleComplete}
                  disabled={!evidenceUri || completing}
                >
                  <Text style={s.completeBtnText}>
                    {completing ? 'Completing…' : `Complete (+${task.points} pts)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
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
    maxHeight: '85%',
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
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  progressSection: {
    gap: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  counterBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decrementBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  incrementBtn: {
    backgroundColor: '#10B981',
  },
  counterBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  countDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  countNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 64,
  },
  countNumberDone: {
    color: '#059669',
  },
  countTarget: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  achievedBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  achievedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    textAlign: 'center',
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    height: 160,
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
  },
  uploadPlaceholderText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  evidencePreview: {
    width: '100%',
    height: '100%',
  },
  changePhotoText: {
    fontSize: 13,
    color: '#10B981',
    textAlign: 'center',
    marginTop: -8,
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
  closeBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  completeBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  completeBtnDisabled: {
    opacity: 0.4,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
