"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Wallet, ArrowDown, Clock, FileText, Download, FileType } from "lucide-react"
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
        // Refresh data
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
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    doc.text(APP_NAME || "Dining System", 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(108, 117, 125);
    doc.text("Official Invoice & Meal Statement", 14, 30);
    
    // Period Info
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text(`Billing Period: ${invoice.periodTitle}`, 14, 45);
    doc.text(`Start Date: ${new Date(invoice.startDate).toLocaleDateString()}`, 14, 52);
    doc.text(`End Date: ${new Date(invoice.endDate).toLocaleDateString()}`, 14, 59);

    // Summary Table
    autoTable(doc, {
      startY: 65,
      head: [['Metric', 'Value']],
      body: [
        ['Total Meals Consumed', invoice.totalMeals.toString()],
        ['Final Dynamic Meal Rate', `${invoice.mealRate.toFixed(2)} BDT`],
        ['Total Cost of Meals', `${invoice.totalCost.toFixed(2)} BDT`],
        ['Total Deposits Made', `${invoice.totalDeposit.toFixed(2)} BDT`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, finalY + 15);
    doc.text("This is an automatically generated system invoice.", 14, finalY + 22);

    // Save
    doc.save(`Invoice_${invoice.periodTitle}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">Manage your meal account balance</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isBkashDialogOpen} onOpenChange={setIsBkashDialogOpen}>
            <DialogTrigger render={<Button variant="default" className="bg-pink-600 hover:bg-pink-700 text-white" />}>
              Add By bKash Payment
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit bKash Payment</DialogTitle>
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
                <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 text-white" disabled={bkashSubmitting}>
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
                  <SelectTrigger>
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
          <AlertDescription>
            Your balance is low ({balance.toFixed(2)} BDT). Please deposit money soon.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Balance Deposit</CardTitle>
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{balance.toFixed(2)} BDT</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.recentDeposits || data.recentDeposits.length === 0) ? (
            <p className="text-muted-foreground">No deposits yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentDeposits.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <Badge variant="default">
                      <ArrowDown className="mr-1 h-3 w-3" />
                      DEPOSIT
                    </Badge>
                    <span className="ml-2 text-sm">{tx.description}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-green-600">+{tx.amount.toFixed(2)} BDT</span>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Period Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground">No past invoices available.</p>
          ) : (
            <div className="space-y-4">
              {invoices.map((inv: any) => (
                <div key={inv.periodId} className="flex flex-col md:flex-row justify-between items-start md:items-center border p-4 rounded-lg bg-card shadow-sm">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      {inv.periodTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(inv.startDate).toLocaleDateString()} - {new Date(inv.endDate).toLocaleDateString()}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Total Meals:</span>
                      <span className="font-medium text-right">{inv.totalMeals}</span>
                      
                      <span className="text-muted-foreground">Meal Rate:</span>
                      <span className="font-medium text-right">{inv.mealRate.toFixed(2)} BDT</span>
                      
                      <span className="text-muted-foreground">Total Cost:</span>
                      <span className="font-medium text-red-600 text-right">-{inv.totalCost.toFixed(2)} BDT</span>
                      
                      <span className="text-muted-foreground">Deposits:</span>
                      <span className="font-medium text-green-600 text-right">+{inv.totalDeposit.toFixed(2)} BDT</span>
                    </div>
                  </div>
                  <Button variant="default" className="mt-4 md:mt-0" onClick={() => exportInvoicePDF(inv)}>
                    <FileType className="h-4 w-4 mr-2" /> Download PDF Receipt
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
