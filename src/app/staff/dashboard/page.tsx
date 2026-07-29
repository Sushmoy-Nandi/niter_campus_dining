"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Download, Search, ScanLine, Camera, FileText, FileSpreadsheet, FileIcon } from "lucide-react"
import { toast } from "sonner"
import { Scanner } from "@yudiel/react-qr-scanner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export default function StaffDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [mealData, setMealData] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCamera, setShowCamera] = useState(false)
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      const role = (session?.user as any)?.role
      if (role !== "STAFF" && role !== "ADMIN") {
        router.push("/student/dashboard")
      } else {
        // Default to today
        const localDate = new Date().toLocaleDateString("en-CA")
        setStartDate(localDate)
        setEndDate(localDate)
        setLoading(false)
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (startDate && endDate) {
      fetchDailyMeals(startDate, endDate)
      const interval = setInterval(() => {
        fetchDailyMeals(startDate, endDate, false)
      }, 10000) // Poll every 10 seconds
      return () => clearInterval(interval)
    }
  }, [startDate, endDate])

  async function fetchDailyMeals(start: string, end: string, showLoader = true) {
    try {
      if (showLoader) setLoading(true)
      const res = await fetch(`/api/admin/reports/daily-meals?startDate=${start}&endDate=${end}`)
      if (res.ok) {
        const data = await res.json()
        setMealData(data)
      } else {
        if (showLoader) toast.error("Failed to fetch daily meals")
      }
    } catch (error) {
      if (showLoader) toast.error("An error occurred")
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  const exportDailyMealsCSV = () => {
    if (!mealData) return
    const headers = ["Dining Id", "Student ID", "Name", "Lunch (Total ON)", "Dinner (Total ON)"]
    const rows = mealData.students.map((s: any) => [
      s.diningId || "",
      s.studentId,
      s.name,
      s.lunch,
      s.dinner,
    ])

    const summaryRows = [
      [],
      ["SUMMARY STATS"],
      ["Expected Lunch", mealData.summary.totalLunch],
      ["Actual Scanned Lunch", mealData.scanStats?.scannedLunch || 0],
      ["Failed Lunch Scans", mealData.scanStats?.failedLunch || 0],
      [],
      ["Expected Dinner", mealData.summary.totalDinner],
      ["Actual Scanned Dinner", mealData.scanStats?.scannedDinner || 0],
      ["Failed Dinner Scans", mealData.scanStats?.failedDinner || 0],
    ]

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.join(",")),
      ...summaryRows.map((row: any) => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `daily_meals_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportExcel = () => {
    if (!mealData) return;
    const worksheet = XLSX.utils.json_to_sheet(mealData.students.map((s: any) => ({
      "Dining ID": s.diningId,
      "Student ID": s.studentId,
      "Name": s.name,
      "Lunch (ON)": s.lunch,
      "Dinner (ON)": s.dinner,
    })));

    XLSX.utils.sheet_add_aoa(worksheet, [
      [],
      ["SUMMARY STATS"],
      ["Expected Lunch", mealData.summary.totalLunch],
      ["Actual Scanned Lunch", mealData.scanStats?.scannedLunch || 0],
      ["Failed Lunch Scans", mealData.scanStats?.failedLunch || 0],
      [],
      ["Expected Dinner", mealData.summary.totalDinner],
      ["Actual Scanned Dinner", mealData.scanStats?.scannedDinner || 0],
      ["Failed Dinner Scans", mealData.scanStats?.failedDinner || 0],
    ], { origin: -1 });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Meals");
    XLSX.writeFile(workbook, `daily_meals_${startDate}_to_${endDate}.xlsx`);
  }

  const exportPDF = () => {
    if (!mealData) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    const title = startDate === endDate ? `Daily Meal Report - ${startDate}` : `Meal Report: ${startDate} to ${endDate}`;
    doc.text(title, 14, 22);
    
    doc.setFontSize(12);
    doc.text("Summary Stats:", 14, 32);
    
    // AutoTable for Summary
    autoTable(doc, {
      startY: 36,
      head: [['Metric', 'Lunch', 'Dinner']],
      body: [
        ['Expected (Meals ON)', mealData.summary.totalLunch, mealData.summary.totalDinner],
        ['Actual (Scanned)', mealData.scanStats?.scannedLunch || 0, mealData.scanStats?.scannedDinner || 0],
        ['Failed/Double Scans', mealData.scanStats?.failedLunch || 0, mealData.scanStats?.failedDinner || 0],
      ],
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50] } // primary green color
    });

    // AutoTable for Students
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Dining ID', 'Student ID', 'Name', 'Lunch (ON)', 'Dinner (ON)']],
      body: mealData.students.map((s: any) => [
        s.diningId || "-", 
        s.studentId, 
        s.name, 
        s.lunch, 
        s.dinner
      ]),
      theme: 'striped',
    });

    doc.save(`daily_meals_${startDate}_to_${endDate}.pdf`);
  }

  const handleScan = async (text: string) => {
    if (!text) return;
    
    try {
      // Check if it's our JSON QR code
      const data = JSON.parse(text);
      if (data.type === "MEAL_CHECKIN") {
        setShowCamera(false);
        const toastId = toast.loading("Verifying meal...");
        
        const res = await fetch("/api/admin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        
        const resData = await res.json();
        
        if (res.ok) {
           toast.success(`Verified! ${resData.student?.name} is authorized for ${resData.student?.currentMeal}`, { id: toastId });
           setSearchQuery(resData.student?.diningId || resData.student?.name || "");
        } else {
           toast.error(`Denied: ${resData.error}`, { id: toastId });
        }
        return;
      }
    } catch (e) {
      // Not a JSON QR code, fallback
    }

    setSearchQuery(text);
    setShowCamera(false);
    toast.success("Scanned: " + text);
  }

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Dashboard</h1>
          <p className="text-muted-foreground">
            View daily meal counts for the dining facility.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Meal Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4 flex-1">
              <div className="space-y-2 flex-1 max-w-[150px]">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1 max-w-[150px]">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button onClick={() => fetchDailyMeals(startDate, endDate)} variant="outline">
                <Search className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            {mealData && (
              <div className="flex items-end mt-4 md:mt-0">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="secondary" />}>
                      <Download className="h-4 w-4 mr-2" /> Export Report
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportPDF}>
                      <FileIcon className="h-4 w-4 mr-2 text-red-500" /> Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportDailyMealsCSV}>
                      <FileText className="h-4 w-4 mr-2 text-blue-500" /> Export as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          
          {mealData && (
            <div className="mb-6 bg-muted/30 p-4 rounded-lg border border-border flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Scan QR Code or Enter Dining ID / Student ID" 
                    className="pl-10 h-12 text-lg font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button 
                  onClick={() => setShowCamera(!showCamera)} 
                  variant={showCamera ? "destructive" : "default"}
                  className="h-12 px-6 w-full md:w-auto"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  {showCamera ? "Close Camera" : "Scan via Phone"}
                </Button>
              </div>
              
              {showCamera && (
                <div className="w-full max-w-md mx-auto overflow-hidden rounded-xl border border-primary/20 shadow-lg bg-black">
                  <Scanner 
                    onScan={(result) => handleScan(result[0].rawValue)}
                    onError={(error) => console.log(error?.message)}
                  />
                  <p className="text-center text-xs text-muted p-2 bg-black/80">Point your camera at a student's Digital Dining Pass</p>
                </div>
              )}
            </div>
          )}

          {loading ? (
             <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : mealData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Lunch (Scheduled)</p>
                  <p className="text-3xl font-bold text-primary">{mealData.summary.totalLunch}</p>
                </div>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Dinner (Scheduled)</p>
                  <p className="text-3xl font-bold text-primary">{mealData.summary.totalDinner}</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg border border-green-200 text-center">
                  <p className="text-sm font-medium text-green-700">Actual Lunch Scans</p>
                  <p className="text-3xl font-bold text-green-700">{mealData.scanStats?.scannedLunch || 0}</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg border border-green-200 text-center">
                  <p className="text-sm font-medium text-green-700">Actual Dinner Scans</p>
                  <p className="text-3xl font-bold text-green-700">{mealData.scanStats?.scannedDinner || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
                  <p className="text-sm font-medium text-red-600">Failed / Double Scans</p>
                  <p className="text-2xl font-bold text-red-600">{(mealData.scanStats?.failedLunch || 0) + (mealData.scanStats?.failedDinner || 0)}</p>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Dining ID</th>
                      <th className="px-4 py-3 font-medium">Student ID</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Lunch</th>
                      <th className="px-4 py-3 font-medium">Dinner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredStudents = mealData.students.filter((s: any) => 
                        !searchQuery || 
                        (s.diningId && s.diningId.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      );

                      if (filteredStudents.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                              {searchQuery ? "No matching student found." : "No active meals for this date."}
                            </td>
                          </tr>
                        )
                      }

                      return filteredStudents.map((student: any, idx: number) => (
                        <tr key={idx} className={`border-t ${searchQuery ? "bg-primary/5" : ""}`}>
                          <td className="px-4 py-3">{student.diningId || "-"}</td>
                          <td className="px-4 py-3">{student.studentId}</td>
                          <td className="px-4 py-3 font-medium">{student.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.lunch > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {student.lunch} {startDate === endDate && (student.lunch > 0 ? '(ON)' : '(OFF)')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.dinner > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {student.dinner} {startDate === endDate && (student.dinner > 0 ? '(ON)' : '(OFF)')}
                            </span>
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Select a date to view meal counts.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
