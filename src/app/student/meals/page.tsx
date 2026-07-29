"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { UtensilsCrossed, Users, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function StudentMeals() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [mealRate, setMealRate] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [balance, setBalance] = useState<number>(0)
  const [autoOff, setAutoOff] = useState<boolean>(false)
  const [autoOffReason, setAutoOffReason] = useState<string>("")

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/student/dining-periods")
      if (res.ok) {
        const data = await res.json()
        setPeriods(data.periods || [])
        // Set default to active period or first period
        if (data.periods && data.periods.length > 0) {
          const active = data.periods.find((p: any) => p.isActive) || data.periods[0]
          setSelectedPeriodId(active.id)
        } else {
          setLoading(false)
        }
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }, [])

  const fetchMealsAndRate = useCallback(async (periodId: string) => {
    try {
      setLoading(true)
      const period = periods.find(p => p.id === periodId)
      if (!period) return

      const start = new Date(period.startDate)
      const end = new Date(period.endDate)

      // Fetch meals
      const resMeals = await fetch(`/api/student/meals?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
      })
      if (resMeals.ok) {
        const data = await resMeals.json()
        setSchedules(data.schedules || [])
        setBalance(data.balance || 0)
        setAutoOff(data.autoOff || false)
        setAutoOffReason(data.autoOffReason || "")
      }

      // Fetch rate
      const resRate = await fetch(`/api/admin/meal-rate/calculation?periodId=${periodId}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
      })
      if (resRate.ok) {
        const data = await resRate.json()
        setMealRate(data.mealRate)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }, [periods])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  useEffect(() => {
    if (selectedPeriodId) {
      fetchMealsAndRate(selectedPeriodId)
    }
  }, [selectedPeriodId, fetchMealsAndRate])

  async function handleToggle(date: string, mealType: string, value: boolean | number) {
    const schedule = getScheduleForDate(date)
    const currentLunch = schedule?.lunch ?? true
    const currentDinner = schedule?.dinner ?? true
    const body = {
      date,
      lunch: mealType === "lunch" ? value : currentLunch,
      dinner: mealType === "dinner" ? value : currentDinner,
    }

    setSchedules((prev) => {
      const dateStr = date
      const existing = prev.find((s) => {
        const d = new Date(s.date)
        return d.toISOString().split("T")[0] === dateStr || d.toLocaleDateString("en-CA") === dateStr
      })
      if (existing) {
        return prev.map((s) => (s === existing ? { ...s, ...body, date: s.date } : s))
      }
      return [...prev, { ...body, date: dateStr }]
    })

    const res = await fetch("/api/student/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to update meal")
      fetchMealsAndRate(selectedPeriodId) // revert on error
      return
    }
    toast.success(`Meal updated for ${date}`)
    fetchMealsAndRate(selectedPeriodId)
  }

  function getScheduleForDate(date: string) {
    return schedules.find((s) => {
      const d = new Date(s.date)
      return d.toISOString().split("T")[0] === date
    })
  }

  function generateDates() {
    if (!selectedPeriodId) return []
    const period = periods.find(p => p.id === selectedPeriodId)
    if (!period) return []

    const start = new Date(period.startDate)
    const end = new Date(period.endDate)
    const dates = []

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Loop from start to end date
    const d = new Date(start)
    while (d <= end) {
      const year = d.getFullYear()
      const month = d.getMonth()
      const day = d.getDate()
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

      // Deadline: 10:00 PM BST the day before
      const deadline = new Date(year, month, day - 1, 22, 0, 0, 0)
      const canEdit = now < deadline
      
      const localD = new Date(year, month, day)
      const isPast = localD < today
      const isToday = localD.getTime() === today.getTime()

      dates.push({ date: dateStr, day, isPast, isToday, canEdit })
      d.setDate(d.getDate() + 1)
    }

    return dates
  }

  const dates = generateDates()

  if (loading && periods.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px]" />
      </div>
    )
  }

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)

  return (
    <div className="space-y-6">
      {autoOff && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Meals Disabled</AlertTitle>
          <AlertDescription>
            {autoOffReason} Your upcoming meals are currently locked.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Schedule</h1>
        <p className="text-muted-foreground">All meals are ON by default. Turn OFF meals you don&apos;t need.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Dining Period
            </CardTitle>
            <div className="flex items-center gap-2">
              {periods.length > 0 ? (
                <Select value={selectedPeriodId} onValueChange={(v) => v && setSelectedPeriodId(v)}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select period">
                      {periods.find((p) => p.id === selectedPeriodId)?.title || "Select period"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No periods available</p>
              )}
            </div>
          </div>
          {selectedPeriod && (
            <CardDescription>
              {new Date(selectedPeriod.startDate).toLocaleDateString()} to {new Date(selectedPeriod.endDate).toLocaleDateString()}
              <br/>
              Estimated Meal Rate for this period: {mealRate} BDT / meal
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-4 gap-2 rounded-md bg-muted p-2 text-xs font-medium text-muted-foreground">
              <span>Date</span>
              <span className="text-center">Lunch</span>
              <span className="text-center">Dinner</span>
              <span className="text-center">Status</span>
            </div>
            {dates.map(({ date, day, isPast, isToday, canEdit }) => {
              const schedule = getScheduleForDate(date)
              const lunch = schedule?.lunch ?? true
              const dinner = schedule?.dinner ?? true
              return (
                <div
                  key={date}
                  className={`grid grid-cols-4 gap-2 rounded-md border p-2 text-sm items-center ${
                    isToday ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div>
                    <span className="font-medium">{day}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(date).getDay()]}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={lunch}
                      onCheckedChange={(v) => handleToggle(date, "lunch", v)}
                      disabled={!canEdit || autoOff}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={dinner}
                      onCheckedChange={(v) => handleToggle(date, "dinner", v)}
                      disabled={!canEdit || autoOff}
                    />
                  </div>
                  <div className="text-center">
                    {canEdit ? (
                      autoOff ? (
                        <span className="text-xs text-red-600">Locked</span>
                      ) : (
                        <span className="text-xs text-green-600">Editable</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    )}
                  </div>
                </div>
              )
            })}
            {dates.length === 0 && <p className="text-sm text-muted-foreground mt-4 text-center">No dates in this period.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
