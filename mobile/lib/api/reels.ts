import type { ImagePickerAsset } from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/api/types';
import { buildUploadSrc } from '@/lib/uploads';

export const MAX_REEL_DURATION_SECONDS = 60;
export const MAX_REEL_BYTES = 100 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES = 1024 * 1024;

type Numberish = number | string | null;

export type Reel = {
  reel_id: string;
  creator_user_id?: string;
  user_id?: string;
  creator_first_name?: string;
  creator_last_name?: string;
  creator_name?: string;
  creator_avatar_path?: string | null;
  caption?: string | null;
  video_path?: string | null;
  video_url?: string | null;
  playback_url?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string | null;
  community_id?: string | null;
  community_name?: string | null;
  community_type?: string | null;
  created_at?: string | null;
  duration_ms?: Numberish;
  duration_seconds?: Numberish;
  width?: Numberish;
  height?: Numberish;
  file_size?: Numberish;
  like_count: number;
  comment_count: number;
  save_count?: number;
  pinned_community_ids: string[];
  is_liked: boolean;
  is_saved: boolean;
  is_pinned: boolean;
  pin_id?: string | null;
  is_intro: boolean;
  is_featured: boolean;
  can_pin?: boolean;
  status?: string | null;
};

export type ReelComment = {
  comment_id: string;
  reel_id?: string;
  user_id?: string;
  creator_user_id?: string;
  body: string;
  first_name?: string;
  last_name?: string;
  creator_name?: string;
  avatar_path?: string | null;
  created_at?: string | null;
  parent_comment_id?: string | null;
};

export type ReelAction =
  | 'like'
  | 'unlike'
  | 'save'
  | 'unsave'
  | 'pin'
  | 'unpin'
  | 'set_intro'
  | 'unset_intro'
  | 'delete'
  | 'feature'
  | 'unfeature';

export type FetchReelsParams = {
  scope?: 'feed' | 'saved';
  reelId?: string;
  userId?: string;
  communityId?: string;
  limit?: number;
  cursor?: string | null;
};

export type FetchReelsResult = {
  reels: Reel[];
  nextCursor: string | null;
};

export type ReelUploadSelection = Pick<
  ImagePickerAsset,
  'uri' | 'fileName' | 'fileSize' | 'mimeType' | 'duration' | 'width' | 'height' | 'file'
>;

export type ReelUploadProgress = {
  phase: 'preparing' | 'uploading' | 'processing' | 'complete';
  progress: number;
  uploadedChunks?: number;
  totalChunks?: number;
  message: string;
};

export type UploadReelOptions = {
  asset: ReelUploadSelection;
  caption?: string;
  communityId?: string | null;
  isIntro?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: ReelUploadProgress) => void;
};

export type UploadReelResult = {
  reelId: string;
  status: string;
  reel?: Reel;
};

const asBool = (value: unknown) =>
  value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';

const asCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const asNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const asStringArray = (value: unknown) => {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      candidate = [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => asNullableString(item))
    .filter((item): item is string => Boolean(item));
};

export function normalizeReel(raw: Record<string, unknown>): Reel {
  const reelId = String(raw.reel_id ?? raw.id ?? '');
  const communityId = asNullableString(raw.community_id);
  const pinnedCommunityIds = asStringArray(raw.pinned_community_ids);
  const creatorFirstName = asNullableString(raw.creator_first_name ?? raw.first_name) ?? undefined;
  const creatorLastName = asNullableString(raw.creator_last_name ?? raw.last_name) ?? undefined;
  const creatorName =
    asNullableString(raw.creator_name) ??
    ([creatorFirstName, creatorLastName].filter(Boolean).join(' ').trim() || undefined);
  return {
    ...(raw as unknown as Reel),
    reel_id: reelId,
    creator_user_id: asNullableString(raw.creator_user_id ?? raw.user_id) ?? undefined,
    user_id: asNullableString(raw.user_id ?? raw.creator_user_id) ?? undefined,
    creator_first_name: creatorFirstName,
    creator_last_name: creatorLastName,
    creator_name: creatorName,
    creator_avatar_path: asNullableString(raw.creator_avatar_path ?? raw.avatar_path),
    caption: asNullableString(raw.caption ?? raw.description),
    video_path: asNullableString(raw.video_path),
    video_url: asNullableString(raw.video_url),
    playback_url: asNullableString(raw.playback_url ?? raw.stream_url),
    thumbnail_path: asNullableString(raw.thumbnail_path ?? raw.poster_path),
    thumbnail_url: asNullableString(raw.thumbnail_url ?? raw.poster_url),
    community_id: communityId,
    community_name: asNullableString(raw.community_name),
    community_type: asNullableString(raw.community_type),
    created_at: asNullableString(raw.created_at),
    pin_id: asNullableString(raw.pin_id),
    like_count: asCount(raw.like_count ?? raw.likes_count ?? raw.likes),
    comment_count: asCount(raw.comment_count ?? raw.comments_count ?? raw.comments),
    save_count: asCount(raw.save_count ?? raw.saves_count ?? raw.saves),
    pinned_community_ids: pinnedCommunityIds,
    is_liked: asBool(raw.is_liked ?? raw.user_liked ?? raw.liked),
    is_saved: asBool(raw.is_saved ?? raw.user_saved ?? raw.saved),
    is_pinned:
      asBool(raw.is_pinned ?? raw.user_pinned) ||
      (communityId
        ? pinnedCommunityIds.includes(communityId)
        : pinnedCommunityIds.length > 0),
    is_intro: asBool(raw.is_intro),
    is_featured: asBool(raw.is_featured),
    can_pin: raw.can_pin === undefined ? undefined : asBool(raw.can_pin),
  };
}

