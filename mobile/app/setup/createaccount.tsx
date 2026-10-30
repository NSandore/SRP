import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import useTagOptions from '@/hooks/use-tag-options';
import { useSession } from '@/hooks/use-session';
import { apiClient } from '@/lib/api/client';
import { getDocumentAsset } from '@/lib/document-picker';
import type { SessionUser } from '@/lib/api/types';
import { useBrandStyles } from '@/hooks/use-brand-styles';

const ROLE_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'student', label: 'Student' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'staff_representative', label: 'Staff / Representative' },
];

type CommunityResult = {
  community_id: string;
  name: string;
  location?: string | null;
  tagline?: string | null;
};

type CommunitySearchProps = {
  userId?: string | null;
  selectedIds: string[];
  onToggle?: (communityId: string, community: CommunityResult) => void;
  onSelect?: (communityId: string, community: CommunityResult) => void;
  placeholder?: string;
  emptyHelper?: string;
  actionLabel?: string;
  selectedLabel?: string;
  multiSelect?: boolean;
  communityType?: 'university' | 'group';
};

type UploadAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  file?: unknown | null;
};

function CommunitySearch({
  userId,
  selectedIds,
  onToggle,
  onSelect,
  placeholder = 'Search universities',
  emptyHelper = 'Search for a university to follow.',
  actionLabel = 'Follow',
  selectedLabel = 'Following',
  multiSelect = true,
  communityType = 'university',
}: CommunitySearchProps) {
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === '') {
      setResults([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/fetch_all_university_data.php', {
          params: {
            user_id: userId || undefined,
            page: 1,
            search: trimmed,
            community_type: communityType,
          },
        });
        if (requestIdRef.current !== requestId) return;
        const communities = Array.isArray(data?.communities) ? data.communities : [];
        setResults(communities);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setResults([]);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, userId, communityType]);

  const handleSelect = (community: CommunityResult) => {
    const id = String(community.community_id);
    if (multiSelect) {
      onToggle?.(id, community);
    } else {
      onSelect?.(id, community);
    }
  };

  return (
    <View style={styles.searchWrapper}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.subtext}
        value={query}
        onChangeText={setQuery}
      />
      {query.trim() === '' ? (
        <ThemedText style={styles.helperText}>{emptyHelper}</ThemedText>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primaryFrom} />
          <ThemedText style={styles.helperText}>Loading results…</ThemedText>
        </View>
      ) : (
        <View style={styles.searchResults}>
          {results.map((community) => {
            const id = String(community.community_id);
            const isSelected = selectedIds.includes(id);
            return (
              <View key={id} style={styles.searchCard}>
                <View style={styles.searchCardBody}>
                  <View style={styles.searchCopy}>
                    <ThemedText style={styles.searchTitle}>{community.name}</ThemedText>
                    <ThemedText style={styles.searchMeta}>
                      {community.location || community.tagline || 'Location unavailable'}
                    </ThemedText>
                  </View>
                  <Pressable
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => handleSelect(community)}
                  >
                    <ThemedText
                      style={[styles.pillButtonText, isSelected && styles.pillButtonTextActive]}
                    >
                      {isSelected ? selectedLabel : actionLabel}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {!results.length && (
            <ThemedText style={styles.helperText}>No matching results. Try another search.</ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

export default function CreateAccountScreen() {
  const router = useRouter();
  const { user, setSession, signOut } = useSession();
  const { tags: tagOptions, loading: loadingTags } = useTagOptions();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [step, setStep] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(user);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const [accountForm, setAccountForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [roleIntent, setRoleIntent] = useState('prospect');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([]);
  const [interestFilter, setInterestFilter] = useState<'topics' | 'universities' | 'groups'>('topics');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [studentSchoolId, setStudentSchoolId] = useState('');
  const [studentStartDate, setStudentStartDate] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffInstitutionId, setStaffInstitutionId] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'id_photo' | 'tuition_statement'>('id_photo');
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationSelfieFile, setVerificationSelfieFile] = useState<UploadAsset | null>(null);
  const [verificationIdFrontFile, setVerificationIdFrontFile] = useState<UploadAsset | null>(null);
  const [verificationDocumentFile, setVerificationDocumentFile] = useState<UploadAsset | null>(null);

  useEffect(() => {
    if (user) {
      setSessionUser(user);
    }
  }, [user]);

  useEffect(() => {
    if (roleIntent === 'staff_representative' && verificationMethod !== 'id_photo') {
      setVerificationMethod('id_photo');
      setVerificationSelfieFile(null);
      setVerificationIdFrontFile(null);
      setVerificationDocumentFile(null);
    }
  }, [roleIntent, verificationMethod]);

  const applyWizardState = (nextWizard?: any, fallbackStep = 0) => {
    const nextStep = Number(nextWizard?.current_step ?? fallbackStep ?? 0);
    setStep(nextStep === 4 ? 5 : nextStep);
    if (nextWizard?.role_intent) {
      setRoleIntent(nextWizard.role_intent);
    }
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const { data } = await apiClient.get('/onboarding_wizard.php');
        if (!mounted) return;
        if (data?.logged_in && data?.user) {
          const nextUser = data.user as SessionUser;
          setSessionUser(nextUser);
          applyWizardState(data?.wizard, 1);
          if (nextUser.recent_university_id) {
            setStudentSchoolId(String(nextUser.recent_university_id));
            setSelectedCommunityIds((prev) =>
              prev.includes(String(nextUser.recent_university_id))
                ? prev
                : [...prev, String(nextUser.recent_university_id)]
            );
          }
          if (data?.profile_basics) {
            setLocationCity(data.profile_basics.location_city || '');
            setLocationState(data.profile_basics.location_state || '');
            setSkillsInput((data.profile_basics.skills || '').toString());
          }
          if (data?.context) {
            setStaffPosition(data.context.position || '');
            setStaffInstitutionId(data.context.community_id || '');
          }
          if (data?.verification && data?.wizard?.role_intent) {
            const roleKey = data.wizard.role_intent;
            const summary = data.verification?.[roleKey];
            if (summary?.status === 'pending') {
              setVerificationPending(true);
            }
          }
        } else {
          setStep(0);
        }
      } catch {
        if (!mounted) return;
        setStep(0);
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser?.user_id) return;
    let mounted = true;
    const hydrateSelections = async () => {
      try {
        const [tagsRes, followedRes] = await Promise.all([
          apiClient.get('/fetch_tag_interests.php', {
            params: { user_id: sessionUser.user_id },
          }),
          apiClient.get('/followed_communities.php', {
            params: { user_id: sessionUser.user_id },
          }),
        ]);
        if (!mounted) return;
        const tagSlugs = Array.isArray(tagsRes.data?.tags) ? tagsRes.data.tags : [];
        setSelectedTags(tagSlugs);
        const followed = Array.isArray(followedRes.data) ? followedRes.data : [];
        const ids = followed.map((item: any) => String(item.community_id));
        setSelectedCommunityIds((prev) => Array.from(new Set([...prev, ...ids])));
      } catch {
        // ignore hydration failures
      }
    };
    hydrateSelections();
    return () => {
      mounted = false;
    };
  }, [sessionUser?.user_id]);

  const toggleTag = (slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= 8
          ? prev
          : [...prev, slug]
    );
  };

  const toggleCommunitySelection = (communityId: string) => {
    setSelectedCommunityIds((prev) =>
      prev.includes(communityId)
        ? prev.filter((id) => id !== communityId)
        : [...prev, communityId]
    );
  };

  const selectStudentSchool = (communityId: string) => {
    setStudentSchoolId(communityId);
    setSelectedCommunityIds((prev) =>
      prev.includes(communityId) ? prev : [...prev, communityId]
    );
  };

  const exitSetup = async () => {
    setError('');
    if (!sessionUser) {
      router.replace('/feed');
      return;
    }
    try {
      await apiClient.post('/onboarding_wizard.php', { action: 'exit_wizard' });
    } catch {
      // ignore errors
    }
    router.replace('/feed');
  };

  const createAccount = async () => {
    setError('');
    setNotice('');
    const { firstName, lastName, email, password, confirmPassword } = accountForm;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('First name, last name, email, and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsWorking(true);
    try {
      const { data } = await apiClient.post('/init_register.php', {
        firstName,
        lastName,
        email,
        password,
      });
      const nextUser = data?.user as SessionUser | undefined;
      if (!nextUser) {
        setError(data?.error || 'Unable to create account.');
        return;
      }
      setSessionUser(nextUser);
      if (data?.session_id) {
        await setSession(nextUser, data.session_id);
      } else {
        await setSession(nextUser);
      }
      applyWizardState(data?.wizard, data?.email_verification_skipped ? 2 : 1);
      if (data?.email_verification_skipped) {
        setNotice('Email verification was skipped in development mode.');
      } else {
        setNotice(`Verification code sent to ${nextUser.email}.`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to create account right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const verifyEmailCode = async () => {
    setError('');
    if (!verificationCode.trim()) {
      setError('Enter the verification code from your email.');
      return;
    }
    setIsWorking(true);
    try {
      const { data } = await apiClient.post('/verify_user.php', {
        user_id: sessionUser?.user_id,
        code: verificationCode.trim(),
      });
      setNotice(data?.message || 'Email verified.');
      applyWizardState(data?.wizard, 2);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid code.');
    } finally {
      setIsWorking(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      const { data } = await apiClient.post('/resend_verification.php', {
        user_id: sessionUser?.user_id,
        email: sessionUser?.email,
      });
      setNotice(data?.message || 'Verification code sent.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not resend verification code.');
    } finally {
      setIsWorking(false);
    }
  };

  const skipEmailVerification = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      const { data } = await apiClient.post('/onboarding_wizard.php', {
        action: 'skip_email_verification',
      });
      applyWizardState(data?.wizard, 2);
      setNotice('You can verify your email later. Continue setting up your account.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to skip right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const saveRole = async () => {
    setError('');
    if (roleIntent === 'student' && !studentSchoolId) {
      setError('Select the university you currently attend.');
      return;
    }
    if (roleIntent === 'student' && !studentStartDate) {
      setError('Enter your start date.');
      return;
    }
    setIsWorking(true);
    try {
      const { data } = await apiClient.post('/onboarding_wizard.php', {
        action: 'set_role',
        role_intent: roleIntent,
        community_id: roleIntent === 'student' ? studentSchoolId : null,
        start_date: roleIntent === 'student' ? studentStartDate : null,
      });
      applyWizardState(data?.wizard, 3);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to save role.');
    } finally {
      setIsWorking(false);
    }
  };

  const saveInterests = async () => {
    setError('');
    if (!selectedTags.length) {
      setError('Select at least one interest.');
      return;
    }
    setIsWorking(true);
    try {
      await apiClient.post('/onboarding_wizard.php', {
        action: 'set_interests',
        tags: selectedTags,
      });
      if (selectedCommunityIds.length) {
        await apiClient.post('/onboarding_wizard.php', {
          action: 'set_follows',
          community_ids: selectedCommunityIds,
        });
      }
      applyWizardState(null, 5);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to save interests.');
    } finally {
      setIsWorking(false);
    }
  };

  const saveProfileBasics = async () => {
    setError('');
    setIsWorking(true);
    try {
      const skills = skillsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const { data } = await apiClient.post('/onboarding_wizard.php', {
        action: 'save_profile_basics',
        location_city: locationCity,
        location_state: locationState,
        skills,
      });
      applyWizardState(data?.wizard, 9);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to save profile basics.');
    } finally {
      setIsWorking(false);
    }
  };

  const getAssetLabel = (asset: UploadAsset | null, fallback: string) => {
    if (!asset) return fallback;
    if (asset.fileName) return asset.fileName;
    if (asset.name) return asset.name;
    if (asset.uri) {
      const parts = asset.uri.split('/');
      return parts[parts.length - 1] || fallback;
    }
    return fallback;
  };

  const buildFormFile = (
    asset: UploadAsset | null,
    fallbackName: string,
    fallbackType: string
  ) => {
    if (!asset) return null;
    if (asset.file) return asset.file;
    const name = asset.fileName || asset.name || fallbackName;
    const type =
      asset.mimeType ||
      (asset.type && asset.type.includes('/') ? asset.type : undefined) ||
      fallbackType;
    return {
      uri: asset.uri,
      name,
      type,
    } as any;
  };

  const ensureCameraPermission = async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access needed', 'Please allow camera access to take a photo.');
      return false;
    }
    return true;
  };

  const ensureLibraryPermission = async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Please allow photo library access to select an image.');
      return false;
    }
    return true;
  };

  const pickImage = async (
    source: 'camera' | 'library',
    setter: (asset: UploadAsset | null) => void,
    cameraType: ImagePicker.CameraType = ImagePicker.CameraType.back
  ) => {
    const hasPermission = source === 'camera'
      ? await ensureCameraPermission()
      : await ensureLibraryPermission();
    if (!hasPermission) return;

    try {
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              cameraType,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            });

      if (!result.canceled && result.assets?.length) {
        setter(result.assets[0] as UploadAsset);
      }
    } catch {
      Alert.alert('Unable to open media picker', 'Please try again or choose another upload method.');
    }
  };

  const pickDocument = async (setter: (asset: UploadAsset | null) => void) => {
    try {
      const asset = await getDocumentAsset({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (asset) {
        setter(asset as UploadAsset);
      }
    } catch {
      Alert.alert('Unable to open files', 'Please try again or choose another upload method.');
    }
  };

  const submitVerificationRequest = async () => {
    setError('');
    if (!['student', 'staff_representative'].includes(roleIntent)) {
      setError('Verification is only available for Student and Staff roles.');
      return;
    }
    if (verificationMethod === 'id_photo' && (!verificationSelfieFile || !verificationIdFrontFile)) {
      setError('Upload a selfie with your ID and a photo of the front of your ID.');
      return;
    }
    if (verificationMethod === 'tuition_statement' && !verificationDocumentFile) {
      setError('Upload your class schedule or billing statement.');
      return;
    }

    setIsWorking(true);
    try {
      const uploadDocument = async (file: UploadAsset | null, documentType: string) => {
        const formData = new FormData();
        const fallbackType = documentType === 'supporting_doc' ? 'application/pdf' : 'image/jpeg';
        const payload = buildFormFile(file, `${documentType}.jpg`, fallbackType);
        if (!payload) {
          throw new Error('Missing file');
        }
        formData.append('document', payload as any);
        formData.append('document_type', documentType);
        const res = await apiClient.post('/upload_verification_document.php', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (!res.data?.success || !res.data?.path) {
          throw new Error(res.data?.error || 'Unable to upload verification document.');
        }
        return res.data.path as string;
      };

      let selfiePath: string | null = null;
      let idFrontPath: string | null = null;
      let supportingDocPath: string | null = null;

      if (verificationMethod === 'id_photo') {
        selfiePath = await uploadDocument(verificationSelfieFile, 'selfie_with_id');
        idFrontPath = await uploadDocument(verificationIdFrontFile, 'id_front');
      } else if (verificationMethod === 'tuition_statement') {
        supportingDocPath = await uploadDocument(verificationDocumentFile, 'supporting_doc');
      }

      const currentAttendanceId = studentSchoolId || staffInstitutionId || null;
      const { data } = await apiClient.post('/onboarding_wizard.php', {
        action: 'submit_verification_request',
        verification_type: roleIntent,
        verification_method: verificationMethod,
        community_id: currentAttendanceId,
        staff_position: staffPosition.trim(),
        selfie_path: selfiePath,
        id_front_path: idFrontPath,
        supporting_doc_path: supportingDocPath,
      });
      applyWizardState(data?.wizard, 9);
      setVerificationPending(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to submit verification request.');
    } finally {
      setIsWorking(false);
    }
  };

  const skipVerification = async () => {
    setError('');
    setIsWorking(true);
    try {
      const { data } = await apiClient.post('/onboarding_wizard.php', { action: 'skip_verification' });
      applyWizardState(data?.wizard, 9);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to skip verification right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const finishWizard = async () => {
    setIsWorking(true);
    try {
      await apiClient.post('/onboarding_wizard.php', { action: 'complete_wizard' });
    } catch {
      // ignore
    } finally {
      setIsWorking(false);
      router.replace('/feed');
    }
  };

  const stepTitle = useMemo(() => {
    if (step === 0) return 'Create account';
    if (step === 1) return 'Verify your email';
    if (step === 2) return 'Choose your role';
    if (step === 3) return 'Interests and topics';
    if (step === 5) return 'Profile basics (optional)';
    if (step === 7) return 'Optional verification';
    return 'You are all set';
  }, [step]);

  const handleSignIn = () => {
    router.push('/login');
  };

  const resetSignupFlow = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      await signOut();
      setSessionUser(null);
      setVerificationCode('');
      setRoleIntent('prospect');
      setSelectedTags([]);
      setSelectedCommunityIds([]);
      setInterestFilter('topics');
      setLocationCity('');
      setLocationState('');
      setSkillsInput('');
      setStudentSchoolId('');
      setStudentStartDate('');
      setStaffPosition('');
      setStaffInstitutionId('');
      setVerificationMethod('id_photo');
      setVerificationPending(false);
      setVerificationSelfieFile(null);
      setVerificationIdFrontFile(null);
      setVerificationDocumentFile(null);
      setStep(0);
      setNotice('Start a new account below.');
    } catch {
      setError('Unable to reset signup right now.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[hexToRgba(colors.primaryFrom, 0.18), 'transparent']}
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
            {isBootstrapping ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.primaryFrom} />
                <ThemedText style={styles.loadingText}>Loading setup wizard…</ThemedText>
              </View>
            ) : (
              <>
                <ThemedText style={styles.stepLabel}>
                  {step === 0 ? 'Step 0' : `Step ${step}`} · {stepTitle}
                </ThemedText>
                <ThemedText style={styles.title}>{stepTitle}</ThemedText>
                <View style={styles.switchRow}>
                  <ThemedText style={styles.switchText}>Already have an account?</ThemedText>
                  <Pressable onPress={handleSignIn}>
                    <ThemedText style={styles.switchLink}>Sign in</ThemedText>
                  </Pressable>
                </View>
                {step > 0 && sessionUser ? (
                  <Pressable onPress={resetSignupFlow} disabled={isWorking}>
                    <ThemedText style={styles.linkTextSubtle}>Start over with a different email</ThemedText>
                  </Pressable>
                ) : null}
                {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
                {notice ? <ThemedText style={styles.successText}>{notice}</ThemedText> : null}

                {step === 0 && (
                  <View style={styles.form}>
                    <View style={styles.inputGrid}>
                      <TextInput
                        style={styles.input}
                        placeholder="First name"
                        placeholderTextColor={colors.subtext}
                        value={accountForm.firstName}
                        onChangeText={(value) =>
                          setAccountForm((prev) => ({ ...prev, firstName: value }))
                        }
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Last name"
                        placeholderTextColor={colors.subtext}
                        value={accountForm.lastName}
                        onChangeText={(value) =>
                          setAccountForm((prev) => ({ ...prev, lastName: value }))
                        }
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor={colors.subtext}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={accountForm.email}
                      onChangeText={(value) =>
                        setAccountForm((prev) => ({ ...prev, email: value }))
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={colors.subtext}
                      secureTextEntry
                      value={accountForm.password}
                      onChangeText={(value) =>
                        setAccountForm((prev) => ({ ...prev, password: value }))
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.subtext}
                      secureTextEntry
                      value={accountForm.confirmPassword}
                      onChangeText={(value) =>
                        setAccountForm((prev) => ({ ...prev, confirmPassword: value }))
                      }
                    />
                    <Pressable style={styles.primaryButton} onPress={createAccount} disabled={isWorking}>
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Create account</ThemedText>
                      )}
                    </Pressable>
                  </View>
                )}

                {step === 1 && (
                  <View style={styles.form}>
                    <ThemedText style={styles.helperText}>
                      Check your email for a verification code.
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Verification code"
                      placeholderTextColor={colors.subtext}
                      value={verificationCode}
                      onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <Pressable style={styles.primaryButton} onPress={verifyEmailCode} disabled={isWorking}>
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Enter code</ThemedText>
                      )}
                    </Pressable>
                    <Pressable onPress={resendCode} disabled={isWorking}>
                      <ThemedText style={styles.linkText}>Resend code</ThemedText>
                    </Pressable>
                    <Pressable onPress={skipEmailVerification} disabled={isWorking}>
                      <ThemedText style={styles.linkTextSubtle}>Skip for now (limited posting)</ThemedText>
                    </Pressable>
                  </View>
                )}

                {step === 2 && (
                  <View style={styles.form}>
                    <ThemedText style={styles.helperText}>Which best describes you right now?</ThemedText>
                    {ROLE_OPTIONS.map((option) => {
                      const selected = roleIntent === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={styles.radioRow}
                          onPress={() => setRoleIntent(option.value)}
                        >
                          <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                            {selected ? <View style={styles.radioInner} /> : null}
                          </View>
                          <ThemedText style={styles.radioLabel}>{option.label}</ThemedText>
                        </Pressable>
                      );
                    })}
                    {roleIntent === 'student' && (
                      <>
                        <ThemedText style={styles.helperText}>
                          Select the university you currently attend.
                        </ThemedText>
                        <CommunitySearch
                          userId={sessionUser?.user_id}
                          selectedIds={studentSchoolId ? [studentSchoolId] : []}
                          onSelect={(id) => selectStudentSchool(id)}
                          placeholder="Search your university"
                          emptyHelper="Search for your current university."
                          actionLabel="Select"
                          selectedLabel="Selected"
                          multiSelect={false}
                          communityType="university"
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Start date (YYYY-MM-DD)"
                          placeholderTextColor={colors.subtext}
                          value={studentStartDate}
                          onChangeText={setStudentStartDate}
                        />
                      </>
                    )}
                    <Pressable style={styles.primaryButton} onPress={saveRole} disabled={isWorking}>
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
                      )}
                    </Pressable>
                  </View>
                )}

                {step === 3 && (
                  <View style={styles.form}>
                    <ThemedText style={styles.helperText}>
                      Select interests to personalize your feed immediately.
                    </ThemedText>
                    <View style={styles.segmentedControl}>
                      {(['topics', 'universities', 'groups'] as const).map((filter) => {
                        const isActive = interestFilter === filter;
                        return (
                          <Pressable
                            key={filter}
                            style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                            onPress={() => setInterestFilter(filter)}
                          >
                            <ThemedText
                              style={[styles.segmentText, isActive && styles.segmentTextActive]}
                            >
                              {filter === 'topics'
                                ? 'Topics'
                                : filter === 'universities'
                                  ? 'Universities'
                                  : 'Groups'}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>

                    {interestFilter === 'topics' && (
                      <View style={styles.tagGrid}>
                        {loadingTags ? (
                          <ActivityIndicator color={colors.primaryFrom} />
                        ) : (
                          tagOptions.map((tag) => {
                            const isSelected = selectedTags.includes(tag.slug);
                            return (
                              <Pressable
                                key={tag.slug}
                                style={[styles.tagPill, isSelected && styles.tagPillActive]}
                                onPress={() => toggleTag(tag.slug)}
                              >
                                <ThemedText
                                  style={[styles.tagPillText, isSelected && styles.tagPillTextActive]}
                                >
                                  {tag.name}
                                </ThemedText>
                              </Pressable>
                            );
                          })
                        )}
                      </View>
                    )}

                    {interestFilter === 'universities' && (
                      <CommunitySearch
                        userId={sessionUser?.user_id}
                        selectedIds={selectedCommunityIds}
                        onToggle={toggleCommunitySelection}
                        placeholder="Search universities"
                        emptyHelper="Search for universities to follow."
                        actionLabel="Follow"
                        selectedLabel="Following"
                        communityType="university"
                      />
                    )}

                    {interestFilter === 'groups' && (
                      <CommunitySearch
                        userId={sessionUser?.user_id}
                        selectedIds={selectedCommunityIds}
                        onToggle={toggleCommunitySelection}
                        placeholder="Search groups"
                        emptyHelper="Search for groups to follow."
                        actionLabel="Follow"
                        selectedLabel="Following"
                        communityType="group"
                      />
                    )}

                    <Pressable style={styles.primaryButton} onPress={saveInterests} disabled={isWorking}>
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
                      )}
                    </Pressable>
                  </View>
                )}

                {step === 5 && (
                  <View style={styles.form}>
                    <ThemedText style={styles.helperText}>
                      Add a little more about yourself. You can skip this and return later.
                    </ThemedText>
                    <View style={styles.inputGrid}>
                      <TextInput
                        style={styles.input}
                        placeholder="City"
                        placeholderTextColor={colors.subtext}
                        value={locationCity}
                        onChangeText={setLocationCity}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="State"
                        placeholderTextColor={colors.subtext}
                        value={locationState}
                        onChangeText={setLocationState}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Skills (comma-separated)"
                      placeholderTextColor={colors.subtext}
                      value={skillsInput}
                      onChangeText={setSkillsInput}
                    />
                    <Pressable style={styles.primaryButton} onPress={saveProfileBasics} disabled={isWorking}>
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Save and continue</ThemedText>
                      )}
                    </Pressable>
                    <Pressable onPress={saveProfileBasics} disabled={isWorking}>
                      <ThemedText style={styles.linkText}>Skip for now</ThemedText>
                    </Pressable>
                  </View>
                )}

                {step === 7 && (
                  <View style={styles.form}>
                    {verificationPending ? (
                      <View style={styles.pendingCard}>
                        <MaterialCommunityIcons name="timer-sand" size={48} color={colors.primaryFrom} />
                        <ThemedText style={styles.pendingTitle}>Review in progress</ThemedText>
                        <ThemedText style={styles.helperText}>
                          Enjoy exploring while we review your submission. We&apos;ll notify you soon.
                        </ThemedText>
                        <Pressable style={styles.primaryButton} onPress={finishWizard} disabled={isWorking}>
                          {isWorking ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <ThemedText style={styles.primaryButtonText}>Go to home</ThemedText>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <ThemedText style={styles.helperText}>
                          Verification is optional. You can skip and return later.
                        </ThemedText>
                        {roleIntent === 'staff_representative' && (
                          <>
                            <ThemedText style={styles.label}>Institution you represent</ThemedText>
                            <CommunitySearch
                              userId={sessionUser?.user_id}
                              selectedIds={staffInstitutionId ? [staffInstitutionId] : []}
                              onSelect={(id) => setStaffInstitutionId(id)}
                              placeholder="Search your institution"
                              emptyHelper="Search for the university you represent."
                              actionLabel="Select"
                              selectedLabel="Selected"
                              multiSelect={false}
                              communityType="university"
                            />
                            <TextInput
                              style={styles.input}
                              placeholder="Position / title"
                              placeholderTextColor={colors.subtext}
                              value={staffPosition}
                              onChangeText={setStaffPosition}
                            />
                          </>
                        )}
                        <ThemedText style={styles.label}>Verification method</ThemedText>
                        {[
                          { value: 'id_photo', label: 'Selfie with ID + front of ID' },
                          ...(roleIntent === 'student'
                            ? [{ value: 'tuition_statement', label: 'Class schedule or billing statement' }]
                            : []),
                        ].map((option) => {
                          const selected = verificationMethod === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              style={styles.radioRow}
                              onPress={() => {
                                setVerificationMethod(option.value as typeof verificationMethod);
                                setVerificationSelfieFile(null);
                                setVerificationIdFrontFile(null);
                                setVerificationDocumentFile(null);
                              }}
                            >
                              <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                                {selected ? <View style={styles.radioInner} /> : null}
                              </View>
                              <ThemedText style={styles.radioLabel}>{option.label}</ThemedText>
                            </Pressable>
                          );
                        })}

                        {verificationMethod === 'id_photo' && (
                          <>
                            <ThemedText style={styles.label}>Selfie holding your ID</ThemedText>
                            <View style={styles.uploadRow}>
                              <Pressable
                                style={styles.uploadButton}
                                onPress={() => pickImage('library', setVerificationSelfieFile)}
                              >
                                <ThemedText style={styles.uploadButtonText}>Upload file</ThemedText>
                              </Pressable>
                              <Pressable
                                style={styles.uploadButton}
                                onPress={() =>
                                  pickImage('camera', setVerificationSelfieFile, ImagePicker.CameraType.front)
                                }
                              >
                                <ThemedText style={styles.uploadButtonText}>Take photo</ThemedText>
                              </Pressable>
                            </View>
                            {verificationSelfieFile ? (
                              <ThemedText style={styles.fileMeta}>
                                Selected: {getAssetLabel(verificationSelfieFile, 'selfie')}
                              </ThemedText>
                            ) : null}
                            <ThemedText style={styles.label}>Front of ID</ThemedText>
                            <View style={styles.uploadRow}>
                              <Pressable
                                style={styles.uploadButton}
                                onPress={() => pickImage('library', setVerificationIdFrontFile)}
                              >
                                <ThemedText style={styles.uploadButtonText}>Upload file</ThemedText>
                              </Pressable>
                              <Pressable
                                style={styles.uploadButton}
                                onPress={() =>
                                  pickImage('camera', setVerificationIdFrontFile, ImagePicker.CameraType.back)
                                }
                              >
                                <ThemedText style={styles.uploadButtonText}>Take photo</ThemedText>
                              </Pressable>
                            </View>
                            {verificationIdFrontFile ? (
                              <ThemedText style={styles.fileMeta}>
                                Selected: {getAssetLabel(verificationIdFrontFile, 'id-front')}
                              </ThemedText>
                            ) : null}
                            <ThemedText style={styles.helperText}>
                              Your name and the university logo must be visible.
                            </ThemedText>
                          </>
                        )}

                        {verificationMethod === 'tuition_statement' && (
                          <>
                            <ThemedText style={styles.label}>Upload schedule or billing statement</ThemedText>
                            <View style={styles.uploadRow}>
                              <Pressable
                                style={styles.uploadButton}
                                onPress={() => pickDocument(setVerificationDocumentFile)}
                              >
                                <ThemedText style={styles.uploadButtonText}>Upload file</ThemedText>
                              </Pressable>
                              <Pressable
                                style={styles.uploadButton}
                                onPress={() =>
                                  pickImage('camera', setVerificationDocumentFile, ImagePicker.CameraType.back)
                                }
                              >
                                <ThemedText style={styles.uploadButtonText}>Take photo</ThemedText>
                              </Pressable>
                            </View>
                            {verificationDocumentFile ? (
                              <ThemedText style={styles.fileMeta}>
                                Selected: {getAssetLabel(verificationDocumentFile, 'document')}
                              </ThemedText>
                            ) : null}
                            <ThemedText style={styles.helperText}>
                              Must be within the last 90 days and show your name and university logo.
                            </ThemedText>
                          </>
                        )}

                        <Pressable style={styles.primaryButton} onPress={submitVerificationRequest} disabled={isWorking}>
                          {isWorking ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <ThemedText style={styles.primaryButtonText}>Submit verification request</ThemedText>
                          )}
                        </Pressable>
                        <Pressable onPress={skipVerification} disabled={isWorking}>
                          <ThemedText style={styles.linkText}>Verify later</ThemedText>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}

                {step === 9 && (
                  <View style={styles.form}>
                    <ThemedText style={styles.helperText}>
                      Your account is active. You can continue exploring and finish any pending verification later.
                    </ThemedText>
                    <Pressable style={styles.primaryButton} onPress={finishWizard} disabled={isWorking}>
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Go to home</ThemedText>
                      )}
                    </Pressable>
                    <Pressable onPress={exitSetup}>
                      <ThemedText style={styles.linkTextSubtle}>Exit setup for now</ThemedText>
                    </Pressable>
                  </View>
                )}
              </>
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
    maxWidth: 480,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Brand.spacing.xl,
    gap: 12,
    shadowColor: '#0c1831',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  loadingBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  loadingText: {
    color: colors.subtext,
    fontSize: 14,
  },
  stepLabel: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.subtext,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  inputGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
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
    lineHeight: 18,
  },
  fileMeta: {
    color: colors.subtext,
    fontSize: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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
  linkText: {
    color: colors.primaryFrom,
    fontWeight: '600',
    textAlign: 'center',
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: colors.primaryFrom,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryFrom,
  },
  radioLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.primaryFrom,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  segmentTextActive: {
    color: '#fff',
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hexToRgba(colors.primaryFrom, 0.35),
    backgroundColor: 'transparent',
  },
  tagPillActive: {
    backgroundColor: colors.primaryFrom,
    borderColor: colors.primaryFrom,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  tagPillTextActive: {
    color: '#fff',
  },
  searchWrapper: {
    gap: 10,
  },
  searchResults: {
    gap: 8,
  },
  searchCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  searchCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchCopy: {
    flex: 1,
  },
  searchTitle: {
    fontWeight: '600',
    color: colors.text,
  },
  searchMeta: {
    fontSize: 12,
    color: colors.subtext,
  },
  pillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hexToRgba(colors.primaryFrom, 0.35),
    backgroundColor: 'transparent',
  },
  pillButtonActive: {
    backgroundColor: colors.primaryFrom,
    borderColor: colors.primaryFrom,
  },
  pillButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  pillButtonTextActive: {
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.page,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  pendingCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
