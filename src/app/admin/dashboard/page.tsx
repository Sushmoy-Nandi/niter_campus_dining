"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, UtensilsCrossed, Banknote, TrendingDown, Wallet, Activity, Star, MessageSquare } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")

  // Fetch available dining periods
  useEffect(() => {
    async function fetchPeriods() {
      try {
        const res = await fetch("/api/admin/settings/dining-periods")
        if (res.ok) {
          const data = await res.json()
          setPeriods(data.periods || [])
          const active = data.periods.find((p: any) => p.isActive)
          if (active) {
            setSelectedPeriodId(active.id)
          } else if (data.periods.length > 0) {
            setSelectedPeriodId(data.periods[0].id)
          }
        }
      } catch (error) {
        console.error("Failed to fetch periods", error)
      }
    }
    fetchPeriods()
  }, [])

  useEffect(() => {
    // Wait until a period is selected (or periods are loaded and there are none)
    if (periods.length > 0 && !selectedPeriodId) return

    const fetchData = (showLoader = true) => {
      if (showLoader) setLoading(true)
      
      let url = `/api/admin/dashboard?t=${Date.now()}`
      if (selectedPeriodId) {
        url += `&periodId=${selectedPeriodId}`
      }
      
      fetch(url, { cache: 'no-store' })
        .then((res) => res.json())
        .then(setData)
        .finally(() => { if (showLoader) setLoading(false) })
    }
    fetchData()
    const interval = setInterval(() => fetchData(false), 10000)
    return () => clearInterval(interval)
  }, [selectedPeriodId, periods])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  const s = data?.stats

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of the dining system</p>
        </div>
        
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border">
          <Label className="text-sm font-medium whitespace-nowrap hidden sm:block">Timeline:</Label>
          <Select value={selectedPeriodId || undefined} onValueChange={(val) => setSelectedPeriodId(val || "")}>
            <SelectTrigger className="w-[280px] bg-background">
              <SelectValue placeholder={periods.length === 0 ? "Loading..." : "Select a timeline"}>
                {periods.find(p => p.id === selectedPeriodId)
                  ? `${periods.find(p => p.id === selectedPeriodId)?.title} (${new Date(periods.find(p => p.id === selectedPeriodId)?.startDate).toLocaleDateString()} - ${new Date(periods.find(p => p.id === selectedPeriodId)?.endDate).toLocaleDateString()})`
                  : (periods.length === 0 ? "Loading..." : "Select a timeline")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title} ({new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()})
                  {p.isActive && " (Active)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalStudents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Refunds (Month)</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalRefunds?.toFixed(2) || "0"} BDT</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits (Month)</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalDeposits?.toFixed(2) || "0"} BDT</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Meal Cost (Month)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalMealCost?.toFixed(2) || "0"} BDT</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.outstandingBalance?.toFixed(2) || "0"} BDT</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Meals</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-2xl font-bold">
              {(s?.todayMeals?.lunch || 0) + (s?.todayMeals?.dinner || 0)}
            </div>
            <div className="flex gap-1.5 mb-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">L: {s?.todayMeals?.lunch || 0}</Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">D: {s?.todayMeals?.dinner || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Meals Served (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.charts?.dailyMeals || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="meals" stroke="#0F766E" strokeWidth={2} name="Meals" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposits vs Bazaar Expenses (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.charts?.monthlyBreakdown || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="amount" fill="#0F766E" name="Amount (BDT)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
