import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isJwtNotExpired(tokenValue?: string): boolean {
  if (!tokenValue) return false
  try {
    const parts = tokenValue.split('.')
    if (parts.length !== 3) return false
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64)) as { exp?: number }
    if (!payload.exp) return true
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')
  const { pathname } = request.nextUrl
  const refreshToken = request.cookies.get('refreshToken')

  // Nếu truy cập vào các thư mục tĩnh, api hoặc đã ở trang login thì bỏ qua
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname === '/login' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|css|js)$/)
  ) {
    // Chỉ redirect khỏi /login nếu access token còn hạn và không có cờ session_expired
    if (pathname === '/login') {
      if (request.nextUrl.searchParams.get('session_expired')) {
        const response = NextResponse.next()
        response.cookies.delete('token')
        response.cookies.delete('refreshToken')
        return response
      }
      if (isJwtNotExpired(token?.value)) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
    return NextResponse.next()
  }

  // Bắt buộc đăng nhập thật trên toàn bộ hệ thống (không còn chế độ Demo)
  if (!token && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
