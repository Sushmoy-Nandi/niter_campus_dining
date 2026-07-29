"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Trash2, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

export default function AdminPollsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<string[]>(["", ""])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      if ((session?.user as any)?.role !== "ADMIN") {
        router.push("/student/dashboard")
      } else {
        fetchPolls()
      }
    }
  }, [status, session, router])

  async function fetchPolls() {
    try {
      const res = await fetch("/api/admin/polls")
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

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault()
    const validOptions = options.map(o => o.trim()).filter(o => o !== "")
    if (!question.trim()) return toast.error("Question is required")
    if (validOptions.length < 2) return toast.error("At least 2 valid options are required")

    try {
      const res = await fetch("/api/admin/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), options: validOptions })
      })

      if (res.ok) {
        toast.success("Poll created")
        setQuestion("")
        setOptions(["", ""])
        fetchPolls()
      } else {
        toast.error("Failed to create poll")
      }
    } catch (error) {
      toast.error("Error creating poll")
    }
  }

  async function togglePollActive(id: string, currentStatus: boolean) {
    try {
      const res = await fetch("/api/admin/polls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentStatus })
      })
      if (res.ok) {
        toast.success("Poll updated")
        fetchPolls()
      } else {
        toast.error("Failed to update poll")
      }
    } catch (error) {
      toast.error("Error updating poll")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this poll forever?")) return
    try {
      const res = await fetch(`/api/admin/polls?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Poll deleted")
        fetchPolls()
      } else {
        toast.error("Failed to delete")
      }
    } catch (error) {
      toast.error("Error deleting poll")
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu Polling</h1>
        <p className="text-muted-foreground">
          Create polls to let students vote on upcoming meals or menu items.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create New Poll</CardTitle>
            <CardDescription>Enter a question and multiple options for students to vote.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div className="space-y-2">
                <Label>Question</Label>
                <Input placeholder="e.g. What should we cook for Friday dinner?" value={question} onChange={(e) => setQuestion(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Options</Label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input placeholder={`Option ${idx + 1}`} value={opt} onChange={(e) => {
                      const newOpts = [...options]
                      newOpts[idx] = e.target.value
                      setOptions(newOpts)
                    }} />
                    {options.length > 2 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, i) => i !== idx))}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ""])} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" /> Add Option
                </Button>
              </div>
              <Button type="submit" className="w-full mt-4">Publish Poll</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Polls</CardTitle>
          </CardHeader>
          <CardContent>
            {polls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No polls created yet.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {polls.map(poll => {
                  const totalVotes = poll._count.votes || 0;
                  return (
                    <div key={poll.id} className="border rounded-md p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{poll.question}</h3>
                          <p className="text-xs text-muted-foreground">{new Date(poll.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={poll.isActive} onCheckedChange={() => togglePollActive(poll.id, poll.isActive)} />
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(poll.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {poll.options.map((opt: any) => {
                          const votes = opt._count.votes || 0;
                          const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          return (
                            <div key={opt.id} className="relative pt-1">
                              <div className="flex mb-1 items-center justify-between">
                                <div>
                                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-primary/10 text-primary">
                                    {opt.text}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold inline-block text-primary">
                                    {percent}% ({votes})
                                  </span>
                                </div>
                              </div>
                              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary/20">
                                <div style={{ width: `${percent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="text-xs text-right text-muted-foreground font-medium">
                        Total Votes: {totalVotes}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
