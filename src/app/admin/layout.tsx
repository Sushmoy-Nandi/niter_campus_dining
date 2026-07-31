import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

// Server-side role gate. The edge proxy only checks that SOME session cookie
// exists; the authoritative role check lives here (same pattern as the staff
// layout) so a logged-in non-admin can never render the admin shell.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if ((session.user as any)?.role !== "ADMIN") {
    redirect("/student/dashboard")
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
