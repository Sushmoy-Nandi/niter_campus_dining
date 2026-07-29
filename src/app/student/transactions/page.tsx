"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">View all your deposit and deduction history</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Meal costs are <span className="font-medium text-foreground">not</span> deducted as fixed daily
            charges. Your meal cost is calculated dynamically from the current bazaar rate (total bazaar spend
            ÷ total meals) and applied against your deposits. See your dashboard for the live estimate.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={(v) => { setFilter(v ?? "ALL"); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="DEPOSIT">Deposits</SelectItem>
            <SelectItem value="REFUND">REFUND</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground">No transactions found</p>
          ) : (
            <>
              <div className="space-y-2">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Badge variant={tx.type === "DEPOSIT" ? "default" : "outline"}>
                        {tx.type.replace("_", " ")}
                      </Badge>
                      <span className="ml-3 text-sm">{tx.description || "N/A"}</span>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${tx.type === "DEPOSIT" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "DEPOSIT" ? "+" : "-"}{tx.amount.toFixed(2)} BDT
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {page} of {totalPages}</span>
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
