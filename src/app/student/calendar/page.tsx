"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"

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

  // A calendar cell represents a day on the viewer's (Bangladesh) wall calendar, so we key
  // it by its LOCAL Y-M-D. Schedule rows are stored at UTC-midnight of that same BDT day, so
  // we key those by their UTC Y-M-D. Both yield the same "YYYY-MM-DD" string, which is why
  // this comparison is stable regardless of the browser's timezone — unlike toISOString(),
  // which would shift a local-midnight cell back a day for any UTC+ viewer (off-by-one).
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
        <p className="text-muted-foreground">View your meal history</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
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
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} className="aspect-square" />
                  const schedule = getScheduleForDate(date)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const isToday = date.getTime() === today.getTime()
                  const hasMeals = schedule && (schedule.lunch || schedule.dinner)

                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-lg border p-1 ${isToday ? "border-primary bg-primary/5" : ""} ${!schedule || !hasMeals ? "opacity-40" : ""}`}
                    >
                      <div className="text-xs font-medium">{date.getDate()}</div>
                      {schedule && hasMeals && (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {schedule.lunch && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">L</Badge>}
                          {schedule.dinner && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">D</Badge>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
