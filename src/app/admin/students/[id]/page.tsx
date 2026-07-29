"use client"

import { useEffect, useState, use } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStudent() {
      try {
        const res = await fetch(`/api/admin/students/${id}`)
        const json = await res.json()
        setData(json)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStudent()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!data?.student) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Student not found</h2>
        <Link href="/admin/students"><Button className="mt-4">Back to Students</Button></Link>
      </div>
    )
  }

  const { student, projectedSpending, remainingBalance } = data

  const toggleMeal = async (dateStr: string, type: "lunch" | "dinner", currentValue: boolean) => {
    try {
      // Optimistic update
      const updatedSchedules = data.student.mealSchedules.map((m: any) => {
        if (new Date(m.date).toDateString() === new Date(dateStr).toDateString()) {
          return { ...m, [type]: !currentValue }
        }
        return m
      })
      setData({
        ...data,
        student: { ...data.student, mealSchedules: updatedSchedules }
      })

      const mealToUpdate = data.student.mealSchedules.find(
        (m: any) => new Date(m.date).toDateString() === new Date(dateStr).toDateString()
      )
      
      const payload = {
        date: dateStr,
        lunch: type === "lunch" ? !currentValue : (mealToUpdate ? mealToUpdate.lunch : true),
        dinner: type === "dinner" ? !currentValue : (mealToUpdate ? mealToUpdate.dinner : true),
      }

      await fetch(`/api/admin/students/${id}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    } catch (e) {
      console.error(e)
      // On error, reload data
      const res = await fetch(`/api/admin/students/${id}`)
      const json = await res.json()
      setData(json)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin/students">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
          <p className="text-muted-foreground">{student.studentId} • {student.department}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span>{student.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session:</span>
              <span>{student.session}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={student.isActive ? "default" : "secondary"}>
                {student.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex justify-between pt-2 border-t mt-2">
              <span className="text-muted-foreground">Current Balance:</span>
              <span className={student.wallet?.balance < 0 ? "text-red-500 font-medium" : "text-green-500 font-medium"}>
                {student.wallet?.balance?.toFixed(2) || "0.00"} BDT
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Projected Spending:</span>
              <span className="text-red-500">-{projectedSpending?.toFixed(2) || "0.00"} BDT</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Remaining Balance:</span>
              <span className={remainingBalance < 0 ? "text-red-600" : "text-green-600"}>
                {remainingBalance?.toFixed(2) || "0.00"} BDT
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>All Meal Status</CardTitle>
            <CardDescription>Click to manually edit</CardDescription>
          </CardHeader>
          <CardContent>
            {student.mealSchedules?.length ? (
              <div className="max-h-[400px] overflow-y-auto pr-2 relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Lunch</TableHead>
                      <TableHead>Dinner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.mealSchedules.map((meal: any) => (
                      <TableRow key={meal.id}>
                        <TableCell>{new Date(meal.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button 
                            variant={meal.lunch ? "default" : "outline"}
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => toggleMeal(meal.date, "lunch", meal.lunch)}
                          >
                            {meal.lunch ? "ON" : "OFF"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant={meal.dinner ? "default" : "outline"}
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => toggleMeal(meal.date, "dinner", meal.dinner)}
                          >
                            {meal.dinner ? "ON" : "OFF"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No meal schedules found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {student.transactions?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.transactions.slice(0, 5).map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{tx.type}</TableCell>
                      <TableCell className={`text-right ${tx.type === "DEPOSIT" ? "text-green-500" : "text-red-500"}`}>
                        {tx.type === "DEPOSIT" ? "+" : "-"}{tx.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent transactions.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Daily Charges</CardTitle>
          </CardHeader>
          <CardContent>
            {student.dailyCharges?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total Charge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.dailyCharges.slice(0, 5).map((charge: any) => (
                    <TableRow key={charge.id}>
                      <TableCell>{new Date(charge.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right text-red-500">
                        -{charge.totalCharge.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent charges.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
