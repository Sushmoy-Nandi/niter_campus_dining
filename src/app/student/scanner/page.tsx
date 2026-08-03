"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Scanner } from "@yudiel/react-qr-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, ScanLine, ArrowLeft } from "lucide-react"
import * as faceapi from "@vladmandic/face-api"

export default function StudentInAppScanner() {
  const router = useRouter()
  const [isScanning, setIsScanning] = useState(false)
  const [isVerifyingFace, setIsVerifyingFace] = useState(false)
  const [scannedToken, setScannedToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isModelsLoaded, setIsModelsLoaded] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>("")
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const hasStarted = useRef(false)
  const faceVideoRef = useRef<HTMLVideoElement>(null)
  const faceRequestRef = useRef<number>(0)

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        setIsModelsLoaded(true)
      } catch (error) {
        console.error("Failed to load models:", error)
        setError("Failed to load facial recognition models.")
      }
    }
    loadModels()
  }, [])

  // Security: Live ticking time for anti-screenshot
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Security: Auto-redirect after 50 seconds once a result is shown
  useEffect(() => {
    if (result || error) {
      const redirectTimer = setTimeout(() => {
        handleReset()
      }, 50000)
      return () => clearTimeout(redirectTimer)
    }
  }, [result, error])

  const handleReset = () => {
    setResult(null)
    setError("")
    setIsScanning(false)
    setIsVerifyingFace(false)
    setScannedToken(null)
    setLoading(false)
    hasStarted.current = false
    stopFaceCamera()
  }

  const processScanData = async (token: string, faceDescriptor: string) => {
    if (hasStarted.current) return
    hasStarted.current = true
    setLoading(true)
    setIsScanning(false)

    try {
      const res = await fetch("/api/student/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, faceDescriptor })
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

  const startFaceCamera = async (token: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      setTimeout(() => {
        if (faceVideoRef.current) {
          faceVideoRef.current.srcObject = stream
          startFaceDetectionLoop(token)
        }
      }, 100)
    } catch (err) {
      console.error(err)
      setError("Please grant camera permissions to verify your face.")
    }
  }

  const stopFaceCamera = () => {
    if (faceRequestRef.current) cancelAnimationFrame(faceRequestRef.current)
    if (faceVideoRef.current && faceVideoRef.current.srcObject) {
      const stream = faceVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      faceVideoRef.current.srcObject = null
    }
  }

  const startFaceDetectionLoop = (token: string) => {
    let lastRun = Date.now()
    let attempts = 0

    const analyzeFace = async () => {
      if (!faceVideoRef.current || hasStarted.current) return

      if (Date.now() - lastRun > 500) {
        if (faceVideoRef.current.readyState >= 2 && faceVideoRef.current.videoWidth > 0) {
          try {
            const detection = await faceapi.detectSingleFace(faceVideoRef.current).withFaceLandmarks().withFaceDescriptor()
            
            if (detection) {
              stopFaceCamera()
              const faceDescriptor = JSON.stringify(Array.from(detection.descriptor))
              await processScanData(token, faceDescriptor)
              return // End loop
            } else {
              attempts++
              if (attempts > 40) { // 20 seconds timeout
                stopFaceCamera()
                setError("No face detected. Please try scanning again and look directly at your screen.")
                return
              }
            }
          } catch (e) {
            // ignore
          }
        }
        lastRun = Date.now()
      }
      faceRequestRef.current = requestAnimationFrame(analyzeFace)
    }
    faceRequestRef.current = requestAnimationFrame(analyzeFace)
  }

  const handleScan = async (scannedText: string) => {
    if (!scannedText || hasStarted.current) return

    // Extract the token parameter from the URL in case they scanned the full link
    const tokenMatch = scannedText.match(/[?&]token=([^&#]+)/)
    const token = tokenMatch ? tokenMatch[1] : scannedText

    if (!token) {
      setError("Invalid QR code format. Please scan a valid dining hall QR code.")
      return
    }

    setScannedToken(token)
    setIsScanning(false)
    setIsVerifyingFace(true)
    
    // Give the QR Scanner time to unmount and release the hardware camera lock
    setTimeout(() => {
      startFaceCamera(token)
    }, 800)
  }

  // --- RENDERING STATES ---

  // 1. Loading Verification State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6">
        <Loader2 className="w-24 h-24 animate-spin text-primary" />
        <h2 className="text-3xl font-bold animate-pulse text-muted-foreground">Verifying Meal...</h2>
      </div>
    )
  }

  // 2. Error / Denied State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85dvh] w-full max-w-md mx-auto p-4 space-y-6 bg-red-600 text-white rounded-3xl mt-4 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent animate-pulse" />
        <XCircle className="w-32 h-32 text-white relative z-10" />
        <h1 className="text-5xl font-extrabold uppercase tracking-widest relative z-10">Access Denied</h1>
        <p className="text-2xl font-semibold opacity-90 relative z-10 px-4">{error}</p>
        
        {/* Live ticking clock even on error state for security validation */}
        <div className="text-3xl font-mono font-black text-white/90 drop-shadow-lg tracking-widest mt-4 z-10">
          {currentTime.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </div>

        <div className="flex gap-4 w-full px-4 relative z-10">
          <Button 
            onClick={handleReset}
            className="flex-1 py-6 bg-white text-red-700 font-bold rounded-full hover:bg-red-50 transition shadow-lg text-xl"
          >
            Scan Again
          </Button>
          <Button 
            onClick={() => router.push('/student/dashboard')}
            className="flex-1 py-6 bg-red-800 text-white font-bold rounded-full hover:bg-red-900 transition shadow-lg text-xl border border-red-500"
          >
            Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // 3. Success / Authorized State
  if (result && result.status === "AUTHORIZED") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85dvh] w-full max-w-md mx-auto p-4 space-y-4 text-white transition-colors duration-500 rounded-3xl mt-4 shadow-2xl bg-green-600 relative overflow-hidden">
        {/* Moving watermark to prevent static screenshots */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="w-[200%] h-[200%] absolute top-[-50%] left-[-50%] animate-[spin_10s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] mix-blend-overlay" />
        </div>

        <div className="relative z-10 flex flex-col items-center w-full">
          <CheckCircle className="w-24 h-24 text-white animate-bounce" />
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-wider drop-shadow-md text-center break-words w-full px-2 mt-2">
            AUTHORIZED
          </h1>

          {result.meal && (
            <div className="bg-white text-green-700 font-extrabold text-2xl md:text-3xl px-6 py-2 rounded-full mt-3 uppercase tracking-widest shadow-lg drop-shadow-md border-4 border-green-400">
              {result.meal}
            </div>
          )}

          {/* Date Display */}
          <div className="text-3xl md:text-4xl font-black text-white/90 drop-shadow-lg tracking-wide text-center mt-4">
            {currentTime.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          
          {/* Live Ticking Time - Anti-Screenshot */}
          <div className="text-5xl md:text-6xl font-mono font-black text-white drop-shadow-xl tracking-widest text-center mt-1 animate-pulse">
            {currentTime.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-md p-6 rounded-2xl w-full shadow-inner flex flex-col items-center relative z-10">
          {result.student?.photo ? (
            <img 
              src={result.student.photo} 
              alt="Profile" 
              className="w-20 h-20 rounded-full mb-3 border-4 border-white shadow-lg object-cover" 
            />
          ) : (
            <div className="w-20 h-20 rounded-full mb-3 border-4 border-white shadow-lg bg-white/40 flex items-center justify-center text-4xl font-bold">
              {result.student?.name?.charAt(0)}
            </div>
          )}
          <h2 className="text-2xl font-bold drop-shadow-sm text-center leading-tight">{result.student?.name}</h2>
          <p className="text-lg mt-1 opacity-90 font-semibold drop-shadow-sm">ID: {result.student?.diningId}</p>
          <p className="text-sm opacity-80 text-center">{result.student?.department}</p>
        </div>

        <button 
          onClick={handleReset}
          className="w-full max-w-[200px] py-3 mt-2 font-extrabold rounded-full transition shadow-xl text-xl hover:scale-105 active:scale-95 bg-green-800 hover:bg-green-900 text-white relative z-10"
        >
          Done
        </button>
      </div>
    )
  }


  // 4. Verifying Face State
  if (isVerifyingFace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6 max-w-md mx-auto px-4">
        <h2 className="text-2xl font-bold text-center">Verifying Identity</h2>
        <p className="text-muted-foreground text-center">Please look directly at your screen.</p>
        
        <div className="relative rounded-lg overflow-hidden border-4 border-primary bg-black max-w-xs w-full aspect-square shadow-2xl">
          <video 
            ref={faceVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />
          <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
            <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
              <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
              Scanning Face...
            </span>
          </div>
        </div>

        <Button variant="outline" onClick={handleReset} className="w-full max-w-xs">
          Cancel
        </Button>
      </div>
    )
  }

  // 5. Idle Scanner Screen
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/student/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">In-App Scanner</h1>
          <p className="text-muted-foreground text-sm">Scan dining hall QR directly in your browser.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle>In-App Check-in</CardTitle>
          <CardDescription>Opens your camera to scan without leaving the app.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 pt-4">
          {isScanning ? (
            <div className="w-full rounded-lg overflow-hidden border bg-black relative aspect-square max-w-[320px]">
              <Scanner 
                onScan={(result: any) => handleScan(result?.[0]?.rawValue || result)} 
                onError={(e: any) => console.error(e)}
              />
              <Button 
                variant="destructive" 
                size="sm" 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
                onClick={() => setIsScanning(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button 
              size="lg" 
              className="w-full h-48 flex flex-col gap-3 max-w-[280px]"
              onClick={() => setIsScanning(true)}
            >
              <ScanLine className="h-12 w-12 text-white animate-pulse" />
              <span className="text-lg font-bold">Tap to Scan QR Code</span>
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center max-w-[240px]">
            Please grant camera permissions if prompted to verify your meal status.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
