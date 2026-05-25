import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div className="p-5 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="w-9 h-9 rounded-full bg-paper-hi border border-line flex items-center justify-center text-ink-soft">
          ←
        </Link>
        <h1 className="font-serif text-3xl font-medium text-ink">Settings</h1>
      </div>
      <p className="text-ink-mute text-sm">Settings coming in Phase 2.</p>
    </div>
  )
}
