import { useNavigate, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard,
  FlaskConical,
  Trash2,
  Activity,
  Package,
  Syringe,
  MapPin,
  DoorOpen,
  Users,
  UserCog,
  BookOpen,
  BookX,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/auth'
import { useSidebarStore } from '../../stores/sidebar'
import type { UserRole } from '../../types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '../ui/sheet'

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  allowedRoles?: UserRole[]
}

interface NavGroup {
  title: string
  items: NavItem[]
  requiresAdmin?: boolean
  hiddenFromTecnico?: boolean
}

const NAV_STANDALONE: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
]

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operações',
    items: [
      { label: 'Aberturas', path: '/operacoes/aberturas', icon: FlaskConical },
      { label: 'Descartes', path: '/operacoes/descartes', icon: Trash2 },
      { label: 'Monitoramento', path: '/operacoes/monitoramento', icon: Activity },
    ],
  },
  {
    title: 'Estoque',
    items: [
      { label: 'Lotes', path: '/estoque/lotes', icon: Package },
      { label: 'Vacinas', path: '/estoque/vacinas', icon: Syringe },
    ],
  },
  {
    title: 'Estrutura',
    hiddenFromTecnico: true,
    items: [
      { label: 'UBSs e Locais', path: '/estrutura/locais', icon: MapPin, allowedRoles: ['administrador', 'gestor'] },
      { label: 'Salas de Vacina', path: '/estrutura/salas', icon: DoorOpen, allowedRoles: ['administrador', 'gestor'] },
      { label: 'Equipe', path: '/estrutura/equipe', icon: Users, allowedRoles: ['administrador'] },
    ],
  },
  {
    title: 'Configurações',
    requiresAdmin: true,
    items: [
      { label: 'Usuários', path: '/configuracoes/usuarios', icon: UserCog },
      { label: 'Motivos de Abertura', path: '/configuracoes/motivos-abertura', icon: BookOpen },
      { label: 'Motivos de Descarte', path: '/configuracoes/motivos-descarte', icon: BookX },
      { label: 'Parâmetros', path: '/configuracoes/parametros', icon: Settings },
    ],
  },
]

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  tecnico: 'Técnico',
}

// ─── Nav item component ───────────────────────────────────────────────────────

function NavItemLink({
  item,
  collapsed,
  onClick,
}: {
  item: NavItem
  collapsed: boolean
  onClick?: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive =
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  const Icon = item.icon

  const button = (
    <button
      onClick={() => {
        navigate({ to: item.path })
        onClick?.()
      }}
      className={cn(
        'flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors cursor-pointer',
        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        'hover:bg-accent hover:text-accent-foreground',
        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return button
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const role = currentUser?.role

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
      {NAV_STANDALONE.map((item) => (
        <NavItemLink
          key={item.path}
          item={item}
          collapsed={collapsed}
          onClick={onNavigate}
        />
      ))}

      {NAV_GROUPS.map((group) => {
        if (group.hiddenFromTecnico && role === 'tecnico') return null
        if (group.requiresAdmin && role !== 'administrador') return null

        const visibleItems = group.items.filter(
          (item) => !item.allowedRoles || !role || item.allowedRoles.includes(role)
        )
        if (visibleItems.length === 0) return null

        return (
          <div key={group.title} className="pt-4">
            {!collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.title}
              </p>
            )}
            {collapsed && <div className="border-t border-border my-2" />}
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <NavItemLink
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

// ─── Sidebar footer ───────────────────────────────────────────────────────────

function SidebarFooter({
  collapsed,
  onLogout,
}: {
  collapsed: boolean
  onLogout?: () => void
}) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
    onLogout?.()
  }

  const initials = currentUser?.name
    ? currentUser.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '?'

  const logoutButton = (
    <button
      onClick={handleLogout}
      className={cn(
        'flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors cursor-pointer',
        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        'hover:bg-destructive/10 hover:text-destructive text-muted-foreground'
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">Sair da conta</span>}
    </button>
  )

  return (
    <div className="shrink-0 border-t px-2 py-3 space-y-1">
      {/* User info — só quando expandido */}
      {!collapsed && currentUser && (
        <div className="flex items-center gap-3 px-3 py-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {ROLE_LABEL[currentUser.role] ?? currentUser.role}
            </p>
          </div>
        </div>
      )}

      {/* Logout */}
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
          <TooltipContent side="right">Sair da conta</TooltipContent>
        </Tooltip>
      ) : (
        logoutButton
      )}
    </div>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar() {
  const { collapsed, toggle } = useSidebarStore()

  const toggleButton = (
    <button
      onClick={toggle}
      className={cn(
        'flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors cursor-pointer',
        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
      )}
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed
        ? <ChevronRight className="h-4 w-4 shrink-0" />
        : <ChevronLeft className="h-4 w-4 shrink-0" />
      }
      {!collapsed && <span className="truncate">Recolher menu</span>}
    </button>
  )

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 border-r bg-card transition-all duration-300 overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center border-b h-14 shrink-0 px-4 gap-2 m-auto">
        <img src="/logo.svg" width={25} style={{display: "block", margin: "auto"}} alt="Imunize-Me logo" />
        {!collapsed && (
          <span className="font-bold text-base truncate" style={{ color: '#1A2F7C' }}>
            Imunize-Me
          </span>
        )}
      </div>

      <TooltipProvider delayDuration={0}>
        {/* Toggle — no topo da pilha quando collapsed, inline quando expanded */}
        <div className="shrink-0 px-2 pt-3 pb-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          ) : (
            toggleButton
          )}
        </div>

        <SidebarNav collapsed={collapsed} />

        <SidebarFooter collapsed={collapsed} />
      </TooltipProvider>
    </aside>
  )
}

// ─── Mobile sheet sidebar ─────────────────────────────────────────────────────

function MobileSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
        <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
        <div className="flex items-center gap-2 border-b h-14 px-4">
          <img src="/logo.svg" width={25} style={{display: "block", margin: "auto"}} alt="Imunize-Me logo" />
          <span className="font-bold text-base" style={{ color: '#1A2F7C' }}>
            Imunize-Me
          </span>
        </div>
        <TooltipProvider delayDuration={0}>
          <SidebarNav collapsed={false} onNavigate={onClose} />
          <SidebarFooter collapsed={false} onLogout={onClose} />
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

interface SidebarProps {
  isMobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar isOpen={isMobileOpen} onClose={onMobileClose} />
    </>
  )
}