export function normalizeReelComment(raw: Record<string, unknown>): ReelComment {
  return {
    ...(raw as unknown as ReelComment),
    comment_id: String(raw.comment_id ?? raw.id ?? ''),
    reel_id: asNullableString(raw.reel_id) ?? undefined,
    user_id: asNullableString(raw.user_id ?? raw.creator_user_id) ?? undefined,
    creator_user_id: asNullableString(raw.creator_user_id ?? raw.user_id) ?? undefined,
    body: String(raw.body ?? raw.content ?? ''),
    avatar_path: asNullableString(raw.avatar_path ?? raw.creator_avatar_path),
    created_at: asNullableString(raw.created_at),
    parent_comment_id: asNullableString(raw.parent_comment_id),
  };
}

export function getReelVideoUrl(reel: Reel) {
  const value = reel.playback_url || reel.video_url || reel.video_path || '';
  return buildUploadSrc(value);
}

export function getReelThumbnailUrl(reel: Reel) {
  const value = reel.thumbnail_url || reel.thumbnail_path || '';
  return buildUploadSrc(value);
}

export async function fetchReels(params: FetchReelsParams = {}): Promise<FetchReelsResult> {
  const { data } = await apiClient.get<ApiResponse<{
    reels?: Record<string, unknown>[];
    items?: Record<string, unknown>[];
    next_cursor?: string | null;
    nextCursor?: string | null;
  }>>('/fetch_reels.php', {
    params: {
      scope: params.scope ?? 'feed',
      reel_id: params.reelId || undefined,
      user_id: params.userId || undefined,
      community_id: params.communityId || undefined,
      limit: Math.max(1, Math.min(50, params.limit ?? 12)),
      cursor: params.cursor || undefined,
    },
  });

  if (data.success === false) {
    throw new Error(data.error || 'Unable to load reels.');
  }

  const rows = Array.isArray(data.reels)
    ? data.reels
    : Array.isArray(data.items)
      ? data.items
      : [];

  return {
    reels: rows.map(normalizeReel).filter((reel) => reel.reel_id !== ''),
    nextCursor: asNullableString(data.next_cursor ?? data.nextCursor),
  };
}

export async function performReelAction(
  action: ReelAction,
  reelId: string,
  extra: Record<string, unknown> = {}
) {
  const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>('/reel_action.php', {
    action,
    reel_id: reelId,
    ...extra,
  });
  if (data.success === false) {
    throw new Error(data.error || 'Unable to update this reel.');
  }
  return data;
}

export async function fetchReelComments(
  reelId: string,
  cursor?: string | null,
  limit: number = 30
) {
  const { data } = await apiClient.get<ApiResponse<{
    comments?: Record<string, unknown>[];
    next_cursor?: string | null;
  }>>('/fetch_reel_comments.php', {
    params: {
      reel_id: reelId,
      cursor: cursor || undefined,
      limit: Math.max(1, Math.min(50, limit)),
    },
  });
  if (data.success === false) {
    throw new Error(data.error || 'Unable to load comments.');
  }
  return {
    comments: (data.comments || []).map(normalizeReelComment),
    nextCursor: asNullableString(data.next_cursor),
  };
}

export async function createReelComment(
  reelId: string,
  body: string,
  parentCommentId?: string | null
) {
  const { data } = await apiClient.post<ApiResponse<{
    comment?: Record<string, unknown>;
    comment_id?: string;
  }>>('/create_reel_comment.php', {
    reel_id: reelId,
    body: body.trim(),
    parent_comment_id: parentCommentId || undefined,
  });
  if (data.success === false) {
    throw new Error(data.error || 'Unable to add your comment.');
  }
  if (data.comment) return normalizeReelComment(data.comment);
  return normalizeReelComment({
    comment_id: data.comment_id || `pending-${Date.now()}`,
    reel_id: reelId,
    body: body.trim(),
    created_at: new Date().toISOString(),
  });
}

export async function deleteReelComment(commentId: string) {
  const { data } = await apiClient.post<ApiResponse<Record<string, never>>>(
    '/delete_reel_comment.php',
    { comment_id: commentId }
  );
  if (data.success === false) {
    throw new Error(data.error || 'Unable to delete this comment.');
  }
  return data;
}

