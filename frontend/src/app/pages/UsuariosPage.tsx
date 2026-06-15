import { useEffect, useState, useCallback } from 'react'
import { Pencil, Plus, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import type { User, UserRole, PaginatedMeta, PaginatedResponse } from '../../types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet'
import { Skeleton } from '../../components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { useToast } from '../../components/ui/use-toast'
import { useTableSort } from '../../hooks/useTableSort'
import { formatDateBR } from '../../lib/utils'

// API response shape (snake_case)
interface ApiUser {
  id: string
  name: string
  email: string
  role: UserRole
  job_title?: string
  is_active: boolean
  created_at: string
}

function mapApiUser(u: ApiUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jobTitle: u.job_title,
    isActive: u.is_active,
    createdAt: u.created_at,
  }
}

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  tecnico: 'Técnico',
}

const PAGE_SIZE = 20

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

interface CreateFormState {
  name: string
  email: string
  password: string
  jobTitle: string
  role: UserRole | ''
}

interface EditFormState {
  name: string
  email: string
  password: string
  jobTitle: string
  role: UserRole | ''
}

const INITIAL_FORM: CreateFormState = {
  name: '',
  email: '',
  password: '',
  jobTitle: '',
  role: '',
}

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { detail?: string; message?: string }
    return body.detail ?? body.message ?? fallback
  } catch {
    return fallback
  }
}

export default function UsuariosPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)

  // Filter + pagination
  const [filter, setFilter] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilter(filter)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [filter])

  const fetchUsers = useCallback(async (p: number, search: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiUser>>(`/users?${params}`)
      setUsers(res.data.map(mapApiUser))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsers(page, debouncedFilter)
  }, [page, debouncedFilter, fetchUsers])

  // Create sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit sheet
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', email: '', password: '', jobTitle: '', role: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Toggle dialog
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)
  const [toggling, setToggling] = useState(false)

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(users)

  // Access guard
  if (currentUser?.role !== 'administrador') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    )
  }

  function handleFilterChange(value: string) {
    setFilter(value)
  }

  // Create user
  async function handleCreate() {
    setFormError('')
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.role) {
      setFormError('Preencha todos os campos obrigatórios.')
      return
    }
    setSaving(true)
    try {
      await apiClient.post('/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        ...(form.jobTitle.trim() ? { job_title: form.jobTitle.trim() } : {}),
      })
      toast({ title: 'Usuário criado com sucesso.' })
      setSheetOpen(false)
      setForm(INITIAL_FORM)
      await fetchUsers(page, debouncedFilter)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 409) {
          setFormError('Já existe um usuário com este e-mail.')
        } else if (err.status === 422) {
          const msg = await getApiErrorMessage(err, 'Dados inválidos. Verifique os campos e tente novamente.')
          setFormError(msg)
        } else {
          setFormError('Erro ao criar usuário. Tente novamente.')
        }
      } else {
        setFormError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  // Toggle active/inactive
  async function handleToggle() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      await apiClient.put(`/users/${toggleTarget.id}`, { is_active: !toggleTarget.isActive })
      toast({
        title: toggleTarget.isActive
          ? `Usuário "${toggleTarget.name}" desativado.`
          : `Usuário "${toggleTarget.name}" ativado.`,
      })
      setToggleTarget(null)
      await fetchUsers(page, debouncedFilter)
    } catch {
      toast({ title: 'Erro ao atualizar situação do usuário.', variant: 'destructive' })
      setToggleTarget(null)
    } finally {
      setToggling(false)
    }
  }

  function openEdit(u: User) {
    setEditTarget(u)
    setEditForm({ name: u.name, email: u.email, password: '', jobTitle: u.jobTitle ?? '', role: u.role })
    setEditError('')
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.role) {
      setEditError('Preencha todos os campos obrigatórios.')
      return
    }
    setEditSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        job_title: editForm.jobTitle.trim() || null,
      }
      if (editForm.password) {
        body.password = editForm.password
      }
      await apiClient.put(`/users/${editTarget.id}`, body)
      toast({ title: 'Usuário atualizado com sucesso.' })
      setEditTarget(null)
      await fetchUsers(page, debouncedFilter)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 409) {
          setEditError('Já existe outro usuário com este e-mail.')
        } else if (err.status === 422) {
          const msg = await getApiErrorMessage(err, 'Dados inválidos. Verifique os campos e tente novamente.')
          setEditError(msg)
        } else {
          setEditError('Erro ao atualizar usuário. Tente novamente.')
        }
      } else {
        setEditError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários do sistema.</p>
        </div>
        <Button onClick={() => { setForm(INITIAL_FORM); setFormError(''); setSheetOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo usuário
        </Button>
      </div>

      {/* Filter */}
      <Input
        placeholder="Filtrar por nome, e-mail, cargo, perfil ou situação…"
        value={filter}
        onChange={(e) => handleFilterChange(e.target.value)}
        className="max-w-md"
      />

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                <span className="flex items-center gap-1">Nome {sortKey === 'name' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'name' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                <span className="flex items-center gap-1">E-mail {sortKey === 'email' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'email' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('jobTitle')}>
                <span className="flex items-center gap-1">Cargo {sortKey === 'jobTitle' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'jobTitle' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('role')}>
                <span className="flex items-center gap-1">Perfil {sortKey === 'role' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'role' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('isActive')}>
                <span className="flex items-center gap-1">Situação {sortKey === 'isActive' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'isActive' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                <span className="flex items-center gap-1">Data de cadastro {sortKey === 'createdAt' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'createdAt' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {filter ? 'Nenhum usuário encontrado para o filtro aplicado.' : 'Nenhum usuário cadastrado.'}
                    </p>
                    {!filter && (
                      <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                        Criar primeiro usuário
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{u.jobTitle ?? '—'}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}
                      className={u.isActive ? 'bg-green-600 hover:bg-green-600' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateBR(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(u)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setToggleTarget(u)}
                      >
                        {u.isActive ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} usuário{meta.total !== 1 ? 's' : ''} • página {meta.page} de {meta.total_pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.has_prev}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.has_next}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Novo usuário</SheetTitle>
            <SheetDescription>Preencha os dados para cadastrar um novo usuário.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Maria Clara"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jobTitle">Cargo</Label>
              <Input
                id="jobTitle"
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder="Ex: Enfermeira"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Perfil *</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar usuário'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar usuário</SheetTitle>
            <SheetDescription>Edite os dados do usuário. Deixe a senha em branco para mantê-la.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Nome completo *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Maria Clara"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">E-mail *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-password">Nova senha</Label>
              <Input
                id="edit-password"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Em branco = manter senha atual"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-jobTitle">Cargo</Label>
              <Input
                id="edit-jobTitle"
                value={editForm.jobTitle}
                onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder="Ex: Enfermeira"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-role">Perfil *</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Toggle confirmation dialog */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => { if (!open) setToggleTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.isActive ? 'Desativar usuário' : 'Ativar usuário'}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.isActive
                ? `Tem certeza que deseja desativar "${toggleTarget?.name}"? O usuário não conseguirá acessar o sistema.`
                : `Tem certeza que deseja ativar "${toggleTarget?.name}"? O usuário poderá acessar o sistema novamente.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)} disabled={toggling}>
              Cancelar
            </Button>
            <Button
              variant={toggleTarget?.isActive ? 'destructive' : 'default'}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling ? 'Aguarde…' : toggleTarget?.isActive ? 'Desativar' : 'Ativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
