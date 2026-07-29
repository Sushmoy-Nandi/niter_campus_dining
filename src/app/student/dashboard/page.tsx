"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Wallet, UtensilsCrossed, CalendarDays, TrendingDown, Clock, MessageSquare, Star } from "lucide-react"
import { LOW_BALANCE_THRESHOLD } from "@/lib/constants"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { QRCodeSVG } from 'qrcode.react'

interface DashboardData {
  student: any
  wallet: any
  todayMeals: any
  tomorrowMeals: any
  monthlyMealCount: number
  monthlySpending: number
  recentTransactions: any[]
  mealRates: any
  periodId: string
  periodTitle: string
  error?: string
  autoOff?: boolean
  autoOffReason?: string
}

export default function StudentDashboard() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mealRate, setMealRate] = useState(0)
  const [polls, setPolls] = useState<any[]>([])
  const [feedback, setFeedback] = useState<any>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  useEffect(() => {
    async function fetchData(showLoader = true) {
      try {
        if (showLoader) setLoading(true)
        const dashRes = await fetch("/api/student/dashboard", {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        const dashboardData = await dashRes.json()
        setData(dashboardData)

        let rateUrl = `/api/admin/meal-rate/calculation?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        if (dashboardData.periodId) {
          rateUrl = `/api/admin/meal-rate/calculation?periodId=${dashboardData.periodId}`
        }

        const rateRes = await fetch(rateUrl, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        const rateData = await rateRes.json()
        setMealRate(rateData.mealRate || 0)

        const pollRes = await fetch("/api/student/polls", { cache: 'no-store' })
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          setPolls(pollData)
        }

        const feedbackRes = await fetch("/api/student/feedback", { cache: 'no-store' })
        if (feedbackRes.ok) {
          const feedbackData = await feedbackRes.json()
          if (feedbackData.feedback) {
            setFeedback(feedbackData.feedback)
            setRating(feedbackData.feedback.rating)
            setComment(feedbackData.feedback.comment || "")
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (showLoader) setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleVote(pollId: string, pollOptionId: string) {
    try {
      const res = await fetch("/api/student/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, pollOptionId })
      })
      if (res.ok) {
        toast.success("Vote recorded!")
        // Refetch polls
        const pollRes = await fetch("/api/student/polls", { cache: 'no-store' })
        if (pollRes.ok) {
          setPolls(await pollRes.json())
        }
      } else {
        toast.error("Failed to vote")
      }
    } catch (e) {
      toast.error("Error voting")
    }
  }

  async function handleFeedbackSubmit() {
    if (rating === 0) return toast.error("Please select a rating star");
    setSubmittingFeedback(true);
    try {
      const res = await fetch("/api/student/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment })
      });
      if (res.ok) {
        toast.success("Thank you for your feedback!");
        const data = await res.json();
        setFeedback({ rating, comment });
      } else {
        toast.error("Failed to submit feedback");
      }
    } catch (e) {
      toast.error("Error submitting feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <p>Failed to load dashboard</p>
  if (data.error) return <p className="text-red-500">Error: {data.error}</p>

  const balance = data.wallet?.balance || 0
  const isLowBalance = balance < LOW_BALANCE_THRESHOLD

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {data.student?.name}
        </h1>
        <p className="text-muted-foreground flex flex-col sm:flex-row sm:gap-2">
          <span>{data.student?.diningId || "No Dining ID"} | {data.student?.studentId} | {data.student?.department}</span>
          {data.student?.whatsapp && (
            <span className="text-sm font-medium text-green-600 sm:border-l sm:pl-2">
              WhatsApp: {data.student.whatsapp}
            </span>
          )}
        </p>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-lg">Your Meal Pass</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <QRCodeSVG 
              value={JSON.stringify({ type: "MEAL_CHECKIN", studentId: data.student?.id })}
              size={150}
              level="H"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">Scan this at the dining hall to check-in for your meal.</p>
        </CardContent>
      </Card>

      {data.autoOff ? (
        <Alert variant="destructive" className="border-red-600 bg-red-50">
          <AlertDescription className="font-semibold text-red-700">
            🚨 YOUR MEAL SERVICE IS SUSPENDED: {data.autoOffReason}
          </AlertDescription>
        </Alert>
      ) : isLowBalance ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your balance is low ({balance.toFixed(2)} BDT). Please deposit money to ensure uninterrupted meal service.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(balance - (data.monthlyMealCount * mealRate)).toFixed(2)} BDT</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Meals</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.monthlyMealCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.periodTitle || "This month"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projected Spending</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.monthlyMealCount * mealRate).toFixed(2)} BDT</div>
            <p className="text-xs text-muted-foreground mt-1">{data.periodTitle || "This month"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estimated Meal Rate</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mealRate.toFixed(2)} BDT</div>
            <p className="text-xs text-muted-foreground mt-1">Per meal ({data.periodTitle || "this month"})</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Meals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <MealBadge label="Lunch" active={!data.autoOff && (data.todayMeals?.lunch ?? true)} />
              <MealBadge label="Dinner" active={!data.autoOff && (data.todayMeals?.dinner ?? true)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tomorrow&apos;s Meals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <MealBadge label="Lunch" active={!data.autoOff && (data.tomorrowMeals?.lunch ?? true)} />
              <MealBadge label="Dinner" active={!data.autoOff && (data.tomorrowMeals?.dinner ?? true)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rate Today&apos;s Food</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-center justify-center py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-10 w-10 cursor-pointer transition-colors ${
                    star <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                  }`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
            <Textarea
              placeholder="Any specific comments? (Optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={2}
            />
            <Button onClick={handleFeedbackSubmit} className="w-full" disabled={submittingFeedback}>
              {feedback ? "Update Feedback" : "Submit Feedback"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {(!data.recentTransactions || data.recentTransactions.length === 0) ? (
              <p className="text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <Badge variant={tx.type === "DEPOSIT" ? "default" : "secondary"}>
                        {tx.type}
                      </Badge>
                      <span className="ml-2 text-sm">{tx.description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={tx.type === "DEPOSIT" ? "text-green-600" : "text-red-600"}>
                        {tx.type === "DEPOSIT" ? "+" : "-"}{tx.amount.toFixed(2)} BDT
                      </span>
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {polls && polls.length > 0 && (
        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Active Polls
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {polls.map((poll: any) => {
                const totalVotes = poll.options.reduce((acc: number, opt: any) => acc + (opt._count?.votes || 0), 0)
                const userVote = poll.votes?.[0]?.pollOptionId
                
                return (
                  <div key={poll.id} className="border rounded-md p-4 bg-card shadow-sm">
                    <h3 className="font-semibold text-lg mb-4">{poll.question}</h3>
                    <div className="space-y-3">
                      {poll.options.map((opt: any) => {
                        const votes = opt._count?.votes || 0
                        const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                        const isSelected = userVote === opt.id

                        return (
                          <div 
                            key={opt.id} 
                            onClick={() => handleVote(poll.id, opt.id)}
                            className={`relative overflow-hidden rounded-md border p-3 cursor-pointer transition-all ${
                              isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                            }`}
                          >
                            <div 
                              className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-500 -z-10" 
                              style={{ width: `${percent}%` }}
                            />
                            <div className="flex justify-between items-center z-10 relative">
                              <span className={`font-medium ${isSelected ? 'text-primary font-bold' : ''}`}>
                                {opt.text}
                              </span>
                              <span className="text-xs font-semibold text-muted-foreground">
                                {percent}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-right">
                      {totalVotes} total votes
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MealBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex-1 rounded-lg border p-3 text-center ${
        active ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}
    >
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-lg font-bold">{active ? "ON" : "OFF"}</p>
    </div>
  )
}
