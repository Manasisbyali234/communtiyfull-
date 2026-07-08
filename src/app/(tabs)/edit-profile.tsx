import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { apiClient, API_BASE_URL } from '../../api/client';

const BASE = API_BASE_URL.replace('/api/v1', '');
const toAbsUrl = (url?: string | null) =>
  url && url.startsWith('/') ? `${BASE}${url}` : url;
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { pickImage, uploadProfilePhoto, uploadCoverPhoto, PickedImage } from '../../utils/imagePicker';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(30, 'Name must be under 30 characters'),
  bio: z.string().max(160, 'Bio must be under 160 characters').optional(),
  avatarUrl: z.string().url('Enter a valid image URL').or(z.literal('')).optional(),
  village: z.string().max(50, 'Village must be under 50 characters').optional(),
  occupation: z.string().max(50, 'Occupation must be under 50 characters').optional(),
  languages: z.string().max(100, 'Languages must be under 100 characters').optional(),
  interests: z.string().max(100, 'Interests must be under 100 characters').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function EditProfile() {
  const { colors, spacing, typography, roundness } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);

  // Sync latest profile from server on mount so cover/avatar are current.
  useEffect(() => {
    apiClient.get('/users/me').then((res) => {
      const fresh = res.data?.data ?? res.data;
      if (fresh) updateProfile(fresh);
    }).catch(() => {});
  }, []);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      bio: user?.bio || '',
      avatarUrl: user?.avatarUrl || '',
      village: user?.village || '',
      occupation: user?.occupation || '',
      languages: user?.languages || '',
      interests: user?.interests || '',
    },
  });

  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);
  const [pickedCover, setPickedCover] = useState<PickedImage | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);

  const handlePickPhoto = async () => {
    setPhotoError(null);
    try {
      const picked = await pickImage();
      if (picked) {
        setLocalAvatarUri(picked.localUri);
        setPickedImage(picked);
      }
    } catch (e: any) {
      setPhotoError('Failed to select photo. Please try a valid image.');
    }
  };

  const handlePickCover = async () => {
    try {
      const picked = await pickImage();
      if (picked) {
        setLocalCoverUri(picked.localUri);
        setPickedCover(picked);
        setCoverRemoved(false);
      }
    } catch (_) {}
  };

  const handleRemoveCover = () => {
    setLocalCoverUri(null);
    setPickedCover(null);
    setCoverRemoved(true);
  };

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      let avatarUrl: string | undefined = data.avatarUrl || undefined;
      if (pickedImage) {
        const uploaded = await uploadProfilePhoto(pickedImage);
        if (uploaded) {
          avatarUrl = toAbsUrl(uploaded) ?? undefined;
        } else {
          showToast('Photo upload failed, other changes will still save.', 'error');
        }
      }

      let coverImage: string | null | undefined = undefined;
      if (pickedCover) {
        const uploaded = await uploadCoverPhoto(pickedCover);
        if (uploaded) {
          coverImage = toAbsUrl(uploaded);
        }
      } else if (coverRemoved) {
        coverImage = null;
      }

      const res = await apiClient.put('/users/me', {
        displayName: data.displayName,
        bio: data.bio || undefined,
        avatarUrl: avatarUrl || undefined,
        ...(coverImage !== undefined ? { coverImage } : {}),
        village: data.village || undefined,
        occupation: data.occupation || undefined,
        languages: data.languages || undefined,
        interests: data.interests || undefined,
      });

      const updated = res.data?.data ?? res.data;
      if (avatarUrl) updated.avatarUrl = avatarUrl;
      if (coverImage !== undefined) updated.coverImage = coverImage;
      updateProfile(updated);
      showToast('Profile updated successfully!', 'success');
      router.canGoBack() ? router.back() : router.replace('/(tabs)/profile');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update profile. Try again.';
      showToast(msg, 'error');
      console.error('Edit profile error:', e?.response?.data ?? e);
    }
  };

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingHorizontal: spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Navbar */}
        <View style={styles.navbar}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text, fontSize: typography.sizes.lg }]}>
            Edit Profile
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Cover Photo Section */}
        <View style={styles.coverSection}>
          <TouchableOpacity onPress={handlePickCover} activeOpacity={0.85} style={styles.coverContainer}>
            {(localCoverUri || (!coverRemoved && user.coverImage)) ? (
              <Image
                source={{ uri: localCoverUri || user.coverImage }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>Add Cover Photo</Text>
              </View>
            )}
            <View style={styles.coverEditBadge}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          {(localCoverUri || (!coverRemoved && user.coverImage)) && (
            <TouchableOpacity onPress={handleRemoveCover} style={styles.removeCoverBtn}>
              <Ionicons name="trash-outline" size={14} color={colors.error ?? '#C62828'} />
              <Text style={{ color: colors.error ?? '#C62828', fontSize: 12, fontWeight: '600' }}>Remove Cover</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Change Photo Option */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
            <Avatar url={localAvatarUri ?? user.avatarUrl} name={user.displayName} size={80} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickPhoto}>
            <Text style={{ color: colors.primary, fontSize: typography.sizes.sm, fontWeight: '700' }}>
              Change Profile Photo
            </Text>
          </TouchableOpacity>
          {photoError && (
            <Text style={{ color: colors.error ?? 'red', fontSize: typography.sizes.xs, marginTop: 4 }}>
              {photoError}
            </Text>
          )}
        </View>

        {/* Form Inputs */}
        <View style={styles.formContainer}>
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Full Name"
                placeholder="Alex Rivers"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                leftIcon="person-outline"
                error={errors.displayName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="bio"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Bio"
                placeholder="Tell us about yourself"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={3}
                leftIcon="document-text-outline"
                error={errors.bio?.message}
                containerStyle={{ minHeight: 90 }}
              />
            )}
          />
          
          <Controller
            control={control}
            name="village"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Native Village"
                placeholder="e.g. Kodagu"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                leftIcon="home-outline"
                error={errors.village?.message}
              />
            )}
          />
          
          <Controller
            control={control}
            name="occupation"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Occupation"
                placeholder="e.g. Agriculturist"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                leftIcon="briefcase-outline"
                error={errors.occupation?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="languages"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Languages"
                placeholder="e.g. Kannada, English"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                leftIcon="language-outline"
                error={errors.languages?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="interests"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Interests"
                placeholder="e.g. Agriculture, Volunteering"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                leftIcon="heart-outline"
                error={errors.interests?.message}
              />
            )}
          />

          <Button
            title="Save Updates"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            variant="gradient"
            style={styles.saveBtn}
          />
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
    paddingBottom: 40,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 20,
  },
  backBtn: {
    padding: 4,
  },
  navTitle: {
    fontWeight: '700',
  },
  coverSection: {
    marginBottom: 0,
  },
  coverContainer: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  coverEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 7,
  },
  removeCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 12,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  changePhotoBtn: {
    marginTop: 12,
    padding: 4,
  },
  formContainer: {
    width: '100%',
  },
  saveBtn: {
    height: 52,
    marginTop: 20,
  },
});
