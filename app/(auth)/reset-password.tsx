import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

// Supabase redirects the recovery email link back to tournacent://reset-password
// with the session tokens in the URL fragment (or query). Pull them out so we
// can establish a short-lived recovery session and let the user set a password.
function parseTokensFromUrl(url: string) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramString =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(paramString);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
  };
}

type Phase = 'verifying' | 'ready' | 'invalid' | 'done';

export default function ResetPassword() {
  const url = Linking.useURL();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('verifying');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Establish the recovery session from the deep-link tokens.
  useEffect(() => {
    if (!url) return;
    const { access_token, refresh_token } = parseTokensFromUrl(url);
    if (!access_token || !refresh_token) {
      setPhase('invalid');
      return;
    }
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error: sessionError }) => {
        setPhase(sessionError ? 'invalid' : 'ready');
      });
  }, [url]);

  const handleUpdatePassword = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Force a clean re-login with the new password.
      await supabase.auth.signOut();
      setPhase('done');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'verifying') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.verifyingText}>Verifying your reset link…</Text>
      </View>
    );
  }

  if (phase === 'invalid') {
    return (
      <View style={[styles.container, styles.content]}>
        <View style={styles.header}>
          <Text style={styles.title}>Link Expired</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or has expired. Request a new one to try again.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)/forgot-password')}
        >
          <Text style={styles.buttonText}>Request New Link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={[styles.container, styles.content]}>
        <View style={styles.header}>
          <Text style={styles.title}>Password Updated</Text>
          <Text style={styles.subtitle}>Your password has been changed. Sign in with your new password.</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // phase === 'ready'
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Choose a new password for your account.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="••••••••"
              value={password}
              onChangeText={v => { setPassword(v); setError(null); }}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
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
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Updating…' : 'Update Password'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { justifyContent: 'center', alignItems: 'center' },
  verifyingText: { marginTop: 16, fontSize: 15, color: '#6B7280' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 30, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FFF8F8' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12 },
  errorText: { fontSize: 14, color: '#DC2626', textAlign: 'center', lineHeight: 20 },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
