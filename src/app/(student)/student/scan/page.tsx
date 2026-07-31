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
      className={`flex flex-col items-center justify-center min-h-[90dvh] w-full max-w-md mx-auto p-4 space-y-4 text-white transition-colors duration-500 rounded-3xl mt-4 shadow-2xl ${
        isAuthorized ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {isAuthorized ? (
        <CheckCircle className="w-24 h-24 text-white animate-bounce" />
      ) : (
        <XCircle className="w-24 h-24 text-white" />
      )}

      <h1 className="text-4xl md:text-5xl font-black uppercase tracking-wider drop-shadow-md text-center break-words w-full px-2">
        {result?.status}
      </h1>

      {result?.reason && (
        <p className="text-xl font-bold opacity-90 uppercase text-center">
          {result.reason}
        </p>
      )}

      {/* Date Display */}
      <div className="text-3xl md:text-4xl font-black text-white/90 drop-shadow-lg tracking-wide text-center">
        {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </div>

      <div className="bg-white/20 backdrop-blur-md p-6 rounded-2xl w-full shadow-inner flex flex-col items-center">
        {result?.student?.photo ? (
          <img 
            src={result.student.photo} 
            alt="Profile" 
            className="w-20 h-20 rounded-full mb-3 border-4 border-white shadow-lg object-cover" 
          />
        ) : (
          <div className="w-20 h-20 rounded-full mb-3 border-4 border-white shadow-lg bg-white/40 flex items-center justify-center text-4xl font-bold">
            {result?.student?.name?.charAt(0)}
          </div>
        )}
        <h2 className="text-2xl font-bold drop-shadow-sm text-center leading-tight">{result?.student?.name}</h2>
        <p className="text-lg mt-1 opacity-90 font-semibold drop-shadow-sm">ID: {result?.student?.diningId}</p>
        <p className="text-sm opacity-80 text-center">{result?.student?.department}</p>
      </div>

      <button 
        onClick={() => router.push('/student/dashboard')}
        className={`w-full max-w-[200px] py-3 mt-2 font-extrabold rounded-full transition shadow-xl text-xl hover:scale-105 active:scale-95 ${
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
