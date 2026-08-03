"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Receipt, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export default function StudentTransactions() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState("ALL")

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const typeParam = filter !== "ALL" ? `&type=${filter}` : ""
    const res = await fetch(`/api/student/transactions?page=${page}&limit=20${typeParam}`)
    const data = await res.json()
    setTransactions(data.transactions || [])
    setTotalPages(data.totalPages || 1)
    setLoading(false)
  }, [page, filter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const isDeposit = (type: string) => type === "DEPOSIT"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">View all your deposit and deduction history</p>
      </div>

      <Card className="border-dashed bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Meal costs are <span className="font-medium text-foreground">not</span> deducted as fixed daily
            charges. Your meal cost is calculated dynamically from the current bazaar rate (total bazaar spend
            ÷ total meals) and applied against your deposits. See your dashboard for the live estimate.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={(v) => { setFilter(v ?? "ALL"); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="DEPOSIT">Deposits</SelectItem>
            <SelectItem value="REFUND">Refunds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Receipt className="mb-3 h-10 w-10 opacity-40" />
              <p>No transactions found</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          isDeposit(tx.type)
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {isDeposit(tx.type) ? (
                          <ArrowDownCircle className="h-4.5 w-4.5" />
                        ) : (
                          <ArrowUpCircle className="h-4.5 w-4.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tx.description || tx.type.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "font-bold tabular-nums",
                          isDeposit(tx.type)
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {isDeposit(tx.type) ? "+" : "-"}{tx.amount.toFixed(2)} BDT
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {tx.type.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
