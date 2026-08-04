"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Package, CheckCircle2, XCircle, Search, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

type Student = {
  id: string
  name: string
  diningId: string | null
  department: string
  session: string
}

type CheckInResult = {
  studentId: string
  name: string
  diningId: string | null
  status: "success" | "error"
  message: string
}

export default function ParcelCheckinPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [students, setStudents] = useState<Student[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  
  const [individualLoading, setIndividualLoading] = useState<Record<string, boolean>>({})
  const [individualResults, setIndividualResults] = useState<Record<string, CheckInResult>>({})

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      const role = (session?.user as any)?.role
      if (role !== "STAFF" && role !== "ADMIN") {
        router.push("/student/dashboard")
      } else {
        fetchStudents()
      }
    }
  }, [status])

  const fetchStudents = async () => {
    try {
      const res = await fetch("/api/admin/parcel-checkin")
      const data = await res.json()
      if (res.ok) {
        setStudents(data.students || [])
      } else {
        toast.error(data.error || "Failed to load students")
      }
    } catch {
      toast.error("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const filtered = students.filter(s => {
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || 
           (s.diningId && s.diningId.toLowerCase().includes(q)) ||
           s.department.toLowerCase().includes(q)
  })

  const handleIndividualSubmit = async (id: string) => {
    setIndividualLoading(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch("/api/admin/parcel-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [id] })
      })
      const data = await res.json()
      if (res.ok && data.results && data.results.length > 0) {
        setIndividualResults(prev => ({ ...prev, [id]: data.results[0] }))
        if (data.results[0].status === "success") {
          toast.success(data.results[0].message)
        } else {
          toast.error(data.results[0].message)
        }
      } else {
        toast.error(data.error || "Failed to check in")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setIndividualLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />
            Parcel Check-in
          </h1>
          <p className="text-muted-foreground text-sm">
            Individual check-in for hostel food delivery (Female students only)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Select Students</CardTitle>
              <CardDescription>
                {students.length} female students registered
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Student List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? "No students match your search" : "No female students registered yet"}
              </p>
            ) : (
              filtered.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.diningId} • {s.department} • {s.session}
                    </p>
                    {individualResults[s.id] && individualResults[s.id].status === "error" && (
                      <p className="text-xs text-red-500 mt-1">{individualResults[s.id].message}</p>
                    )}
                  </div>
                  
                  {individualResults[s.id] && individualResults[s.id].status === "success" ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-full text-xs font-medium shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      Checked In
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={individualResults[s.id] && individualResults[s.id].status === "error" ? "outline" : "default"}
                      className={individualResults[s.id] && individualResults[s.id].status === "error" ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" : ""}
                      onClick={() => handleIndividualSubmit(s.id)}
                      disabled={individualLoading[s.id] || (individualResults[s.id]?.status === "success")}
                    >
                      {individualLoading[s.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : individualResults[s.id] && individualResults[s.id].status === "error" ? (
                        "Retry"
                      ) : (
                        "Check In"
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
