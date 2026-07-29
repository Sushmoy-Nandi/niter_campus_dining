"use client"

import { useState } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, XCircle, AlertCircle, ScanLine, Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AdminScanner() {
  const [scanResult, setScanResult] = useState<{
    status: "success" | "error" | "idle" | "processing",
    message?: string,
    studentName?: string,
    meal?: string
  }>({ status: "idle" })
  const [isScanning, setIsScanning] = useState(false)
  const [manualId, setManualId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const processScanData = async (data: any) => {
    if (scanResult.status === "processing" || isSubmitting) return;
    
    setScanResult({ status: "processing" })
    setIsScanning(false)
    setIsSubmitting(true)
    
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      
      const resData = await res.json()
      
      if (res.ok) {
        setScanResult({ 
          status: "success", 
          message: resData.message,
          studentName: resData.student?.name,
          meal: resData.student?.currentMeal
        })
      } else {
        setScanResult({ status: "error", message: resData.error || "Unknown error" })
      }
    } catch (e) {
      setScanResult({ status: "error", message: "Failed to connect to server." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScan = async (result: string) => {
    try {
      const data = JSON.parse(result)
      await processScanData(data)
    } catch (e) {
      setScanResult({ status: "error", message: "Invalid QR code format." })
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualId.trim()) return
    
    const formattedId = manualId.trim().toUpperCase()
    await processScanData({ diningId: formattedId, type: "MEAL_CHECKIN" })
    setManualId("")
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meal Scanner</h1>
        <p className="text-muted-foreground">Scan student QR codes or manually enter Dining ID.</p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>Meal Check-in</CardTitle>
          <CardDescription>Scan QR or enter Dining ID manually.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          
          {isScanning ? (
            <div className="w-full max-w-sm rounded-lg overflow-hidden border bg-black relative">
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
                Cancel Scan
              </Button>
            </div>
          ) : (
            <Button 
              size="lg" 
              className="w-full max-w-sm h-32 flex flex-col gap-2"
              onClick={() => {
                setScanResult({ status: "idle" })
                setIsScanning(true)
              }}
            >
              <ScanLine className="h-8 w-8" />
              Tap to Scan QR Code
            </Button>
          )}

          <div className="w-full max-w-sm flex items-center gap-4 py-2">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">OR</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={handleManualSubmit} className="w-full max-w-sm flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="e.g. DIN-1005" 
                className="pl-9" 
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                disabled={isSubmitting || isScanning}
              />
            </div>
            <Button type="submit" disabled={!manualId.trim() || isSubmitting || isScanning}>
              Check In
            </Button>
          </form>

          <div className="w-full max-w-sm mt-4">
            {scanResult.status === "processing" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Processing...</AlertTitle>
                <AlertDescription>Verifying meal schedule...</AlertDescription>
              </Alert>
            )}

            {scanResult.status === "success" && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Verified!</AlertTitle>
                <AlertDescription className="text-green-700 font-medium">
                  {scanResult.studentName} is authorized for {scanResult.meal}.
                </AlertDescription>
              </Alert>
            )}

            {scanResult.status === "error" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription className="font-medium">
                  {scanResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
