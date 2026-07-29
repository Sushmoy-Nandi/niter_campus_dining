"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, TrendingUp, ShoppingBag, Users, Loader2, Plus, X, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

export default function BazaarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [bazaars, setBazaars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState("")
  const [name, setName] = useState("")
  const [details, setDetails] = useState("")
  const [amount, setAmount] = useState("")
  const [items, setItems] = useState<{name: string, quantity: string, unit: string, price: string}[]>([])
  
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [summary, setSummary] = useState({
    totalBazaarCost: 0,
    totalMeals: 0,
    mealRate: 0
  })

  // Process data for charts
  const [chartData, setChartData] = useState<any[]>([])
  const [availableItems, setAvailableItems] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      if ((session?.user as any)?.role !== "ADMIN") {
        router.push("/student/dashboard")
      } else {
        fetchPeriods()
        // Set default date to today
        const localDate = new Date()
        setDate(localDate.toLocaleDateString("en-CA"))
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (selectedPeriodId) {
      fetchBazaars()
      fetchSummary()
    }
  }, [selectedPeriodId])

  async function fetchPeriods() {
    try {
      const res = await fetch("/api/admin/settings/dining-periods")
      if (res.ok) {
        const data = await res.json()
        setPeriods(data.periods || [])
        const active = data.periods.find((p: any) => p.isActive)
        if (active) {
          setSelectedPeriodId(active.id)
        } else if (data.periods.length > 0) {
          setSelectedPeriodId(data.periods[0].id)
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  async function fetchBazaars() {
    try {
      const res = await fetch(`/api/admin/bazaar?periodId=${selectedPeriodId}&t=${Date.now()}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setBazaars(data)
        
        // Process analytics data
        const itemMap: Record<string, any> = {}
        const uniqueItems = new Set<string>()
        
        data.forEach((bazaar: any) => {
          const dateStr = new Date(bazaar.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
          if (!itemMap[dateStr]) itemMap[dateStr] = { date: dateStr, sortDate: new Date(bazaar.date).getTime() }
          
          if (bazaar.items) {
            bazaar.items.forEach((item: any) => {
              const itemName = item.name.toLowerCase().trim()
              if (itemName && item.quantity > 0) {
                const unitPrice = item.price / item.quantity
                itemMap[dateStr][itemName] = unitPrice
                uniqueItems.add(itemName)
              }
            })
          }
        })
        
        const sortedChartData = Object.values(itemMap).sort((a: any, b: any) => a.sortDate - b.sortDate)
        setChartData(sortedChartData)
        
        const itemsList = Array.from(uniqueItems)
        setAvailableItems(itemsList)
        // Select top 3 items by default
        setSelectedItems(itemsList.slice(0, 3))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSummary() {
    try {
      const res = await fetch(`/api/admin/meal-rate/calculation?periodId=${selectedPeriodId}&t=${Date.now()}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  async function handleAddBazaar(e: React.FormEvent) {
    e.preventDefault()
    
    if (!date || !name || !amount) {
      toast.error("Date, Name, and Total Cost are required")
      return
    }

    try {
      const res = await fetch("/api/admin/bazaar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name, details, amount, items }),
      })

      if (res.ok) {
        toast.success("Bazaar record added")
        setName("")
        setDetails("")
        setAmount("")
        setItems([])
        fetchBazaars()
        fetchSummary()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to add record")
      }
    } catch (error) {
      toast.error("Failed to add bazaar record")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this record?")) return
    
    try {
      const res = await fetch(`/api/admin/bazaar?id=${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Record deleted")
        fetchBazaars()
        fetchSummary()
      } else {
        toast.error("Failed to delete record")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bazaar & Meal Rate</h1>
        <p className="text-muted-foreground">
          Manage daily shopping expenses and calculate dynamic meal rates.
        </p>
      </div>

      <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
        <Label className="text-base font-medium">Select Timeline:</Label>
        <Select value={selectedPeriodId || undefined} onValueChange={(val) => setSelectedPeriodId(val || "")}>
          <SelectTrigger className="w-[350px]">
            <SelectValue placeholder={periods.length === 0 ? "Loading..." : "Select a period"}>
              {periods.find(p => p.id === selectedPeriodId)
                ? `${periods.find(p => p.id === selectedPeriodId)?.title} (${new Date(periods.find(p => p.id === selectedPeriodId)?.startDate).toLocaleDateString()} - ${new Date(periods.find(p => p.id === selectedPeriodId)?.endDate).toLocaleDateString()})`
                : (periods.length === 0 ? "Loading..." : "Select a period")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} ({new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bazaar Cost</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalBazaarCost.toFixed(2)} BDT</div>
            <p className="text-xs text-muted-foreground">For selected timeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meals Consumed</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalMeals}</div>
            <p className="text-xs text-muted-foreground">For selected timeline</p>
          </CardContent>
        </Card>
        <Card className="border-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-primary">Current Meal Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary.mealRate.toFixed(2)} BDT</div>
            <p className="text-xs text-muted-foreground">Cost per meal (all meals equal 1)</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && availableItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Ingredient Price Trends (BDT / unit)
                </CardTitle>
                <CardDescription>Track inflation and cost of specific items over time.</CardDescription>
              </div>
              <div className="max-w-[300px]">
                <Select 
                  onValueChange={(val: any) => {
                    if (selectedItems.includes(val)) {
                      setSelectedItems(selectedItems.filter(i => i !== val))
                    } else {
                      setSelectedItems([...selectedItems, val])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toggle items..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map(item => (
                      <SelectItem key={item} value={item}>
                        <div className="flex items-center justify-between w-full">
                          <span>{item.charAt(0).toUpperCase() + item.slice(1)}</span>
                          {selectedItems.includes(item) && <span className="text-green-600 text-xs ml-2">Selected</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedItems.map((item, i) => (
                  <div key={item} className="bg-muted px-2 py-1 rounded-md text-xs flex items-center gap-1 border">
                    <span style={{ color: `hsl(${i * 137 % 360}, 70%, 50%)` }}>●</span>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                    <button onClick={() => setSelectedItems(selectedItems.filter(x => x !== item))} className="ml-1 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              {selectedItems.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Please select at least one item to display its price trend.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toFixed(2)} BDT`, 'Unit Price']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    {selectedItems.map((item, index) => (
                      <Line 
                        key={item} 
                        type="monotone" 
                        dataKey={item} 
                        name={item.charAt(0).toUpperCase() + item.slice(1)}
                        stroke={`hsl(${index * 137 % 360}, 70%, 50%)`} 
                        strokeWidth={2}
                        activeDot={{ r: 8 }} 
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Bazaar Record</CardTitle>
            <CardDescription>Enter details of daily shopping.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddBazaar} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Shopper Name</Label>
                <Input placeholder="e.g. Rahim" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Bazaar Details</Label>
                <Input placeholder="e.g. Rice, Chicken, Vegetables" value={details} onChange={(e) => setDetails(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Total Cost (BDT)</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label>Detailed Items (Optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, {name: "", quantity: "", unit: "kg", price: ""}])}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>
                {items.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input placeholder="Item Name (e.g. Rice)" value={item.name} onChange={(e) => {
                          const newItems = [...items]
                          newItems[idx].name = e.target.value
                          setItems(newItems)
                        }} />
                        <Input type="number" placeholder="Qty" value={item.quantity} className="w-20" onChange={(e) => {
                          const newItems = [...items]
                          newItems[idx].quantity = e.target.value
                          setItems(newItems)
                        }} />
                        <Select value={item.unit} onValueChange={(val) => {
                          const newItems = [...items]
                          newItems[idx].unit = val || "kg"
                          setItems(newItems)
                        }}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="liter">liter</SelectItem>
                            <SelectItem value="pcs">pcs</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" placeholder="Price" value={item.price} className="w-24" onChange={(e) => {
                          const newItems = [...items]
                          newItems[idx].price = e.target.value
                          setItems(newItems)
                          
                          // Auto calculate total amount
                          const newTotal = newItems.reduce((acc, curr) => acc + (parseFloat(curr.price) || 0), 0)
                          setAmount(newTotal.toString())
                        }} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => {
                          const newItems = items.filter((_, i) => i !== idx)
                          setItems(newItems)
                          const newTotal = newItems.reduce((acc, curr) => acc + (parseFloat(curr.price) || 0), 0)
                          setAmount(newTotal.toString())
                        }}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full">Save Record</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Bazaar Records</CardTitle>
            <CardDescription>Records for selected timeline</CardDescription>
          </CardHeader>
          <CardContent>
            {bazaars.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No bazaar records found for this month.
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {bazaars.map((b) => (
                  <div key={b.id} className="flex flex-col border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{new Date(b.date).toLocaleDateString("en-CA")} - {b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.details || "No details"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{b.amount} BDT</span>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {b.items && b.items.length > 0 && (
                      <div className="mt-2 bg-muted/50 rounded-md p-2 text-xs">
                        <span className="font-medium mb-1 block">Items:</span>
                        <div className="grid grid-cols-2 gap-1">
                          {b.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-b border-border/50 last:border-0 pb-1">
                              <span>{item.name} ({item.quantity} {item.unit})</span>
                              <span className="text-muted-foreground">{item.price} BDT</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