export function validateReelSelection(asset: ReelUploadSelection): string | null {
  const durationMs = Number(asset.duration);
  if (Number.isFinite(durationMs) && durationMs > MAX_REEL_DURATION_SECONDS * 1000) {
    return 'Choose a video that is 60 seconds or shorter.';
  }

  const fileSize = Number(asset.fileSize ?? asset.file?.size);
  if (Number.isFinite(fileSize) && fileSize > MAX_REEL_BYTES) {
    return 'Choose a video smaller than 100 MB.';
  }

  if (!asset.uri) {
    return 'This video could not be read. Please choose another one.';
  }

  return null;
}

const createUploadBlob = (asset: ReelUploadSelection): Blob => {
  if (asset.file && typeof asset.file.slice === 'function') {
    return asset.file;
  }
  return new ExpoFile(asset.uri);
};

const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Upload canceled.'));
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Upload canceled.'));
      },
      { once: true }
    );
  });

export async function fetchReelStatus(reelId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiResponse<{
    reel_id?: string;
    status?: string;
    reel?: Record<string, unknown>;
  }>>('/fetch_reel_status.php', {
    params: { reel_id: reelId },
    signal,
  });
  if (data.success === false) {
    throw new Error(data.error || 'Unable to check processing status.');
  }
  return {
    reelId: String(data.reel_id || reelId),
    status: String(data.status || 'processing').toLowerCase(),
    reel: data.reel ? normalizeReel(data.reel) : undefined,
    error: data.error,
  };
}

export async function uploadReelInChunks({
  asset,
  caption = '',
  communityId = null,
  isIntro = false,
  signal,
  onProgress,
}: UploadReelOptions): Promise<UploadReelResult> {
  const validationError = validateReelSelection(asset);
  if (validationError) throw new Error(validationError);

  onProgress?.({
    phase: 'preparing',
    progress: 0,
    message: 'Preparing your video…',
  });

  const file = createUploadBlob(asset);
  const fileSize = Number(asset.fileSize ?? file.size);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error('This video is empty or unavailable.');
  }
  if (fileSize > MAX_REEL_BYTES) {
    throw new Error('Choose a video smaller than 100 MB.');
  }

  const mimeType = asset.mimeType || file.type || 'video/mp4';
  const fileName = asset.fileName || `reel-${Date.now()}.mp4`;
  const proposedChunkCount = Math.max(1, Math.ceil(fileSize / DEFAULT_CHUNK_BYTES));

  const { data: initData } = await apiClient.post<ApiResponse<{
    upload_id?: string;
    chunk_size?: number;
    total_chunks?: number;
  }>>('/init_reel_upload.php', {
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileSize,
    caption: caption.trim(),
    community_id: communityId || null,
    is_intro: isIntro,
  }, { signal });

  if (initData.success === false || !initData.upload_id) {
    throw new Error(initData.error || 'Unable to start the upload.');
  }

  const uploadId = initData.upload_id;
  const chunkSize = Math.max(256 * 1024, Number(initData.chunk_size) || DEFAULT_CHUNK_BYTES);
  const totalChunks = Math.max(
    1,
    Number(initData.total_chunks) || proposedChunkCount || Math.ceil(fileSize / chunkSize)
  );

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    if (signal?.aborted) throw new Error('Upload canceled.');
    const start = chunkIndex * chunkSize;
    const end = Math.min(fileSize, start + chunkSize);
    const body = file.slice(start, end, mimeType);

    const { data: chunkData } = await apiClient.post<ApiResponse<{
      received_chunks?: number;
      total_chunks?: number;
    }>>('/upload_reel_chunk.php', body, {
      params: {
        upload_id: uploadId,
        chunk_index: chunkIndex,
      },
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000,
      signal,
    });

    if (chunkData.success === false) {
      throw new Error(chunkData.error || `Unable to upload chunk ${chunkIndex + 1}.`);
    }

    const uploadedChunks = chunkIndex + 1;
    onProgress?.({
      phase: 'uploading',
      progress: Math.round((uploadedChunks / totalChunks) * 82),
      uploadedChunks,
      totalChunks,
      message: `Uploading ${uploadedChunks} of ${totalChunks}…`,
    });
  }

  const { data: finalizeData } = await apiClient.post<ApiResponse<{
    reel_id?: string;
    status?: string;
  }>>(
    '/finalize_reel_upload.php',
    { upload_id: uploadId },
    { signal, timeout: 120000 }
  );

  if (finalizeData.success === false || !finalizeData.reel_id) {
    throw new Error(finalizeData.error || 'Unable to finish the upload.');
  }

  const reelId = finalizeData.reel_id;
  onProgress?.({
    phase: 'processing',
    progress: 86,
    message: 'Applying light compression…',
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await fetchReelStatus(reelId, signal);
    if (['ready', 'complete', 'completed', 'published'].includes(result.status)) {
      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Your reel is ready.',
      });
      return { reelId, status: result.status, reel: result.reel };
    }
    if (['failed', 'error', 'rejected'].includes(result.status)) {
      throw new Error(result.error || 'Video processing failed. Please try another video.');
    }

    onProgress?.({
      phase: 'processing',
      progress: Math.min(98, 86 + Math.floor(attempt / 6)),
      message: 'Applying light compression…',
    });
    await wait(1500, signal);
  }

  return {
    reelId,
    status: 'processing',
  };
}
