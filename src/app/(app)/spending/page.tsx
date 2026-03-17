'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Plus, Trash2, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react'

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Others']

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f97316',
  Transport: '#3b82f6',
  Bills: '#8b5cf6',
  Shopping: '#ec4899',
  Entertainment: '#06b6d4',
  Others: '#6b7280',
}

type Transaction = {
  id: string
  user_id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  date: string
  note: string | null
  created_at: string
}

function formatMYR(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {}
  for (const tx of transactions) {
    if (!groups[tx.date]) groups[tx.date] = []
    groups[tx.date].push(tx)
  }
  return groups
}

export default function SpendingPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [monthlyBudget, setMonthlyBudget] = useState<number>(3000)
  const [budgetInput, setBudgetInput] = useState<string>('3000')

  // Form state
  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().split('T')[0],
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function fetchTransactions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function handleAdd() {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: form.type,
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
      note: form.note || null,
    })
    setForm({ type: 'expense', amount: '', category: 'Food', date: new Date().toISOString().split('T')[0], note: '' })
    setOpen(false)
    setSubmitting(false)
    await fetchTransactions()
  }

  async function handleDelete(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
    await fetchTransactions()
  }

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterCategory !== 'all' && t.category !== filterCategory) return false
      return true
    })
  }, [transactions, filterType, filterCategory])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions])
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions])
  const netCashFlow = totalIncome - totalExpense
  const budgetProgress = Math.min((totalExpense / monthlyBudget) * 100, 100)

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [transactions])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Spending Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button className="gap-2 bg-white text-black hover:bg-white/90 rounded-lg">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0F0F0F] backdrop-blur-xl border-[#1F1F1F] rounded-xl max-w-sm">
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Type Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setForm(f => ({ ...f, type: 'expense' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-[#111111] text-[#A1A1AA] border border-[#1F1F1F]'}`}
                >
                  Expense
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, type: 'income' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#111111] text-[#A1A1AA] border border-[#1F1F1F]'}`}
                >
                  Income
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount (MYR)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="bg-[#111111] border-[#1F1F1F] focus:border-[#333333]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={form.category} onValueChange={e => setForm(f => ({ ...f, category: e ?? '' }))}>
                  <SelectTrigger className="bg-[#111111] border-[#1F1F1F]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F0F0F] border-[#1F1F1F]">
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="bg-[#111111] border-[#1F1F1F] focus:border-[#333333]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Note (optional)</Label>
                <Textarea
                  placeholder="What was this for?"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="bg-[#111111] border-[#1F1F1F] resize-none"
                  rows={2}
                />
              </div>

              <Button
                onClick={handleAdd}
                disabled={!form.amount || submitting}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                {submitting ? 'Saving...' : 'Save Transaction'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="bg-[#111111] border border-[#1F1F1F]">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 bg-[#111111] rounded-lg p-1 border border-[#1F1F1F]">
              {(['all', 'income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filterType === t ? 'bg-[#1F1F1F] text-white' : 'text-muted-foreground'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value ?? 'all')}>
              <SelectTrigger className="bg-[#111111] border-[#1F1F1F] w-36 h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F0F0F] border-[#1F1F1F]">
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction List */}
          {sortedDates.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <ArrowLeftRight className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No transactions this month</p>
              <p className="text-xs mt-1 opacity-60">Tap + Add to record your first one</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="space-y-1.5">
                    {grouped[date].map(tx => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#111111] border border-[#1F1F1F] hover:bg-[#1A1A1A] hover:border-[#2A2A2A] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[tx.category] || '#6b7280' }}
                          />
                          <div>
                            <p className="text-sm font-medium">{tx.category}</p>
                            {tx.note && <p className="text-xs text-muted-foreground">{tx.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatMYR(tx.amount)}
                          </p>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SUMMARY TAB */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" /> Income
                </p>
                <p className="text-base font-semibold text-emerald-400">{formatMYR(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <TrendingDown className="w-3 h-3 text-rose-400" /> Expenses
                </p>
                <p className="text-base font-semibold text-rose-400">{formatMYR(totalExpense)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Net Flow</p>
                <p className={`text-base font-semibold ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatMYR(netCashFlow)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Budget Progress */}
          <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Monthly Budget</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-normal">Limit: RM</span>
                  <Input
                    type="number"
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    onBlur={() => setMonthlyBudget(parseFloat(budgetInput) || 3000)}
                    className="w-24 h-6 text-xs bg-[#111111] border-[#1F1F1F] py-0"
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress
                  value={budgetProgress}
                  className={`h-2 ${budgetProgress > 80 ? '[&>div]:bg-rose-500' : '[&>div]:bg-emerald-500'}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatMYR(totalExpense)} spent</span>
                  <span className={budgetProgress > 80 ? 'text-rose-400' : ''}>
                    {budgetProgress.toFixed(0)}% of {formatMYR(monthlyBudget)}
                  </span>
                </div>
                {budgetProgress > 80 && (
                  <p className="text-xs text-rose-400">⚠ Over 80% of monthly budget</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Chart */}
          {categoryData.length > 0 && (
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#888' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #1F1F1F', borderRadius: 8, fontSize: 12 }}
                      formatter={(value) => {
                        const num = typeof value === 'number' ? value : Number(value)
                        return [isNaN(num) ? 'RM 0.00' : `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, ''] as [string, string]
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {categoryData.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">No expense data to display</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
