"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

function ScanHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing QR token. Please scan the QR code again.")
      setLoading(false)
      return
    }

    async function processCheckIn() {
      try {
        const res = await fetch("/api/student/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        })

        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || "Failed to check in.")
        } else {
          setResult(data)
        }
      } catch (err: any) {
        setError(err.message || "Network error. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    processCheckIn()
  }, [token])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6">
        <Loader2 className="w-24 h-24 animate-spin text-primary" />
        <h2 className="text-3xl font-bold animate-pulse text-muted-foreground">Verifying Meal...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6 bg-red-600 text-white rounded-3xl p-8 text-center mx-4 mt-8 shadow-2xl">
        <XCircle className="w-32 h-32 text-white" />
        <h1 className="text-5xl font-extrabold uppercase tracking-widest">Error</h1>
        <p className="text-2xl font-semibold opacity-90">{error}</p>
        <button 
          onClick={() => router.push('/student/dashboard')}
          className="mt-12 px-8 py-4 bg-white text-red-700 font-bold rounded-full hover:bg-red-50 transition shadow-lg text-xl"
        >
          Return Home
        </button>
      </div>
    )
  }

  const isAuthorized = result?.status === "AUTHORIZED"

  return (
    <div 
      className={`flex flex-col items-center justify-center min-h-[80vh] space-y-8 text-white rounded-3xl p-8 text-center mx-4 mt-8 shadow-2xl transition-colors duration-500 ${
        isAuthorized ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {isAuthorized ? (
        <CheckCircle className="w-40 h-40 text-white animate-bounce" />
      ) : (
        <XCircle className="w-40 h-40 text-white" />
      )}

      <h1 className="text-6xl md:text-8xl font-black uppercase tracking-widest drop-shadow-md">
        {result?.status}
      </h1>

      {result?.reason && (
        <p className="text-3xl font-bold opacity-90 uppercase">
          {result.reason}
        </p>
      )}

      <div className="mt-8 bg-white/20 backdrop-blur-md p-8 rounded-2xl w-full max-w-md shadow-inner">
        {result?.student?.photo ? (
          <img 
            src={result.student.photo} 
            alt="Profile" 
            className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-white shadow-lg object-cover" 
          />
        ) : (
          <div className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-white shadow-lg bg-white/40 flex items-center justify-center text-5xl font-bold">
            {result?.student?.name?.charAt(0)}
          </div>
        )}
        <h2 className="text-4xl font-bold drop-shadow-sm">{result?.student?.name}</h2>
        <p className="text-2xl mt-2 opacity-90 font-semibold drop-shadow-sm">ID: {result?.student?.diningId}</p>
        <p className="text-xl mt-1 opacity-80">{result?.student?.department}</p>
      </div>

      <button 
        onClick={() => router.push('/student/dashboard')}
        className={`mt-12 px-10 py-4 font-extrabold rounded-full transition shadow-xl text-2xl hover:scale-105 active:scale-95 ${
          isAuthorized ? "bg-green-800 hover:bg-green-900 text-white" : "bg-white text-red-700 hover:bg-red-50"
        }`}
      >
        Done
      </button>
    </div>
  )
}

export default function StudentScanPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6">
        <Loader2 className="w-24 h-24 animate-spin text-primary" />
        <h2 className="text-3xl font-bold animate-pulse text-muted-foreground">Loading Scanner...</h2>
      </div>
    }>
      <ScanHandler />
    </Suspense>
  )
}
