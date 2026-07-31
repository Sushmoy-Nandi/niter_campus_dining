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
  
  // Edit states
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
        let width = img.width
        let height = img.height

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
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Your account information</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 gap-2">
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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border">
                    {student.user?.image && <AvatarImage src={student.user.image} alt={student.name} className="object-cover" />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/95 transition shadow shadow-black/40">
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
                    className="text-xs text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 font-semibold mt-1"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <h2 className="text-xl font-bold mb-2">{student.name}</h2>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground text-sm">
                      <Hash className="h-4 w-4" /> Student ID
                    </div>
                    <p>{student.studentId}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground text-sm">
                      <Hash className="h-4 w-4" /> Dining ID
                    </div>
                    <p>{student.diningId || "Not Assigned"}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center bg-muted/30 p-4 rounded-xl border border-border/50">
              <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Digital Dining Pass</p>
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <QRCode 
                  value={qrPayload}
                  size={120}
                  level="Q"
                />
              </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-[150px]">
                  Show this QR code to the dining manager to verify your meals.
                </p>
              </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{student.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{student.whatsapp || "Not provided"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{student.department}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{student.session}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold">{student.wallet?.balance?.toFixed(2) || "0.00"} BDT</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={student.isActive ? "default" : "secondary"}>
              {student.isActive ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p>Total Transactions: {student._count?.transactions || 0}</p>
              <p>Total Meal Days: {student._count?.mealSchedules || 0}</p>
              <p>Joined: {new Date(student.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
