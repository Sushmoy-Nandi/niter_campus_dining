import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

// Server-side role gate (mirrors the admin/staff layouts). Non-students are sent
// to their own area instead of rendering the student shell against APIs that key
// off a student profile they don't have.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const role = (session.user as any)?.role
  if (role === "ADMIN") {
    redirect("/admin/dashboard")
  }
  if (role === "STAFF") {
    redirect("/staff/dashboard")
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
