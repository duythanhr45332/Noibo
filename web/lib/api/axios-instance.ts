import axios, { AxiosRequestConfig, AxiosError } from 'axios'

const BASE_URL = (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:8081/api/v1')
export { BASE_URL as API_URL }

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Cho phép trình duyệt gửi kèm HttpOnly Cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

let isRefreshing = false
let failedQueue: Array<{ resolve: () => void, reject: (error: any) => void }> = []
const processQueue = (error: any) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

// Hàm refresh token dùng chung cho cả 2 axios instances
const performTokenRefresh = async (): Promise<void> => {
  await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
}

// Interceptor chung — dùng cho axiosInstance (gọi trực tiếp)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && typeof window !== 'undefined' && originalRequest && !originalRequest._retry) {
      if (originalRequest.url === '/auth/login' || originalRequest.url === '/auth/refresh') {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<void>(function (resolve, reject) {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return axiosInstance(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await performTokenRefresh()
        processQueue(null)
        return axiosInstance(originalRequest)
      } catch (err) {
        console.error("REFRESH FAILED:", err)
        processQueue(err)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?session_expired=true'
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Base URL cho Orval-generated hooks — không bao gồm /api/v1 vì Orval đã gen full path
const ORVAL_BASE_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8081'

// Axios instance riêng cho Orval hooks — dùng full path từ swagger
export const orvalAxiosInstance = axios.create({
  baseURL: ORVAL_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor đầy đủ cho orvalAxiosInstance — CÓ refresh logic, không redirect ngay
orvalAxiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && typeof window !== 'undefined' && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<void>(function (resolve, reject) {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return orvalAxiosInstance(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await performTokenRefresh()
        processQueue(null)
        return orvalAxiosInstance(originalRequest)
      } catch (err) {
        console.error("ORVAL REFRESH FAILED:", err)
        processQueue(err)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?session_expired=true'
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Hàm này được dùng bởi Orval-generated hooks
export const customAxiosInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  let url = config.url || '';
  if (url && !url.startsWith('/api/v1') && !url.startsWith('http')) {
    url = `/api/v1${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return orvalAxiosInstance({
    ...config,
    url,
    ...options,
  }).then(({ data }) => data)
}

export default customAxiosInstance
