import { Sidebar, BottomNav } from '@/components/layout/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:pl-56 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
