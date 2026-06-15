import { useCallback, useEffect, useState } from 'react'
import { DoorOpen, Pencil, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import type { VaccineRoom, Location, PaginatedMeta, PaginatedResponse } from '../../types'
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
import { AsyncCombobox, type ComboboxOption } from '../../components/ui/async-combobox'
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

const PAGE_SIZE = 20

interface ApiVaccineRoom {
  id: string
  location_id: string
  description: string
  is_deleted: boolean
  deleted_by?: string
  deleted_at?: string
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

function mapApiVaccineRoom(a: ApiVaccineRoom): VaccineRoom {
  return {
    id: a.id,
    locationId: a.location_id,
    description: a.description,
    isDeleted: a.is_deleted,
    deletedBy: a.deleted_by,
    deletedAt: a.deleted_at,
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

async function getApiErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string; message?: string }
    return body.detail ?? body.message ?? 'Erro desconhecido.'
  } catch {
    return 'Erro desconhecido.'
  }
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 4 }).map((__, j) => (
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
  locationId: string
  description: string
}

const INITIAL_FORM: CreateFormState = {
  locationId: '',
  description: '',
}

export default function SalasPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { toast } = useToast()

  const [rooms, setRooms] = useState<VaccineRoom[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)

  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [editTarget, setEditTarget] = useState<VaccineRoom | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<VaccineRoom | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = currentUser?.role === 'administrador'
  const isGestor = currentUser?.role === 'gestor'

  const fetchRooms = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      const res = await apiClient.get<PaginatedResponse<ApiVaccineRoom>>(`/vaccine-rooms?${params}`)
      setRooms(res.data.map(mapApiVaccineRoom))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLocations = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20')
      setLocations(res.data.filter((l) => !l.is_deleted).map(mapApiLocation))
    } catch {
      // non-critical — dropdown just stays empty
    }
  }, [])

  useEffect(() => {
    void fetchRooms(page)
  }, [page, fetchRooms])

  useEffect(() => {
    void fetchLocations()
  }, [fetchLocations])

  const fetchLocationOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiLocation>>(`/locations?${params}`)
      const nextLocations = res.data.filter((l) => !l.is_deleted).map(mapApiLocation)
      setLocations((current) => {
        const merged = new Map(current.map((location) => [location.id, location]))
        nextLocations.forEach((location) => merged.set(location.id, location))
        return Array.from(merged.values())
      })
      return nextLocations.map((location) => ({
        value: location.id,
        label: location.name,
      }))
    } catch {
      return []
    }
  }, [])

  const locationMap = new Map(locations.map((l) => [l.id, l]))

  const q = filter.toLowerCase()
  const filtered = rooms
    .filter((r) => {
      const loc = locationMap.get(r.locationId)
      return (
        r.description.toLowerCase().includes(q) ||
        (loc?.name ?? '').toLowerCase().includes(q)
      )
    })
    .map((r) => ({ ...r, locationName: locationMap.get(r.locationId)?.name ?? '' }))

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered)

  if (!isAdmin && !isGestor) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito a administradores e gestores.</p>
      </div>
    )
  }

  function handleFilterChange(value: string) {
    setFilter(value)
  }

  async function handleCreate() {
    setFormError('')
    if (!form.locationId || !form.description.trim()) {
      setFormError('Preencha todos os campos obrigatórios.')
      return
    }
    setSaving(true)
    try {
      await apiClient.post('/vaccine-rooms', {
        location_id: form.locationId,
        description: form.description.trim(),
      })
      toast({ title: 'Sala criada com sucesso.' })
      setSheetOpen(false)
      setForm(INITIAL_FORM)
      await fetchRooms(page)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setFormError(msg)
        } else {
          setFormError('Erro ao criar sala. Tente novamente.')
        }
      } else {
        setFormError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  function openEdit(r: VaccineRoom) {
    setEditTarget(r)
    setEditDescription(r.description)
    setEditError('')
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editDescription.trim()) {
      setEditError('A descrição é obrigatória.')
      return
    }
    setEditSaving(true)
    try {
      await apiClient.put(`/vaccine-rooms/${editTarget.id}`, {
        description: editDescription.trim(),
      })
      toast({ title: 'Sala atualizada com sucesso.' })
      setEditTarget(null)
      await fetchRooms(page)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setEditError(msg)
        } else {
          setEditError('Erro ao atualizar sala. Tente novamente.')
        }
      } else {
        setEditError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/vaccine-rooms/${deleteTarget.id}`)
      toast({ title: `Sala "${deleteTarget.description}" excluída.` })
      await fetchRooms(page)
    } catch {
      toast({ title: 'Erro ao excluir sala.', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Salas de Vacina</h1>
          <p className="text-sm text-muted-foreground">Gerencie as salas de vacinação por local.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(INITIAL_FORM); setFormError(''); setSheetOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova sala
          </Button>
        )}
      </div>

      {/* Filter */}
      <Input
        placeholder="Filtrar por sala ou UBS…"
        value={filter}
        onChange={(e) => handleFilterChange(e.target.value)}
        className="max-w-md"
      />

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('locationName')}>
                <span className="flex items-center gap-1">UBS / Local {sortKey === 'locationName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'locationName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('description')}>
                <span className="flex items-center gap-1">Descrição {sortKey === 'description' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'description' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                <span className="flex items-center gap-1">Data de cadastro {sortKey === 'createdAt' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'createdAt' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <DoorOpen className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {filter ? 'Nenhuma sala encontrada para o filtro aplicado.' : 'Nenhuma sala cadastrada.'}
                    </p>
                    {!filter && isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                        Criar primeira sala
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => {
                const loc = locationMap.get(r.locationId)
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{loc?.name ?? r.locationId}</TableCell>
                    <TableCell className="font-medium">{r.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateBR(r.createdAt)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} sala{meta.total !== 1 ? 's' : ''} • página {meta.page} de {meta.total_pages}
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

      {/* Create sheet (Admin only) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nova sala</SheetTitle>
            <SheetDescription>Preencha os dados para cadastrar uma nova sala de vacina.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="room-location">UBS / Local *</Label>
              <AsyncCombobox
                id="room-location"
                value={form.locationId}
                valueLabel={locationMap.get(form.locationId)?.name}
                onValueChange={(locationId) => setForm((current) => ({ ...current, locationId }))}
                fetchOptions={fetchLocationOptions}
                placeholder="Selecione o local"
                searchPlaceholder="Busque um local"
                emptyMessage="Nenhum local encontrado."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="room-description">Descrição da sala *</Label>
              <Input
                id="room-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Sala de Vacinação 1"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar sala'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit sheet (Admin only) */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar sala</SheetTitle>
            <SheetDescription>Altere a descrição da sala de vacina.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-room-description">Descrição da sala *</Label>
              <Input
                id="edit-room-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ex: Sala de Vacinação 1"
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

      {/* Delete confirmation dialog (Admin only) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir sala</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a sala <strong>{deleteTarget?.description}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
