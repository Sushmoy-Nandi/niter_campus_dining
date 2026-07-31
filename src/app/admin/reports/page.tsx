"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Star } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export default function AdminReports() {
  const [report, setReport] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({ totalBazaarCost: 0, totalMeals: 0, mealRate: 0 })
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<any[]>([])
  const [periodId, setPeriodId] = useState<string>("")
  const [reportTitle, setReportTitle] = useState("")

  const [dailyMealDate, setDailyMealDate] = useState(() => new Date().toLocaleDateString("en-CA"))
  const [dailyMeals, setDailyMeals] = useState<any[]>([])
  const [loadingDaily, setLoadingDaily] = useState(false)

  const [feedbackDate, setFeedbackDate] = useState(() => new Date().toLocaleDateString("en-CA"))
  const [feedbackStats, setFeedbackStats] = useState<any>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/dining-periods")
      if (res.ok) {
        const data = await res.json()
        setPeriods(data.periods || [])
        if (data.periods && data.periods.length > 0) {
          const active = data.periods.find((p: any) => p.isActive) || data.periods[0]
          setPeriodId(active.id)
        } else {
          setLoading(false)
        }
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }, [])

  const fetchReport = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports?periodId=${id}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data.report || [])
        setSummary(data.summary || { totalBazaarCost: 0, totalMeals: 0, mealRate: 0 })
        setReportTitle(data.reportTitle || "Report")
      } else {
        toast.error("Failed to load report")
      }
    } catch (error) {
      toast.error("Error loading report")
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])
  useEffect(() => { if (periodId) fetchReport(periodId) }, [periodId, fetchReport])

  const fetchDailyMeals = useCallback(async (date: string, showLoader = true) => {
    if (showLoader) setLoadingDaily(true)
    try {
      const res = await fetch(`/api/admin/reports/daily-meals?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setDailyMeals(data.students || [])
      } else {
        if (showLoader) toast.error("Failed to load daily meals")
      }
    } catch (error) {
      if (showLoader) toast.error("Error loading daily meals")
    }
    if (showLoader) setLoadingDaily(false)
  }, [])

  const fetchFeedback = useCallback(async (date: string) => {
    setLoadingFeedback(true)
    try {
      const res = await fetch(`/api/admin/reports/feedback?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setFeedbackStats(data.feedbackStats || null)
      } else {
        toast.error("Failed to load feedback stats")
      }
    } catch (error) {
      toast.error("Error loading feedback")
    }
    setLoadingFeedback(false)
  }, [])

  useEffect(() => {
    fetchDailyMeals(dailyMealDate)
    const interval = setInterval(() => {
      fetchDailyMeals(dailyMealDate, false)
    }, 10000)
    return () => clearInterval(interval)
  }, [dailyMealDate, fetchDailyMeals])

  useEffect(() => {
    fetchFeedback(feedbackDate)
  }, [feedbackDate, fetchFeedback])

  function exportCSV() {
    if (report.length === 0) {
      toast.error("No data to export")
      return
    }
    let csv = `Total Bazaar Cost: ${summary.totalBazaarCost},Total Meals: ${summary.totalMeals},Meal Rate: ${summary.mealRate}\n\n`
    csv += "SL,Name,Info,Deposit,Cost,On-Hand,Total Meal\n"
    report.forEach((r: any, index: number) => {
      const info = `${r.department} ${r.info}`.trim()
      csv += `${index + 1},"${r.name}","${info}",${r.monthDeposit},${r.cost},${r.onHand},${r.totalMeals}\n`
    })
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `report-${reportTitle.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV downloaded")
  }

  function exportPDF() {
    if (report.length === 0) return toast.error("No data to export")
    const doc = new jsPDF()
    doc.text(`Timeline Report: ${reportTitle}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Bazaar Cost: ${summary.totalBazaarCost} BDT | Total Meals: ${summary.totalMeals} | Meal Rate: ${summary.mealRate} BDT`, 14, 22)
    const tableData = report.map((r: any, i: number) => [
      i + 1, r.name, `${r.department} ${r.info}`.trim(), r.totalMeals, r.monthDeposit.toFixed(2), r.cost.toFixed(2), r.onHand.toFixed(2)
    ])
    autoTable(doc, {
      head: [["SL", "Name", "Info", "Total Meal", "Deposit", "Cost", "On-Hand"]],
      body: tableData,
      startY: 28
    })
    doc.save(`report-${reportTitle.replace(/\s+/g, '-')}.pdf`)
    toast.success("PDF downloaded")
  }

  function exportExcel() {
    if (report.length === 0) return toast.error("No data to export")
    const wsData = report.map((r: any, i: number) => ({
      "SL": i + 1,
      "Name": r.name,
      "Info": `${r.department} ${r.info}`.trim(),
      "Total Meal": r.totalMeals,
      "Deposit": r.monthDeposit,
      "Cost": r.cost,
      "On-Hand": r.onHand
    }))
    const ws = XLSX.utils.json_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Report")
    XLSX.writeFile(wb, `report-${reportTitle.replace(/\s+/g, '-')}.xlsx`)
    toast.success("Excel downloaded")
  }

  function exportDailyCSV() {
    if (dailyMeals.length === 0) return toast.error("No data")
    let csv = "Dining ID,Student ID,Name,Lunch,Dinner\n"
    dailyMeals.forEach((m) => {
      csv += `${m.diningId},${m.studentId},"${m.name}",${m.lunch ? "ON" : "OFF"},${m.dinner ? "ON" : "OFF"}\n`
    })
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `daily-meals-${dailyMealDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV downloaded")
  }

  function exportDailyPDF() {
    if (dailyMeals.length === 0) return toast.error("No data")
    const doc = new jsPDF()
    doc.text(`Daily Meal Report: ${dailyMealDate}`, 14, 15)
    const tableData = dailyMeals.map(m => [
      m.diningId, m.studentId, m.name, m.lunch ? "ON" : "OFF", m.dinner ? "ON" : "OFF"
    ])
    autoTable(doc, {
      head: [["Dining ID", "Student ID", "Name", "Lunch", "Dinner"]],
      body: tableData,
      startY: 20
    })
    doc.save(`daily-meals-${dailyMealDate}.pdf`)
    toast.success("PDF downloaded")
  }

  function exportDailyExcel() {
    if (dailyMeals.length === 0) return toast.error("No data")
    const wsData = dailyMeals.map(m => ({
      "Dining ID": m.diningId,
      "Student ID": m.studentId,
      "Name": m.name,
      "Lunch": m.lunch ? "ON" : "OFF",
      "Dinner": m.dinner ? "ON" : "OFF"
    }))
    const ws = XLSX.utils.json_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Meals")
    XLSX.writeFile(wb, `daily-meals-${dailyMealDate}.xlsx`)
    toast.success("Excel downloaded")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timeline Reports</h1>
          <p className="text-muted-foreground">Detailed meal and financial reports for dining periods</p>
        </div>
        <div className="flex items-center gap-3">
          {periods.length > 0 ? (
            <Select value={periodId} onValueChange={(v) => v && setPeriodId(v)}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Period">
                  {periods.find((p) => p.id === periodId)?.title || "Select Period"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
             <p className="text-sm text-muted-foreground">No periods available</p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => {
              const secret = process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET || "NITER_MASTER_2026";
              window.open(`/api/admin/export-excel?secret=${secret}`, '_blank');
            }} variant="default" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              <Download className="mr-2 h-4 w-4" /> Live Master Excel
            </Button>
            <Button onClick={() => {
              const secret = process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET || "NITER_MASTER_2026";
              window.open(`/api/admin/live-sheet?secret=${secret}`, '_blank');
            }} variant="default" className="bg-green-600 hover:bg-green-700 text-white font-bold">
              <Download className="mr-2 h-4 w-4" /> Live Master CSV
            </Button>
            <Button onClick={exportCSV} variant="outline" disabled={periods.length === 0 || report.length === 0}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button onClick={exportExcel} variant="outline" disabled={periods.length === 0 || report.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button onClick={exportPDF} variant="outline" disabled={periods.length === 0 || report.length === 0}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Bazaar Cost</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.totalBazaarCost.toFixed(2)} BDT</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Meals</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.totalMeals}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Current Meal Rate</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.mealRate.toFixed(2)} BDT</p></CardContent>
        </Card>
      </div>



      <Card>
        <CardHeader>
          <CardTitle>{reportTitle} Report</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : report.length === 0 ? (
            <p className="p-6 text-muted-foreground">No data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">SL</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Info</TableHead>
                    <TableHead className="text-right">Total Meal</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">On-Hand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((r: any, index: number) => (
                    <TableRow key={r.studentId}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.department} {r.info}</TableCell>
                      <TableCell className="text-right font-bold">{r.totalMeals}</TableCell>
                      <TableCell className="text-right">{r.monthDeposit.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-600">{r.cost.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-bold ${r.onHand >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {r.onHand.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Daily Meal Count</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Export daily meals for a specific date</p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={dailyMealDate}
                onChange={(e) => setDailyMealDate(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={exportDailyCSV} variant="outline" disabled={dailyMeals.length === 0 || loadingDaily}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button onClick={exportDailyExcel} variant="outline" disabled={dailyMeals.length === 0 || loadingDaily}>
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button onClick={exportDailyPDF} variant="outline" disabled={dailyMeals.length === 0 || loadingDaily}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
          {loadingDaily ? (
            <div className="mt-6 space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <div className="mt-6 text-sm text-muted-foreground">
              {dailyMeals.length} records found for {dailyMealDate}. Use the buttons above to download the list.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <div>
                <CardTitle>Meal Feedback Distribution</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">View student ratings for a specific date</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={feedbackDate}
                onChange={(e) => setFeedbackDate(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFeedback ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !feedbackStats || feedbackStats.total === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">
              No feedback received for {feedbackDate}.
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex flex-col md:flex-row gap-12 items-center">
                <div className="flex flex-col items-center justify-center min-w-[200px]">
                  <div className="text-6xl font-bold">{feedbackStats.average}</div>
                  <div className="flex gap-1 my-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${
                          star <= Math.round(Number(feedbackStats.average)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{feedbackStats.total} total ratings</p>
                </div>
                
                <div className="space-y-3 flex-1 w-full max-w-lg">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = feedbackStats.distribution[star] || 0
                    const percentage = (count / feedbackStats.total) * 100
                    return (
                      <div key={star} className="flex items-center gap-4 text-sm">
                        <div className="w-12 flex items-center gap-1.5 font-medium text-muted-foreground">
                          {star} <Star className="h-4 w-4" />
                        </div>
                        <Progress value={percentage} className="h-3 flex-1" />
                        <div className="w-12 text-right font-medium text-muted-foreground">{Math.round(percentage)}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
