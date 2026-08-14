"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { APP_NAME } from "@/lib/constants"
import { Switch } from "@/components/ui/switch"
import { Trash2 } from "lucide-react"

export default function AdminSettings() {
  const [periods, setPeriods] = useState<any[]>([])
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [depositDeadline, setDepositDeadline] = useState("")
  const [minimumDeposit, setMinimumDeposit] = useState("3000")
  const [minimumBalance, setMinimumBalance] = useState("200")
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [staffList, setStaffList] = useState<any[]>([])
  const [staffName, setStaffName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPassword, setStaffPassword] = useState("")

  useEffect(() => {
    fetchPeriods()
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/admin/staff")
      if (res.ok) {
        setStaffList(await res.json())
      }
    } catch (e) {}
  }

  const fetchPeriods = async () => {
    try {
      const res = await fetch("/api/admin/settings/dining-periods")
      if (res.ok) {
        const data = await res.json()
        setPeriods(data.periods || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async () => {
    if (!title || !startDate || !endDate) {
      toast.error("Please fill all fields")
      return
    }
    setLoading(true)
    try {
      const isEdit = !!editingId;
      const url = "/api/admin/settings/dining-periods";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit 
        ? JSON.stringify({ id: editingId, title, startDate, endDate, depositDeadline: depositDeadline || null, minimumDeposit: parseFloat(minimumDeposit), minimumBalance: parseFloat(minimumBalance) }) 
        : JSON.stringify({ title, startDate, endDate, depositDeadline: depositDeadline || null, minimumDeposit: parseFloat(minimumDeposit), minimumBalance: parseFloat(minimumBalance) });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (res.ok) {
        toast.success(isEdit ? "Dining period updated" : "Dining period created")
        handleCancelEdit()
        fetchPeriods()
      } else {
        const data = await res.json()
        toast.error(data.error || `Failed to ${isEdit ? "update" : "create"} period`)
      }
    } catch (e) {
      toast.error(`Error ${editingId ? "updating" : "creating"} period`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (p: any) => {
    setEditingId(p.id)
    setTitle(p.title)
    setStartDate(new Date(p.startDate).toISOString().split('T')[0])
    setEndDate(new Date(p.endDate).toISOString().split('T')[0])
    setDepositDeadline(p.depositDeadline ? new Date(p.depositDeadline).toISOString().split('T')[0] : "")
    setMinimumDeposit(p.minimumDeposit?.toString() || "3000")
    setMinimumBalance(p.minimumBalance?.toString() || "200")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setTitle("")
    setStartDate("")
    setEndDate("")
    setDepositDeadline("")
    setMinimumDeposit("3000")
    setMinimumBalance("200")
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (currentStatus) return // Already active, do nothing
    
    try {
      const res = await fetch("/api/admin/settings/dining-periods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: true }),
      })
      if (res.ok) {
        toast.success("Active period updated")
        fetchPeriods()
      } else {
        toast.error("Failed to update active period")
      }
    } catch (e) {
      toast.error("Error updating active period")
    }
  }

  const handleSettlePeriod = async (id: string) => {
    if (!confirm("Are you sure? This will calculate the exact meal costs for this entire period and permanently deduct them from every student's wallet balance. This cannot be undone.")) return
    
    try {
      const res = await fetch("/api/admin/settings/dining-periods/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchPeriods()
      } else {
        toast.error(data.error)
      }
    } catch (e) {
      toast.error("Error settling period")
    }
  }

  const handleDeleteClick = async (id: string) => {
    if (!confirm("WARNING: This will completely delete this dining period AND reverse any settlement transactions (Meal Deductions & Rollovers) that were created by it, completely wiping it from Student transaction history. Are you absolutely sure?")) return;
    
    try {
      const res = await fetch(`/api/admin/settings/dining-periods?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchPeriods();
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error("Error deleting period");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">System configuration & timelines</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Dining Timeline Management</CardTitle>
            <CardDescription>Create and manage custom dining months (e.g. Aug 10 - Sep 10)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Period Title</Label>
                  <Input placeholder="e.g. Aug-Sep 2026" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Deposit Deadline (Optional)</Label>
                  <Input type="date" value={depositDeadline} onChange={e => setDepositDeadline(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Required Deposit by Deadline</Label>
                  <Input type="number" value={minimumDeposit} onChange={e => setMinimumDeposit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Auto-Off Low Balance</Label>
                  <Input type="number" value={minimumBalance} onChange={e => setMinimumBalance(e.target.value)} />
                </div>
                <div className="md:col-span-3 flex flex-col gap-2 md:flex-row md:items-end mt-2">
                  <Button onClick={handleSubmit} disabled={loading}>
                    {editingId ? "Update Period" : "Add Period"}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={handleCancelEdit} disabled={loading}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <Label className="mb-2 block">Existing Periods</Label>
                <div className="space-y-2">
                  {periods.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-md border ${p.isActive ? 'border-primary bg-primary/5' : ''}`}>
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!p.isSettled ? (
                          <Button variant="secondary" size="sm" onClick={() => handleSettlePeriod(p.id)}>
                            Settle & Close
                          </Button>
                        ) : (
                          <span className="text-xs font-bold text-green-600">SETTLED</span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(p)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(p.id)} className="px-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2 border-l pl-3 ml-2">
                          <Label className="text-xs">Active</Label>
                          <Switch checked={p.isActive} onCheckedChange={() => handleToggleActive(p.id, p.isActive)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {periods.length === 0 && <p className="text-sm text-muted-foreground">No periods defined yet.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Application details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-muted-foreground">App Name</Label>
                <p className="font-medium">{APP_NAME}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Institution</Label>
                <p className="font-medium">National Institute of Textile Engineering and Research</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Backup</CardTitle>
              <CardDescription>Download a full copy of all database records as a JSON file</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.open('/api/admin/backup', '_blank')} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Download JSON Backup
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Staff Accounts</CardTitle>
            <CardDescription>Create and manage dining staff credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <Label>Name</Label>
                <Input placeholder="Staff Name" value={staffName} onChange={e => setStaffName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Label>Email</Label>
                <Input type="email" placeholder="staff@example.com" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Label>Password</Label>
                <Input type="password" placeholder="***" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} />
              </div>
              <Button onClick={async () => {
                if (!staffName || !staffEmail || !staffPassword) return toast.error("All fields required");
                const res = await fetch("/api/admin/staff", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: staffName, email: staffEmail, password: staffPassword })
                });
                if (res.ok) {
                  toast.success("Staff account created");
                  setStaffName(""); setStaffEmail(""); setStaffPassword("");
                  fetchStaff();
                } else {
                  const data = await res.json();
                  toast.error(data.error);
                }
              }}>Create Staff Account</Button>
            </div>
            
            <div className="pt-4 border-t space-y-2">
              <Label>Existing Staff</Label>
              {staffList.length === 0 && <p className="text-sm text-muted-foreground">No staff accounts found.</p>}
              {staffList.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm("Delete staff account?")) return;
                    const res = await fetch(`/api/admin/staff?id=${s.id}`, { method: "DELETE" });
                    if (res.ok) fetchStaff();
                  }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
