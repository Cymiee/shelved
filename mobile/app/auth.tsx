import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { Colors } from '../constants/colors';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, loading } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  function extractMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return 'Something went wrong. Please try again.';
  }

  async function handleSubmit() {
    setError(null);
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      if (mode === 'login') {
        await login(email, password);
        router.replace('/(tabs)');
      } else {
        const { needsConfirmation } = await register(email, password, username);
        if (needsConfirmation) {
          setConfirmationSent(true);
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      setError(extractMessage(err));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>Shelved</Text>
        <Text style={styles.tagline}>Track, rate, and discover games.</Text>

        <View style={styles.tabRow}>
          {(['login', 'signup'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => { setMode(tab); setError(null); }}
              style={[styles.tab, mode === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === tab && styles.tabTextActive]}>
                {tab === 'login' ? 'Sign in' : 'Sign up'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'signup' && (
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />
        )}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          style={styles.input}
        />

        {mode === 'signup' && (
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            style={styles.input}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {confirmationSent && (
          <Text style={styles.confirmation}>
            Check your email to confirm your account, then sign in.
          </Text>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        >
          {loading ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.submitText}>{mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
          )}
        </Pressable>

        {mode === 'signup' && (
          <Text style={styles.tos}>By signing up you agree to our Terms of Service</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  wordmark: { fontFamily: 'Syne_700Bold', fontSize: 36, color: Colors.accent, textAlign: 'center' },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  tabRow: { flexDirection: 'row', gap: 24, marginBottom: 8 },
  tab: { paddingBottom: 6, borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: Colors.accent },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textMuted },
  tabTextActive: { color: Colors.textPrimary, fontFamily: 'Inter_500Medium' },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.danger },
  confirmation: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#4ade80' },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { fontFamily: 'Syne_700Bold', fontSize: 15, color: '#111' },
  tos: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
