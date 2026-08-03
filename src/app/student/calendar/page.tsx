"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export default function StudentCalendar() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  const fetchMeals = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/student/meals?month=${currentMonth}&year=${currentYear}`)
    const data = await res.json()
    setSchedules(data.schedules || [])
    setLoading(false)
  }, [currentMonth, currentYear])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  function ymdLocal(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }
  function ymdUTC(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
  }

  function getScheduleForDate(date: Date) {
    const ds = ymdLocal(date)
    return schedules.find((s) => ymdUTC(new Date(s.date)) === ds)
  }

  function generateCalendarDays() {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const startDay = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    const days = []

    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day))
    }

    return days
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Calendar</h1>
        <p className="text-muted-foreground">A quick look at your meal plan each month</p>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarIcon className="h-4.5 w-4.5" />
              </span>
              {monthNames[currentMonth]} {currentYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => {
                if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
                else setCurrentMonth(currentMonth - 1)
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => { setCurrentMonth(new Date().getMonth()); setCurrentYear(new Date().getFullYear()) }}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => {
                if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
                else setCurrentMonth(currentMonth + 1)
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {generateCalendarDays().map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} className="aspect-square" />
                  const schedule = getScheduleForDate(date)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const isToday = date.getTime() === today.getTime()
                  const hasLunch = !!(schedule && schedule.lunch)
                  const hasDinner = !!(schedule && schedule.dinner)
                  const hasMeals = hasLunch || hasDinner

                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center rounded-xl border p-1 transition-colors",
                        isToday
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : hasMeals
                            ? "border-border bg-card hover:bg-muted/40"
                            : "border-dashed border-border/60 opacity-40"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isToday ? "text-primary" : ""
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {hasMeals && (
                        <div className="mt-0.5 flex gap-0.5">
                          {hasLunch && (
                            <span className="h-1.5 w-3 rounded-full bg-primary" title="Lunch" />
                          )}
                          {hasDinner && (
                            <span className="h-1.5 w-3 rounded-full bg-accent" title="Dinner" />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-primary" /> Lunch ON
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-accent" /> Dinner ON
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md ring-1 ring-primary bg-primary/10" /> Today
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md border border-dashed border-border/60" /> No meals
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
