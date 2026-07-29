import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for auth session token cookie (next-auth sets this)
  const token =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("next-auth.session-token") ||
    request.cookies.get("__Secure-next-auth.session-token")

  const isLoggedIn = !!token

  const isOnAuth =
    pathname.startsWith("/login") || pathname.startsWith("/register")
  const isOnStudent = pathname.startsWith("/student")
  const isOnAdmin = pathname.startsWith("/admin")
  const isOnStaff = pathname.startsWith("/staff")

  // If user is logged in and visits auth pages, redirect to dashboard
  if (isOnAuth && isLoggedIn) {
    // Note: We don't have the user's role here because standard auth token might not decode easily without auth.config
    // But typically if they land on /login and have a token, we just send them to /student/dashboard and let the client routing correct them, 
    // or we can redirect to a generic page. Let's redirect to root which will handle routing, or student/dashboard.
    return NextResponse.redirect(new URL("/student/dashboard", request.url))
  }

  // If user is NOT logged in and visits protected pages, redirect to login
  if ((isOnStudent || isOnAdmin || isOnStaff) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
