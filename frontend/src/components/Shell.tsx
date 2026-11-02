import { Camera, Hand, Languages, LayoutDashboard, MessageSquareText, ScanText, Settings } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { NAV_ITEMS } from '../lib/nav'

const ICONS: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  '/': LayoutDashboard,
  '/camera': Camera,
  '/assistant': MessageSquareText,
  '/text': ScanText,
  '/gestures': Hand,
  '/translator': Languages,
  '/settings': Settings,
}

export function Shell() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="border-line bg-panel order-2 border-t md:order-1 md:w-60 md:shrink-0 md:border-t-0 md:border-r">
        <div className="hidden items-center gap-3 px-6 py-7 md:flex">
          <span className="border-tally grid size-8 place-items-center rounded-full border-2" aria-hidden>
            <span className="bg-tally size-2.5 rounded-full" />
          </span>
          <span className="text-lg font-semibold tracking-tight">VisionMate</span>
        </div>
        <nav aria-label="Main" className="flex justify-around gap-1 p-2 md:flex-col md:justify-start md:px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.path]
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-raised text-text' : 'text-muted hover:text-text'
                  }`
                }
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                <span className="max-md:sr-only">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <main className="order-1 min-h-0 flex-1 overflow-y-auto px-5 py-8 md:order-2 md:px-12">
        <Outlet />
      </main>
    </div>
  )
}
