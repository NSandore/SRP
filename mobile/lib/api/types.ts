export type SessionUser = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_id?: number;
  avatar_path?: string | null;
  banner_path?: string | null;
  is_ambassador?: number;
  is_verified?: number;
  education_status?: string;
  recent_university_id?: string | null;
  admin_community_ids?: string[];
};

export type ApiResponse<T> = {
  success?: boolean;
  error?: string;
  message?: string;
} & T;
