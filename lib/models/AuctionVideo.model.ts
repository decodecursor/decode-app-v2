/**
 * Auction Video Model
 * Represents winner video recordings with 7-day auto-deletion
 */

export type RecordingMethod = 'in_page' | 'email_link';

export interface AuctionVideo {
  id: string;

  // Auction and bid reference
  auction_id: string;
  bid_id: string;

  // Video storage
  file_url: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  mime_type?: string;

  // Security token for fallback recording page
  recording_token?: string;
  token_expires_at?: string;

  // Recording metadata
  retake_count: number;
  recording_method?: RecordingMethod;

  // Auto-deletion (7 days)
  expires_at: string;
  deleted_at?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateAuctionVideoDto {
  auction_id: string;
  bid_id: string;
  file_url: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  mime_type?: string;
  recording_method?: RecordingMethod;
  recording_token?: string;
  token_expires_at?: string;
}

export interface UpdateAuctionVideoDto {
  file_url?: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  mime_type?: string;
  retake_count?: number;
  deleted_at?: string;
}

export interface VideoRecordingSession {
  auction_id: string;
  bid_id: string;
  token: string;
  expires_at: string;
  can_retake: boolean;
}

export interface VideoUploadResult {
  success: boolean;
  video_id?: string;
  file_url?: string;
  error?: string;
}

// Constants
export const MAX_VIDEO_DURATION_SECONDS = 10;
export const MAX_RETAKES = 1;
export const VIDEO_EXPIRY_DAYS = 7;
export const RECORDING_TOKEN_EXPIRY_HOURS = 24;
export const MAX_VIDEO_SIZE_MB = 50;
export const ALLOWED_VIDEO_FORMATS = ['video/webm', 'video/mp4', 'video/quicktime'];

// Helper functions
export function generateRecordingToken(): string {
  // Generate a secure random token for video recording links
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function getVideoExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + VIDEO_EXPIRY_DAYS);
  return expiryDate;
}

export function getTokenExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + RECORDING_TOKEN_EXPIRY_HOURS);
  return expiryDate;
}

export function isVideoExpired(video: AuctionVideo): boolean {
  if (video.deleted_at) return true;
  return new Date(video.expires_at) <= new Date();
}

export function canRetake(video: AuctionVideo): boolean {
  return video.retake_count < MAX_RETAKES && !isVideoExpired(video);
}

export function isTokenValid(tokenExpiresAt?: string): boolean {
  if (!tokenExpiresAt) return false;
  return new Date(tokenExpiresAt) > new Date();
}

export function formatVideoSize(bytes?: number): string {
  if (!bytes) return 'Unknown';

  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function formatVideoDuration(seconds?: number): string {
  if (!seconds) return 'Unknown';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  // Check file type (use startsWith to handle codec suffixes like video/webm;codecs=vp8,opus)
  if (!ALLOWED_VIDEO_FORMATS.some(format => file.type.startsWith(format))) {
    return {
      valid: false,
      error: `Invalid file type. Allowed formats: ${ALLOWED_VIDEO_FORMATS.join(', ')}`,
    };
  }

  // Check file size
  const maxSizeBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_VIDEO_SIZE_MB}MB`,
    };
  }

  return { valid: true };
}
