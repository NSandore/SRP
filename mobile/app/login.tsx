import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/hooks/use-session';
import { resetPassword } from '@/lib/api/session';
import { useBrandStyles } from '@/hooks/use-brand-styles';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, verifyTwoFactor } = useSession();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const heading = useMemo(() => {
    if (showReset) return 'Reset your password';
    if (requiresTwoFactor) return 'Verify your login';
    return 'Welcome back';
  }, [showReset, requiresTwoFactor]);

  const subheading = useMemo(() => {
    if (showReset) return 'Choose a new password to regain access.';
    if (requiresTwoFactor) return 'Enter the verification code we sent to your email.';
    return 'Log in to continue your journey.';
  }, [showReset, requiresTwoFactor]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    if (result.requiresTwoFactor) {
      setRequiresTwoFactor(true);
      setMessage(result.message || 'Enter the verification code sent to your email.');
      setError(null);
      setIsSubmitting(false);
      return;
    }
    if (!result.success) {
      setError(result.error || 'Login failed.');
      setIsSubmitting(false);
      return;
    }
    router.back();
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      setTwoFactorError('Enter the 6-digit code.');
      return;
    }
    setIsSubmitting(true);
    setTwoFactorError(null);
    const result = await verifyTwoFactor(code.trim(), rememberDevice);
    if (!result.success) {
      setTwoFactorError(result.error || 'Verification failed.');
      setIsSubmitting(false);
      return;
    }
    router.back();
  };

  const handleResetPassword = async () => {
    if (!email.trim() || !newPassword || !confirmPassword) {
      setResetMessage('Please fill out all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetMessage('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setResetMessage(null);
    try {
      const response = await resetPassword(email.trim(), newPassword);
      if (response.success) {
        setResetMessage('Password updated. You can now log in.');
        setShowReset(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setResetMessage(response.error || 'Failed to reset password.');
      }
    } catch {
      setResetMessage('Server error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNeedAccount = () => {
    router.push('/setup/createaccount');
  };

  const handleContinueGuest = () => {
    router.replace('/feed');
  };

  return (
    <View style={styles.container}
    >
      <LinearGradient
        colors={[hexToRgba(colors.primaryFrom, 0.2), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.gradient}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{heading}</ThemedText>
              <ThemedText style={styles.subheading}>{subheading}</ThemedText>
              <View style={styles.switchRow}>
                <ThemedText style={styles.switchText}>Need an account?</ThemedText>
                <Pressable onPress={handleNeedAccount}>
                  <ThemedText style={styles.switchLink}>Create a free account</ThemedText>
                </Pressable>
              </View>
            </View>

            {showReset ? (
              <View style={styles.form}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.subtext}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <ThemedText style={styles.label}>New password</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={colors.subtext}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <ThemedText style={styles.label}>Confirm password</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.subtext}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                {resetMessage ? <ThemedText style={styles.errorText}>{resetMessage}</ThemedText> : null}
                <Pressable style={styles.primaryButton} onPress={handleResetPassword} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Update password</ThemedText>
                  )}
                </Pressable>
                <Pressable onPress={() => setShowReset(false)} disabled={isSubmitting}>
                  <ThemedText style={styles.linkText}>Never mind, take me back</ThemedText>
                </Pressable>
              </View>
            ) : requiresTwoFactor ? (
              <View style={styles.form}>
                <ThemedText style={styles.label}>Verification code</ThemedText>
                <ThemedText style={styles.helperText}>We sent a 6-digit code to your email.</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.subtext}
                  keyboardType="numeric"
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                />
                <Pressable
                  onPress={() => setRememberDevice((prev) => !prev)}
                  style={styles.checkbox}
                >
                  <View style={[styles.checkboxBox, rememberDevice && styles.checkboxBoxChecked]} />
                  <ThemedText style={styles.checkboxText}>Remember this device</ThemedText>
                </Pressable>
                {message ? <ThemedText style={styles.successText}>{message}</ThemedText> : null}
                {twoFactorError ? <ThemedText style={styles.errorText}>{twoFactorError}</ThemedText> : null}
                <Pressable style={styles.primaryButton} onPress={handleVerify} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Verify</ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRequiresTwoFactor(false);
                    setCode('');
                    setMessage(null);
                    setTwoFactorError(null);
                    setRememberDevice(true);
                  }}
                >
                  <ThemedText style={styles.linkText}>Back to login</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.form}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.subtext}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <ThemedText style={styles.label}>Password</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.subtext}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
                <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Log in</ThemedText>
                  )}
                </Pressable>
                <View style={styles.linkRow}>
                  <Pressable onPress={() => setShowReset(true)}>
                    <ThemedText style={styles.linkText}>Forgot password?</ThemedText>
                  </Pressable>
                  <Pressable onPress={handleNeedAccount}>
                    <ThemedText style={styles.linkText}>Need an account?</ThemedText>
                  </Pressable>
                </View>
                <Pressable onPress={handleContinueGuest}>
                  <ThemedText style={styles.linkTextSubtle}>Continue as guest</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.page,
  },
  flex: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Brand.spacing.lg,
    paddingVertical: Brand.spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Brand.spacing.xl,
    gap: 16,
    shadowColor: '#0c1831',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    gap: 6,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subheading: {
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  switchText: {
    fontSize: 13,
    color: colors.subtext,
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hexToRgba('#94a3b8', 0.35),
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: colors.card,
    color: colors.text,
  },
  helperText: {
    color: colors.subtext,
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.primaryFrom,
    shadowColor: colors.primaryFrom,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: colors.primaryFrom,
    fontWeight: '600',
  },
  linkTextSubtle: {
    color: colors.subtext,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  successText: {
    color: '#15803d',
    fontSize: 13,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primaryFrom,
    borderColor: colors.primaryFrom,
  },
  checkboxText: {
    color: colors.text,
    fontSize: 13,
  },
});
