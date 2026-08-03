"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Camera, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import * as faceapi from "@vladmandic/face-api"

export function FaceEnrollment({ hasFaceRegistered }: { hasFaceRegistered: boolean }) {
  const [isModelsLoaded, setIsModelsLoaded] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [status, setStatus] = useState<"idle" | "detecting" | "registered" | "error">("idle")
  const [isRegistered, setIsRegistered] = useState(hasFaceRegistered)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
        toast.error("Failed to load facial recognition models.")
      }
    }
    loadModels()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
      }
    } catch (err) {
      console.error(err)
      toast.error("Please grant camera permissions to register your face.")
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
    }
  }

  const captureAndRegister = async () => {
    if (!videoRef.current) return

    setStatus("detecting")
    
    // Detect a single face in the video stream
    const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()

    if (!detection) {
      setStatus("error")
      toast.error("No face detected. Please look directly at the camera.")
      return
    }

    try {
      // The descriptor is a Float32Array (128 elements). We stringify it to save to DB.
      const faceDescriptor = JSON.stringify(Array.from(detection.descriptor))
      
      const res = await fetch("/api/student/profile/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceDescriptor })
      })

      if (res.ok) {
        setStatus("registered")
        setIsRegistered(true)
        toast.success("Face successfully registered!")
        stopCamera()
      } else {
        const data = await res.json()
        setStatus("error")
        toast.error(data.error || "Failed to register face.")
      }
    } catch (error) {
      setStatus("error")
      toast.error("An error occurred. Please try again.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Face Registration</CardTitle>
        <CardDescription>
          Register your face to enable secure meal check-ins. This ensures no one else can use your QR code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isRegistered && status !== "detecting" && !isCameraActive && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="ml-2 font-medium">
              You have already registered your face. You can re-register below if needed.
            </AlertDescription>
          </Alert>
        )}

        {isCameraActive ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative rounded-lg overflow-hidden border bg-black max-w-sm w-full aspect-video">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
            </div>
            <div className="flex gap-4">
              <Button onClick={captureAndRegister} disabled={status === "detecting" || !isModelsLoaded}>
                {status === "detecting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Capture & Register
              </Button>
              <Button variant="outline" onClick={stopCamera}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={startCamera} disabled={!isModelsLoaded} className="w-full sm:w-auto">
            {!isModelsLoaded ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading AI Models...</>
            ) : (
              <><Camera className="mr-2 h-4 w-4" /> {isRegistered ? "Re-register Face" : "Start Face Registration"}</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
