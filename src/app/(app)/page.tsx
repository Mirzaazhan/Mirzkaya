'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TrendingUp, TrendingDown, Wallet, BarChart3, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatMYR(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

function formatUSD(amount: number) {
  return `$${amount.toFixed(2)}`
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [monthlySpending, setMonthlySpending] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [netWorth, setNetWorth] = useState(0)
  const [todayPnL, setTodayPnL] = useState<number | null>(null)
  const [transactionCount, setTransactionCount] = useState(0)
  const [accountCount, setAccountCount] = useState(0)
  const [tradingBalance, setTradingBalance] = useState<number | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserName(user.email?.split('@')[0] || 'there')

      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      const [txRes, accRes, tradingRes, configRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', user.id)
          .gte('date', firstDay)
          .lte('date', lastDay),
        supabase
          .from('accounts')
          .select('current_value')
          .eq('user_id', user.id),
        supabase
          .from('trading_entries')
          .select('pnl, closing_balance, date')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(1),
        supabase
          .from('trading_config')
          .select('starting_balance')
          .eq('user_id', user.id)
          .single(),
      ])

      if (txRes.data) {
        const expenses = txRes.data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        const income = txRes.data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        setMonthlySpending(expenses)
        setMonthlyIncome(income)
        setTransactionCount(txRes.data.length)
      }

      if (accRes.data) {
        const total = accRes.data.reduce((s, a) => s + (a.current_value || 0), 0)
        setNetWorth(total)
        setAccountCount(accRes.data.length)
      }

      if (tradingRes.data && tradingRes.data.length > 0) {
        setTodayPnL(tradingRes.data[0].pnl)
        setTradingBalance(tradingRes.data[0].closing_balance)
      } else if (configRes.data) {
        setTradingBalance(configRes.data.starting_balance)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const netCashFlow = monthlyIncome - monthlySpending

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-[#A1A1AA] mb-1">{getGreeting()},</p>
        <h1 className="text-3xl font-bold text-[#F5F5F5] capitalize tracking-tight">{userName}</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">
          {new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <Separator className="bg-[#1F1F1F]" />

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Worth */}
        <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl col-span-1 md:col-span-1 transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              NET WORTH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#F5F5F5]">{formatMYR(netWorth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{accountCount} account{accountCount !== 1 ? 's' : ''} tracked</p>
          </CardContent>
        </Card>

        {/* Monthly Spending */}
        <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              THIS MONTH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-400">{formatMYR(monthlySpending)}</p>
            <p className="text-xs text-muted-foreground mt-1">spent · {transactionCount} transactions</p>
          </CardContent>
        </Card>

        {/* Trading */}
        <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              TRADING
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tradingBalance !== null ? (
              <>
                <p className="text-2xl font-bold text-[#F5F5F5]">{formatUSD(tradingBalance)}</p>
                {todayPnL !== null && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${todayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {todayPnL >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    Last entry P&L: {formatUSD(todayPnL)}
                  </p>
                )}
                {todayPnL === null && (
                  <p className="text-xs text-muted-foreground mt-1">No entries yet</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              INCOME (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-emerald-400">{formatMYR(monthlyIncome)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              EXPENSES (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-rose-400">{formatMYR(monthlySpending)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              NET CASH FLOW
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-semibold ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatMYR(netCashFlow)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module Quick Links */}
      <div>
        <p className="text-xs text-[#A1A1AA] uppercase tracking-widest text-xs font-medium mb-4">Modules</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/spending">
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl hover:bg-[#1A1A1A] hover:border-[#2A2A2A] transition-all duration-200 cursor-pointer h-full group">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <BarChart3 className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Spending Tracker</p>
                    <p className="text-xs text-muted-foreground">Transactions & budget</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
          <a href="/net-worth">
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl hover:bg-[#1A1A1A] hover:border-[#2A2A2A] transition-all duration-200 cursor-pointer h-full group">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <Wallet className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Net Worth</p>
                    <p className="text-xs text-muted-foreground">Accounts & history</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
          <a href="/trading">
            <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl hover:bg-[#1A1A1A] hover:border-[#2A2A2A] transition-all duration-200 cursor-pointer h-full group">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <TrendingUp className="w-4.5 h-4.5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Trading Journal</p>
                    <p className="text-xs text-muted-foreground">P&L & calendar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>
      </div>
    </div>
  )
}
