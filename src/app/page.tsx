import Link from "next/link"
import { Button } from "@/components/ui/button"
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="container mx-auto flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            N
          </div>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button>Register</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="flex flex-col items-center justify-center py-20 text-center">
          <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
            Campus Dining Management for{" "}
            <span className="text-primary">NITER</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            {APP_DESCRIPTION}. Manage your daily meals, track expenses, and stay on top
            of your dining account with ease.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-8 py-20 md:grid-cols-3">
          {[
            {
              title: "Meal Scheduling",
              description: "Turn breakfast, lunch, and dinner ON or OFF with a single tap. Plan your meals in advance.",
            },
            {
              title: "Wallet Management",
              description: "Deposit money, track your balance, and get low-balance alerts. Never run out of meal credits.",
            },
            {
              title: "Monthly Reports",
              description: "View detailed monthly meal counts, spending summaries, and download printable statements.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border bg-card p-8 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="mt-3 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </section>

        <section className="py-20 text-center">
          <h2 className="text-3xl font-bold">
            National Institute of Textile Engineering and Research
          </h2>
          <p className="mt-4 text-muted-foreground">
            Savar, Dhaka, Bangladesh
          </p>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
