import Link from "next/link"
import { APP_NAME } from "@/lib/constants"
import { UtensilsCrossed, QrCode, Wallet, CalendarCheck } from "lucide-react"

const highlights = [
  {
    icon: CalendarCheck,
    text: "Plan lunch & dinner with one tap",
  },
  {
    icon: Wallet,
    text: "Track your balance and bKash deposits in real time",
  },
  {
    icon: QrCode,
    text: "Check in at the hall with your digital dining pass",
  },
]

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel (hidden on small screens) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary via-teal-600 to-teal-800 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative z-10 p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-bold text-white backdrop-blur">
              N
            </div>
            <span className="text-xl font-bold text-white">{APP_NAME}</span>
          </Link>
        </div>

        <div className="relative z-10 p-10">
          <UtensilsCrossed className="h-14 w-14 text-white/90" />
          <h2 className="mt-6 max-w-md text-3xl font-extrabold leading-tight tracking-tight text-white">
            Manage your campus dining, the easy way.
          </h2>
          <p className="mt-3 max-w-md text-teal-50/85">
            One place for meal scheduling, wallet balance, and your digital dining pass.
          </p>

          <ul className="mt-8 space-y-4">
            {highlights.map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                  <item.icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-medium">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 p-10 text-sm text-teal-50/70">
          National Institute of Textile Engineering and Research
          <br /> Savar, Dhaka, Bangladesh
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-grid-fade px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-600 text-lg font-bold text-white shadow-lg shadow-teal-500/25">
              N
            </div>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </Link>

          <div className="animate-fade-up rounded-2xl border bg-card p-6 shadow-2xl shadow-teal-950/5 sm:p-8 card-shadow-hover">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
