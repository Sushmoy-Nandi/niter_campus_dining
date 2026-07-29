"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
} from "lucide-react"
import { APP_NAME } from "@/lib/constants"

const studentNavItems = [
  { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { title: "Meals", href: "/student/meals", icon: UtensilsCrossed },
  { title: "Calendar", href: "/student/calendar", icon: Calendar },
  { title: "Polls", href: "/student/polls", icon: MessageSquare },
  { title: "Wallet", href: "/student/wallet", icon: Wallet },
  { title: "Transactions", href: "/student/transactions", icon: Receipt },
  { title: "Profile", href: "/student/profile", icon: User },
]

const adminNavItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Scanner", href: "/admin/scanner", icon: ScanLine },
  { title: "Scan Monitor", href: "/admin/scan-logs", icon: Activity },
  { title: "Students", href: "/admin/students", icon: Users },
  { title: "Deposits", href: "/admin/deposits", icon: Banknote },
  { title: "Bazaar & Rate", href: "/admin/bazaar", icon: DollarSign },
  { title: "Refunds", href: "/admin/refunds", icon: Banknote },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Polls", href: "/admin/polls", icon: MessageSquare },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

const staffNavItems = [
  { title: "Meal Counts", href: "/staff/dashboard", icon: UtensilsCrossed },
  { title: "Scanner", href: "/admin/scanner", icon: ScanLine },
  { title: "Scan Monitor", href: "/admin/scan-logs", icon: Activity },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  
  const navItems = role === "ADMIN" 
    ? adminNavItems 
    : role === "STAFF" 
      ? staffNavItems 
      : studentNavItems

  function handleLogout() {
    signOut({ redirect: false }).then(() => {
      window.location.assign("/login")
    })
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link 
          href={role === "ADMIN" ? "/admin/dashboard" : role === "STAFF" ? "/staff/dashboard" : "/student/dashboard"} 
          className="flex items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            N
          </div>
          <span className="font-semibold text-sm leading-tight">{APP_NAME}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                onClick={() => router.push(item.href)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          NITER, Savar, Dhaka
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

