import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { AppNavbar } from "./app-navbar"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 overflow-y-auto overflow-x-hidden">
          <AppNavbar />
          <main className="relative flex-1 p-4 md:p-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" />
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
