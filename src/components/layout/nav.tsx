'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, PieChart, TrendingUp, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/spending', label: 'Spending', icon: Wallet },
  { href: '/net-worth', label: 'Net Worth', icon: PieChart },
  { href: '/trading', label: 'Trading', icon: TrendingUp },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0A0A0A] border-r border-[#1F1F1F] px-3 py-6 fixed top-0 left-0 z-40">
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-7 h-7 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-foreground">Finance</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-[#1A1A1A] text-white font-medium border border-[#2A2A2A]'
                  : 'text-muted-foreground hover:text-white hover:bg-[#141414]'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-[#141414] transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </aside>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-[#1F1F1F] px-2 py-2 flex justify-around">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors',
              active ? 'text-white' : 'text-muted-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
