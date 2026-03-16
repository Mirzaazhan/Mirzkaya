'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Flame, Target } from 'lucide-react'

type TradingEntry = {
  id: string
  user_id: string
  date: string
  closing_balance: number
  num_trades: number | null
  notes: string | null
  strategy_tag: string | null
  pnl: number | null
  created_at: string
}

type TradingConfig = {
  id: string
  user_id: string
  starting_balance: number
  created_at: string
}

function formatUSD(amount: number) {
  return `$${amount.toFixed(2)}`
}

// Get Mon–Fri dates for a given year/month
function getWeekdaysOfMonth(year: number, month: number): (Date | null)[] {
  const days: (Date | null)[] = []
  const firstDay = new Date(year, month, 1)
  // Pad start: Mon=0,...,Fri=4, Sat=5,Sun=6 in our grid (Mon-first)
  // day.getDay(): 0=Sun,1=Mon,...,5=Fri,6=Sat
  const dayOfWeek = firstDay.getDay() // 0=Sun
  // Convert to Mon-first: Mon=0,Tue=1,...,Fri=4
  const mondayFirst = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  // Only fill Mon-Fri columns (0-4), so we need to find the col of the first day
  // We'll build a 5-column grid (Mon-Fri only), adding null for empty cells

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // We iterate through each day of the month
  // Build array of weekday dates (Mon-Fri only), with nulls for padding
  const result: (Date | null)[] = []
  let padded = false
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay() // 0=Sun,6=Sat
    if (dow === 0 || dow === 6) continue // skip weekends
    if (!padded) {
      // Pad with nulls: Mon=1,Tue=2,...,Fri=5 → col index 0-4
      const col = dow - 1 // Mon=0,...,Fri=4
      for (let i = 0; i < col; i++) result.push(null)
      padded = true
    }
    result.push(date)
  }
  return result
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function TradingPage() {
  const supabase = createClient()
  const [config, setConfig] = useState<TradingConfig | null>(null)
  const [entries, setEntries] = useState<TradingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startingBalanceInput, setStartingBalanceInput] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [entryForm, setEntryForm] = useState({
    closing_balance: '',
    num_trades: '',
    strategy_tag: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [configRes, entriesRes] = await Promise.all([
      supabase.from('trading_config').select('*').eq('user_id', user.id).single(),
      supabase.from('trading_entries').select('*').eq('user_id', user.id).order('date', { ascending: true }),
    ])

    setConfig(configRes.data || null)
    setEntries(entriesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleSaveConfig() {
    setSavingConfig(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('trading_config').insert({
      user_id: user.id,
      starting_balance: parseFloat(startingBalanceInput),
    })
    setSavingConfig(false)
    await fetchData()
  }

  // Build entry map: date string -> entry
  const entryMap = useMemo(() => {
    const map: Record<string, TradingEntry> = {}
    entries.forEach(e => { map[e.date] = e })
    return map
  }, [entries])

  // Month calendar days (weekdays only)
  const calendarDays = useMemo(() => getWeekdaysOfMonth(viewYear, viewMonth), [viewYear, viewMonth])

  // Latest entry for current balance
  const latestEntry = useMemo(() => {
    if (entries.length === 0) return null
    return entries[entries.length - 1]
  }, [entries])

  const currentBalance = latestEntry ? latestEntry.closing_balance : config?.starting_balance ?? 0
  const totalPnL = config ? currentBalance - config.starting_balance : 0

  // Monthly stats
  const monthEntries = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    return entries.filter(e => e.date.startsWith(prefix))
  }, [entries, viewYear, viewMonth])

  const monthPnL = monthEntries.reduce((s, e) => s + (e.pnl || 0), 0)
  const profitableDays = monthEntries.filter(e => (e.pnl || 0) > 0).length
  const winRate = monthEntries.length > 0 ? (profitableDays / monthEntries.length) * 100 : 0
  const bestDay = monthEntries.length > 0 ? Math.max(...monthEntries.map(e => e.pnl || 0)) : 0
  const worstDay = monthEntries.length > 0 ? Math.min(...monthEntries.map(e => e.pnl || 0)) : 0

  // Profitable days streak (from latest entry backwards)
  const streak = useMemo(() => {
    let count = 0
    for (let i = entries.length - 1; i >= 0; i--) {
      if ((entries[i].pnl || 0) > 0) count++
      else break
    }
    return count
  }, [entries])

  function openDayDialog(date: Date) {
    const dateStr = date.toISOString().split('T')[0]
    setSelectedDate(dateStr)
    const existing = entryMap[dateStr]
    if (existing) {
      setEntryForm({
        closing_balance: String(existing.closing_balance),
        num_trades: String(existing.num_trades ?? ''),
        strategy_tag: existing.strategy_tag ?? '',
        notes: existing.notes ?? '',
      })
    } else {
      setEntryForm({ closing_balance: '', num_trades: '', strategy_tag: '', notes: '' })
    }
    setDialogOpen(true)
  }

  async function handleSaveEntry() {
    if (!selectedDate || !config) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const closingBalance = parseFloat(entryForm.closing_balance)

    // Find previous balance
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    const prevEntry = sortedEntries.filter(e => e.date < selectedDate).pop()
    const prevBalance = prevEntry ? prevEntry.closing_balance : config.starting_balance
    const pnl = closingBalance - prevBalance

    const existing = entryMap[selectedDate]
    if (existing) {
      await supabase.from('trading_entries').update({
        closing_balance: closingBalance,
        num_trades: entryForm.num_trades ? parseInt(entryForm.num_trades) : null,
        strategy_tag: entryForm.strategy_tag || null,
        notes: entryForm.notes || null,
        pnl,
      }).eq('id', existing.id)
    } else {
      await supabase.from('trading_entries').insert({
        user_id: user.id,
        date: selectedDate,
        closing_balance: closingBalance,
        num_trades: entryForm.num_trades ? parseInt(entryForm.num_trades) : null,
        strategy_tag: entryForm.strategy_tag || null,
        notes: entryForm.notes || null,
        pnl,
      })
    }

    // Recalculate pnl for all entries after this date
    const allSorted = [...entries.filter(e => e.date !== selectedDate), {
      id: existing?.id || 'new',
      user_id: user.id,
      date: selectedDate,
      closing_balance: closingBalance,
      pnl,
      num_trades: entryForm.num_trades ? parseInt(entryForm.num_trades) : null,
      strategy_tag: entryForm.strategy_tag || null,
      notes: entryForm.notes || null,
      created_at: new Date().toISOString(),
    }].sort((a, b) => a.date.localeCompare(b.date))

    for (let i = 0; i < allSorted.length; i++) {
      const e = allSorted[i]
      if (e.date > selectedDate) {
        const prev = allSorted[i - 1]
        const newPnl = e.closing_balance - (prev ? prev.closing_balance : config.starting_balance)
        if (newPnl !== e.pnl) {
          await supabase.from('trading_entries').update({ pnl: newPnl }).eq('id', e.id)
        }
      }
    }

    setDialogOpen(false)
    setSubmitting(false)
    await fetchData()
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  // Setup screen
  if (!config) {
    return (
      <div className="p-6 max-w-md mx-auto flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-orange-400" />
          </div>
          <h1 className="text-2xl font-semibold">Set Up Trading Journal</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter your starting balance to begin tracking your trades.</p>
        </div>
        <Card className="w-full bg-white/5 border-white/10 rounded-xl">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Starting Balance (USD)</Label>
              <Input
                type="number"
                placeholder="e.g. 1000.00"
                value={startingBalanceInput}
                onChange={e => setStartingBalanceInput(e.target.value)}
                className="bg-white/5 border-white/10 text-lg"
              />
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={!startingBalanceInput || savingConfig}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {savingConfig ? 'Saving...' : 'Start Tracking'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Trading Journal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track your daily P&L</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white/5 border-white/10 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
            <p className="text-xl font-semibold">{formatUSD(currentBalance)}</p>
          </CardContent>
        </Card>
        <Card className={`border-white/10 rounded-xl ${totalPnL >= 0 ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
            <p className={`text-xl font-semibold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatUSD(totalPnL)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" /> Streak
            </p>
            <p className="text-xl font-semibold">{streak} day{streak !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Starting Balance</p>
            <p className="text-xl font-semibold">{formatUSD(config.starting_balance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card className="bg-white/5 border-white/10 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <div className="flex gap-1">
                  <button
                    onClick={prevMonth}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                {WEEKDAY_HEADERS.map(h => (
                  <div key={h} className="text-center text-xs text-muted-foreground py-1 font-medium">{h}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-5 gap-1.5">
                {calendarDays.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} />
                  }
                  const dateStr = date.toISOString().split('T')[0]
                  const entry = entryMap[dateStr]
                  const isToday = dateStr === today.toISOString().split('T')[0]
                  const isPast = date <= today
                  const pnl = entry?.pnl ?? null

                  return (
                    <button
                      key={dateStr}
                      onClick={() => isPast && openDayDialog(date)}
                      disabled={!isPast}
                      className={`
                        relative flex flex-col items-center justify-center rounded-lg py-2.5 text-xs transition-colors
                        ${isPast ? 'hover:bg-white/10 cursor-pointer' : 'opacity-30 cursor-default'}
                        ${isToday ? 'ring-1 ring-white/30' : ''}
                        ${entry
                          ? pnl !== null && pnl > 0
                            ? 'bg-green-500/10 border border-green-500/20'
                            : pnl !== null && pnl < 0
                              ? 'bg-red-500/10 border border-red-500/20'
                              : 'bg-white/5 border border-white/10'
                          : 'bg-white/[0.02] border border-white/5'
                        }
                      `}
                    >
                      <span className={`font-medium text-xs ${isToday ? 'text-white' : 'text-muted-foreground'}`}>
                        {date.getDate()}
                      </span>
                      {entry && pnl !== null ? (
                        <span className={`text-[10px] font-semibold mt-0.5 ${pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {pnl > 0 ? '+' : ''}{pnl.toFixed(0)}
                        </span>
                      ) : isPast ? (
                        <span className="text-[10px] text-white/20 mt-0.5">—</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary */}
        <div className="space-y-3">
          <Card className="bg-white/5 border-white/10 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">This Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Total P&L</p>
                <p className={`text-sm font-semibold ${monthPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {monthPnL >= 0 ? '+' : ''}{formatUSD(monthPnL)}
                </p>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="w-3 h-3" /> Win Rate
                </p>
                <p className="text-sm font-semibold">{winRate.toFixed(0)}%</p>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Days Traded</p>
                <p className="text-sm font-semibold">{monthEntries.length}</p>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-400" /> Best Day
                </p>
                <p className="text-sm font-semibold text-green-400">
                  {monthEntries.length > 0 ? `+${formatUSD(bestDay)}` : '—'}
                </p>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-400" /> Worst Day
                </p>
                <p className="text-sm font-semibold text-red-400">
                  {monthEntries.length > 0 ? formatUSD(worstDay) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Entries */}
          {entries.length > 0 && (
            <Card className="bg-white/5 border-white/10 rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...entries].reverse().slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      {e.strategy_tag && <p className="text-[10px] text-muted-foreground">{e.strategy_tag}</p>}
                    </div>
                    <p className={`text-xs font-semibold ${(e.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(e.pnl || 0) >= 0 ? '+' : ''}{formatUSD(e.pnl || 0)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111] border-white/10 rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Entry'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {entryMap[selectedDate || ''] && (
              <div className={`px-3 py-2 rounded-lg text-xs font-medium ${(entryMap[selectedDate!]?.pnl || 0) >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                Recorded P&L: {(entryMap[selectedDate!]?.pnl || 0) >= 0 ? '+' : ''}{formatUSD(entryMap[selectedDate!]?.pnl || 0)}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Closing Balance (USD) *</Label>
              <Input
                type="number"
                placeholder="e.g. 1050.00"
                value={entryForm.closing_balance}
                onChange={e => setEntryForm(f => ({ ...f, closing_balance: e.target.value }))}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Number of Trades</Label>
              <Input
                type="number"
                placeholder="Optional"
                value={entryForm.num_trades}
                onChange={e => setEntryForm(f => ({ ...f, num_trades: e.target.value }))}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Strategy Tag</Label>
              <Input
                placeholder="e.g. Breakout, Scalp, Swing"
                value={entryForm.strategy_tag}
                onChange={e => setEntryForm(f => ({ ...f, strategy_tag: e.target.value }))}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                placeholder="How did the session go?"
                value={entryForm.notes}
                onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-white/5 border-white/10 resize-none"
                rows={3}
              />
            </div>
            <Button
              onClick={handleSaveEntry}
              disabled={!entryForm.closing_balance || submitting}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {submitting ? 'Saving...' : entryMap[selectedDate || ''] ? 'Update Entry' : 'Save Entry'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
