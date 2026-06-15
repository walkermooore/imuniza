import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import Sidebar from '../../components/layout/Sidebar'
import Header from '../../components/layout/Header'
import { useSidebarStore } from '../../stores/sidebar'
import { cn } from '../../lib/utils'

export default function AuthLayout() {
  const [isMobileOpen, setMobileOpen] = useState(false)
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={cn('flex flex-col transition-all duration-300', collapsed ? 'lg:pl-16' : 'lg:pl-64')}
      >
        <Header onMobileMenuClick={() => setMobileOpen(true)} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
