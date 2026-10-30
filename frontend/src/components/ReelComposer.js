import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, CheckCircle2, Film, LoaderCircle, Upload } from 'lucide-react';
import ModalOverlay from './ModalOverlay';
import {
  MAX_REEL_DURATION_SECONDS,
  MAX_REEL_FILE_SIZE_BYTES,
  REEL_CAPTION_MAX_LENGTH,
  formatReelBytes,
  uploadReelInChunks,
  validateReelFile,
} from '../utils/reels';
import './Reels.css';

const getPhaseLabel = (phase) => {
  switch (phase) {
    case 'starting':
      return 'Preparing upload…';
    case 'uploading':
      return 'Uploading video…';
    case 'finalizing':
      return 'Securing upload…';
    case 'processing':
      return 'Applying light compression…';
    case 'ready':
      return 'Your reel is ready.';
    default:
      return '';
  }
};

function ReelComposer({
  isOpen,
  onClose,
  userData,
  communityOptions = [],
  initialIntro = false,
  defaultCommunityId = '',
  onCreated,
}) {
  const uploadInputRef = useRef(null);
  const recordInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [communityId, setCommunityId] = useState(defaultCommunityId || '');
  const [isIntro, setIsIntro] = useState(Boolean(initialIntro));
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [uploadError, setUploadError] = useState('');

  const uniqueCommunities = useMemo(() => {
    const map = new Map();
    communityOptions.forEach((community) => {
      const id = String(community?.community_id ?? community?.id ?? '');
      if (!id || map.has(id)) return;
      map.set(id, {
        community_id: id,
        name: community?.name || community?.community_name || 'Community',
      });
    });
    if (defaultCommunityId && !map.has(String(defaultCommunityId))) {
      map.set(String(defaultCommunityId), {
        community_id: String(defaultCommunityId),
        name: 'Selected community',
      });
    }
    return Array.from(map.values());
  }, [communityOptions, defaultCommunityId]);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setMetadata(null);
    setCaption('');
    setCommunityId(defaultCommunityId || '');
    setIsIntro(Boolean(initialIntro));
    setValidationError('');
    setUploadError('');
    setIsValidating(false);
    setIsUploading(false);
    setProgress(0);
    setPhase('');
  }, [isOpen, initialIntro, defaultCommunityId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  const handleClose = () => {
    if (isUploading) {
      const shouldCancel = window.confirm('Cancel this reel upload?');
      if (!shouldCancel) return;
      abortControllerRef.current?.abort();
    }
    onClose?.();
  };

  const handleFileSelection = async (selectedFile) => {
    setValidationError('');
    setUploadError('');
    setMetadata(null);
    setFile(null);
    if (!selectedFile) return;

    setIsValidating(true);
    try {
      const nextMetadata = await validateReelFile(selectedFile);
      setFile(selectedFile);
      setMetadata(nextMetadata);
    } catch (error) {
      setValidationError(error.message || 'This video cannot be used.');
    } finally {
      setIsValidating(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      if (recordInputRef.current) recordInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || isUploading || isValidating) return;
    setUploadError('');
    setIsUploading(true);
    setProgress(0);
    setPhase('starting');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await uploadReelInChunks({
        file,
        caption: caption.trim(),
        communityId,
        isIntro,
        signal: controller.signal,
        onProgress: (nextProgress, nextPhase) => {
          setProgress(nextProgress);
          setPhase(nextPhase);
        },
      });

      if (isIntro && result.reelId && !result.reel?.is_intro) {
        const introResponse = await axios.post(
          '/api/reel_action.php',
          { action: 'set_intro', reel_id: result.reelId },
          { withCredentials: true }
        );
        if (introResponse.data?.success === false || introResponse.data?.error) {
          throw new Error(introResponse.data.error || 'Unable to set this as your Intro Reel.');
        }
      }
      setProgress(100);
      setPhase('ready');
      onCreated?.(result.reel, result);
      window.setTimeout(() => onClose?.(), 700);
    } catch (error) {
      if (error?.name !== 'AbortError' && error?.code !== 'ERR_CANCELED') {
        setUploadError(
          error?.response?.data?.error ||
            error.message ||
            'The reel could not be uploaded. Please try again.'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsUploading(false);
    }
  };

  const aspectLabel =
    metadata?.width && metadata?.height
      ? metadata.height >= metadata.width
        ? 'Portrait'
        : 'Landscape'
      : '';

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={handleClose}
      contentClassName="reel-composer-overlay"
    >
      <section className="reel-composer" aria-labelledby="reel-composer-title">
        <header className="reel-composer__header">
          <span className="reel-composer__eyebrow">
            <Film size={16} aria-hidden="true" />
            Create a reel
          </span>
          <h2 id="reel-composer-title">
            {isIntro ? 'Share your introduction' : 'Share something worth seeing'}
          </h2>
          <p>
            Upload a video from any computer, or record one on a supported phone. Reels may be up
            to {MAX_REEL_DURATION_SECONDS} seconds and {formatReelBytes(MAX_REEL_FILE_SIZE_BYTES)}.
          </p>
        </header>

        <form className="reel-composer__form" onSubmit={handleSubmit}>
          <div className="reel-composer__media-column">
            {previewUrl ? (
              <div className="reel-composer__preview">
                <video src={previewUrl} controls muted playsInline preload="metadata" />
                <button
                  type="button"
                  className="reel-composer__replace"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading}
                >
                  Replace video
                </button>
              </div>
            ) : (
              <div className="reel-composer__dropzone">
                {isValidating ? (
                  <>
                    <LoaderCircle className="reel-spin" size={28} aria-hidden="true" />
                    <strong>Checking your video…</strong>
                  </>
                ) : (
                  <>
                    <Film size={34} aria-hidden="true" />
                    <strong>Choose how to add your video</strong>
                    <span>Portrait video works best in the Reels feed.</span>
                    <div className="reel-composer__source-actions">
                      <button type="button" onClick={() => uploadInputRef.current?.click()}>
                        <Upload size={17} aria-hidden="true" />
                        Upload video
                      </button>
                      <button type="button" onClick={() => recordInputRef.current?.click()}>
                        <Camera size={17} aria-hidden="true" />
                        Record video
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <input
              ref={uploadInputRef}
              className="reel-file-input"
              type="file"
              accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/*"
              onChange={(event) => handleFileSelection(event.target.files?.[0])}
              disabled={isUploading}
            />
            <input
              ref={recordInputRef}
              className="reel-file-input"
              type="file"
              accept="video/*"
              capture="user"
              onChange={(event) => handleFileSelection(event.target.files?.[0])}
              disabled={isUploading}
            />
            {metadata ? (
              <div className="reel-composer__file-meta">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>
                  {file?.name} · {metadata.duration.toFixed(1)}s · {formatReelBytes(file?.size)}{' '}
                  {aspectLabel ? `· ${aspectLabel}` : ''}
                </span>
              </div>
            ) : null}
            {validationError ? (
              <p className="reel-composer__error" role="alert">
                {validationError}
              </p>
            ) : null}
          </div>

          <div className="reel-composer__details">
            <label htmlFor="reel-caption">Caption</label>
            <textarea
              id="reel-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Give people a reason to watch…"
              maxLength={REEL_CAPTION_MAX_LENGTH}
              rows={5}
              disabled={isUploading}
            />
            <span className="reel-composer__count">
              {caption.length} / {REEL_CAPTION_MAX_LENGTH}
            </span>

            {uniqueCommunities.length > 0 ? (
              <>
                <label htmlFor="reel-community">Community</label>
                <select
                  id="reel-community"
                  value={communityId}
                  onChange={(event) => setCommunityId(event.target.value)}
                  disabled={isUploading}
                >
                  <option value="">No community</option>
                  {uniqueCommunities.map((community) => (
                    <option key={community.community_id} value={community.community_id}>
                      {community.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <label className="reel-composer__intro-toggle">
              <input
                type="checkbox"
                checked={isIntro}
                onChange={(event) => setIsIntro(event.target.checked)}
                disabled={isUploading}
              />
              <span>
                <strong>Use as my Intro Reel</strong>
                <small>Visitors can play it from your profile.</small>
              </span>
            </label>

            {isUploading || phase === 'ready' ? (
              <div className="reel-upload-progress" aria-live="polite">
                <div className="reel-upload-progress__row">
                  <span>{getPhaseLabel(phase)}</span>
                  <strong>{Math.round(progress)}%</strong>
                </div>
                <div
                  className="reel-upload-progress__track"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(progress)}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}
            {uploadError ? (
              <p className="reel-composer__error" role="alert">
                {uploadError}
              </p>
            ) : null}

            <div className="reel-composer__actions">
              <button
                type="submit"
                className="reel-primary-button"
                disabled={!file || isValidating || isUploading}
              >
                {isUploading ? (
                  <LoaderCircle className="reel-spin" size={18} aria-hidden="true" />
                ) : (
                  <Upload size={18} aria-hidden="true" />
                )}
                {isUploading ? 'Uploading…' : 'Publish reel'}
              </button>
              <button
                type="button"
                className="reel-secondary-button"
                onClick={handleClose}
              >
                {isUploading ? 'Cancel upload' : 'Cancel'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </ModalOverlay>
  );
}

export default ReelComposer;
