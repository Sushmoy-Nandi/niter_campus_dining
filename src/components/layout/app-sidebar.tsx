"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  UtensilsCrossed,
  Calendar,
  Wallet,
  Receipt,
  User,
  Users,
  Banknote,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  MessageSquare,
  ScanLine,
  Activity,
  QrCode,
  Package,
} from "lucide-react"
import { APP_NAME } from "@/lib/constants"

const studentNavGroups = [
  {
    label: "Dining",
    items: [
      { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
      { title: "My Meals", href: "/student/meals", icon: UtensilsCrossed },
      { title: "Calendar", href: "/student/calendar", icon: Calendar },
      { title: "Meal Scanner", href: "/student/scanner", icon: ScanLine },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Wallet", href: "/student/wallet", icon: Wallet },
      { title: "Transactions", href: "/student/transactions", icon: Receipt },
      { title: "Polls & Feedback", href: "/student/polls", icon: MessageSquare },
      { title: "Profile", href: "/student/profile", icon: User },
    ],
  },
]

const adminNavGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Scan Monitor", href: "/admin/scan-logs", icon: Activity },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "QR Generator", href: "/admin/qr-generator", icon: QrCode },
      { title: "Scanner", href: "/admin/scanner", icon: ScanLine },
      { title: "Students", href: "/admin/students", icon: Users },
      { title: "Deposits", href: "/admin/deposits", icon: Banknote },
      { title: "Bazaar & Rate", href: "/admin/bazaar", icon: DollarSign },
      { title: "Refunds", href: "/admin/refunds", icon: Banknote },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", href: "/admin/reports", icon: BarChart3 },
      { title: "Polls", href: "/admin/polls", icon: MessageSquare },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/admin/settings", icon: Settings }],
  },
]

const staffNavGroups = [
  {
    label: "Overview",
    items: [{ title: "Meal Counts", href: "/staff/dashboard", icon: UtensilsCrossed }],
  },
  {
    label: "Operations",
    items: [
      { title: "Scanner", href: "/admin/scanner", icon: ScanLine },
      { title: "Parcel Check-in", href: "/staff/parcel-checkin", icon: Package },
      { title: "Scan Monitor", href: "/admin/scan-logs", icon: Activity },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role

  const navGroups =
    role === "ADMIN" ? adminNavGroups : role === "STAFF" ? staffNavGroups : studentNavGroups

  function handleLogout() {
    signOut({ redirect: false }).then(() => {
      window.location.assign("/login")
    })
  }

  const homeHref =
    role === "ADMIN" ? "/admin/dashboard" : role === "STAFF" ? "/staff/dashboard" : "/student/dashboard"

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3.5">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-600 text-primary-foreground text-sm font-bold shadow-md shadow-teal-500/20">
            N
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight">{APP_NAME}</span>
            <span className="text-[11px] text-muted-foreground">NITER Dining Portal</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + "/")
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => router.push(item.href)}
                        className={cn(
                          "gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                          isActive &&
                            "bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        <item.icon
                          className={cn("h-4 w-4", isActive && "text-primary")}
                        />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="gap-2.5 rounded-lg px-2.5 py-2 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          NITER, Savar, Dhaka
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
