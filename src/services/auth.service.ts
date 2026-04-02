import api from '@/hooks/useApi'
import type {
  TokenRequest,
  RefreshTokenRequest,
  TokenResponse,
  ApiResponse,
  ChangeActiveBranchRequest,
} from '@/types/api'

export const authService = {
  login: (data: TokenRequest) =>
    api.post<ApiResponse<TokenResponse>>('/auth/token', data),

  refresh: (data: RefreshTokenRequest) =>
    api.post<ApiResponse<TokenResponse>>('/auth/token/refresh', data),

  me: (params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>('/auth/me', { params }),

  changeActiveBranch: (data: ChangeActiveBranchRequest) =>
    api.patch<ApiResponse<unknown>>('/auth/change-active-branch', data),

  revoke: () =>
    api.post<ApiResponse<unknown>>('/auth/revoke'),
}
