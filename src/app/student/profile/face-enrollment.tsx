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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setIsCameraActive(true)
      captureStageRef.current = "CENTER"
      setInstruction("Look directly at the camera")
      centerDescriptorRef.current = null
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          startDetectionLoop()
        }
      }, 100)
    } catch (err) {
      console.error(err)
      toast.error("Please grant camera permissions to register your face.")
    }
  }

  const stopCamera = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current)
    captureStageRef.current = "IDLE"
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
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
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.")
      captureStageRef.current = "CENTER"
      setInstruction("Look directly at the camera")
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
            const nose = landmarks.getNose()[3] // The tip of the nose moves the most during a head turn
            const jawLeft = landmarks.getJawOutline()[0]
            const jawRight = landmarks.getJawOutline()[16]
            
            const jawWidth = jawRight.x - jawLeft.x
            const yawRatio = (nose.x - jawLeft.x) / jawWidth

            if (captureStageRef.current === "CENTER") {
              if (yawRatio > 0.4 && yawRatio < 0.6) {
                centerDescriptorRef.current = detection.descriptor
                captureStageRef.current = "LEFT"
                setInstruction("Good! Now turn your head slightly to your LEFT.")
                toast.success("Center face captured.")
              }
            } else if (captureStageRef.current === "LEFT") {
              // Due to mirror effect, turning left moves nose to the right side of the screen
              if (yawRatio > 0.6) {
                captureStageRef.current = "RIGHT"
                setInstruction("Good! Now turn your head slightly to your RIGHT.")
                toast.success("Left face captured.")
              }
            } else if (captureStageRef.current === "RIGHT") {
              // Turning right moves nose to the left side
              if (yawRatio < 0.4) {
                captureStageRef.current = "REGISTERING"
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
            <div className="relative rounded-lg overflow-hidden border bg-black max-w-sm w-full aspect-video">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
              <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
                  {instruction}
                </span>
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
