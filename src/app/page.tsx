import Link from "next/link"
import { Button } from "@/components/ui/button"
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants"
import {
  CalendarCheck,
  Wallet,
  QrCode,
  BarChart3,
  UtensilsCrossed,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Clock3,
  Star,
} from "lucide-react"

const features = [
  {
    icon: CalendarCheck,
    title: "One-Tap Meal Scheduling",
    description:
      "Turn breakfast, lunch, and dinner ON or OFF with a single tap. Plan your whole month in seconds.",
  },
  {
    icon: Wallet,
    title: "Smart Wallet & bKash",
    description:
      "Deposit via bKash, track your balance in real time, and get low-balance alerts before you run out.",
  },
  {
    icon: QrCode,
    title: "Digital Dining Pass",
    description:
      "Check in at the hall with your personal QR code. No more paper lists or losing your card.",
  },
  {
    icon: BarChart3,
    title: "Transparent Spending",
    description:
      "See exactly what each meal costs with dynamic rates based on bazaar prices. No hidden charges.",
  },
  {
    icon: MessageSquare,
    title: "Vote & Give Feedback",
    description:
      "Pick your menu through polls and rate today's food. Your voice shapes tomorrow's meals.",
  },
  {
    icon: ShieldCheck,
    title: "Auto Suspension Guard",
    description:
      "Fair, automatic rules keep the system balanced and protected so everyone gets their fair share.",
  },
]

const steps = [
  {
    step: "01",
    title: "Create your account",
    description: "Register in under a minute with your student ID and department.",
  },
  {
    step: "02",
    title: "Top up your wallet",
    description: "Send money via bKash and verify your transaction in seconds.",
  },
  {
    step: "03",
    title: "Plan your meals",
    description: "Turn meals on or off for any day, then check in with your QR pass.",
  },
]

const stats = [
  { value: "400+", label: "Students served per day" },
  { value: "2", label: "Meals a day" },
  { value: "24/7", label: "Wallet access" },
  { value: "100%", label: "Cashless dining" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid-fade" />

      <header className="relative z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-600 text-primary-foreground font-bold text-lg shadow-lg shadow-teal-500/25">
              N
            </div>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:inline-flex">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button>
                Register
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -top-10 left-1/4 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

            <div className="animate-fade-up mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-4 w-4 text-accent" />
              Modern dining for NITER students
            </div>

            <h1 className="animate-fade-up animation-delay-100 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Campus Dining,{" "}
              <span className="bg-gradient-to-r from-primary via-teal-500 to-accent bg-clip-text text-transparent">
                made effortless
              </span>
            </h1>

            <p className="animate-fade-up animation-delay-200 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {APP_DESCRIPTION}. Plan your meals, track every taka, check in with
              your phone, and never worry about meal management again.
            </p>

            <div className="animate-fade-up animation-delay-300 mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-teal-500/25">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  Sign In to Your Account
                </Button>
              </Link>
            </div>

            {/* Trust row */}
            <div className="animate-fade-up animation-delay-300 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-primary" /> Instant bKash verification
              </span>
              <span className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-primary" /> QR check-in at the hall
              </span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y bg-card/60 backdrop-blur">
          <div className="container mx-auto grid grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-extrabold tracking-tight text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything you need to{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                eat better
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built around the way students actually live — quick, mobile-first, and clear.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border bg-card p-6 transition-all duration-300 card-shadow hover:-translate-y-1 hover:card-shadow-hover"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y bg-card/60 backdrop-blur">
          <div className="container mx-auto px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                Get started in <span className="text-primary">3 easy steps</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                From signup to your first meal — faster than a lunch break.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {steps.map((step, i) => (
                <div
                  key={step.step}
                  className="relative rounded-2xl border bg-card p-6 card-shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 text-sm font-bold text-primary-foreground shadow-lg shadow-teal-500/25">
                      {step.step}
                    </span>
                    {i < steps.length - 1 && (
                      <ArrowRight className="hidden h-4 w-4 text-muted-foreground/50 md:block" />
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-teal-600 to-teal-700 px-6 py-16 text-center text-white shadow-2xl shadow-teal-500/30">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />

            <div className="relative z-10 mx-auto max-w-2xl">
              <UtensilsCrossed className="mx-auto h-12 w-12 opacity-90" />
              <h2 className="mt-6 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready for a smarter meal plan?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-teal-50/90">
                Join NITER students who already manage their dining in one place.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="h-12 bg-white px-8 text-base text-teal-800 shadow-xl hover:bg-teal-50"
                  >
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 border-white/40 bg-transparent px-8 text-base text-white hover:bg-white/10 hover:text-white"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/60 backdrop-blur">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <p>
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p>National Institute of Textile Engineering and Research, Savar, Dhaka</p>
        </div>
      </footer>
    </div>
  )
}
