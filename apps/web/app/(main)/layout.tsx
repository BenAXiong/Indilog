import BottomNav from '@/components/nav/BottomNav'
import DesktopSidebar from '@/components/nav/DesktopSidebar'

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="lg:grid lg:grid-cols-[232px_1fr] lg:min-h-screen">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <DesktopSidebar />
        </div>

        {/* Main content area */}
        <main className="relative min-h-screen overflow-x-hidden">
          <div className="pb-32 lg:pb-10 scrollbar-hide">
            {children}
          </div>

          {/* Mobile bottom nav */}
          <BottomNav />
        </main>
      </div>
    </div>
  )
}
