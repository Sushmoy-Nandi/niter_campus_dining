"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Wallet, ArrowDown, Clock, FileText, Download, FileType, AlertTriangle, PlusCircle } from "lucide-react"
import { LOW_BALANCE_THRESHOLD, APP_NAME } from "@/lib/constants"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function StudentWalletPage() {
  const [data, setData] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBkashDialogOpen, setIsBkashDialogOpen] = useState(false)
  const [refundData, setRefundData] = useState({ amount: "", method: "", accountNo: "" })
  const [bkashTrxId, setBkashTrxId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bkashSubmitting, setBkashSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/student/wallet").then((res) => res.json()),
      fetch("/api/student/invoices").then((res) => res.json())
    ])
      .then(([walletData, invoicesData]) => {
        setData(walletData)
        if (walletData.remainingBalance && walletData.remainingBalance > 0) {
          setRefundData(prev => ({ ...prev, amount: walletData.remainingBalance.toFixed(2) }))
        }
        if (invoicesData.invoices) {
          setInvoices(invoicesData.invoices)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  const balance = data?.wallet?.balance || 0
  const isLowBalance = balance < LOW_BALANCE_THRESHOLD

  const handleBkashSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBkashSubmitting(true)
    try {
      const res = await fetch("/api/student/verify-bkash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trxId: bkashTrxId.trim() }),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success(result.message)
        setIsBkashDialogOpen(false)
        setBkashTrxId("")
        const newWalletData = await fetch("/api/student/wallet").then(r => r.json())
        setData(newWalletData)
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error("Failed to verify bKash TrxID")
    } finally {
      setBkashSubmitting(false)
    }
  }

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/student/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: refundData.amount,
          method: refundData.method,
          accountNo: refundData.accountNo,
        }),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success(result.message)
        setIsDialogOpen(false)
        setRefundData({ amount: "", method: "", accountNo: "" })
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error("Failed to submit refund request")
    } finally {
      setSubmitting(false)
    }
  }

  const exportInvoicePDF = (invoice: any) => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    doc.text(APP_NAME || "Dining System", 14, 22);

    doc.setFontSize(14);
    doc.setTextColor(108, 117, 125);
    doc.text("Official Invoice & Meal Statement", 14, 30);

    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text(`Billing Period: ${invoice.periodTitle}`, 14, 45);
    doc.text(`Start Date: ${new Date(invoice.startDate).toLocaleDateString()}`, 14, 52);
    doc.text(`End Date: ${new Date(invoice.endDate).toLocaleDateString()}`, 14, 59);

    autoTable(doc, {
      startY: 65,
      head: [["Metric", "Value"]],
      body: [
        ["Total Meals Consumed", invoice.totalMeals.toString()],
        ["Final Dynamic Meal Rate", `${invoice.mealRate.toFixed(2)} BDT`],
        ["Total Cost of Meals", `${invoice.totalCost.toFixed(2)} BDT`],
        ["Total Deposits Made", `${invoice.totalDeposit.toFixed(2)} BDT`],
        ["Remaining Balance", `${(invoice.totalDeposit - invoice.totalCost).toFixed(2)} BDT`],
      ],
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: "bold" } }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, finalY + 15);
    doc.text("This is an automatically generated system invoice.", 14, finalY + 22);

    doc.save(`Invoice_${invoice.periodTitle}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">Manage your meal account balance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isBkashDialogOpen} onOpenChange={setIsBkashDialogOpen}>
            <DialogTrigger render={<Button className="bg-pink-600 text-white hover:bg-pink-700" />}>
              <PlusCircle className="h-4 w-4" /> Add via bKash
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit bKash TrxID</DialogTitle>
                <DialogDescription>
                  Enter the TrxID from your bKash SMS. The system will automatically verify and add the balance to your wallet instantly.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBkashSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>TrxID</Label>
                  <Input
                    required
                    placeholder="e.g. 9H1A2B3C"
                    value={bkashTrxId}
                    onChange={(e) => setBkashTrxId(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full bg-pink-600 text-white hover:bg-pink-700" disabled={bkashSubmitting}>
                  {bkashSubmitting ? "Verifying..." : "Verify & Add"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
              Request Refund
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Refund / Withdrawal</DialogTitle>
                <DialogDescription>
                  Withdraw your remaining balance at the end of the month via mobile banking.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRefundSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Amount (BDT)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    readOnly
                    className="bg-muted cursor-not-allowed"
                    value={refundData.amount}
                    onChange={(e) => setRefundData({ ...refundData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select required onValueChange={(v: any) => setRefundData({ ...refundData, method: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BKASH">bKash</SelectItem>
                      <SelectItem value="NAGAD">Nagad</SelectItem>
                      <SelectItem value="ROCKET">Rocket</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    required
                    placeholder="e.g. 01700000000"
                    value={refundData.accountNo}
                    onChange={(e) => setRefundData({ ...refundData, accountNo: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLowBalance && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low balance</AlertTitle>
          <AlertDescription>
            Your balance is low ({balance.toFixed(2)} BDT). Please deposit money soon.
          </AlertDescription>
        </Alert>
      )}

      {/* Balance hero card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-700 p-6 text-white shadow-xl shadow-teal-500/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative z-10 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Wallet className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-teal-100">Available Balance</p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight">{balance.toFixed(2)} BDT</p>
          </div>
        </div>
        <p className="relative z-10 mt-4 text-sm text-teal-50/80">
          Deposit via bKash send money or request a refund of unused balance.
        </p>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowDown className="h-4.5 w-4.5 text-emerald-500" />
            Recent Deposits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.recentDeposits || data.recentDeposits.length === 0) ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Wallet className="mb-3 h-10 w-10 opacity-40" />
              <p>No deposits yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentDeposits.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <ArrowDown className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{tx.amount.toFixed(2)} BDT
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4.5 w-4.5 text-primary" />
            Past Period Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No past invoices available.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv: any) => (
                <div key={inv.periodId} className="flex flex-col gap-4 rounded-xl border bg-card p-5 card-shadow md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      {inv.periodTitle}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(inv.startDate).toLocaleDateString()} - {new Date(inv.endDate).toLocaleDateString()}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                      <span className="text-muted-foreground">Total Meals</span>
                      <span className="text-right font-medium tabular-nums">{inv.totalMeals}</span>

                      <span className="text-muted-foreground">Meal Rate</span>
                      <span className="text-right font-medium tabular-nums">{inv.mealRate.toFixed(2)} BDT</span>

                      <span className="text-muted-foreground">Total Cost</span>
                      <span className="text-right font-medium tabular-nums text-rose-600 dark:text-rose-400">-{inv.totalCost.toFixed(2)} BDT</span>

                      <span className="text-muted-foreground">Deposits</span>
                      <span className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">+{inv.totalDeposit.toFixed(2)} BDT</span>

                      <span className="border-t pt-1.5 font-semibold text-muted-foreground">Remaining Balance</span>
                      <span className="border-t pt-1.5 text-right font-bold tabular-nums text-primary">
                        {(inv.totalDeposit - inv.totalCost).toFixed(2)} BDT
                      </span>
                    </div>
                  </div>
                  <Button className="shrink-0" onClick={() => exportInvoicePDF(inv)}>
                    <FileType className="mr-2 h-4 w-4" /> Download Receipt
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
