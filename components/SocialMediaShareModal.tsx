import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface Service {
  id: string;
  name: string;
  originalRate: string;
  newRate: string;
}

export function SocialMediaShareModal({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([
    { id: '1', name: '', originalRate: '', newRate: '' },
  ]);

  const addService = () => {
    setServices([
      ...services,
      { id: Date.now().toString(), name: '', originalRate: '', newRate: '' },
    ]);
  };

  const removeService = (id: string) => {
    if (services.length > 1) {
      setServices(services.filter(s => s.id !== id));
    }
  };

  const updateService = (id: string, field: keyof Service, value: string) => {
    setServices(services.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const calculateSavings = (service: Service) => {
    const orig = parseFloat(service.originalRate) || 0;
    const newRate = parseFloat(service.newRate) || 0;
    return orig > 0 ? orig - newRate : 0;
  };

  const totalSavings = services.reduce((sum, s) => sum + calculateSavings(s), 0);
  const hasValidServices = services.some(s => s.name.trim() && s.originalRate && s.newRate);
  const borderColor = `${theme.subtext}30`;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={[styles.overlay, { backgroundColor: `${theme.text}99` }]}>
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.title, { color: theme.text }]}>Create Social Media Graphic</Text>
            <TouchableOpacity onPress={onClose}>
              <X color={theme.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <Text style={[styles.instruction, { color: theme.subtext }]}>
              Enter the services you negotiated to generate a shareable graphic.
            </Text>

            {services.map((service, idx) => (
              <View key={service.id} style={[styles.serviceCard, { borderColor }]}>
                <View style={styles.serviceNumber}>
                  <Text style={[styles.serviceNumberText, { color: theme.primary }]}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={styles.serviceFields}>
                  <TextInput
                    placeholder="Service name (e.g., Internet, Phone)"
                    value={service.name}
                    onChangeText={v => updateService(service.id, 'name', v)}
                    style={[
                      styles.input,
                      { borderColor, color: theme.text, backgroundColor: theme.background },
                    ]}
                    placeholderTextColor={theme.subtext}
                  />
                  <View style={styles.rateRow}>
                    <View style={styles.rateField}>
                      <Text style={[styles.rateLabel, { color: theme.subtext }]}>Original</Text>
                      <TextInput
                        placeholder="$0.00"
                        value={service.originalRate}
                        onChangeText={v => updateService(service.id, 'originalRate', v)}
                        keyboardType="decimal-pad"
                        style={[
                          styles.input,
                          { borderColor, color: theme.text, backgroundColor: theme.background },
                        ]}
                        placeholderTextColor={theme.subtext}
                      />
                    </View>
                    <View style={styles.arrow}>
                      <Text style={[styles.arrowText, { color: theme.subtext }]}>→</Text>
                    </View>
                    <View style={styles.rateField}>
                      <Text style={[styles.rateLabel, { color: theme.subtext }]}>New Rate</Text>
                      <TextInput
                        placeholder="$0.00"
                        value={service.newRate}
                        onChangeText={v => updateService(service.id, 'newRate', v)}
                        keyboardType="decimal-pad"
                        style={[
                          styles.input,
                          { borderColor, color: theme.text, backgroundColor: theme.background },
                        ]}
                        placeholderTextColor={theme.subtext}
                      />
                    </View>
                  </View>
                  {service.originalRate && service.newRate && (
                    <Text style={[styles.savings, { color: '#10B981' }]}>
                      Saves ${calculateSavings(service).toFixed(2)}/mo
                    </Text>
                  )}
                </View>
                {services.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeService(service.id)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 color="#EF4444" size={20} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              onPress={addService}
              style={[styles.addBtn, { borderColor: theme.primary }]}
            >
              <Plus color={theme.primary} size={20} />
              <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Another Service</Text>
            </TouchableOpacity>

            {hasValidServices && (
              <View style={[styles.preview, { backgroundColor: theme.background, borderColor }]}>
                <Text style={[styles.previewTitle, { color: theme.text }]}>Preview Graphic</Text>
                <View style={[styles.graphicContainer, { backgroundColor: '#1F2937' }]}>
                  <Text style={styles.graphicHeader}>🎯 My Rate Check Wins</Text>
                  <View style={styles.servicesGrid}>
                    {services
                      .filter(s => s.name.trim() && s.originalRate && s.newRate)
                      .map((service, idx) => (
                        <View key={service.id} style={styles.graphicService}>
                          <Text style={styles.graphicServiceName} numberOfLines={2}>
                            {service.name}
                          </Text>
                          <Text style={styles.graphicRate}>${service.originalRate}</Text>
                          <Text style={styles.graphicArrow}>↓</Text>
                          <Text style={styles.graphicNewRate}>${service.newRate}</Text>
                          <Text style={styles.graphicSavings}>
                            Save ${calculateSavings(service).toFixed(2)}/mo
                          </Text>
                        </View>
                      ))}
                  </View>
                  <View style={styles.graphicTotal}>
                    <Text style={styles.graphicTotalText}>
                      Total Monthly Savings: ${totalSavings.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.graphicFooter}>via Tournacent</Text>
                </View>

                <Text style={[styles.screenshotNote, { color: theme.subtext }]}>
                  📸 Screenshot this graphic and upload as your task completion evidence.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.cancelBtn, { borderColor }]}
            >
              <Text style={[styles.cancelText, { color: theme.subtext }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onComplete}
              disabled={!hasValidServices}
              style={[
                styles.completeBtn,
                { backgroundColor: hasValidServices ? theme.primary : theme.subtext },
              ]}
            >
              <Text style={styles.completeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '90%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  instruction: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  serviceCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  serviceNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  serviceNumberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  serviceFields: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  rateField: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  arrow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '600',
  },
  savings: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
  },
  addBtn: {
    flexDirection: 'row',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  graphicContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  graphicHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  graphicService: {
    width: '48%',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  graphicServiceName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  graphicRate: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  graphicArrow: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  graphicNewRate: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  graphicSavings: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
  },
  graphicTotal: {
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  graphicTotalText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  graphicFooter: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  screenshotNote: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  completeBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
