"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { APP_NAME } from "@/lib/constants"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error === "Admin login requires an OTP.") {
        // Trigger the OTP generation API
        const otpReq = await fetch("/api/admin/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const otpRes = await otpReq.json();
        
        if (otpRes.success) {
          setStep("OTP")
        } else {
          setError(otpRes.error || "Failed to send verification code")
        }
        setLoading(false)
      } else if (result?.error) {
        setError(result.error) // Standard login error
        setLoading(false)
      } else {
        // Success (Student or Staff)
        await handleSuccessRedirect()
      }
    } else {
      // Step: OTP
      const result = await signIn("credentials", {
        email,
        otp,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else {
        // Success (Admin)
        await handleSuccessRedirect()
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
            N
          </div>
          <CardTitle className="text-2xl">
            {step === "PASSWORD" ? "Welcome back" : "Admin Verification"}
          </CardTitle>
          <CardDescription>
            {step === "PASSWORD" ? `Sign in to ${APP_NAME}` : "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {step === "PASSWORD" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@niter.edu.bd"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {step === "OTP" && (
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : step === "PASSWORD" ? "Sign In" : "Verify & Login"}
            </Button>
            {step === "PASSWORD" && (
              <p className="text-sm text-muted-foreground text-center">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Register
                </Link>
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
