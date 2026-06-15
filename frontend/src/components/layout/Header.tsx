import { useNavigate } from '@tanstack/react-router'
import { Menu, Bell, Syringe, User, Package, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form'
import { Input } from '../ui/input'
import { useToast } from '../ui/use-toast'
import type { Notification } from '../../types'

type NotificationWithDescription = Notification & { description: string }

interface ApiNotification {
  id: string
  user_id: string
  event_type: string
  entity_id: string
  entity_table: string
  source_vaccine_room_id: string
  is_read: boolean
  read_at?: string
  created_at: string
  description: string
}

function mapApiNotification(a: ApiNotification): NotificationWithDescription {
  return {
    id: a.id,
    userId: a.user_id,
    eventType: a.event_type as Notification['eventType'],
    entityId: a.entity_id,
    entityTable: a.entity_table,
    sourceVaccineRoomId: a.source_vaccine_room_id,
    isRead: a.is_read,
    readAt: a.read_at,
    createdAt: a.created_at,
    description: a.description,
  }
}

const profileSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    jobTitle: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => !data.newPassword || data.newPassword === data.confirmPassword,
    { message: 'As senhas não coincidem', path: ['confirmPassword'] }
  )

type ProfileFormValues = z.infer<typeof profileSchema>

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

const ROLE_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  tecnico: 'Técnico',
}

const PAGE_SIZE = 10

interface HeaderProps {
  onMobileMenuClick: () => void
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { toast } = useToast()

  const [profileOpen, setProfileOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPage, setNotifPage] = useState(1)
  const [notifications, setNotifications] = useState<NotificationWithDescription[]>([])

  // Pre-load unread count on mount
  useEffect(() => {
    apiClient
      .get<{ data: ApiNotification[]; meta: unknown } | ApiNotification[]>('/notifications')
      .then((res) => {
        const items = Array.isArray(res) ? res : (res as { data: ApiNotification[] }).data
        setNotifications(items.map(mapApiNotification))
      })
      .catch(() => {/* silently ignore — bell just shows 0 */})
  }, [])

  // Reload when panel opens
  useEffect(() => {
    if (!notifOpen) return
    apiClient
      .get<{ data: ApiNotification[]; meta: unknown } | ApiNotification[]>('/notifications')
      .then((res) => {
        const items = Array.isArray(res) ? res : (res as { data: ApiNotification[] }).data
        setNotifications(items.map(mapApiNotification))
      })
      .catch(() => {})
  }, [notifOpen])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  function getEventIcon(type: string) {
    if (type === 'bottle_opening') return <Package className="h-4 w-4 text-blue-600" />
    if (type === 'bottle_discard') return <Trash2 className="h-4 w-4 text-orange-600" />
    return <Bell className="h-4 w-4 text-muted-foreground" />
  }

  async function handleMarkRead(notif: NotificationWithDescription) {
    if (notif.isRead) return
    await apiClient.put(`/notifications/${notif.id}/read`, {})
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    )
  }

  async function handleMarkAllRead() {
    await apiClient.put('/notifications/read-all', {})
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    toast({ title: 'Todas as notificações foram marcadas como lidas.' })
  }

  const paginatedNotifs = sortedNotifications.slice(0, notifPage * PAGE_SIZE)
  const hasMore = paginatedNotifs.length < sortedNotifications.length

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: currentUser?.name ?? '',
      jobTitle: currentUser?.jobTitle ?? '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
  }

  function handleOpenProfile() {
    form.reset({
      name: currentUser?.name ?? '',
      jobTitle: currentUser?.jobTitle ?? '',
      newPassword: '',
      confirmPassword: '',
    })
    setProfileOpen(true)
  }

  async function onSubmit(values: ProfileFormValues) {
    if (!currentUser) return
    setSaving(true)
    try {
      await apiClient.put(`/users/${currentUser.id}`, {
        name: values.name,
        job_title: values.jobTitle ?? '',
      })
      setCurrentUser({ ...currentUser, name: values.name, jobTitle: values.jobTitle ?? '' })
      setProfileOpen(false)
      toast({ title: 'Perfil atualizado com sucesso' })
    } catch {
      toast({ title: 'Erro ao salvar perfil. Tente novamente.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-card px-4 gap-3">
      {/* Hamburger — mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMobileMenuClick}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo — visible on mobile (desktop shows in sidebar) */}
      <div className="flex items-center gap-2 lg:hidden">
        <Syringe className="h-5 w-5" style={{ color: '#1A2F7C' }} />
        <span className="font-bold text-base" style={{ color: '#1A2F7C' }}>
          Imunize-Me
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification bell */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          onClick={() => { setNotifPage(1); setNotifOpen(true) }}
        >
          <Bell className="h-5 w-5" />
        </Button>
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center px-1 text-[10px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </div>

      {/* User avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu do usuário">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {currentUser ? getInitials(currentUser.name) : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {currentUser?.name ?? 'Usuário'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {currentUser ? ROLE_LABELS[currentUser.role] ?? currentUser.role : ''}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleOpenProfile}>
            Meu perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleLogout}
          >
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Notifications Sheet ──────────────────────────────────────────── */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] flex flex-col p-0"
        >
          <SheetHeader className="flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <SheetTitle className="text-base">Notificações</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700 me-3"
                onClick={handleMarkAllRead}
              >
                Marcar todas como lidas
              </Button>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {sortedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <ul>
                {paginatedNotifs.map((notif) => (
                  <li
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMarkRead(notif)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleMarkRead(notif) }}
                    className={`flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                      notif.isRead ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Event icon */}
                    <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {getEventIcon(notif.eventType)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{notif.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <div className="flex justify-center py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setNotifPage((p) => p + 1)}
                >
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Profile edit Sheet ───────────────────────────────────────────── */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="max-w-md w-full">
          <SheetHeader>
            <SheetTitle>Meu perfil</SheetTitle>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Seu nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Seu cargo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha (opcional)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Deixe em branco para não alterar" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Repita a nova senha" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-2 flex gap-2">
                <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </header>
  )
}
