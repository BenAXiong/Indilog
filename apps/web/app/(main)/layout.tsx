import BottomNav from '@/components/nav/BottomNav'
import DesktopSidebar from '@/components/nav/DesktopSidebar'
import { LangDialectProvider } from '@/lib/context/LangDialectProvider'
import StudyDateSync from '@/components/StudyDateSync'
import BfcacheRefresh from '@/components/BfcacheRefresh'

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LangDialectProvider>
      <StudyDateSync />
      <BfcacheRefresh />
      <div className="min-h-screen bg-cream">
        <div className="lg:grid lg:grid-cols-[232px_1fr] lg:min-h-screen">
          <div className="hidden lg:block">
            <DesktopSidebar />
          </div>
          <main className="relative min-h-screen overflow-x-hidden">
            <div className="pb-32 lg:pb-10 scrollbar-hide">
              {children}
            </div>
            <BottomNav />
          </main>
        </div>
      </div>
    </LangDialectProvider>
  )
}
