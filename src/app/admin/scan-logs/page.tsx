"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Activity, CheckCircle2, XCircle, AlertTriangle, Users, Download, FileIcon, FileSpreadsheet, FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export default function ScanLogsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const localDate = new Date().toLocaleDateString("en-CA")
  const [startDate, setStartDate] = useState(localDate)
  const [endDate, setEndDate] = useState(localDate)

  useEffect(() => {
    const fetchData = (showLoader = true) => {
      if (showLoader) setLoading(true)
      fetch(`/api/admin/scan-logs?startDate=${startDate}&endDate=${endDate}`)
        .then((res) => res.json())
        .then(setData)
        .finally(() => { if (showLoader) setLoading(false) })
    }
    fetchData()
    const interval = setInterval(() => fetchData(false), 5000)
    return () => clearInterval(interval)
  }, [startDate, endDate])

  const exportCSV = () => {
    if (!data?.logs) return
    const headers = ["Time", "Student", "Dining ID", "Status", "Details"]
    const rows = data.logs.map((log: any) => {
      const isSuccess = log.action.startsWith("MEAL_SCANNED_")
      const isDouble = log.details?.includes("Double scan attempt")
      const isAutoOff = log.details?.includes("auto-disabled") || log.action === "FAILED_SCAN_AUTO_OFF"
      let status = isSuccess ? "SUCCESS" : "FAILED"
      if (isDouble) status = "DOUBLE SCAN"
      if (isAutoOff) status = "AUTO-OFF"
      return [
        new Date(log.createdAt).toLocaleString(),
        log.student.name,
        log.student.diningId || log.student.studentId,
        status,
        log.details || log.action
      ]
    })
    const csvContent = [headers.join(","), ...rows.map((r: any) => `"${r.join('","')}"`)].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `scan_logs_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportExcel = () => {
    if (!data?.logs) return
    const worksheetData = data.logs.map((log: any) => {
      const isSuccess = log.action.startsWith("MEAL_SCANNED_")
      const isDouble = log.details?.includes("Double scan attempt")
      const isAutoOff = log.details?.includes("auto-disabled") || log.action === "FAILED_SCAN_AUTO_OFF"
      let status = isSuccess ? "SUCCESS" : "FAILED"
      if (isDouble) status = "DOUBLE SCAN"
      if (isAutoOff) status = "AUTO-OFF"
      return {
        "Time": new Date(log.createdAt).toLocaleString(),
        "Student": log.student.name,
        "Dining ID": log.student.diningId || log.student.studentId,
        "Status": status,
        "Details": log.details || log.action
      }
    })
    const worksheet = XLSX.utils.json_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Scan Logs")
    XLSX.writeFile(workbook, `scan_logs_${startDate}_to_${endDate}.xlsx`)
  }

  const exportPDF = () => {
    if (!data?.logs) return
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(`Scan Logs: ${startDate} to ${endDate}`, 14, 22)
    
    autoTable(doc, {
      startY: 30,
      head: [["Time", "Student", "Dining ID", "Status", "Details"]],
      body: data.logs.map((log: any) => {
        const isSuccess = log.action.startsWith("MEAL_SCANNED_")
        const isDouble = log.details?.includes("Double scan attempt")
        const isAutoOff = log.details?.includes("auto-disabled") || log.action === "FAILED_SCAN_AUTO_OFF"
        let status = isSuccess ? "SUCCESS" : "FAILED"
        if (isDouble) status = "DOUBLE SCAN"
        if (isAutoOff) status = "AUTO-OFF"
        return [
          new Date(log.createdAt).toLocaleString(),
          log.student.name,
          log.student.diningId || log.student.studentId,
          status,
          log.details || log.action
        ]
      }),
      theme: 'grid'
    })
    doc.save(`scan_logs_${startDate}_to_${endDate}.pdf`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  const s = data?.stats || {}
  const logs = data?.logs || []

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Monitor</h1>
          <p className="text-muted-foreground">Real-time logs for {data?.startDate === data?.endDate ? data?.startDate : `${data?.startDate} to ${data?.endDate}`}.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 w-full md:w-auto mt-4 md:mt-0">
          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            <div className="space-y-1 flex-1 sm:flex-none">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-full sm:w-auto" />
            </div>
            <div className="space-y-1 flex-1 sm:flex-none">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-full sm:w-auto" />
            </div>
          </div>
          {data?.logs && data.logs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2 w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" /> Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-full sm:w-auto">
                <DropdownMenuItem onClick={exportPDF}>
                  <FileIcon className="h-4 w-4 mr-2 text-red-500" /> Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV}>
                  <FileText className="h-4 w-4 mr-2 text-blue-500" /> Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Successful Scans</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{s.totalScanned || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Scans</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{s.totalFailed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Double Scans</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{s.doubleScans || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Auto-Off Blocked</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{s.autoOffFails || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Scan Logs</CardTitle>
          <CardDescription>Chronological list of all scanner activity for today.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Dining ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const isSuccess = log.action.startsWith("MEAL_SCANNED_")
                    const isDouble = log.details?.includes("Double scan attempt")
                    const isAutoOff = log.details?.includes("auto-disabled") || log.action === "FAILED_SCAN_AUTO_OFF"
                    
                    let badgeVariant = isSuccess ? "default" : "destructive" as any;
                    let badgeText = isSuccess ? "SUCCESS" : "FAILED";
                    
                    if (isDouble) {
                      badgeVariant = "outline"
                      badgeText = "DOUBLE SCAN"
                    } else if (isAutoOff) {
                      badgeVariant = "secondary"
                      badgeText = "AUTO-OFF"
                    }

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                        <TableCell className="font-medium">{log.student.name}</TableCell>
                        <TableCell>{log.student.diningId || log.student.studentId}</TableCell>
                        <TableCell>
                          <Badge variant={badgeVariant} className={isDouble ? "text-orange-600 border-orange-600" : ""}>
                            {badgeText}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.details || log.action}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-4 opacity-50" />
              <p>No scans recorded for today yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
