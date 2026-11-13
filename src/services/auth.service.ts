import api from '@/hooks/useApi'
import type {
  TokenRequest,
  RefreshTokenRequest,
  TokenResponse,
  ApiResponse,
  ChangeActiveBranchRequest,
} from '@/types/api'

export interface UpdateProfileRequest {
  name: string
  email: string
  phone: string | null
  birth: string | null
  gender: 'male' | 'female' | null
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  new_password_confirmation: string
}

export const authService = {
  login: (data: TokenRequest) =>
    api.post<ApiResponse<TokenResponse>>('/auth/token/', data),

  refresh: (data: RefreshTokenRequest) =>
    api.post<ApiResponse<TokenResponse>>('/auth/token/refresh', data),

  me: (params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>('/auth/me', { params }),

  changeActiveBranch: (data: ChangeActiveBranchRequest) =>
    api.patch<ApiResponse<unknown>>('/auth/change-active-branch', data),

  updateProfile: (data: UpdateProfileRequest) =>
    api.put<ApiResponse<unknown>>('/auth/me', data),

  changePassword: (data: ChangePasswordRequest) =>
    api.patch<ApiResponse<unknown>>('/auth/me/password', data),

  revoke: () =>
    api.post<ApiResponse<unknown>>('/auth/revoke'),
}
