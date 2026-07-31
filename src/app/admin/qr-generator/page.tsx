"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import QRCode from "qrcode"
import { CalendarIcon, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export default function QRGeneratorPage() {
  const [date, setDate] = useState<Date>(new Date())
  const [mealType, setMealType] = useState<"LUNCH" | "DINNER">("LUNCH")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const generateQRCode = async () => {
    setLoading(true)
    setError("")
    setQrCodeUrl("")

    try {
      const dateStr = format(date, "yyyy-MM-dd")
      const res = await fetch("/api/admin/generate-qr-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, mealType })
      })

      if (!res.ok) {
        throw new Error("Failed to generate token")
      }

      const { token } = await res.json()
      
      // The URL the student will visit
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const scanUrl = `${origin}/student/scan?token=${token}`

      // Generate the QR Code image as a data URL
      const qrDataUrl = await QRCode.toDataURL(scanUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })

      setQrCodeUrl(qrDataUrl)
    } catch (err: any) {
      setError(err.message || "Failed to generate QR Code")
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate on load and when selections change
  useEffect(() => {
    generateQRCode()
  }, [date, mealType])

  const downloadQR = () => {
    if (!qrCodeUrl) return
    
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Title
      doc.setFont("helvetica", "bold")
      doc.setFontSize(24)
      doc.text("NITER Campus Dining", pageWidth / 2, 30, { align: "center" })
      
      // Add the QR Code Image
      const qrSize = 100
      const qrX = (pageWidth - qrSize) / 2
      doc.addImage(qrCodeUrl, "PNG", qrX, 45, qrSize, qrSize)

      // Add Date Text (e.g. "Friday, July 31st, 2026")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(20)
      const dateText = format(date, "EEEE, MMMM do, yyyy")
      doc.text(dateText, pageWidth / 2, 160, { align: "center" })

      // Add Meal Text (e.g. "LUNCH")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(28)
      doc.setTextColor(34, 197, 94) // Green-ish color
      doc.text(mealType, pageWidth / 2, 175, { align: "center" })
      
      // Instructions
      doc.setTextColor(80, 80, 80)
      doc.setFontSize(14)
      doc.setFont("helvetica", "normal")
      const instruction1 = `Scan this QR code to securely check in for ${mealType.charAt(0) + mealType.slice(1).toLowerCase()}.`
      const instruction2 = `Please ensure you are logged into your student account before scanning.`
      
      doc.text(instruction1, pageWidth / 2, 195, { align: "center" })
      
      doc.setFontSize(12)
      doc.setTextColor(150, 150, 150)
      doc.text(instruction2, pageWidth / 2, 203, { align: "center" })

      // Save PDF
      doc.save(`Meal-QR-${format(date, "yyyy-MM-dd")}-${mealType}.pdf`)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily QR Code Generator</h1>
        <p className="text-muted-foreground mt-2">
          Generate the secure QR code for students to scan during meals. Display this on a tablet or print it.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6 p-6 border rounded-xl bg-card shadow-sm h-fit">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <Popover>
                <PopoverTrigger
                  className={cn(
                    "flex h-9 w-full items-center justify-start rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Meal Type</label>
              <Select value={mealType} onValueChange={(val: any) => setMealType(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Meal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LUNCH">Lunch</SelectItem>
                  <SelectItem value="DINNER">Dinner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-8 border rounded-xl bg-card shadow-sm min-h-[400px]">
          {loading ? (
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-64 h-64 bg-slate-200 rounded-lg"></div>
              <p className="mt-4 text-muted-foreground">Generating secure QR code...</p>
            </div>
          ) : qrCodeUrl ? (
            <div className="flex flex-col items-center space-y-6">
              <div className="p-4 bg-white rounded-xl shadow-md">
                <img src={qrCodeUrl} alt="Meal QR Code" className="w-72 h-72 object-contain" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-xl">{format(date, "PPPP")}</h3>
                <p className="text-muted-foreground text-lg uppercase tracking-widest">{mealType}</p>
              </div>
              <Button onClick={downloadQR} className="w-full" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Download QR Code
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
