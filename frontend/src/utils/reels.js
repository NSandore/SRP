import axios from 'axios';

export const MAX_REEL_DURATION_SECONDS = 60;
export const MAX_REEL_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const REEL_CAPTION_MAX_LENGTH = 500;

const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);
const READY_STATUSES = new Set(['ready', 'complete', 'completed', 'published', 'active']);
const FAILED_STATUSES = new Set(['failed', 'error', 'rejected']);

const asBoolean = (value) =>
  value === true || value === 1 || value === '1' || value === 'true';

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getExtension = (name = '') => {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
};

export const formatReelBytes = (bytes = 0) => {
  const value = asNumber(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const getReelFileValidationError = (file, durationSeconds = null) => {
  if (!file) return 'Choose a video to continue.';
  if (!file.size) return 'The selected video is empty.';
  if (file.size > MAX_REEL_FILE_SIZE_BYTES) {
    return `Videos must be ${formatReelBytes(MAX_REEL_FILE_SIZE_BYTES)} or smaller.`;
  }

  const mimeType = String(file.type || '').toLowerCase();
  const extension = getExtension(file.name);
  if (
    (mimeType && !mimeType.startsWith('video/')) ||
    (!mimeType && !ALLOWED_VIDEO_EXTENSIONS.has(extension))
  ) {
    return 'Choose an MP4, MOV, M4V, or WebM video.';
  }

  if (durationSeconds !== null) {
    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      return 'We could not read this video’s duration.';
    }
    if (duration > MAX_REEL_DURATION_SECONDS) {
      return `Reels must be ${MAX_REEL_DURATION_SECONDS} seconds or shorter.`;
    }
  }

  return '';
};

export const readReelVideoMetadata = (file) =>
  new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      reject(new Error('Video metadata is unavailable in this environment.'));
      return;
    }

    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('Video metadata took too long to load.')));
    }, 15000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const metadata = {
        duration: Number(video.duration),
        width: Number(video.videoWidth) || 0,
        height: Number(video.videoHeight) || 0,
      };
      finish(() => resolve(metadata));
    };
    video.onerror = () => {
      finish(() => reject(new Error('This video could not be read by your browser.')));
    };
    video.src = objectUrl;
  });

export const validateReelFile = async (file) => {
  const basicError = getReelFileValidationError(file);
  if (basicError) throw new Error(basicError);

  const metadata = await readReelVideoMetadata(file);
  const metadataError = getReelFileValidationError(file, metadata.duration);
  if (metadataError) throw new Error(metadataError);
  return metadata;
};

const normalizePinnedCommunities = (raw) => {
  const values = Array.isArray(raw?.pinned_communities)
    ? raw.pinned_communities
    : Array.isArray(raw?.pinned_community_ids)
      ? raw.pinned_community_ids
      : [];

  return values
    .map((item) => {
      if (item && typeof item === 'object') {
        const communityId = String(item.community_id ?? item.id ?? '');
        if (!communityId) return null;
        return {
          community_id: communityId,
          name: item.name || item.community_name || 'Community',
          pin_id: item.pin_id ? String(item.pin_id) : '',
        };
      }
      const communityId = String(item || '');
      return communityId
        ? { community_id: communityId, name: 'Community', pin_id: '' }
        : null;
    })
    .filter(Boolean);
};

export const normalizeReel = (raw = {}) => {
  const reelId = String(raw.reel_id ?? raw.id ?? '');
  const creatorId = String(
    raw.creator_user_id ?? raw.user_id ?? raw.creator_id ?? raw.created_by ?? ''
  );
  const communityId = String(raw.community_id ?? '');
  const status = String(raw.status ?? raw.processing_status ?? 'ready').toLowerCase();

  return {
    ...raw,
    reel_id: reelId,
    user_id: creatorId,
    community_id: communityId,
    community_type: raw.community_type || raw.type || 'group',
    video_path: raw.video_path || raw.video_url || raw.media_path || raw.media_url || '',
    poster_path: raw.poster_path || raw.poster_url || raw.thumbnail_path || raw.thumbnail_url || '',
    caption: raw.caption || raw.description || '',
    first_name: raw.first_name || raw.creator_first_name || '',
    last_name: raw.last_name || raw.creator_last_name || '',
    creator_name:
      raw.creator_name ||
      [raw.first_name || raw.creator_first_name, raw.last_name || raw.creator_last_name]
        .filter(Boolean)
        .join(' ') ||
      'StudentSphere creator',
    avatar_path: raw.avatar_path || raw.creator_avatar_path || '',
    community_name: raw.community_name || '',
    likes_count: asNumber(raw.likes_count ?? raw.like_count ?? raw.likes),
    comments_count: asNumber(raw.comments_count ?? raw.comment_count ?? raw.comments),
    saves_count: asNumber(raw.saves_count ?? raw.save_count ?? raw.saves),
    is_liked: asBoolean(raw.is_liked ?? raw.liked),
    is_saved: asBoolean(raw.is_saved ?? raw.saved),
    is_intro: asBoolean(raw.is_intro ?? raw.intro),
    is_featured: asBoolean(raw.is_featured ?? raw.featured),
    status,
    pinned_communities: normalizePinnedCommunities(raw),
  };
};

