"use client"

import { useState } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, XCircle, AlertCircle, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminScanner() {
  const [scanResult, setScanResult] = useState<{
    status: "success" | "error" | "idle" | "processing",
    message?: string,
    studentName?: string,
    meal?: string
  }>({ status: "idle" })
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = async (result: string) => {
    if (scanResult.status === "processing") return;
    
    setScanResult({ status: "processing" })
    setIsScanning(false)
    
    try {
      const data = JSON.parse(result)
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
      setScanResult({ status: "error", message: "Invalid QR code format." })
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meal Scanner</h1>
        <p className="text-muted-foreground">Scan student QR codes to verify meal access.</p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>QR Code Check-in</CardTitle>
          <CardDescription>Position the QR code within the scanner frame.</CardDescription>
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

          <div className="w-full max-w-sm">
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
