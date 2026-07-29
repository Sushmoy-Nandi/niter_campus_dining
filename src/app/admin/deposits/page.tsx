"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Plus, Upload, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>("general")
  const [form, setForm] = useState({ diningId: "", amount: "", description: "" })

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/student/dining-periods")
      const data = await res.json()
      if (data.periods?.length > 0) {
        setPeriods(data.periods)
        // Select the active period by default
        const active = data.periods.find((p: any) => p.isActive)
        if (active) setSelectedPeriod(active.title)
      }
    } catch (error) {
      console.error("Failed to fetch periods", error)
    }
  }, [])

  const fetchDeposits = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/deposits?page=${page}&limit=20`)
    const data = await res.json()
    setDeposits(data.deposits || [])
    setTotalPages(data.totalPages || 1)
    setLoading(false)
  }, [page])

  useEffect(() => { 
    fetchDeposits()
    fetchPeriods()
  }, [fetchDeposits, fetchPeriods])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    let finalDesc = form.description || ""
    if (selectedPeriod && selectedPeriod !== "general") {
      finalDesc = finalDesc ? `${finalDesc} (Period: ${selectedPeriod})` : `Period: ${selectedPeriod}`
    }

    const res = await fetch("/api/admin/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diningId: form.diningId,
        amount: parseFloat(form.amount),
        description: finalDesc || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to add deposit")
    } else {
      toast.success(`Deposit of ${form.amount} BDT added`)
      setDialogOpen(false)
      setForm({ diningId: "", amount: "", description: "" })
      fetchDeposits()
    }
    setSubmitting(false)
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBulkUploading(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet)

      const deposits = rows.map((row) => {
        // Find ID column (Dining ID, diningId, studentId, ID, etc)
        const idKey = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'diningid' || k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'studentid' || k.toLowerCase() === 'id')
        // Find Amount column
        const amountKey = Object.keys(row).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('taka') || k.toLowerCase().includes('deposit'))
        
        let bulkDesc = "Bulk Upload"
        if (selectedPeriod && selectedPeriod !== "general") {
          bulkDesc += ` (Period: ${selectedPeriod})`
        }

        return {
          diningId: idKey ? String(row[idKey]) : "",
          amount: amountKey ? parseFloat(row[amountKey]) : 0,
          description: bulkDesc
        }
      }).filter(d => d.diningId && d.amount > 0)

      if (deposits.length === 0) {
        toast.error("No valid deposits found in file. Ensure columns 'Dining ID' and 'Amount' exist.")
        setBulkUploading(false)
        return
      }

      const res = await fetch("/api/admin/deposits/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deposits }),
      })

      const resData = await res.json()
      if (!res.ok) {
        toast.error(resData.error || "Bulk upload failed")
      } else {
        toast.success(resData.message)
        if (resData.results?.errors?.length > 0) {
          console.error("Bulk Upload Errors:", resData.results.errors)
        }
        fetchDeposits()
      }
    } catch (err) {
      console.error(err)
      toast.error("Error reading file")
    }
    setBulkUploading(false)
    // Reset file input
    e.target.value = ""
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deposit? The amount will be deducted from the student's wallet and an email will be sent.")) return

    try {
      const res = await fetch(`/api/admin/deposits/${id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchDeposits()
      } else {
        toast.error(data.error || "Failed to delete deposit")
      }
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deposits</h1>
          <p className="text-muted-foreground">Manage student deposits</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-[180px]">
            <Select value={selectedPeriod} onValueChange={(val) => setSelectedPeriod(val || "general")}>
              <SelectTrigger>
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General / No Period</SelectItem>
                {periods.map(p => (
                  <SelectItem key={p.id} value={p.title}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <input 
            type="file" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            id="bulk-upload" 
            className="hidden" 
            onChange={handleBulkUpload} 
            disabled={bulkUploading}
          />
          <Button variant="outline" disabled={bulkUploading} onClick={() => document.getElementById('bulk-upload')?.click()}>
            {bulkUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Bulk Upload
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Add Deposit
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Add Manual Deposit</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Dining ID</Label>
                <Input value={form.diningId} onChange={(e) => setForm({ ...form, diningId: e.target.value })} required placeholder="DIN-1001" />
              </div>
              <div className="space-y-2">
                <Label>Amount (BDT)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Processing..." : "Add Deposit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{d.student?.name}</p>
                        <p className="text-xs text-muted-foreground">{d.student?.diningId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="text-green-700 bg-green-100">
                        +{d.amount.toFixed(2)} BDT
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.description || "N/A"}</TableCell>
                    <TableCell className="text-sm">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
