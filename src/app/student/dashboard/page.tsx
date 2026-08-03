"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Wallet,
  UtensilsCrossed,
  CalendarDays,
  TrendingDown,
  MessageSquare,
  Star,
  Download,
  ScanLine,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { LOW_BALANCE_THRESHOLD } from "@/lib/constants"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { QRCodeCanvas } from "qrcode.react"
import { jsPDF } from "jspdf"
import { cn } from "@/lib/utils"

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
  const router = useRouter()
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
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        })
        const dashboardData = await dashRes.json()
        setData(dashboardData)

        let rateUrl = `/api/admin/meal-rate/calculation?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
        if (dashboardData.periodId) {
          rateUrl = `/api/admin/meal-rate/calculation?periodId=${dashboardData.periodId}`
        }

        const rateRes = await fetch(rateUrl, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        })
        const rateData = await rateRes.json()
        setMealRate(rateData.mealRate || 0)

        const pollRes = await fetch("/api/student/polls", { cache: "no-store" })
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          setPolls(pollData)
        }

        const feedbackRes = await fetch("/api/student/feedback", { cache: "no-store" })
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

  async function handleVote(pollId: string, optionId: string) {
    try {
      const res = await fetch("/api/student/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, optionId })
      })
      if (res.ok) {
        toast.success("Vote recorded!")
        const pollRes = await fetch("/api/student/polls", { cache: "no-store" })
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

  const downloadQRAsPDF = () => {
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement
    if (!canvas) return
    const imgData = canvas.toDataURL("image/png")
    const doc = new jsPDF()

    doc.setFontSize(22)
    doc.text("NITER Campus Dining", 105, 20, { align: "center" })

    doc.setFontSize(16)
    doc.text("Meal Pass", 105, 30, { align: "center" })

    doc.addImage(imgData, "PNG", 55, 45, 100, 100)

    doc.setFontSize(20)
    doc.text(`Dining ID: ${data?.student?.diningId || "N/A"}`, 105, 160, { align: "center" })

    doc.setFontSize(14)
    doc.text(`Name: ${data?.student?.name}`, 105, 175, { align: "center" })
    doc.text(`Department: ${data?.student?.department || "N/A"}`, 105, 185, { align: "center" })

    doc.save(`Meal_Pass_${data?.student?.diningId || "QR"}.pdf`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <p>Failed to load dashboard</p>
  if (data.error) return <p className="text-red-500">Error: {data.error}</p>

  const balance = data.wallet?.balance || 0
  const isLowBalance = balance < LOW_BALANCE_THRESHOLD

  const stats = [
    {
      label: "Remaining Balance",
      value: `${(balance - data.monthlyMealCount * mealRate).toFixed(2)} BDT`,
      hint: "After projected meals",
      icon: Wallet,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Monthly Meals",
      value: `${data.monthlyMealCount}`,
      hint: data.periodTitle || "This month",
      icon: UtensilsCrossed,
      iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      label: "Projected Spending",
      value: `${(data.monthlyMealCount * mealRate).toFixed(2)} BDT`,
      hint: data.periodTitle || "This month",
      icon: TrendingDown,
      iconClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    {
      label: "Estimated Meal Rate",
      value: `${mealRate.toFixed(2)} BDT`,
      hint: "Per meal",
      icon: CalendarDays,
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-teal-600 to-teal-700 p-6 text-white shadow-xl shadow-teal-500/20 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-teal-100">
              <Sparkles className="h-4 w-4" />
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome back, {data.student?.name?.split(" ")[0]}!
            </h1>
            <p className="mt-2 text-sm text-teal-50/90">
              {data.student?.diningId || "No Dining ID"} · {data.student?.studentId} · {data.student?.department}
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/10 px-5 py-3 text-center backdrop-blur-sm ring-1 ring-white/20">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-100">Balance</p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{balance.toFixed(2)} BDT</p>
          </div>
        </div>
      </div>

      {/* Suspension / low balance alert */}
      {data.autoOff ? (
        <Alert className="border-red-600/30 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-700 dark:text-red-400">Meal service suspended</AlertTitle>
          <AlertDescription className="font-medium text-red-700 dark:text-red-400">
            {data.autoOffReason}
          </AlertDescription>
        </Alert>
      ) : isLowBalance ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low balance</AlertTitle>
          <AlertDescription>
            Your balance is low ({balance.toFixed(2)} BDT). Please deposit money to ensure
            uninterrupted meal service.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="card-shadow transition-all duration-300 hover:-translate-y-0.5 hover:card-shadow-hover"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", stat.iconClass)}>
                <stat.icon className="h-4.5 w-4.5" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tabular-nums tracking-tight">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meal pass + meals */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 card-shadow">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-lg">Your Meal Pass</CardTitle>
            <p className="text-xs text-muted-foreground">
              Scan at the dining hall to check in for your meal.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <QRCodeCanvas
                id="qr-canvas"
                value={JSON.stringify({ type: "MEAL_CHECKIN", studentId: data.student?.id })}
                size={150}
                level="H"
              />
            </div>
            <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
              <Button size="sm" className="flex-1" onClick={() => router.push("/student/scanner")}>
                <ScanLine className="mr-1.5 h-4 w-4" /> Scan
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={downloadQRAsPDF}>
                <Download className="mr-1.5 h-4 w-4" /> Save PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 card-shadow">
          <CardHeader>
            <CardTitle>Today&apos;s & Tomorrow&apos;s Meals</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tap a card to jump to the meal scheduler.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <MealDayRow
              label="Today"
              date={new Date()}
              lunch={data.todayMeals?.lunch}
              dinner={data.todayMeals?.dinner}
              onOpen={() => router.push("/student/meals")}
            />
            <MealDayRow
              label="Tomorrow"
              date={new Date(new Date().getTime() + 86400000)}
              lunch={data.tomorrowMeals?.lunch}
              dinner={data.tomorrowMeals?.dinner}
              onOpen={() => router.push("/student/meals")}
            />
          </CardContent>
        </Card>
      </div>

      {/* Feedback + transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
              Rate Today&apos;s Food
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-1.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-9 w-9 cursor-pointer transition-all hover:scale-110",
                    star <= (hoverRating || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  )}
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

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4.5 w-4.5 text-primary" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data.recentTransactions || data.recentTransactions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {data.recentTransactions.slice(0, 5).map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          tx.type === "DEPOSIT"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {tx.type === "DEPOSIT" ? (
                          <ArrowDownCircle className="h-4 w-4" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        tx.type === "DEPOSIT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {tx.type === "DEPOSIT" ? "+" : "-"}
                      {tx.amount.toFixed(2)} BDT
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active polls */}
      {polls && polls.length > 0 && (
        <Card className="card-shadow">
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
                  <div key={poll.id} className="rounded-xl border bg-card p-5 card-shadow">
                    <h3 className="mb-4 text-lg font-semibold">{poll.question}</h3>
                    <div className="space-y-3">
                      {poll.options.map((opt: any) => {
                        const votes = opt._count?.votes || 0
                        const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                        const isSelected = userVote === opt.id

                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleVote(poll.id, opt.id)}
                            className={cn(
                              "relative cursor-pointer overflow-hidden rounded-lg border p-3.5 transition-all",
                              isSelected
                                ? "border-primary ring-1 ring-primary"
                                : "hover:border-primary/50 hover:bg-muted/30"
                            )}
                          >
                            <div
                              className="absolute inset-y-0 left-0 -z-10 bg-gradient-to-r from-primary/15 to-primary/5 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                            <div className="flex items-center justify-between gap-3">
                              <span className={cn("font-medium", isSelected && "font-bold text-primary")}>
                                {opt.text}
                              </span>
                              <span className="text-xs font-semibold text-muted-foreground">
                                {percent}% · {votes} vote{votes === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
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

function MealDayRow({
  label,
  date,
  lunch,
  dinner,
  onOpen,
}: {
  label: string
  date: Date
  lunch: boolean
  dinner: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-xl border bg-muted/20 p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/40"
    >
      <div>
        <p className="text-sm font-bold">
          {label}
          <span className="ml-2 font-normal text-muted-foreground">
            {date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
          </span>
        </p>
        <div className="mt-2 flex gap-2">
          <MealBadge label="Lunch" active={lunch} />
          <MealBadge label="Dinner" active={dinner} />
        </div>
      </div>
      <Badge variant="outline" className="shrink-0">Manage</Badge>
    </button>
  )
}

function MealBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {label} · {active ? "ON" : "OFF"}
    </span>
  )
}
