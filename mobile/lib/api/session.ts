import { apiClient } from '@/lib/api/client';
import type { ApiResponse, SessionUser } from '@/lib/api/types';

export type LoginResponse = ApiResponse<{
  user?: SessionUser;
  requires_two_factor?: boolean;
  session_id?: string;
}>;

export async function loginWithPassword(email: string, password: string) {
  const { data } = await apiClient.post<LoginResponse>('/login_user.php', {
    email,
    password,
  });
  return data;
}

export async function verifyTwoFactor(code: string, rememberDevice: boolean) {
  const { data } = await apiClient.post<LoginResponse>('/verify_two_factor.php', {
    code,
    remember_device: rememberDevice,
  });
  return data;
}

export async function resetPassword(email: string, newPassword: string) {
  const { data } = await apiClient.post<ApiResponse<Record<string, never>>>('/reset_password.php', {
    email,
    new_password: newPassword,
  });
  return data;
}
