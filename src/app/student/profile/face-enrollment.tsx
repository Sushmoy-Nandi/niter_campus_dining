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
  const [isRegistered, setIsRegistered] = useState(hasFaceRegistered)
  const [instruction, setInstruction] = useState("Look directly at the camera")
  const [progress, setProgress] = useState({ center: false, left: false, right: false })
  const [debugYaw, setDebugYaw] = useState<number | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureStageRef = useRef<"IDLE" | "CENTER" | "LEFT" | "RIGHT" | "REGISTERING">("IDLE")
  const centerDescriptorRef = useRef<Float32Array | null>(null)
  const requestRef = useRef<number>(0)

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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
      })
      setIsCameraActive(true)
      captureStageRef.current = "CENTER"
      setInstruction("Look directly at the camera")
      setProgress({ center: false, left: false, right: false })
      centerDescriptorRef.current = null
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadeddata = () => {
          startDetectionLoop()
        }
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.error(err)
      toast.error("Please grant camera permissions to register your face.")
    }
  }

  const stopCamera = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current)
    captureStageRef.current = "IDLE"
    if (videoRef.current) {
      videoRef.current.onloadeddata = null
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
        setIsCameraActive(false)
      }
    }
  }

  const registerFace = async (descriptor: Float32Array) => {
    try {
      const faceDescriptor = JSON.stringify(Array.from(descriptor))
      const res = await fetch("/api/student/profile/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceDescriptor })
      })

      if (res.ok) {
        setIsRegistered(true)
        toast.success("Face successfully registered!")
        stopCamera()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to register face.")
        captureStageRef.current = "CENTER"
        setInstruction("Look directly at the camera")
        setProgress({ center: false, left: false, right: false })
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.")
      captureStageRef.current = "CENTER"
      setInstruction("Look directly at the camera")
      setProgress({ center: false, left: false, right: false })
    }
  }

  const startDetectionLoop = () => {
    let lastRun = Date.now()

    const analyzeFace = async () => {
      if (!videoRef.current || captureStageRef.current === "IDLE" || captureStageRef.current === "REGISTERING") {
        return // Stop loop if idle or already registering
      }

      // Throttle to ~5 FPS to save CPU
      if (Date.now() - lastRun > 200) {
        try {
          const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()
          
          if (detection) {
            const landmarks = detection.landmarks
            // Use precise 68-point model indices
            const nose = landmarks.positions[30] // Exact nose tip
            const jawLeft = landmarks.positions[0] // Exact left jaw edge
            const jawRight = landmarks.positions[16] // Exact right jaw edge
            
            const jawWidth = jawRight.x - jawLeft.x
            const yawRatio = (nose.x - jawLeft.x) / jawWidth
            setDebugYaw(Math.round(yawRatio * 100))

            if (captureStageRef.current === "CENTER") {
              // Relaxed threshold: 0.3 to 0.7
              if (yawRatio > 0.3 && yawRatio < 0.7) {
                centerDescriptorRef.current = detection.descriptor
                captureStageRef.current = "LEFT"
                setProgress(p => ({ ...p, center: true }))
                setInstruction("Good! Now turn your head slightly to your LEFT.")
                toast.success("Center face captured.")
              }
            } else if (captureStageRef.current === "LEFT") {
              // Due to mirror effect, turning left moves nose to the right side of the screen
              // Require > 0.7
              if (yawRatio > 0.7) {
                captureStageRef.current = "RIGHT"
                setProgress(p => ({ ...p, left: true }))
                setInstruction("Good! Now turn your head slightly to your RIGHT.")
                toast.success("Left face captured.")
              }
            } else if (captureStageRef.current === "RIGHT") {
              // Turning right moves nose to the left side
              // Require < 0.3
              if (yawRatio < 0.3) {
                captureStageRef.current = "REGISTERING"
                setProgress(p => ({ ...p, right: true }))
                setInstruction("Processing and registering...")
                toast.success("Right face captured. Registering...")
                
                if (centerDescriptorRef.current) {
                  await registerFace(centerDescriptorRef.current)
                }
              }
            }
          }
        } catch (e) {
          // ignore detection errors
        }
        lastRun = Date.now()
      }

      requestRef.current = requestAnimationFrame(analyzeFace)
    }

    requestRef.current = requestAnimationFrame(analyzeFace)
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
        {isRegistered && !isCameraActive && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="ml-2 font-medium">
              You have already registered your face. You can re-register below if needed.
            </AlertDescription>
          </Alert>
        )}

        {isCameraActive ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative rounded-lg overflow-hidden border bg-black max-w-sm w-full aspect-square sm:aspect-video">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
              <div className="absolute top-4 left-4 pointer-events-none">
                {debugYaw !== null && (
                  <span className="bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
                    Alignment: {debugYaw}%
                  </span>
                )}
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none px-4">
                <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse inline-block">
                  {instruction}
                </span>
              </div>
            </div>
            
            <div className="flex w-full max-w-sm justify-between px-4 mt-2">
              <div className="flex flex-col items-center">
                {progress.center ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />}
                <span className="text-xs mt-1 text-gray-500 font-medium">Front</span>
              </div>
              <div className="flex-1 border-b-2 border-dashed border-gray-200 self-center mb-5 mx-2"></div>
              <div className="flex flex-col items-center">
                {progress.left ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Loader2 className={`h-6 w-6 text-gray-400 ${progress.center && !progress.left ? 'animate-spin' : ''}`} />}
                <span className="text-xs mt-1 text-gray-500 font-medium">Left</span>
              </div>
              <div className="flex-1 border-b-2 border-dashed border-gray-200 self-center mb-5 mx-2"></div>
              <div className="flex flex-col items-center">
                {progress.right ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Loader2 className={`h-6 w-6 text-gray-400 ${progress.left && !progress.right ? 'animate-spin' : ''}`} />}
                <span className="text-xs mt-1 text-gray-500 font-medium">Right</span>
              </div>
            </div>

            <div className="flex gap-4">
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
