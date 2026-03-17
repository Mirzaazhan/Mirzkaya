'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'

type AccountType = 'Bank' | 'Investment' | 'Crypto' | 'e-Wallet' | 'Cash' | 'Others'

const ACCOUNT_TYPES: AccountType[] = ['Bank', 'Investment', 'Crypto', 'e-Wallet', 'Cash', 'Others']

const TYPE_COLORS: Record<AccountType, string> = {
  Bank: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Investment: 'bg-green-500/20 text-green-400 border-green-500/30',
  Crypto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'e-Wallet': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Cash: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Others: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  current_value: number
  updated_at: string
}

type Snapshot = {
  id: string
  month: string
  total_value: number
}

function formatMYR(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

const emptyForm = { name: '', type: 'Bank' as AccountType, current_value: '' }

function AccountForm({ f, setF }: { f: typeof emptyForm; setF: (v: typeof emptyForm) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Account Name</Label>
        <Input
          placeholder="e.g. Maybank Savings"
          value={f.name}
          onChange={e => setF({ ...f, name: e.target.value })}
          className="bg-[#111111] border-[#1F1F1F] focus:border-[#333333]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Type</Label>
        <Select value={f.type} onValueChange={v => setF({ ...f, type: v as AccountType })}>
          <SelectTrigger className="bg-[#111111] border-[#1F1F1F] focus:border-[#333333]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0F0F0F] border-[#1F1F1F]">
            {ACCOUNT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Current Value (MYR)</Label>
        <Input
          type="number"
          placeholder="0.00"
          value={f.current_value}
          onChange={e => setF({ ...f, current_value: e.target.value })}
          className="bg-[#111111] border-[#1F1F1F] focus:border-[#333333]"
        />
      </div>
    </div>
  )
}

export default function NetWorthPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [accRes, snapRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('net_worth_snapshots').select('id, month, total_value').eq('user_id', user.id).order('month', { ascending: true }),
    ])

    const accs = accRes.data || []
    setAccounts(accs)
    setSnapshots(snapRes.data || [])

    // Upsert snapshot for current month
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const totalValue = accs.reduce((s, a) => s + (a.current_value || 0), 0)
    const existing = snapRes.data?.find(s => s.month === currentMonth)
    if (!existing) {
      await supabase.from('net_worth_snapshots').upsert({
        user_id: user.id,
        month: currentMonth,
        total_value: totalValue,
      }, { onConflict: 'user_id,month' })
      // Re-fetch snapshots
      const { data: newSnaps } = await supabase
        .from('net_worth_snapshots')
        .select('id, month, total_value')
        .eq('user_id', user.id)
        .order('month', { ascending: true })
      setSnapshots(newSnaps || [])
    } else if (Math.abs(existing.total_value - totalValue) > 0.01) {
      // Update current month snapshot
      await supabase
        .from('net_worth_snapshots')
        .update({ total_value: totalValue })
        .eq('id', existing.id)
      setSnapshots(prev => prev.map(s => s.month === currentMonth ? { ...s, total_value: totalValue } : s))
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const totalNetWorth = accounts.reduce((s, a) => s + (a.current_value || 0), 0)

  async function handleAdd() {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('accounts').insert({
      user_id: user.id,
      name: form.name,
      type: form.type,
      current_value: parseFloat(form.current_value),
    })
    setForm(emptyForm)
    setAddOpen(false)
    setSubmitting(false)
    await fetchData()
  }

  async function handleEdit() {
    if (!editTarget) return
    setSubmitting(true)
    await supabase.from('accounts').update({
      name: editForm.name,
      type: editForm.type,
      current_value: parseFloat(editForm.current_value),
      updated_at: new Date().toISOString(),
    }).eq('id', editTarget.id)
    setEditOpen(false)
    setEditTarget(null)
    setSubmitting(false)
    await fetchData()
  }

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    await fetchData()
  }

  function openEdit(acc: Account) {
    setEditTarget(acc)
    setEditForm({ name: acc.name, type: acc.type, current_value: String(acc.current_value) })
    setEditOpen(true)
  }

  const chartData = snapshots.map(s => ({
    month: s.month,
    value: s.total_value,
  }))

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
          <h1 className="text-2xl font-semibold">Net Worth</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All accounts combined</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger>
            <Button className="gap-2 bg-white text-black hover:bg-white/90 rounded-lg">
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0F0F0F] backdrop-blur-xl border-[#1F1F1F] rounded-xl max-w-sm">
            <DialogHeader>
              <DialogTitle>New Account</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <AccountForm f={form} setF={setForm} />
              <Button
                onClick={handleAdd}
                disabled={!form.name || !form.current_value || submitting}
                className="w-full bg-white text-black hover:bg-white/90 mt-4"
              >
                {submitting ? 'Saving...' : 'Save Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total Net Worth */}
      <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
        <CardContent className="pt-6 pb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Total Net Worth</p>
          <p className="text-4xl font-bold">{formatMYR(totalNetWorth)}</p>
          <p className="text-xs text-muted-foreground mt-2">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No accounts yet</p>
          <p className="text-xs mt-1 opacity-60">Add your first account to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {accounts.map(acc => (
            <Card key={acc.id} className="bg-[#111111] border-[#1F1F1F] rounded-xl group hover:border-[#2A2A2A] transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <Badge className={`text-xs border ${TYPE_COLORS[acc.type] || TYPE_COLORS.Others}`}>
                    {acc.type}
                  </Badge>
                  <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(acc)}
                      className="text-muted-foreground hover:text-white transition-colors p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium">{acc.name}</p>
                <p className="text-lg font-semibold mt-1">{formatMYR(acc.current_value)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(acc.updated_at).toLocaleDateString('en-MY')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#0F0F0F] backdrop-blur-xl border-[#1F1F1F] rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <AccountForm f={editForm} setF={setEditForm} />
            <Button
              onClick={handleEdit}
              disabled={!editForm.name || !editForm.current_value || submitting}
              className="w-full bg-white text-black hover:bg-white/90 mt-4"
            >
              {submitting ? 'Saving...' : 'Update Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Chart */}
      {chartData.length > 1 && (
        <>
          <Separator className="bg-[#1F1F1F]" />
          <Card className="bg-[#111111] border-[#1F1F1F] rounded-xl transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Net Worth History</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#888' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#888' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #1F1F1F', borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => {
                      const num = typeof value === 'number' ? value : Number(value)
                      return [isNaN(num) ? 'RM 0.00' : `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, ''] as [string, string]
                    }}
                    cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