export const normalizeReelsResponse = (data = {}) => {
  const source = Array.isArray(data) ? data : data.reels || data.items || [];
  return {
    reels: Array.isArray(source) ? source.map(normalizeReel).filter((reel) => reel.reel_id) : [],
    nextCursor:
      (Array.isArray(data) ? null : data.next_cursor ?? data.cursor ?? data.pagination?.next_cursor) ||
      null,
  };
};

const assertSuccessfulResponse = (response, fallbackMessage) => {
  const data = response?.data || {};
  if (data.success === false || data.error) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
};

export const pollReelStatus = async (
  reelId,
  { signal, onProgress, intervalMs = 2000, maxAttempts = 90 } = {}
) => {
  if (!reelId) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Upload cancelled.', 'AbortError');
    }

    const response = await axios.get('/api/fetch_reel_status.php', {
      params: { reel_id: reelId },
      withCredentials: true,
      signal,
    });
    const data = assertSuccessfulResponse(response, 'Unable to check reel processing status.');
    const status = String(
      data.status ?? data.processing_status ?? data.reel?.status ?? data.reel?.processing_status ?? ''
    ).toLowerCase();

    if (READY_STATUSES.has(status)) {
      onProgress?.(100, 'ready');
      return data.reel ? normalizeReel(data.reel) : normalizeReel({ ...data, reel_id: reelId });
    }
    if (FAILED_STATUSES.has(status)) {
      throw new Error(data.error || data.message || 'The reel could not be processed.');
    }

    onProgress?.(Math.min(99, 95 + Math.floor(attempt / 20)), 'processing');
    await new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(resolve, intervalMs);
      signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(timeoutId);
          reject(new DOMException('Upload cancelled.', 'AbortError'));
        },
        { once: true }
      );
    });
  }

  throw new Error('Your video is still processing. Check your Reels profile shortly.');
};

export const uploadReelInChunks = async ({
  file,
  caption = '',
  communityId = '',
  isIntro = false,
  signal,
  onProgress,
}) => {
  if (!file) throw new Error('Choose a video to continue.');

  onProgress?.(0, 'starting');
  const initResponse = await axios.post(
    '/api/init_reel_upload.php',
    {
      file_name: file.name,
      mime_type: file.type || 'video/mp4',
      file_size: file.size,
      caption,
      community_id: communityId || null,
      is_intro: Boolean(isIntro),
    },
    { withCredentials: true, signal }
  );
  const initData = assertSuccessfulResponse(initResponse, 'Unable to start the reel upload.');
  const uploadId = String(initData.upload_id || '');
  const chunkSize = Math.max(256 * 1024, asNumber(initData.chunk_size, 1024 * 1024));
  const totalChunks = Math.max(
    1,
    asNumber(initData.total_chunks, Math.ceil(file.size / chunkSize))
  );

  if (!uploadId) throw new Error('The upload service did not return an upload ID.');

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    if (signal?.aborted) {
      throw new DOMException('Upload cancelled.', 'AbortError');
    }
    const start = chunkIndex * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);

    const chunkResponse = await axios.post(
      `/api/upload_reel_chunk.php?upload_id=${encodeURIComponent(uploadId)}&chunk_index=${chunkIndex}`,
      chunk,
      {
        withCredentials: true,
        signal,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        onUploadProgress: (event) => {
          const loaded = Math.min(event.loaded || 0, chunk.size);
          const uploadedBytes = start + loaded;
          onProgress?.(Math.min(92, Math.round((uploadedBytes / file.size) * 92)), 'uploading');
        },
      }
    );
    assertSuccessfulResponse(chunkResponse, `Unable to upload video part ${chunkIndex + 1}.`);
  }

  onProgress?.(94, 'finalizing');
  const finalizeResponse = await axios.post(
    '/api/finalize_reel_upload.php',
    { upload_id: uploadId },
    { withCredentials: true, signal }
  );
  const finalizeData = assertSuccessfulResponse(finalizeResponse, 'Unable to finalize the reel upload.');
  const reelId = String(finalizeData.reel_id ?? finalizeData.reel?.reel_id ?? '');

  if (!reelId) {
    onProgress?.(100, 'ready');
    return { uploadId, reelId: '', reel: null, response: finalizeData };
  }

  const finalizeStatus = String(
    finalizeData.status ?? finalizeData.reel?.status ?? finalizeData.reel?.processing_status ?? ''
  ).toLowerCase();
  if (READY_STATUSES.has(finalizeStatus)) {
    onProgress?.(100, 'ready');
    return {
      uploadId,
      reelId,
      reel: normalizeReel(finalizeData.reel || { ...finalizeData, reel_id: reelId }),
      response: finalizeData,
    };
  }

  onProgress?.(95, 'processing');
  const processedReel = await pollReelStatus(reelId, { signal, onProgress });
  return { uploadId, reelId, reel: processedReel, response: finalizeData };
};
