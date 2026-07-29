"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Plus, Search, MailWarning, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

const departments = [
  "Textile Engineering (TE)",
  "Computer Science & Engineering (CSE)",
  "Electrical & Electronic Engineering (EEE)",
  "Industrial & Production Engineering (IPE)",
  "Fashion Design & Apparel Engineering (FDAE)",
]
const sessions = ["2018-19", "2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25"]

export default function AdminStudents() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    studentId: "", name: "", email: "", whatsapp: "", department: "", session: "", password: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/students?page=${page}&limit=10&search=${search}`)
    const data = await res.json()
    setStudents(data.students || [])
    setTotalPages(data.totalPages || 1)
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to create student")
    } else {
      toast.success("Student created successfully")
      setDialogOpen(false)
      setForm({ studentId: "", name: "", email: "", whatsapp: "", department: "", session: "", password: "" })
      fetchStudents()
    }
    setSubmitting(false)
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/students/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    })
    fetchStudents()
    toast.success(`Student ${!isActive ? "activated" : "deactivated"}`)
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this student and all their data? This cannot be undone.")) return
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Student completely deleted")
      fetchStudents()
    } else {
      toast.error("Failed to delete student")
    }
  }

  async function handleSendAlerts() {
    if (!confirm("Are you sure you want to email a warning to ALL active students with a low balance?")) return
    const res = await fetch("/api/admin/low-balance-alerts", { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message)
    } else {
      toast.error(data.error || "Failed to send alerts")
    }
  }

  async function handleTurnOffMeals() {
    if (!confirm("Are you sure you want to completely turn OFF future meals for ALL students who currently have a low balance?")) return
    const res = await fetch("/api/admin/students/turn-off-low-balance", { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message)
    } else {
      toast.error(data.error || "Failed to turn off meals")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage all registered students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleTurnOffMeals}>
            <ShieldAlert className="mr-2 h-4 w-4" /> Turn Off Meals (Low Balance)
          </Button>
          <Button variant="outline" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200" onClick={handleSendAlerts}>
            <MailWarning className="mr-2 h-4 w-4" /> Send Low Balance Alerts
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Student ID</Label>
                <Input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required placeholder="221-15-5001" />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp (Optional)</Label>
                <Input type="text" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={form.session} onValueChange={(v) => setForm({ ...form, session: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                  <SelectContent>{sessions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating..." : "Create Student"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or ID..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
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
                  <TableHead>Student ID</TableHead>
                  <TableHead>Dining ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.studentId}</TableCell>
                    <TableCell>{s.diningId || "-"}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{s.email}</div>
                      {s.whatsapp && <div className="text-xs">WA: {s.whatsapp}</div>}
                    </TableCell>
                    <TableCell>{s.department}</TableCell>
                    <TableCell>{s.wallet?.balance?.toFixed(2) || "0.00"} BDT</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "default" : "secondary"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-2">
                      <Link href={`/admin/students/${s.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(s.id, s.isActive)}>
                        {s.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(s.id)}>
                        Delete
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
