"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, GraduationCap, Calendar, Wallet, Activity, Hash, Phone, Edit2, Camera, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import QRCode from "react-qr-code"

export default function StudentProfile() {
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDepartment, setEditDepartment] = useState("")
  const [editSession, setEditSession] = useState("")
  const [editWhatsapp, setEditWhatsapp] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = () => {
    fetch("/api/student/profile")
      .then((res) => res.json())
      .then((data) => {
        setStudent(data.student)
        setEditName(data.student.name)
        setEditDepartment(data.student.department)
        setEditSession(data.student.session)
        setEditWhatsapp(data.student.whatsapp || "")
      })
      .finally(() => setLoading(false))
  }

  const handleSaveProfile = async () => {
    if (!editName || !editDepartment || !editSession) {
      toast.error("Name, Department, and Session are required.")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          department: editDepartment,
          session: editSession,
          whatsapp: editWhatsapp,
        })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success("Profile updated successfully!")
        setStudent(data.student)
        setIsDialogOpen(false)
      } else {
        toast.error(data.error || "Failed to update profile")
      }
    } catch (e) {
      toast.error("An error occurred while updating")
    } finally {
      setIsSaving(false)
    }
  }

  const uploadImage = async (imageBase64: string) => {
    const loadingToast = toast.loading("Uploading image...")
    try {
      const res = await fetch("/api/student/profile/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Profile picture updated!", { id: loadingToast })
        setStudent((prev: any) => ({
          ...prev,
          user: { ...prev.user, image: data.image }
        }))
      } else {
        toast.error(data.error || "Failed to upload image", { id: loadingToast })
      }
    } catch (err) {
      toast.error("Error uploading image", { id: loadingToast })
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.match(/image\/(png|jpeg|webp)/)) {
      toast.error("Please upload a PNG, JPEG, or WEBP image.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Max allowed original size is 5MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const MAX_WIDTH = 300
        const MAX_HEIGHT = 300
        const width = img.width
        const height = img.height

        const size = Math.min(width, height)
        const sourceX = (width - size) / 2
        const sourceY = (height - size) / 2

        canvas.width = MAX_WIDTH
        canvas.height = MAX_HEIGHT

        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, sourceX, sourceY, size, size, 0, 0, MAX_WIDTH, MAX_HEIGHT)
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85)
          uploadImage(compressedBase64)
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleImageDelete = async () => {
    if (!confirm("Are you sure you want to remove your profile picture?")) return
    try {
      const res = await fetch("/api/student/profile/image", { method: "DELETE" })
      if (res.ok) {
        toast.success("Profile picture removed")
        setStudent((prev: any) => ({
          ...prev,
          user: { ...prev.user, image: null }
        }))
      } else {
        toast.error("Failed to remove image")
      }
    } catch (err) {
      toast.error("Error removing image")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!student) return <p>Failed to load profile</p>

  const initials = student.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()

  const qrPayload = JSON.stringify({
    studentId: student.id,
    type: "MEAL_CHECKIN"
  })

  const detailItems = [
    { icon: Mail, label: "Email", value: student.email },
    { icon: Phone, label: "WhatsApp", value: student.whatsapp || "Not provided" },
    { icon: GraduationCap, label: "Department", value: student.department },
    { icon: Calendar, label: "Session", value: student.session },
    {
      icon: Wallet,
      label: "Balance",
      value: `${student.wallet?.balance?.toFixed(2) || "0.00"} BDT`,
      strong: true,
    },
    {
      icon: Activity,
      label: "Status",
      value: student.isActive ? "Active" : "Inactive",
      badge: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Your account information</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Edit2 className="h-4 w-4" /> Edit Profile
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={editDepartment} onChange={e => setEditDepartment(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Input value={editSession} onChange={e => setEditSession(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} placeholder="01XXXXXXXXX" />
              </div>
              <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Profile hero card */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 card-shadow sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg">
                  {student.user?.image && <AvatarImage src={student.user.image} alt={student.name} className="object-cover" />}
                  <AvatarFallback className="bg-gradient-to-br from-primary to-teal-600 text-2xl font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-primary p-2 text-primary-foreground shadow-lg transition-transform hover:scale-105">
                  <Camera className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
              {student.user?.image && (
                <button
                  onClick={handleImageDelete}
                  className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="text-2xl font-extrabold tracking-tight">{student.name}</h2>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" /> {student.studentId}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <User className="h-3 w-3" /> {student.diningId || "No Dining ID"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {student.department} · Session {student.session}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/30 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Digital Dining Pass
            </p>
            <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-border">
              <QRCode
                value={qrPayload}
                size={110}
                level="Q"
              />
            </div>
            <p className="mt-3 max-w-[160px] text-center text-[11px] text-muted-foreground">
              Show this QR code to the dining manager to verify your meals.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {detailItems.map((item) => (
          <Card key={item.label} className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {item.badge ? (
                <Badge variant={student.isActive ? "default" : "secondary"}>
                  {student.isActive ? "Active" : "Inactive"}
                </Badge>
              ) : (
                <p className={item.strong ? "text-lg font-extrabold tabular-nums" : "font-medium"}>{item.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </span>
            Account Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-extrabold tabular-nums">{student._count?.transactions || 0}</p>
              <p className="text-xs text-muted-foreground">Total transactions</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-extrabold tabular-nums">{student._count?.mealSchedules || 0}</p>
              <p className="text-xs text-muted-foreground">Total meal days</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-extrabold tabular-nums">
                {new Date(student.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">Member since</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
