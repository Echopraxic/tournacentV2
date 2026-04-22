import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

// Returns age in whole years, or -1 if the date is invalid.
function calculateAge(year: number, month: number, day: number): number {
  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) return -1;

  const birth = new Date(year, month - 1, day);
  // Guard against JS silently rolling over invalid dates (e.g. Feb 31)
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) return -1;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Birthday split into three fields for clean mobile UX
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signUp } = useAuth();
  const router = useRouter();

  const dayRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const handleMonthChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 2);
    setDobMonth(digits);
    setError(null);
    // Auto-advance when two digits entered
    if (digits.length === 2) dayRef.current?.focus();
  };

  const handleDayChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 2);
    setDobDay(digits);
    setError(null);
    if (digits.length === 2) yearRef.current?.focus();
  };

  const handleYearChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setDobYear(digits);
    setError(null);
  };

  const handleSignUp = async () => {
    setError(null);

    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (!dobMonth || !dobDay || !dobYear || dobYear.length < 4) {
      setError('Please enter your complete date of birth.');
      return;
    }

    const month = parseInt(dobMonth, 10);
    const day = parseInt(dobDay, 10);
    const year = parseInt(dobYear, 10);
    const age = calculateAge(year, month, day);

    if (age === -1) {
      setError('Please enter a valid date of birth.');
      return;
    }

    if (age < 13) {
      setError('You must be at least 13 years old to create an account.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const isoDate = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, displayName.trim(), isoDate);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the financial challenge</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={displayName}
                onChangeText={v => { setDisplayName(v); setError(null); }}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={v => { setEmail(v); setError(null); }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <Text style={styles.sublabel}>You must be 13 or older to use Tournacent.</Text>
              <View style={styles.dobRow}>
                <View style={styles.dobFieldWrap}>
                  <Text style={styles.dobFieldLabel}>MM</Text>
                  <TextInput
                    style={styles.dobInput}
                    value={dobMonth}
                    onChangeText={handleMonthChange}
                    placeholder="MM"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                    onSubmitEditing={() => dayRef.current?.focus()}
                  />
                </View>

                <Text style={styles.dobSep}>/</Text>

                <View style={styles.dobFieldWrap}>
                  <Text style={styles.dobFieldLabel}>DD</Text>
                  <TextInput
                    ref={dayRef}
                    style={styles.dobInput}
                    value={dobDay}
                    onChangeText={handleDayChange}
                    placeholder="DD"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                    onSubmitEditing={() => yearRef.current?.focus()}
                  />
                </View>

                <Text style={styles.dobSep}>/</Text>

                <View style={[styles.dobFieldWrap, styles.dobYearWrap]}>
                  <Text style={styles.dobFieldLabel}>YYYY</Text>
                  <TextInput
                    ref={yearRef}
                    style={styles.dobInput}
                    value={dobYear}
                    onChangeText={handleYearChange}
                    placeholder="YYYY"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="next"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={v => { setPassword(v); setError(null); }}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setError(null); }}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating account…' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sublabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  dobFieldWrap: {
    alignItems: 'center',
    flex: 1,
  },
  dobYearWrap: {
    flex: 1.6,
  },
  dobFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dobInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
    width: '100%',
  },
  dobSep: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '300',
    paddingBottom: 12,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  link: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
});
