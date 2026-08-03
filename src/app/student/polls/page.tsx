"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, MessageSquare, Vote } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function StudentPollsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [votingId, setVotingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      fetchPolls()
    }
  }, [status, session, router])

  async function fetchPolls() {
    try {
      const res = await fetch("/api/student/polls")
      if (res.ok) {
        const data = await res.json()
        setPolls(data)
      }
    } catch (error) {
      toast.error("Failed to fetch polls")
    } finally {
      setLoading(false)
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    setVotingId(pollId)
    try {
      const res = await fetch("/api/student/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, optionId })
      })
      if (res.ok) {
        toast.success("Vote cast successfully!")
        fetchPolls()
      } else {
        toast.error("Failed to submit vote")
      }
    } catch (error) {
      toast.error("Error submitting vote")
    } finally {
      setVotingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading polls...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Polls & Feedback</h1>
        <p className="text-muted-foreground">
          Have your say on upcoming meals and menu changes!
        </p>
      </div>

      {polls.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
            </span>
            <p>No active polls at the moment. Check back soon!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {polls.map(poll => {
            const userVote = poll.votes?.[0]?.optionId
            const totalVotes = poll.options?.reduce((acc: number, opt: any) => acc + (opt._count?.votes || 0), 0) || 0
            return (
              <Card
                key={poll.id}
                className={cn(
                  "card-shadow transition-all duration-300 hover:-translate-y-0.5 hover:card-shadow-hover",
                  userVote && "border-primary/40 ring-1 ring-primary/20"
                )}
              >
                <CardHeader>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Active Poll
                  </div>
                  <CardTitle className="text-lg leading-tight">{poll.question}</CardTitle>
                  <CardDescription>
                    {new Date(poll.createdAt).toLocaleDateString()} · {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={userVote || ""}
                    onValueChange={(val: string) => handleVote(poll.id, val)}
                    disabled={votingId === poll.id}
                  >
                    <div className="space-y-2.5">
                      {poll.options.map((opt: any) => (
                        <div
                          key={opt.id}
                          className={cn(
                            "flex cursor-pointer items-center space-x-2.5 rounded-xl border p-3 transition-all",
                            userVote === opt.id
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "hover:border-primary/40 hover:bg-muted/40"
                          )}
                        >
                          <RadioGroupItem value={opt.id} id={opt.id} />
                          <Label htmlFor={opt.id} className="flex-1 cursor-pointer font-normal">
                            {opt.text}
                          </Label>
                          {userVote === opt.id && <Vote className="h-4 w-4 text-primary" />}
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  {userVote && (
                    <p className="mt-4 text-center text-xs font-semibold text-primary">
                      You have voted on this poll.
                    </p>
                  )}
                  {votingId === poll.id && (
                    <div className="mt-4 flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
