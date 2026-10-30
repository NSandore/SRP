import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { apiClient } from '@/lib/api/client';
import { buildUploadSrc } from '@/lib/uploads';
import { useBrandStyles } from '@/hooks/use-brand-styles';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

type VerificationRequest = {
  request_id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  community_name?: string;
  verification_type?: string;
  verification_method?: string;
  staff_position?: string;
  created_at?: string;
  selfie_path?: string | null;
  id_front_path?: string | null;
  supporting_doc_path?: string | null;
};

const labelForMethod = (method?: string) => {
  if (method === 'id_photo') return 'Selfie + ID front';
  if (method === 'tuition_statement') return 'Schedule / Billing statement';
  return method || 'Unknown';
};

export default function VerificationsScreen() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ request_id?: string }>();
  const highlightRequestId = Array.isArray(params?.request_id)
    ? params.request_id[0]
    : params?.request_id;
  const isAllowed = isSuperAdmin(user?.role_id);
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const segWidth = useRef(0);
  const segAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const index = STATUS_OPTIONS.findIndex((opt) => opt.value === status);
    Animated.timing(segAnim, {
      toValue: index < 0 ? 0 : index,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [status, segAnim]);

  const fetchRequests = async (nextStatus = status) => {
    if (!isAllowed) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.get('/fetch_verification_requests.php', {
        params: { status: nextStatus },
      });
      const list = Array.isArray((res.data as any)?.requests) ? (res.data as any).requests : [];
      setRequests(list);
    } catch {
      setError('Unable to load verification submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAllowed) return;
    if (highlightRequestId && status !== 'all') {
      setStatus('all');
      return;
    }
    fetchRequests(status);
  }, [status, isAllowed, highlightRequestId]);

  const handleDecision = async (requestId: string, decision: 'approve' | 'reject') => {
    setError('');
    try {
      await apiClient.post('/update_verification_request.php', {
        request_id: requestId,
        decision,
      });
      setRequests((prev) => prev.filter((item) => item.request_id !== requestId));
    } catch {
      setError('Unable to update verification request.');
    }
  };

  const emptyState = useMemo(() => {
    if (loading) return 'Loading submissions...';
    if (error) return error;
    return 'No submissions in this view.';
  }, [loading, error]);

  if (!user) {
    return (
      <AppShell>
        <View style={styles.helper}>
          <ThemedText style={styles.helperText}>Log in to view verification submissions.</ThemedText>
        </View>
      </AppShell>
    );
  }

  if (!isAllowed) {
    return (
      <AppShell>
        <View style={styles.helper}>
          <ThemedText style={styles.helperText}>
            Only super admins can access verification submissions.
          </ThemedText>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText style={styles.pageTitle}>Verification submissions</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              Review student and staff proof uploads and take action.
            </ThemedText>
          </View>
          <View
            style={styles.segmentControl}
            onLayout={(event) => {
              segWidth.current = event.nativeEvent.layout.width;
            }}
          >
            <Animated.View
              style={[
                styles.segmentIndicator,
                {
                  width: segWidth.current ? segWidth.current / STATUS_OPTIONS.length - 6 : 0,
                  transform: [
                    {
                      translateX: segAnim.interpolate({
                        inputRange: [0, 1, 2, 3],
                        outputRange: [
                          3,
                          segWidth.current / STATUS_OPTIONS.length + 3,
                          (segWidth.current / STATUS_OPTIONS.length) * 2 + 3,
                          (segWidth.current / STATUS_OPTIONS.length) * 3 + 3,
                        ],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.segmentPillBackground} />
            {STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.segmentButton}
                onPress={() => setStatus(opt.value)}
              >
                <ThemedText
                  style={[
                    styles.segmentButtonText,
                    status === opt.value && styles.segmentButtonTextActive,
                  ]}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryFrom} />
            <ThemedText style={styles.mutedText}>Loading submissions...</ThemedText>
          </View>
        ) : null}

        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.mutedText}>{emptyState}</ThemedText>
          </View>
        ) : (
          <View style={styles.grid}>
            {requests.map((req) => {
              const highlight = highlightRequestId && req.request_id === highlightRequestId;
              const name = `${req.first_name || ''} ${req.last_name || ''}`.trim() || 'Member';
              const resolvedSelfie = req.selfie_path ? buildUploadSrc(req.selfie_path) : '';
              const resolvedId = req.id_front_path ? buildUploadSrc(req.id_front_path) : '';
              const resolvedDoc = req.supporting_doc_path ? buildUploadSrc(req.supporting_doc_path) : '';
              return (
                <View
                  key={req.request_id}
                  style={[styles.card, highlight && styles.cardHighlight]}
                >
                  <View style={styles.cardHead}>
                    <View style={styles.cardHeadText}>
                      <ThemedText style={styles.name}>{name}</ThemedText>
                      <ThemedText style={styles.metaText}>{req.email}</ThemedText>
                    </View>
                    <View style={styles.statusPill}>
                      <ThemedText style={styles.statusText}>{req.status || 'pending'}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.details}>
                    <ThemedText style={styles.detailLine}>
                      <ThemedText style={styles.detailLabel}>Community:</ThemedText>{' '}
                      {req.community_name || 'Not provided'}
                    </ThemedText>
                    <ThemedText style={styles.detailLine}>
                      <ThemedText style={styles.detailLabel}>Type:</ThemedText>{' '}
                      {req.verification_type || 'Unknown'}
                    </ThemedText>
                    <ThemedText style={styles.detailLine}>
                      <ThemedText style={styles.detailLabel}>Method:</ThemedText>{' '}
                      {labelForMethod(req.verification_method)}
                    </ThemedText>
                    {req.staff_position ? (
                      <ThemedText style={styles.detailLine}>
                        <ThemedText style={styles.detailLabel}>Position:</ThemedText>{' '}
                        {req.staff_position}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={styles.detailLine}>
                      <ThemedText style={styles.detailLabel}>Submitted:</ThemedText>{' '}
                      {req.created_at || 'Unknown'}
                    </ThemedText>
                  </View>

                  <View style={styles.uploads}>
                    {resolvedSelfie ? (
                      <Pressable
                        style={styles.fileCard}
                        onPress={() => Linking.openURL(resolvedSelfie)}
                      >
                        <Image source={{ uri: resolvedSelfie }} style={styles.fileImage} />
                        <ThemedText style={styles.fileLabel}>Selfie + ID</ThemedText>
                      </Pressable>
                    ) : null}
                    {resolvedId ? (
                      <Pressable
                        style={styles.fileCard}
                        onPress={() => Linking.openURL(resolvedId)}
                      >
                        <Image source={{ uri: resolvedId }} style={styles.fileImage} />
                        <ThemedText style={styles.fileLabel}>ID front</ThemedText>
                      </Pressable>
                    ) : null}
                    {resolvedDoc ? (
                      <Pressable
                        style={styles.fileCard}
                        onPress={() => Linking.openURL(resolvedDoc)}
                      >
                        <View style={styles.docPreview}>
                          <MaterialCommunityIcons name="file-pdf-box" size={28} color={colors.primaryFrom} />
                        </View>
                        <ThemedText style={styles.fileLabel}>Statement</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.actions}>
                    {req.status === 'pending' ? (
                      <>
                        <Pressable
                          style={styles.approveButton}
                          onPress={() => handleDecision(req.request_id, 'approve')}
                        >
                          <ThemedText style={styles.actionText}>Approve</ThemedText>
                        </Pressable>
                        <Pressable
                          style={styles.rejectButton}
                          onPress={() => handleDecision(req.request_id, 'reject')}
                        >
                          <ThemedText style={styles.actionText}>Reject</ThemedText>
                        </Pressable>
                      </>
                    ) : (
                      <ThemedText style={styles.resolvedText}>Reviewed</ThemedText>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  container: {
    paddingHorizontal: Brand.spacing.lg,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
  },
  headerText: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.subtext,
  },
  segmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: hexToRgba('#0f172a', 0.08),
    padding: 3,
    alignSelf: 'flex-start',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  segmentPillBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  segmentButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mutedText: {
    fontSize: 12,
    color: colors.subtext,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  grid: {
    gap: 18,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.card,
    gap: 14,
  },
  cardHighlight: {
    borderColor: hexToRgba(colors.primaryFrom, 0.7),
    shadowColor: colors.primaryFrom,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeadText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  metaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.primaryFrom,
    letterSpacing: 0.6,
  },
  details: {
    gap: 6,
  },
  detailLine: {
    fontSize: 12,
    color: colors.text,
  },
  detailLabel: {
    fontWeight: '700',
    color: colors.text,
  },
  uploads: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fileCard: {
    flexBasis: 110,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8,
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  fileImage: {
    width: '100%',
    height: 90,
    borderRadius: 8,
  },
  docPreview: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 'auto',
  },
  approveButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1f8f4e',
  },
  rejectButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#c0392b',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  resolvedText: {
    fontSize: 12,
    color: colors.subtext,
    fontWeight: '600',
  },
  helper: {
    padding: 18,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  helperText: {
    fontSize: 12,
    color: colors.subtext,
  },
});
