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

// Step 1: request an emailed reset code.
export async function requestPasswordReset(email: string) {
  const { data } = await apiClient.post<ApiResponse<{ requires_code?: boolean }>>('/reset_password.php', {
    email,
  });
  return data;
}

// Step 2: submit the code plus the new password.
export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
  const { data } = await apiClient.post<ApiResponse<Record<string, never>>>('/reset_password.php', {
    email,
    code,
    new_password: newPassword,
  });
  return data;
}

export async function logout() {
  const { data } = await apiClient.post<ApiResponse<Record<string, never>>>('/logout.php', {});
  return data;
}
