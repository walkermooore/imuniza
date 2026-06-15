import { useCallback, useEffect, useState } from 'react'
import { Link2Off, Pencil, Plus, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import { apiClient } from '../../lib/api-client'
import type { ManagerLocation, TechnicianRoom, PaginatedResponse, User, Location } from '../../types'
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
import { AsyncCombobox, type ComboboxOption } from '../../components/ui/async-combobox'

const PAGE_SIZE = 20

// ─── API types ───────────────────────────────────────────────────────────────

interface ApiUser {
  id: string
  name: string
  email: string
  role: string
  job_title?: string
  is_active: boolean
  created_at: string
}

interface ApiLocation {
  id: string
  name: string
  address: string
  type: string
  is_deleted: boolean
  created_at: string
}

interface ApiManagerLocation {
  id: string
  user_id: string
  location_id: string
  is_deleted: boolean
  created_at: string
}

interface ApiTechnicianRoom {
  id: string
  user_id: string
  vaccine_room_id: string
  is_deleted: boolean
  created_at: string
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapApiUser(a: ApiUser): User {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role as User['role'],
    jobTitle: a.job_title,
    isActive: a.is_active,
    createdAt: a.created_at,
  }
}

function mapApiLocation(a: ApiLocation): Location {
  return {
    id: a.id,
    name: a.name,
    address: a.address,
    type: a.type as Location['type'],
    isDeleted: a.is_deleted,
    createdAt: a.created_at,
  }
}

function mapApiManagerLocation(a: ApiManagerLocation): ManagerLocation {
  return {
    id: a.id,
    userId: a.user_id,
    locationId: a.location_id,
    isDeleted: a.is_deleted,
    createdAt: a.created_at,
  }
}

function mapApiTechnicianRoom(a: ApiTechnicianRoom): TechnicianRoom {
  return {
    id: a.id,
    userId: a.user_id,
    vaccineRoomId: a.vaccine_room_id,
    isDeleted: a.is_deleted,
    createdAt: a.created_at,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ─── Gestores por UBS ────────────────────────────────────────────────────────

function GestoresTab() {
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [bindings, setBindings] = useState<ManagerLocation[]>([])
  const [meta, setMeta] = useState({ total: 0, total_pages: 1, page: 1, has_prev: false, has_next: false })
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [formUserId, setFormUserId] = useState('')
  const [formLocationId, setFormLocationId] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [editTarget, setEditTarget] = useState<ManagerLocation | null>(null)
  const [editLocationId, setEditLocationId] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ManagerLocation | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    const res = await apiClient.get<PaginatedResponse<ApiUser>>('/users?page=1&page_size=20')
    setUsers(res.data.map(mapApiUser).filter((u) => u.isActive))
  }, [])

  const fetchLocations = useCallback(async () => {
    const res = await apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20')
    setLocations(res.data.map(mapApiLocation).filter((l) => !l.isDeleted))
  }, [])

  const fetchBindings = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<PaginatedResponse<ApiManagerLocation>>(
        `/manager-locations?page=${p}&page_size=${PAGE_SIZE}`
      )
      setBindings(res.data.map(mapApiManagerLocation))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsers()
    void fetchLocations()
  }, [fetchUsers, fetchLocations])

  useEffect(() => {
    void fetchBindings(page)
  }, [fetchBindings, page])

  const fetchUsersOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit), role: 'gestor' })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiUser>>(`/users?${params}`)
      return res.data.filter(u => u.is_active).map(u => ({ value: u.id, label: u.name }))
    } catch { return [] }
  }, [])

  const fetchLocationsOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiLocation>>(`/locations?${params}`)
      return res.data.filter(l => !l.is_deleted).map(l => ({ value: l.id, label: l.name }))
    } catch { return [] }
  }, [])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const locationMap = new Map(locations.map((l) => [l.id, l]))

  const q = filter.toLowerCase()
  const filtered = bindings
    .filter((ml) => {
      const user = userMap.get(ml.userId)
      const loc = locationMap.get(ml.locationId)
      return (
        (user?.name ?? ml.userId).toLowerCase().includes(q) ||
        (loc?.name ?? ml.locationId).toLowerCase().includes(q)
      )
    })
    .map((ml) => ({
      ...ml,
      userName: userMap.get(ml.userId)?.name ?? '',
      locationName: locationMap.get(ml.locationId)?.name ?? '',
    }))

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered)

  function handleFilterChange(value: string) {
    setFilter(value)
  }

  function openSheet() {
    setFormUserId('')
    setFormLocationId('')
    setFormError('')
    setSheetOpen(true)
  }

  async function handleCreate() {
    setFormError('')
    if (!formUserId || !formLocationId) {
      setFormError('Selecione o gestor e a UBS.')
      return
    }
    setSaving(true)
    try {
      await apiClient.post<{ success: boolean; data: ApiManagerLocation }>('/manager-locations', {
        user_id: formUserId,
        location_id: formLocationId,
      })
      toast({ title: 'Vínculo criado com sucesso.' })
      setSheetOpen(false)
      void fetchBindings(page)
    } catch (err) {
      const res = err as Response
      if (res.status === 409 || res.status === 422) {
        const body = await res.json().catch(() => ({}))
        setFormError((body as { detail?: string }).detail ?? 'Este vínculo já existe.')
      } else {
        setFormError('Erro ao criar vínculo.')
      }
    } finally {
      setSaving(false)
    }
  }

  function openEdit(ml: ManagerLocation) {
    setEditTarget(ml)
    setEditLocationId(ml.locationId)
    setEditError('')
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editLocationId) {
      setEditError('Selecione uma UBS.')
      return
    }
    setEditSaving(true)
    try {
      await apiClient.delete<{ success: boolean }>(`/manager-locations/${editTarget.id}`)
      await apiClient.post<{ success: boolean; data: ApiManagerLocation }>('/manager-locations', {
        user_id: editTarget.userId,
        location_id: editLocationId,
      })
      toast({ title: 'Vínculo atualizado com sucesso.' })
      setEditTarget(null)
      void fetchBindings(page)
    } catch (err) {
      const res = err as Response
      if (res.status === 409 || res.status === 422) {
        const body = await res.json().catch(() => ({}))
        setEditError((body as { detail?: string }).detail ?? 'Este vínculo já existe.')
      } else {
        setEditError('Erro ao atualizar vínculo.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete<{ success: boolean }>(`/manager-locations/${deleteTarget.id}`)
      toast({ title: 'Vínculo removido.' })
      void fetchBindings(page)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Vínculos entre gestores e UBSs/locais.</p>
        <Button onClick={openSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Novo vínculo
        </Button>
      </div>

      <Input
        placeholder="Filtrar por gestor ou UBS…"
        value={filter}
        onChange={(e) => handleFilterChange(e.target.value)}
        className="max-w-md"
      />

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('userName')}>
                <span className="flex items-center gap-1">Gestor {sortKey === 'userName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'userName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('locationName')}>
                <span className="flex items-center gap-1">UBS / Local {sortKey === 'locationName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'locationName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                <span className="flex items-center gap-1">Criado em {sortKey === 'createdAt' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'createdAt' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={4} />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  Nenhum vínculo encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((ml) => (
                <TableRow key={ml.id}>
                  <TableCell className="font-medium">{ml.userName}</TableCell>
                  <TableCell>{ml.locationName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateBR(ml.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(ml)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(ml)}>
                        <Link2Off className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} vínculo{meta.total !== 1 ? 's' : ''} • página {meta.page} de {meta.total_pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!meta.has_prev} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!meta.has_next} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Edit sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar vínculo Gestor ↔ UBS</SheetTitle>
            <SheetDescription>Altere a UBS associada ao gestor.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Gestor</Label>
              <p className="text-sm font-medium">{userMap.get(editTarget?.userId ?? '')?.name ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <Label>UBS / Local *</Label>
              <AsyncCombobox
                placeholder="Selecione o local"
                fetchOptions={fetchLocationsOptions}
                value={editLocationId}
                onValueChange={setEditLocationId}
                valueLabel={locationMap.get(editLocationId)?.name}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Novo vínculo Gestor ↔ UBS</SheetTitle>
            <SheetDescription>Selecione o gestor e a UBS para criar o vínculo.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label>Gestor *</Label>
              <AsyncCombobox
                placeholder="Selecione o gestor"
                fetchOptions={fetchUsersOptions}
                value={formUserId}
                onValueChange={setFormUserId}
                valueLabel={userMap.get(formUserId)?.name}
              />
            </div>
            <div className="space-y-1">
              <Label>UBS / Local *</Label>
              <AsyncCombobox
                placeholder="Selecione o local"
                fetchOptions={fetchLocationsOptions}
                value={formLocationId}
                onValueChange={setFormLocationId}
                valueLabel={locationMap.get(formLocationId)?.name}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar vínculo'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover vínculo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o vínculo de{' '}
              <strong>{userMap.get(deleteTarget?.userId ?? '')?.name}</strong> com{' '}
              <strong>{locationMap.get(deleteTarget?.locationId ?? '')?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo…' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Técnicos por Sala ───────────────────────────────────────────────────────

function TecnicosTab() {
  const { vaccineRooms } = useVaccineRooms()
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [bindings, setBindings] = useState<TechnicianRoom[]>([])
  const [meta, setMeta] = useState({ total: 0, total_pages: 1, page: 1, has_prev: false, has_next: false })
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [formUserId, setFormUserId] = useState('')
  const [formRoomId, setFormRoomId] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [editTarget, setEditTarget] = useState<TechnicianRoom | null>(null)
  const [editRoomId, setEditRoomId] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TechnicianRoom | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    const res = await apiClient.get<PaginatedResponse<ApiUser>>('/users?page=1&page_size=20')
    setUsers(res.data.map(mapApiUser).filter((u) => u.isActive))
  }, [])

  const fetchBindings = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<PaginatedResponse<ApiTechnicianRoom>>(
        `/technician-rooms?page=${p}&page_size=${PAGE_SIZE}`
      )
      setBindings(res.data.map(mapApiTechnicianRoom))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    void fetchBindings(page)
  }, [fetchBindings, page])

  const fetchUsersOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit), role: 'tecnico' })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiUser>>(`/users?${params}`)
      return res.data.filter(u => u.is_active).map(u => ({ value: u.id, label: u.name }))
    } catch { return [] }
  }, [])

  const fetchRoomsOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<{ id: string; description: string; location_name: string; is_deleted: boolean }>>(`/vaccine-rooms?${params}`)
      return res.data.filter(r => !r.is_deleted).map(r => ({ value: r.id, label: `${r.description} (${r.location_name})` }))
    } catch { return [] }
  }, [])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const roomMap = new Map(vaccineRooms.map((r) => [r.id, r]))

  const q = filter.toLowerCase()
  const filtered = bindings
    .filter((tr) => {
      const user = userMap.get(tr.userId)
      const room = roomMap.get(tr.vaccineRoomId)
      return (
        (user?.name ?? tr.userId).toLowerCase().includes(q) ||
        (room?.description ?? tr.vaccineRoomId).toLowerCase().includes(q)
      )
    })
    .map((tr) => ({
      ...tr,
      userName: userMap.get(tr.userId)?.name ?? '',
      roomDescription: roomMap.get(tr.vaccineRoomId)?.description ?? '',
      locationName: roomMap.get(tr.vaccineRoomId)?.locationName ?? '',
    }))

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered)

  function handleFilterChange(value: string) {
    setFilter(value)
  }

  function openSheet() {
    setFormUserId('')
    setFormRoomId('')
    setFormError('')
    setSheetOpen(true)
  }

  async function handleCreate() {
    setFormError('')
    if (!formUserId || !formRoomId) {
      setFormError('Selecione o técnico e a sala.')
      return
    }
    setSaving(true)
    try {
      await apiClient.post<{ success: boolean; data: ApiTechnicianRoom }>('/technician-rooms', {
        user_id: formUserId,
        vaccine_room_id: formRoomId,
      })
      toast({ title: 'Vínculo criado com sucesso.' })
      setSheetOpen(false)
      void fetchBindings(page)
    } catch (err) {
      const res = err as Response
      if (res.status === 409 || res.status === 422) {
        const body = await res.json().catch(() => ({}))
        setFormError((body as { detail?: string }).detail ?? 'Este vínculo já existe.')
      } else {
        setFormError('Erro ao criar vínculo.')
      }
    } finally {
      setSaving(false)
    }
  }

  function openEdit(tr: TechnicianRoom) {
    setEditTarget(tr)
    setEditRoomId(tr.vaccineRoomId)
    setEditError('')
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editRoomId) {
      setEditError('Selecione uma sala.')
      return
    }
    setEditSaving(true)
    try {
      await apiClient.delete<{ success: boolean }>(`/technician-rooms/${editTarget.id}`)
      await apiClient.post<{ success: boolean; data: ApiTechnicianRoom }>('/technician-rooms', {
        user_id: editTarget.userId,
        vaccine_room_id: editRoomId,
      })
      toast({ title: 'Vínculo atualizado com sucesso.' })
      setEditTarget(null)
      void fetchBindings(page)
    } catch (err) {
      const res = err as Response
      if (res.status === 409 || res.status === 422) {
        const body = await res.json().catch(() => ({}))
        setEditError((body as { detail?: string }).detail ?? 'Este vínculo já existe.')
      } else {
        setEditError('Erro ao atualizar vínculo.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete<{ success: boolean }>(`/technician-rooms/${deleteTarget.id}`)
      toast({ title: 'Vínculo removido.' })
      void fetchBindings(page)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Vínculos entre técnicos e salas de vacina.</p>
        <Button onClick={openSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Novo vínculo
        </Button>
      </div>

      <Input
        placeholder="Filtrar por técnico ou sala…"
        value={filter}
        onChange={(e) => handleFilterChange(e.target.value)}
        className="max-w-md"
      />

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('userName')}>
                <span className="flex items-center gap-1">Técnico {sortKey === 'userName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'userName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('roomDescription')}>
                <span className="flex items-center gap-1">Sala / UBS {sortKey === 'roomDescription' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'roomDescription' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                <span className="flex items-center gap-1">Criado em {sortKey === 'createdAt' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'createdAt' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={4} />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  Nenhum vínculo encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell className="font-medium">{tr.userName}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{tr.roomDescription}</div>
                      <div className="text-xs text-muted-foreground">{tr.locationName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateBR(tr.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(tr)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(tr)}>
                        <Link2Off className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} vínculo{meta.total !== 1 ? 's' : ''} • página {meta.page} de {meta.total_pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!meta.has_prev} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!meta.has_next} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Edit sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar vínculo Técnico ↔ Sala</SheetTitle>
            <SheetDescription>Altere a sala associada ao técnico.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Técnico</Label>
              <p className="text-sm font-medium">{userMap.get(editTarget?.userId ?? '')?.name ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <Label>Sala de Vacina *</Label>
              <AsyncCombobox
                placeholder="Selecione a sala"
                fetchOptions={fetchRoomsOptions}
                value={editRoomId}
                onValueChange={setEditRoomId}
                valueLabel={roomMap.get(editRoomId)?.description}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Novo vínculo Técnico ↔ Sala</SheetTitle>
            <SheetDescription>Selecione o técnico e a sala para criar o vínculo.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label>Técnico *</Label>
              <AsyncCombobox
                placeholder="Selecione o técnico"
                fetchOptions={fetchUsersOptions}
                value={formUserId}
                onValueChange={setFormUserId}
                valueLabel={userMap.get(formUserId)?.name}
              />
            </div>
            <div className="space-y-1">
              <Label>Sala de Vacina *</Label>
              <AsyncCombobox
                placeholder="Selecione a sala"
                fetchOptions={fetchRoomsOptions}
                value={formRoomId}
                onValueChange={setFormRoomId}
                valueLabel={roomMap.get(formRoomId)?.description}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar vínculo'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover vínculo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o vínculo de{' '}
              <strong>{userMap.get(deleteTarget?.userId ?? '')?.name}</strong> com{' '}
              <strong>{roomMap.get(deleteTarget?.vaccineRoomId ?? '')?.description}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo…' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function EquipePage() {
  const [tab, setTab] = useState<'gestores' | 'tecnicos'>('gestores')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Users className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão da Equipe</h1>
          <p className="text-muted-foreground">Controle de acessos e vínculos de gestores e técnicos.</p>
        </div>
      </div>

      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'gestores' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('gestores')}
        >
          Gestores por UBS
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'tecnicos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('tecnicos')}
        >
          Técnicos por Sala
        </button>
      </div>

      {tab === 'gestores' ? <GestoresTab /> : <TecnicosTab />}
    </div>
  )
}
