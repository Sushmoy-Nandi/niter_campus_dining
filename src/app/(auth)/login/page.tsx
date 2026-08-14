"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "@/components/layout/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"PASSWORD" | "OTP">("PASSWORD")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSuccessRedirect() {
    const res = await fetch("/api/auth/session")
    const session = await res.json()
    const role = (session?.user as any)?.role;

    if (role === "ADMIN") {
      router.push("/admin/dashboard")
    } else if (role === "STAFF") {
      router.push("/staff/dashboard")
    } else {
      router.push("/student/dashboard")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (step === "PASSWORD") {
      try {
        const otpReq = await fetch("/api/admin/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const otpRes = await otpReq.json();

        if (otpRes.success) {
          setStep("OTP")
          setLoading(false)
          return
        }
      } catch (err) {
        console.error("OTP API Error:", err)
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
        setLoading(false)
      } else {
        await handleSuccessRedirect()
      }
    } else {
      const result = await signIn("credentials", {
        email,
        otp,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid OTP or expired")
        setLoading(false)
      } else {
        await handleSuccessRedirect()
      }
    }
  }

  return (
    <AuthLayout
      title={step === "PASSWORD" ? "Welcome back" : "Admin Verification"}
      description={
        step === "PASSWORD"
          ? "Sign in to manage your meals and dining account."
          : "Enter the 6-digit code sent to your email"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive" className="py-2.5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "PASSWORD" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  className="h-10 pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="h-10 pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                className="h-10 pl-9 tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
            </div>
          </div>
        )}

        <Button type="submit" className="h-10 w-full text-base" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading
            ? "Verifying..."
            : step === "PASSWORD"
              ? "Sign In"
              : "Verify & Login"}
        </Button>

        {step === "PASSWORD" && (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
