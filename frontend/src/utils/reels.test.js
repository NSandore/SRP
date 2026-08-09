import axios from 'axios';
import {
  MAX_REEL_DURATION_SECONDS,
  MAX_REEL_FILE_SIZE_BYTES,
  getReelFileValidationError,
  normalizeReel,
  uploadReelInChunks,
} from './reels';

jest.mock('axios');

const makeFile = ({
  name = 'introduction.mp4',
  type = 'video/mp4',
  size = 8 * 1024 * 1024,
} = {}) => ({ name, type, size });

describe('getReelFileValidationError', () => {
  it('accepts a supported video that is exactly sixty seconds long', () => {
    expect(
      getReelFileValidationError(makeFile(), MAX_REEL_DURATION_SECONDS)
    ).toBe('');
  });

  it('rejects a video longer than sixty seconds', () => {
    expect(
      getReelFileValidationError(makeFile(), MAX_REEL_DURATION_SECONDS + 0.01)
    ).toBe('Reels must be 60 seconds or shorter.');
  });

  it('rejects a file larger than the upload limit', () => {
    expect(
      getReelFileValidationError(
        makeFile({ size: MAX_REEL_FILE_SIZE_BYTES + 1 })
      )
    ).toBe('Videos must be 100.0 MB or smaller.');
  });

  it('rejects an empty file', () => {
    expect(getReelFileValidationError(makeFile({ size: 0 }))).toBe(
      'The selected video is empty.'
    );
  });

  it('rejects non-video content even when the extension looks valid', () => {
    expect(
      getReelFileValidationError(
        makeFile({ name: 'renamed.mp4', type: 'application/pdf' })
      )
    ).toBe('Choose an MP4, MOV, M4V, or WebM video.');
  });

  it('accepts a supported extension when a browser omits the MIME type', () => {
    expect(
      getReelFileValidationError(
        makeFile({ name: 'phone-capture.mov', type: '' }),
        32.5
      )
    ).toBe('');
  });
});

describe('uploadReelInChunks', () => {
  beforeEach(() => {
    axios.post.mockReset();
  });

  it('uses one-megabyte fallback chunks and sends raw chunk requests without Content-Range', async () => {
    const fileSize = 1024 * 1024 + 25;
    const file = {
      name: 'intro.webm',
      type: 'video/webm',
      size: fileSize,
      slice: jest.fn((start, end) => ({ size: end - start })),
    };

    axios.post
      .mockResolvedValueOnce({
        data: { success: true, upload_id: 'upload-7', total_chunks: 2 },
      })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          reel_id: 'reel-9',
          status: 'ready',
          reel: { reel_id: 'reel-9', creator_user_id: '4', status: 'ready' },
        },
      });

    const result = await uploadReelInChunks({
      file,
      caption: 'Hello from the commons',
      communityId: '12',
      isIntro: true,
    });

    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      '/api/init_reel_upload.php',
      {
        file_name: 'intro.webm',
        mime_type: 'video/webm',
        file_size: fileSize,
        caption: 'Hello from the commons',
        community_id: '12',
        is_intro: true,
      },
      expect.objectContaining({ withCredentials: true })
    );
    expect(file.slice).toHaveBeenNthCalledWith(1, 0, 1024 * 1024);
    expect(file.slice).toHaveBeenNthCalledWith(2, 1024 * 1024, fileSize);
    expect(axios.post.mock.calls[1][0]).toBe(
      '/api/upload_reel_chunk.php?upload_id=upload-7&chunk_index=0'
    );
    expect(axios.post.mock.calls[1][2].headers).toEqual({
      'Content-Type': 'application/octet-stream',
    });
    expect(axios.post.mock.calls[1][2].headers).not.toHaveProperty(
      'Content-Range'
    );
    expect(result.reel).toEqual(
      expect.objectContaining({ reel_id: 'reel-9', user_id: '4' })
    );
  });
});

describe('normalizeReel', () => {
  it('normalizes the backend feed contract for cards and profile grids', () => {
    expect(
      normalizeReel({
        reel_id: 18,
        creator_user_id: 7,
        thumbnail_path: '/uploads/reels/thumb.jpg',
        like_count: '4',
        comment_count: '3',
        save_count: '2',
        liked: 1,
        saved: '1',
        is_intro: true,
        pinned_community_ids: [9, '12'],
      })
    ).toEqual(
      expect.objectContaining({
        reel_id: '18',
        user_id: '7',
        poster_path: '/uploads/reels/thumb.jpg',
        likes_count: 4,
        comments_count: 3,
        saves_count: 2,
        is_liked: true,
        is_saved: true,
        is_intro: true,
        pinned_communities: [
          { community_id: '9', name: 'Community', pin_id: '' },
          { community_id: '12', name: 'Community', pin_id: '' },
        ],
      })
    );
  });
});
