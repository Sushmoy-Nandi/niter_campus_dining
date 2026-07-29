"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Polls</h1>
        <p className="text-muted-foreground">
          Have your say on upcoming meals and menu changes!
        </p>
      </div>

      {polls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mb-4 text-green-500 opacity-50" />
            <p>No active polls at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {polls.map(poll => {
            const userVote = poll.votes?.[0]?.optionId
            return (
              <Card key={poll.id} className={userVote ? "border-primary/50" : ""}>
                <CardHeader>
                  <CardTitle className="text-lg leading-tight">{poll.question}</CardTitle>
                  <CardDescription>
                    {new Date(poll.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup 
                    value={userVote || ""} 
                    onValueChange={(val: string) => handleVote(poll.id, val)}
                    disabled={votingId === poll.id}
                  >
                    <div className="space-y-3">
                      {poll.options.map((opt: any) => (
                        <div key={opt.id} className={`flex items-center space-x-2 rounded-lg border p-3 cursor-pointer transition-colors ${userVote === opt.id ? 'bg-primary/5 border-primary/50' : 'hover:bg-muted/50'}`}>
                          <RadioGroupItem value={opt.id} id={opt.id} />
                          <Label htmlFor={opt.id} className="flex-1 cursor-pointer font-normal">
                            {opt.text}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  {userVote && (
                    <p className="text-xs text-center text-primary font-medium mt-4">
                      You have voted on this poll.
                    </p>
                  )}
                  {votingId === poll.id && (
                    <div className="flex justify-center mt-4">
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
