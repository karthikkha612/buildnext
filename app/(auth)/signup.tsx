import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ArrowLeft, User, Mail, Phone, Lock } from 'lucide-react-native';

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

const NAME_REGEX = /^[A-Za-z\s]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
// At least 1 lowercase, 1 uppercase, 1 number, 1 special character, 8+ chars total
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) next.name = 'Name is required.';
    else if (trimmedName.length < 2) next.name = 'Name must be at least 2 characters.';
    else if (!NAME_REGEX.test(trimmedName)) next.name = 'Name can only contain letters and spaces.';

    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(trimmedEmail)) next.email = 'Enter a valid email address.';

    const digitsOnlyPhone = phone.trim();
    if (!digitsOnlyPhone) next.phone = 'Phone number is required.';
    else if (!PHONE_REGEX.test(digitsOnlyPhone)) next.phone = 'Enter a valid 10-digit phone number (digits only).';

    if (!password) next.password = 'Password is required.';
    else if (!PASSWORD_REGEX.test(password)) {
      next.password = 'Min 8 characters, with uppercase, lowercase, number & special character.';
    }

    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async () => {
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: 'Engineer',
        createdAt: new Date(),
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message?.replace('Firebase: ', '') || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Digits only, max 10
    setPhone(value.replace(/\D/g, '').slice(0, 10));
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.subtitle}>Join BuildNext to manage your projects</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Full Name */}
          <View style={[styles.inputWrapper, fieldErrors.name && styles.inputWrapperError]}>
            <View style={styles.inputIcon}><User size={18} color="#6B7280" /></View>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          {fieldErrors.name && <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>}

          {/* Email */}
          <View style={[styles.inputWrapper, fieldErrors.email && styles.inputWrapperError]}>
            <View style={styles.inputIcon}><Mail size={18} color="#6B7280" /></View>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {fieldErrors.email && <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>}

          {/* Phone */}
          <View style={[styles.inputWrapper, fieldErrors.phone && styles.inputWrapperError]}>
            <View style={styles.inputIcon}><Phone size={18} color="#6B7280" /></View>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
          {fieldErrors.phone && <Text style={styles.fieldErrorText}>{fieldErrors.phone}</Text>}

          {/* Password */}
          <View style={[styles.inputWrapper, fieldErrors.password && styles.inputWrapperError]}>
            <View style={styles.inputIcon}><Lock size={18} color="#6B7280" /></View>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          {fieldErrors.password ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
          ) : (
            <Text style={styles.hintText}>8+ chars, with uppercase, lowercase, number & special character</Text>
          )}

          {/* Confirm Password */}
          <View style={[styles.inputWrapper, fieldErrors.confirmPassword && styles.inputWrapperError]}>
            <View style={styles.inputIcon}><Lock size={18} color="#6B7280" /></View>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          {fieldErrors.confirmPassword && <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>}

          <TouchableOpacity style={styles.signupBtn} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupBtnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.loginRow}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  form: { paddingHorizontal: 24 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  errorText: {
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperError: { borderColor: '#DC2626' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  fieldErrorText: { fontSize: 12, color: '#DC2626', marginBottom: 10, marginTop: 2 },
  hintText: { fontSize: 11, color: '#9CA3AF', marginBottom: 10, marginTop: 2 },
  signupBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signupBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginRow: { alignItems: 'center', marginTop: 20 },
  loginText: { fontSize: 14, color: '#6B7280' },
  loginLink: { color: '#1A56DB', fontWeight: '600' },
});