import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import qs from 'qs'
import { cookies } from '@/lib/cookies'
import environment from '@/config/environment'
import { toast } from 'sonner'

const api: AxiosInstance = axios.create({
  baseURL: environment.API_URL,
  headers: { 'Content-Type': 'application/json' },
  paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'brackets', encode: false }),
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = cookies.get('token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

function clearAuthAndRedirect() {
  const cookieOpts = {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };

  cookies.remove("token", cookieOpts);
  cookies.remove("refresh_token", cookieOpts);
  cookies.remove("session_start", cookieOpts);
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

/** Map common HTTP status codes to user-friendly messages */
function getFriendlyErrorMessage(status: number, data: any): string | null {
  // Try to use backend message first
  const backendMsg: string | undefined = data?.message
  if (backendMsg && backendMsg.toLowerCase() !== 'internal server error') {
    return backendMsg
  }

  switch (status) {
    case 400: return 'Permintaan tidak valid. Periksa data yang Anda masukkan.'
    case 403: return 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
    case 404: return 'Data yang diminta tidak ditemukan.'
    case 409: return 'Terjadi konflik data. Data mungkin sudah ada atau sudah berubah.'
    case 422: return 'Data yang dikirim tidak valid. Pastikan semua field sudah diisi dengan benar.'
    case 429: return 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.'
    case 500: return 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi administrator.'
    case 502: return 'Server sedang tidak dapat diakses. Silakan coba lagi.'
    case 503: return 'Layanan sedang tidak tersedia. Silakan coba lagi nanti.'
    default: return null
  }
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error?.response?.status
    const data = (error?.response?.data as any) ?? {}

    // Overwrite generic message with specific field error if available
    if (data?.errors && typeof data.errors === 'object') {
      for (const key in data.errors) {
        if (Array.isArray(data.errors[key]) && data.errors[key].length > 0) {
          data.message = data.errors[key][0]
          break
        }
      }
    }
    if (status === 401 && !originalRequest._retry) {
      const refreshToken = cookies.get('refresh_token')
      if (!refreshToken) {
        clearAuthAndRedirect()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await axios.post(`${environment.API_URL}/auth/token/refresh`, { refresh_token: refreshToken })
        const newToken: string = res.data?.data?.access_token ?? res.data?.access_token
        cookies.set('token', newToken, {
          expires: 1,
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        })
        processQueue(null, newToken)
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Show global toast for server-side errors (5xx) where no specific
    // mutation-level handler will provide a better message.
    if (status && status >= 500) {
      const friendlyMsg = getFriendlyErrorMessage(status, data)
      if (friendlyMsg) {
        toast.error(friendlyMsg)
      }
    }

    return Promise.reject(error)
  },
)

export default api

export const useApi = () => api

