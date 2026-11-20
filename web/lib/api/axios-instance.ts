import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'

const SERVER_INTERNAL_ORIGIN =
  process.env.INTERNAL_API_URL || 'http://localhost:8081'

// Trên trình duyệt luôn dùng same-origin /api/v1 (đi qua Next.js rewrites) để tránh lệch host/cookie giữa localhost và IP LAN
const BASE_URL =
  typeof window !== 'undefined'
    ? '/api/v1'
    : `${SERVER_INTERNAL_ORIGIN}/api/v1`

export { BASE_URL as API_URL }

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Base URL cho Orval-generated hooks — không bao gồm /api/v1 vì Orval đã gen full path
const ORVAL_BASE_URL =
  typeof window !== 'undefined' ? '' : SERVER_INTERNAL_ORIGIN

export const orvalAxiosInstance = axios.create({
  baseURL: ORVAL_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<void> | null = null

const performTokenRefresh = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function isAuthBypassEndpoint(url?: string): boolean {
  if (!url) return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/session')
  )
}

function isProtectedAdminRoute(pathname: string): boolean {
  return pathname === '/users' || pathname.startsWith('/users/')
}

function attachAuthRefreshInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as
        | (AxiosRequestConfig & { _retry?: boolean })
        | undefined

      if (
        error.response?.status === 401 &&
        typeof window !== 'undefined' &&
        originalRequest &&
        !originalRequest._retry &&
        !isAuthBypassEndpoint(originalRequest.url)
      ) {
        originalRequest._retry = true
        try {
          await performTokenRefresh()
          return instance(originalRequest)
        } catch (refreshErr) {
          const pathname = window.location.pathname
          if (isProtectedAdminRoute(pathname)) {
            window.location.href = '/login?session_expired=true'
          }
          return Promise.reject(refreshErr)
        }
      }

      return Promise.reject(error)
    }
  )
}

attachAuthRefreshInterceptor(axiosInstance)
attachAuthRefreshInterceptor(orvalAxiosInstance)

// Hàm này được dùng bởi Orval-generated hooks
export const customAxiosInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  let url = config.url || ''
  if (url && !url.startsWith('/api/v1') && !url.startsWith('http')) {
    url = `/api/v1${url.startsWith('/') ? '' : '/'}${url}`
  }
  return orvalAxiosInstance({
    ...config,
    url,
    ...options,
  }).then(({ data }) => data)
}

export default customAxiosInstance
