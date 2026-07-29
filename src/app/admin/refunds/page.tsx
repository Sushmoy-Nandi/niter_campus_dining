"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Check, X } from "lucide-react"

export default function AdminRefunds() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/admin/refunds")
      const data = await res.json()
      if (data.requests) setRequests(data.requests)
    } catch (e) {
      console.error(e)
      toast.error("Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this refund?`)) return
    
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(data.message)
        fetchRequests()
      } else {
        toast.error(data.error)
      }
    } catch (e) {
      toast.error("An error occurred")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Refund Requests</h1>
        <p className="text-muted-foreground">Manage student withdrawal and refund requests.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Amount (BDT)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Account No</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No refund requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.student.name}</div>
                      <div className="text-xs text-muted-foreground">{r.student.studentId} | {r.student.department}</div>
                    </TableCell>
                    <TableCell className="font-bold">{r.amount.toFixed(2)}</TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell>{r.accountNo || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "APPROVED" ? "default" : r.status === "REJECTED" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "PENDING" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAction(r.id, "APPROVE")} className="bg-green-600 hover:bg-green-700">
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleAction(r.id, "REJECT")}>
                            <X className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
