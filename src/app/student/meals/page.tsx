"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { UtensilsCrossed, Users, AlertTriangle, CalendarDays, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function StudentMeals() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [mealRate, setMealRate] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [balance, setBalance] = useState<number>(0)
  const [autoOff, setAutoOff] = useState<boolean>(false)
  const [autoOffReason, setAutoOffReason] = useState<string>("")
  const [suspendedDates, setSuspendedDates] = useState<string[]>([])

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/student/dining-periods")
      if (res.ok) {
        const data = await res.json()
        setPeriods(data.periods || [])
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

      const resMeals = await fetch(`/api/student/meals?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0" }
      })
      if (resMeals.ok) {
        const data = await resMeals.json()
        setSchedules(data.schedules || [])
        setBalance(data.balance || 0)
        setAutoOff(data.autoOff || false)
        setAutoOffReason(data.autoOffReason || "")
        setSuspendedDates(data.suspendedDates || [])
      }

      const resRate = await fetch(`/api/admin/meal-rate/calculation?periodId=${periodId}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0" }
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
      fetchMealsAndRate(selectedPeriodId)
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

    const d = new Date(start)
    while (d <= end) {
      const year = d.getFullYear()
      const month = d.getMonth()
      const day = d.getDate()
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

      const deadline = new Date(year, month, day - 1, 22, 0, 0, 0)
      const canEdit = now < deadline

      const localD = new Date(year, month, day)
      const isPast = localD < today
      const isToday = localD.getTime() === today.getTime()

      dates.push({ date: dateStr, day, month, year, isPast, isToday, canEdit })
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
  const activeMealCount = dates.filter(({ date, isPast }) => {
    if (isPast) return false
    const isSuspended = suspendedDates.includes(date)
    const schedule = getScheduleForDate(date)
    const lunch = isSuspended ? false : (schedule?.lunch ?? true)
    const dinner = isSuspended ? false : (schedule?.dinner ?? true)
    return lunch || dinner
  }).length

  return (
    <div className="space-y-6">
      {autoOff && (
        <Alert className="border-red-600/30 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-700 dark:text-red-400">Meals disabled</AlertTitle>
          <AlertDescription className="font-medium text-red-700 dark:text-red-400">
            {autoOffReason} Your upcoming meals are currently locked.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meal Schedule</h1>
          <p className="text-muted-foreground">
            All meals are ON by default. Turn OFF meals you don&apos;t need.
          </p>
        </div>
        {periods.length > 0 && (
          <Select value={selectedPeriodId} onValueChange={(v) => v && setSelectedPeriodId(v)}>
            <SelectTrigger className="w-full sm:w-[260px]">
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
        )}
      </div>

      {/* Summary strip */}
      {selectedPeriod && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 card-shadow">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Upcoming active days</p>
              <p className="text-lg font-bold tabular-nums">{activeMealCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 card-shadow">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Estimated meal rate</p>
              <p className="text-lg font-bold tabular-nums">{mealRate.toFixed(2)} BDT</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 card-shadow">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Dining period</p>
              <p className="text-sm font-semibold">
                {new Date(selectedPeriod.startDate).toLocaleDateString()} — {new Date(selectedPeriod.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Daily Meal Toggles
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Meals can only be changed up to 10:00 PM the day before. Suspended days are locked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && periods.length > 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr] gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr]">
                <span>Date</span>
                <span className="text-center">Lunch</span>
                <span className="text-center">Dinner</span>
                <span className="text-center">Status</span>
              </div>

              {dates.map(({ date, day, month, isPast, isToday, canEdit }) => {
                const schedule = getScheduleForDate(date)
                const isSuspended = suspendedDates.includes(date)

                const lunch = isSuspended ? false : (schedule?.lunch ?? true)
                const dinner = isSuspended ? false : (schedule?.dinner ?? true)

                return (
                  <div
                    key={date}
                    className={cn(
                      "grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr] items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr]",
                      isToday ? "border-primary bg-primary/5" : "bg-card",
                      isSuspended ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20" : ""
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : isPast
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                        )}
                      >
                        <span className="text-sm font-bold">{day}</span>
                        <span className="text-[9px] font-medium uppercase">{MONTH_NAMES[month]}</span>
                      </span>
                      <div className="leading-tight">
                        <p className="font-semibold">{DAY_NAMES[new Date(date).getDay()]}</p>
                        <p className="text-xs text-muted-foreground">
                          {isToday ? "Today" : isPast ? "Past" : "Upcoming"}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Switch
                        checked={lunch}
                        onCheckedChange={(v) => handleToggle(date, "lunch", v)}
                        disabled={!canEdit || isSuspended}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={dinner}
                        onCheckedChange={(v) => handleToggle(date, "dinner", v)}
                        disabled={!canEdit || isSuspended}
                      />
                    </div>
                    <div className="text-center">
                      {isSuspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950">
                          <AlertTriangle className="h-3 w-3" /> Suspended
                        </span>
                      ) : canEdit ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950">
                          Editable
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {dates.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No dates in this period.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {balance !== undefined && (
        <p className="text-center text-xs text-muted-foreground">
          Wallet balance: {balance.toFixed(2)} BDT · {activeMealCount} active upcoming day
          {activeMealCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  )
}
