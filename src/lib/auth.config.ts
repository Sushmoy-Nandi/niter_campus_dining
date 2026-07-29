import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const userRole = (auth?.user as any)?.role

      const isOnStudent = nextUrl.pathname.startsWith("/student")
      const isOnAdmin = nextUrl.pathname.startsWith("/admin")
      const isOnAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register")

      if (isOnAuth) {
        if (isLoggedIn) {
          if (userRole === "ADMIN") {
            return Response.redirect(new URL("/admin/dashboard", nextUrl))
          }
          return Response.redirect(new URL("/student/dashboard", nextUrl))
        }
        return true
      }

      if (isOnAdmin) {
        if (isLoggedIn && userRole === "ADMIN") return true
        return false
      }

      if (isOnStudent) {
        if (isLoggedIn && userRole === "STUDENT") return true
        return false
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
