import React from 'react';
import { StyleSheet, Text, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTheme } from '../../theme';
import { useToastStore } from '../../store/toastStore';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(16, 'Username must be under 16 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric and underscores'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const { colors, spacing, typography, palette, roundness } = useTheme();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const response = await apiClient.post<{ data: { user: any; accessToken: string; refreshToken: string } }>('/auth/register', {
        username: data.username,
        email: data.email,
        password: data.password,
        displayName: data.username, // Default to username, they can edit profile later
      });
      
      const { user, accessToken, refreshToken } = response.data.data;
      
      // Store tokens but they will be unverified
      useAuthStore.getState().login(user, accessToken, refreshToken);
      
      showToast('Account created! Please verify your OTP.', 'success');
      router.push({
        pathname: '/(auth)/otp',
        params: { email: data.email },
      });
    } catch (e: any) {
      const message = e.response?.data?.message ?? e.message ?? 'Registration failed. Try again.';
      showToast(message, 'error');
      console.error('[Register] error:', e.message, e.response?.status, e.response?.data);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Back Button */}
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        {/* Form Logo branding */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={[palette.gradientStart, palette.gradientMiddle, palette.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.logoIcon, { borderRadius: roundness.xl }]}
          >
            <Ionicons name="sparkles" size={32} color={palette.white} />
          </LinearGradient>
          <Text
            style={[
              styles.logoText,
              { color: colors.text, fontSize: typography.sizes.xxl, fontWeight: typography.weights.black },
            ]}
          >
            JOIN PLATFORM
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.sm }]}>
            Create an account to start exploring
          </Text>
        </View>

        {/* Inputs list */}
        <View style={styles.formContainer}>
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Username"
                placeholder="alex_designer"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                leftIcon="person-outline"
                error={errors.username?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email Address"
                placeholder="you@example.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="Choose a strong password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                leftIcon="lock-closed-outline"
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Confirm Password"
                placeholder="Confirm your password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                leftIcon="lock-closed-outline"
                error={errors.confirmPassword?.message}
              />
            )}
          />

          {/* Submit */}
          <Button
            title="Create Account"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            variant="gradient"
            style={styles.submitBtn}
          />
        </View>

        {/* Footer link */}
        <View style={styles.footerContainer}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm }}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  backBtn: {
    position: 'absolute',
    top: 24,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  logoIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    letterSpacing: 2,
  },
  subtitle: {
    marginTop: 4,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  submitBtn: {
    height: 52,
    marginTop: 8,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
});
