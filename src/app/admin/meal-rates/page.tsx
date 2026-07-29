"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function AdminMealRates() {
  const [rates, setRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ breakfastPrice: "25", lunchPrice: "60", dinnerPrice: "50" })

  useEffect(() => {
    fetch("/api/admin/meal-rates")
      .then((res) => res.json())
      .then((data) => {
        setRates(data.rates || [])
        if (data.rates && data.rates.length > 0) {
          const latest = data.rates[0]
          setForm({
            breakfastPrice: String(latest.breakfastPrice),
            lunchPrice: String(latest.lunchPrice),
            dinnerPrice: String(latest.dinnerPrice),
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch("/api/admin/meal-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breakfastPrice: parseFloat(form.breakfastPrice),
        lunchPrice: parseFloat(form.lunchPrice),
        dinnerPrice: parseFloat(form.dinnerPrice),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to update rates")
    } else {
      toast.success("Meal rates updated successfully")
      setRates([data.rate, ...rates])
    }
    setSubmitting(false)
  }

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Rates</h1>
        <p className="text-muted-foreground">Set pricing for each meal type</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Set New Rates</CardTitle>
            <CardDescription>New rates take effect immediately</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Breakfast Price (BDT)</Label>
                <Input type="number" step="0.01" value={form.breakfastPrice} onChange={(e) => setForm({ ...form, breakfastPrice: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Lunch Price (BDT)</Label>
                <Input type="number" step="0.01" value={form.lunchPrice} onChange={(e) => setForm({ ...form, lunchPrice: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Dinner Price (BDT)</Label>
                <Input type="number" step="0.01" value={form.dinnerPrice} onChange={(e) => setForm({ ...form, dinnerPrice: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : "Update Rates"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rate History</CardTitle></CardHeader>
          <CardContent>
            {rates.length === 0 ? (
              <p className="text-muted-foreground">No rate history</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Breakfast</TableHead>
                    <TableHead>Lunch</TableHead>
                    <TableHead>Dinner</TableHead>
                    <TableHead>Effective</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r: any, i: number) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.breakfastPrice} BDT</TableCell>
                      <TableCell>{r.lunchPrice} BDT</TableCell>
                      <TableCell>{r.dinnerPrice} BDT</TableCell>
                      <TableCell>
                        {i === 0 ? <Badge>Current</Badge> : new Date(r.effectiveFrom).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
