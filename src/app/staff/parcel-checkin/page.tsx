"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<CheckInResult[] | null>(null)
  const [mealInfo, setMealInfo] = useState<string | null>(null)

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

  const toggleStudent = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.error("No students selected")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/parcel-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: Array.from(selected) })
      })

      const data = await res.json()

      if (res.ok) {
        setResults(data.results)
        setMealInfo(data.meal)
        setSelected(new Set())
        const successCount = data.results.filter((r: CheckInResult) => r.status === "success").length
        toast.success(`${successCount} students checked in successfully!`)
      } else {
        toast.error(data.error || "Failed to check in")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSubmitting(false)
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
            Bulk check-in for hostel food delivery (Female students only)
          </p>
        </div>
      </div>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Check-in Results — {mealInfo?.toUpperCase()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                r.status === "success" ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"
              }`}>
                {r.status === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.diningId}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  r.status === "success" 
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}>
                  {r.message}
                </span>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-2" onClick={() => setResults(null)}>
              Back to Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Selection */}
      {!results && (
        <>
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
              {/* Select All */}
              <div className="flex items-center justify-between py-2 px-3 mb-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium">
                    {selected.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground font-semibold">
                  {selected.size} selected
                </span>
              </div>

              {/* Student List */}
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No students match your search" : "No female students registered yet"}
                  </p>
                ) : (
                  filtered.map(s => (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selected.has(s.id) 
                          ? "bg-primary/10 border border-primary/30" 
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox checked={selected.has(s.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.diningId} • {s.department} • {s.session}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            className="w-full h-14 text-lg font-bold"
            disabled={selected.size === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Package className="h-5 w-5 mr-2" />
                Check In {selected.size} Student{selected.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
