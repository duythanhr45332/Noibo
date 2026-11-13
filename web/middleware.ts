import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
    // Nếu đã có token mà lại vào trang login thì redirect phù hợp
    if ((token || refreshToken) && pathname === '/login') {
      if (request.nextUrl.searchParams.get('session_expired')) {
        const response = NextResponse.next()
        response.cookies.delete('token')
        response.cookies.delete('refreshToken')
        return response
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Prototype Mode: Cho phép truy cập trực tiếp trang chủ và các màn hình Prototype mà không bắt buộc phải có token đăng nhập
  if (pathname === '/' || pathname.startsWith('/prototype')) {
    return NextResponse.next()
  }

  // Nếu không có cả token và refreshToken, redirect về trang login
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
