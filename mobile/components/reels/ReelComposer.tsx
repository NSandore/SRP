import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { apiClient } from '@/lib/api/client';
import {
  MAX_REEL_DURATION_SECONDS,
  uploadReelInChunks,
  validateReelSelection,
  type ReelUploadProgress,
  type ReelUploadSelection,
  type UploadReelResult,
} from '@/lib/api/reels';

type CommunityOption = {
  id: string;
  name: string;
  type?: string;
};

type ReelComposerProps = {
  visible: boolean;
  userId: string;
  defaultIntro?: boolean;
  defaultCommunityId?: string | null;
  onClose: () => void;
  onComplete: (result: UploadReelResult) => void;
};

const formatBytes = (value?: number | null) => {
  if (!value || !Number.isFinite(value)) return 'Size unavailable';
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const formatDuration = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Duration checked on upload';
  const seconds = Math.max(0, Math.round(value / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

function SelectedVideoPreview({ asset }: { asset: ReelUploadSelection }) {
  const player = useVideoPlayer(asset.uri, (instance) => {
    instance.loop = true;
    instance.muted = false;
    instance.staysActiveInBackground = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.preview}
      nativeControls
      contentFit="contain"
      playsInline
      surfaceType="textureView"
    />
  );
}

export default function ReelComposer({
  visible,
  userId,
  defaultIntro = false,
  defaultCommunityId = null,
  onClose,
  onComplete,
}: ReelComposerProps) {
  const colors = useBrandColors();
  const dynamicStyles = useBrandStyles(createStyles);
  const insets = useSafeAreaInsets();
  const abortRef = useRef<AbortController | null>(null);
  const [asset, setAsset] = useState<ReelUploadSelection | null>(null);
  const [caption, setCaption] = useState('');
  const [isIntro, setIsIntro] = useState(defaultIntro);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(defaultCommunityId);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<ReelUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAsset(null);
    setCaption('');
    setIsIntro(defaultIntro);
    setSelectedCommunityId(defaultCommunityId);
    setProgress(null);
    setError(null);
  }, [defaultCommunityId, defaultIntro, visible]);

  useEffect(() => {
    if (!visible || !userId) return;
    let mounted = true;
    setIsLoadingCommunities(true);
    apiClient
      .get('/followed_communities.php', { params: { user_id: userId } })
      .then((response) => {
        if (!mounted) return;
        const rows = Array.isArray(response.data)
          ? response.data
          : Array.isArray((response.data as any)?.communities)
            ? (response.data as any).communities
            : [];
        const normalized = rows
          .map((row: any) => ({
            id: String(row.community_id ?? row.id ?? ''),
            name: String(row.name || 'Community'),
            type: row.community_type ? String(row.community_type) : undefined,
          }))
          .filter((community: CommunityOption) => community.id);
        if (defaultCommunityId && !normalized.some((community: CommunityOption) => community.id === defaultCommunityId)) {
          normalized.unshift({
            id: defaultCommunityId,
            name: 'Selected community',
          });
        }
        setCommunities(normalized);
      })
      .catch(() => {
        setCommunities(
          defaultCommunityId
            ? [{ id: defaultCommunityId, name: 'Selected community' }]
            : []
        );
      })
      .finally(() => {
        if (mounted) setIsLoadingCommunities(false);
      });
    return () => {
      mounted = false;
    };
  }, [defaultCommunityId, userId, visible]);

  const chooseVideo = async (source: 'camera' | 'library') => {
    if (isUploading) return;
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Camera access needed',
            'Allow camera and microphone access to record a reel.'
          );
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Video access needed',
            'Allow photo library access to choose a reel.'
          );
          return;
        }
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['videos'],
        allowsEditing: false,
        videoMaxDuration: MAX_REEL_DURATION_SECONDS,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        quality: 1,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets?.[0]) return;
      const selected = result.assets[0];
      const validationError = validateReelSelection(selected);
      if (validationError) {
        setAsset(null);
        setError(validationError);
        return;
      }
      setAsset(selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open this video.');
    }
  };

  const startUpload = async () => {
    if (!asset || isUploading) return;
    const validationError = validateReelSelection(asset);
    if (validationError) {
      setError(validationError);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadReelInChunks({
        asset,
        caption,
        communityId: selectedCommunityId,
        isIntro,
        signal: controller.signal,
        onProgress: setProgress,
      });
      onComplete(result);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Unable to upload this reel.');
      }
    } finally {
      abortRef.current = null;
      setIsUploading(false);
    }
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setIsUploading(false);
    setProgress(null);
    setError('Upload canceled.');
  };

  const tryClose = () => {
    if (isUploading) {
      Alert.alert('Cancel upload?', 'Your upload progress will be lost.', [
        { text: 'Keep uploading', style: 'cancel' },
        {
          text: 'Cancel upload',
          style: 'destructive',
          onPress: () => {
            abortRef.current?.abort();
            onClose();
          },
        },
      ]);
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={tryClose}>
      <KeyboardAvoidingView
        style={[dynamicStyles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={dynamicStyles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close reel composer"
            onPress={tryClose}
            style={({ pressed }) => [dynamicStyles.headerButton, pressed && dynamicStyles.pressed]}
          >
            <MaterialCommunityIcons name="close" size={23} color={colors.text} />
          </Pressable>
          <View style={dynamicStyles.headerCopy}>
            <ThemedText style={dynamicStyles.title}>
              {isIntro ? 'Intro video' : 'Create a reel'}
            </ThemedText>
            <ThemedText style={dynamicStyles.subtitle}>Up to 60 seconds · 100 MB</ThemedText>
          </View>
          <View style={dynamicStyles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            dynamicStyles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 88 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {asset ? (
            <View style={dynamicStyles.previewCard}>
              <SelectedVideoPreview asset={asset} />
              <View style={dynamicStyles.assetMeta}>
                <View style={dynamicStyles.assetCopy}>
                  <ThemedText style={dynamicStyles.assetName} numberOfLines={1}>
                    {asset.fileName || 'Selected video'}
                  </ThemedText>
                  <ThemedText style={dynamicStyles.assetDetail}>
                    {formatDuration(asset.duration)} · {formatBytes(asset.fileSize ?? asset.file?.size)}
                  </ThemedText>
                </View>
                {!isUploading ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove selected video"
                    onPress={() => setAsset(null)}
                    style={({ pressed }) => [dynamicStyles.removeButton, pressed && dynamicStyles.pressed]}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={dynamicStyles.sourceCard}>
              <View style={dynamicStyles.sourceIcon}>
                <MaterialCommunityIcons name="movie-open-plus" size={32} color={colors.primaryFrom} />
              </View>
              <ThemedText style={dynamicStyles.sourceTitle}>Choose how to start</ThemedText>
              <ThemedText style={dynamicStyles.sourceText}>
                Record something new or select a video already on your device.
              </ThemedText>
              <View style={dynamicStyles.sourceButtons}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => chooseVideo('camera')}
                  style={({ pressed }) => [dynamicStyles.primaryButton, pressed && dynamicStyles.pressed]}
                >
                  <MaterialCommunityIcons name="video-plus-outline" size={20} color="#fff" />
                  <ThemedText style={dynamicStyles.primaryButtonText}>Record</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => chooseVideo('library')}
                  style={({ pressed }) => [dynamicStyles.secondaryButton, pressed && dynamicStyles.pressed]}
                >
                  <MaterialCommunityIcons name="image-multiple-outline" size={20} color={colors.text} />
                  <ThemedText style={dynamicStyles.secondaryButtonText}>Library</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          <View style={dynamicStyles.formCard}>
            <View style={dynamicStyles.labelRow}>
              <ThemedText style={dynamicStyles.label}>Caption</ThemedText>
              <ThemedText style={dynamicStyles.counter}>{caption.length}/500</ThemedText>
            </View>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              editable={!isUploading}
              placeholder="What should people know about this reel?"
              placeholderTextColor={colors.subtext}
              multiline
              maxLength={500}
              style={dynamicStyles.captionInput}
            />
          </View>

          <View style={dynamicStyles.formCard}>
            <View style={dynamicStyles.settingRow}>
              <View style={dynamicStyles.settingIcon}>
                <MaterialCommunityIcons name="account-voice" size={21} color={colors.primaryFrom} />
              </View>
              <View style={dynamicStyles.settingCopy}>
                <ThemedText style={dynamicStyles.settingTitle}>Use as profile intro</ThemedText>
                <ThemedText style={dynamicStyles.settingText}>
                  Visitors can play this from your profile. Any aspect ratio works.
                </ThemedText>
              </View>
              <Switch
                value={isIntro}
                onValueChange={setIsIntro}
                disabled={isUploading}
                trackColor={{ false: colors.border, true: colors.primaryFrom }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={dynamicStyles.formCard}>
            <ThemedText style={dynamicStyles.label}>Community</ThemedText>
            <ThemedText style={dynamicStyles.helper}>
              Associate this reel with any community you follow, or keep it on your profile.
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={dynamicStyles.communityRow}
            >
              <Pressable
                disabled={isUploading}
                onPress={() => setSelectedCommunityId(null)}
                style={({ pressed }) => [
                  dynamicStyles.communityChip,
                  selectedCommunityId === null && dynamicStyles.communityChipActive,
                  pressed && dynamicStyles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="account-circle-outline"
                  size={17}
                  color={selectedCommunityId === null ? '#fff' : colors.text}
                />
                <ThemedText
                  style={[
                    dynamicStyles.communityChipText,
                    selectedCommunityId === null && dynamicStyles.communityChipTextActive,
                  ]}
                >
                  Profile only
                </ThemedText>
              </Pressable>
              {communities.map((community) => {
                const active = selectedCommunityId === community.id;
                return (
                  <Pressable
                    key={community.id}
                    disabled={isUploading}
                    onPress={() => setSelectedCommunityId(community.id)}
                    style={({ pressed }) => [
                      dynamicStyles.communityChip,
                      active && dynamicStyles.communityChipActive,
                      pressed && dynamicStyles.pressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="account-group-outline"
                      size={17}
                      color={active ? '#fff' : colors.text}
                    />
                    <ThemedText
                      numberOfLines={1}
                      style={[
                        dynamicStyles.communityChipText,
                        active && dynamicStyles.communityChipTextActive,
                      ]}
                    >
                      {community.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
              {isLoadingCommunities ? <ActivityIndicator color={colors.primaryFrom} /> : null}
            </ScrollView>
          </View>

          {progress ? (
            <View style={dynamicStyles.progressCard}>
              <View style={dynamicStyles.progressCopy}>
                <ThemedText style={dynamicStyles.settingTitle}>{progress.message}</ThemedText>
                <ThemedText style={dynamicStyles.counter}>{progress.progress}%</ThemedText>
              </View>
              <View style={dynamicStyles.progressTrack}>
                <View style={[dynamicStyles.progressFill, { width: `${progress.progress}%` }]} />
              </View>
              {isUploading ? (
                <Pressable onPress={cancelUpload} style={({ pressed }) => pressed && dynamicStyles.pressed}>
                  <ThemedText style={dynamicStyles.cancelText}>Cancel upload</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {error ? (
            <View style={dynamicStyles.errorCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
              <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <View style={[dynamicStyles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityRole="button"
            disabled={!asset || isUploading}
            onPress={startUpload}
            style={({ pressed }) => [
              dynamicStyles.publishButton,
              (!asset || isUploading) && dynamicStyles.publishButtonDisabled,
              pressed && asset && !isUploading && dynamicStyles.pressed,
            ]}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="upload" size={20} color="#fff" />
            )}
            <ThemedText style={dynamicStyles.publishText}>
              {isUploading ? 'Uploading…' : isIntro ? 'Publish intro' : 'Publish reel'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.page,
    },
    header: {
      minHeight: 64,
      paddingHorizontal: Brand.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.hover,
    },
    headerCopy: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    headerSpacer: {
      width: 42,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.subtext,
      fontSize: 11,
    },
    content: {
      padding: Brand.spacing.lg,
      gap: Brand.spacing.lg,
    },
    pressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.9,
    },
    previewCard: {
      overflow: 'hidden',
      borderRadius: Brand.radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: '#020617',
    },
    assetMeta: {
      minHeight: 62,
      backgroundColor: colors.card,
      paddingHorizontal: Brand.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Brand.spacing.md,
    },
    assetCopy: {
      flex: 1,
      gap: 2,
    },
    assetName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    assetDetail: {
      color: colors.subtext,
      fontSize: 12,
    },
    removeButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.hover,
    },
    sourceCard: {
      minHeight: 280,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: Brand.radius.card,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Brand.spacing.xl,
      gap: 9,
    },
    sourceIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
      marginBottom: 4,
    },
    sourceTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    sourceText: {
      color: colors.subtext,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      maxWidth: 330,
    },
    sourceButtons: {
      marginTop: Brand.spacing.md,
      flexDirection: 'row',
      gap: Brand.spacing.md,
    },
    primaryButton: {
      minHeight: 44,
      minWidth: 120,
      borderRadius: Brand.radius.pill,
      paddingHorizontal: 18,
      backgroundColor: colors.primaryFrom,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryButton: {
      minHeight: 44,
      minWidth: 120,
      borderRadius: Brand.radius.pill,
      paddingHorizontal: 18,
      backgroundColor: colors.hover,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    formCard: {
      borderRadius: Brand.radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: Brand.spacing.lg,
      gap: Brand.spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    counter: {
      color: colors.subtext,
      fontSize: 11,
    },
    helper: {
      color: colors.subtext,
      fontSize: 12,
      lineHeight: 17,
    },
    captionInput: {
      minHeight: 100,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.page,
      padding: 12,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Brand.spacing.md,
    },
    settingIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
    },
    settingCopy: {
      flex: 1,
      gap: 2,
    },
    settingTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    settingText: {
      color: colors.subtext,
      fontSize: 12,
      lineHeight: 17,
    },
    communityRow: {
      paddingTop: 4,
      gap: 8,
      alignItems: 'center',
    },
    communityChip: {
      minHeight: 38,
      maxWidth: 220,
      borderRadius: Brand.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      backgroundColor: colors.page,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    communityChipActive: {
      borderColor: colors.primaryFrom,
      backgroundColor: colors.primaryFrom,
    },
    communityChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    communityChipTextActive: {
      color: '#fff',
    },
    progressCard: {
      borderRadius: Brand.radius.card,
      borderWidth: 1,
      borderColor: hexToRgba(colors.primaryFrom, 0.35),
      backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
      padding: Brand.spacing.lg,
      gap: Brand.spacing.md,
    },
    progressCopy: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Brand.spacing.md,
    },
    progressTrack: {
      height: 7,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: colors.primaryFrom,
    },
    cancelText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    errorCard: {
      borderRadius: 12,
      padding: Brand.spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: hexToRgba(colors.danger, 0.35),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Brand.spacing.sm,
    },
    errorText: {
      flex: 1,
      color: colors.danger,
      fontSize: 12,
      lineHeight: 17,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Brand.spacing.lg,
      paddingTop: Brand.spacing.md,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    publishButton: {
      minHeight: 50,
      borderRadius: Brand.radius.pill,
      backgroundColor: colors.primaryFrom,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    publishButtonDisabled: {
      opacity: 0.45,
    },
    publishText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
  });

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    height: 300,
    backgroundColor: '#020617',
  },
});
