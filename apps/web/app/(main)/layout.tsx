import BottomNav from '@/components/nav/BottomNav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-cream overflow-x-hidden">
      <div className="overflow-y-auto pb-32 scrollbar-hide">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
