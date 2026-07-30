import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"

import { CredentialsSignin } from "next-auth"

class CustomAuthError extends CredentialsSignin {
  code: string;
  constructor(message: string) {
    super();
    this.code = message;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "OTP", type: "text" }, // Add OTP field
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new CustomAuthError("Email is required")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) {
          throw new CustomAuthError("Invalid email or password")
        }

        // --- ADMIN LOGIN LOGIC (2-Step Verification) ---
        if (user.role === "ADMIN") {
          if (!credentials.otp) {
            throw new CustomAuthError("Admin login requires an OTP.")
          }
          
          if (user.otpCode !== credentials.otp) {
            throw new CustomAuthError("Invalid OTP.")
          }
          
          if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
            throw new CustomAuthError("OTP has expired. Please request a new one.")
          }

          // Clear the OTP upon successful login
          await prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null, otpExpiresAt: null }
          })
        } 
        // --- STUDENT/STAFF LOGIN LOGIC (Password) ---
        else {
          if (!credentials.password || !user.passwordHash) {
            throw new CustomAuthError("Invalid email or password")
          }

          const isValid = await compare(
            credentials.password as string,
            user.passwordHash
          )

          if (!isValid) {
            throw new CustomAuthError("Invalid email or password")
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
})
