"use client"

import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Moon, Sun, LogOut, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

const TITLES: Record<string, string> = {
  "/student/dashboard": "Dashboard",
  "/student/meals": "My Meals",
  "/student/calendar": "Meal Calendar",
  "/student/scanner": "Meal Scanner",
  "/student/wallet": "Wallet",
  "/student/transactions": "Transactions",
  "/student/polls": "Polls & Feedback",
  "/student/profile": "Profile",
  "/admin/dashboard": "Dashboard",
  "/admin/qr-generator": "QR Generator",
  "/admin/scanner": "Scanner",
  "/admin/scan-logs": "Scan Monitor",
  "/admin/students": "Students",
  "/admin/deposits": "Deposits",
  "/admin/bazaar": "Bazaar & Rate",
  "/admin/refunds": "Refunds",
  "/admin/reports": "Reports",
  "/admin/polls": "Polls",
  "/admin/settings": "Settings",
  "/staff/dashboard": "Meal Counts",
}

export function AppNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  let pageTitle = TITLES[pathname]
  
  if (!pageTitle) {
    if (pathname.startsWith("/admin/students/")) {
      pageTitle = "Student Details"
    } else {
      pageTitle = pathname.split("/").pop() || ""
      // Format the fallback title slightly better
      if (pageTitle && !pageTitle.includes("-") && pageTitle.length < 20) {
        pageTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1)
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger className="lg:hidden" />
      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden h-6 w-1 rounded-full bg-gradient-to-b from-primary to-accent sm:block" />
        <h2 className="truncate text-sm font-semibold tracking-tight sm:text-base">
          {pageTitle}
        </h2>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className={cn("outline-none")}>
            <div className="relative h-8 w-8 cursor-pointer rounded-full ring-2 ring-primary/20 transition-shadow hover:ring-primary/40">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-teal-600 text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end">
            <div className="px-2 py-1.5 font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/student/profile")}
            >
              <UserRound className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-500 focus:text-red-500"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
