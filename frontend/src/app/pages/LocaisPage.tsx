import { useCallback, useEffect, useState } from 'react'
import { MapPin, Pencil, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import type { Location, LocationType, PaginatedMeta, PaginatedResponse } from '../../types'
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

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  ubs: 'UBS',
  lugar_temporario: 'Lugar Temporário',
  escola: 'Escola',
  hospital: 'Hospital',
  outro: 'Outro',
}

const PAGE_SIZE = 20

interface ApiLocation {
  id: string
  name: string
  address: string
  type: LocationType
  other_description?: string
  is_deleted: boolean
  deleted_by?: string
  deleted_at?: string
  created_at: string
}

function mapApiLocation(a: ApiLocation): Location {
  return {
    id: a.id,
    name: a.name,
    address: a.address,
    type: a.type,
    otherDescription: a.other_description,
    isDeleted: a.is_deleted,
    deletedBy: a.deleted_by,
    deletedAt: a.deleted_at,
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
          {Array.from({ length: 5 }).map((__, j) => (
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
  address: string
  type: LocationType | ''
  otherDescription: string
}

const INITIAL_FORM: CreateFormState = {
  name: '',
  address: '',
  type: '',
  otherDescription: '',
}

interface EditFormState {
  name: string
  address: string
  type: LocationType
  otherDescription: string
}

export default function LocaisPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { toast } = useToast()

  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)

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

  const fetchLocations = useCallback(async (p: number, search: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiLocation>>(`/locations?${params}`)
      setLocations(res.data.map(mapApiLocation))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLocations(page, debouncedFilter)
  }, [page, debouncedFilter, fetchLocations])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [editTarget, setEditTarget] = useState<Location | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', address: '', type: 'ubs', otherDescription: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  function openEdit(l: Location) {
    setEditTarget(l)
    setEditForm({ name: l.name, address: l.address, type: l.type, otherDescription: l.otherDescription ?? '' })
    setEditError('')
  }

  const isAdmin = currentUser?.role === 'administrador'
  const isGestor = currentUser?.role === 'gestor'

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(locations)

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
    if (!form.name.trim() || !form.address.trim() || !form.type) {
      setFormError('Preencha todos os campos obrigatórios.')
      return
    }
    if (form.type === 'outro' && !form.otherDescription.trim()) {
      setFormError('Descreva o tipo de local quando selecionar "Outro".')
      return
    }
    setSaving(true)
    try {
      await apiClient.post('/locations', {
        name: form.name.trim(),
        address: form.address.trim(),
        type: form.type as LocationType,
        other_description: form.type === 'outro' ? form.otherDescription.trim() : undefined,
      })
      toast({ title: 'Local criado com sucesso.' })
      setSheetOpen(false)
      setForm(INITIAL_FORM)
      await fetchLocations(page, debouncedFilter)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 409) {
          setFormError('Já existe um local com essas informações.')
        } else if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setFormError(msg)
        } else {
          setFormError('Erro ao criar local. Tente novamente.')
        }
      } else {
        setFormError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/locations/${deleteTarget.id}`)
      toast({ title: `Local "${deleteTarget.name}" excluído.` })
      await fetchLocations(page, debouncedFilter)
    } catch {
      toast({ title: 'Erro ao excluir local.', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editForm.name.trim() || !editForm.address.trim()) {
      setEditError('Preencha todos os campos obrigatórios.')
      return
    }
    if (editForm.type === 'outro' && !editForm.otherDescription.trim()) {
      setEditError('Descreva o tipo de local quando selecionar "Outro".')
      return
    }
    setEditSaving(true)
    try {
      await apiClient.put(`/locations/${editTarget.id}`, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        type: editForm.type,
        other_description: editForm.type === 'outro' ? editForm.otherDescription.trim() : undefined,
      })
      toast({ title: 'Local atualizado com sucesso.' })
      setEditTarget(null)
      await fetchLocations(page, debouncedFilter)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 409) {
          setEditError('Já existe um local com essas informações.')
        } else if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setEditError(msg)
        } else {
          setEditError('Erro ao atualizar local. Tente novamente.')
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
          <h1 className="text-2xl font-bold">UBSs e Locais</h1>
          <p className="text-sm text-muted-foreground">Gerencie as unidades e locais de vacinação.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(INITIAL_FORM); setFormError(''); setSheetOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo local
          </Button>
        )}
      </div>

      {/* Filter */}
      <Input
        placeholder="Filtrar por nome, endereço ou tipo…"
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
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('address')}>
                <span className="flex items-center gap-1">Endereço {sortKey === 'address' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'address' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>
                <span className="flex items-center gap-1">Tipo {sortKey === 'type' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'type' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
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
                <TableCell colSpan={isAdmin ? 5 : 4} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <MapPin className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {filter ? 'Nenhum local encontrado para o filtro aplicado.' : 'Nenhum local cadastrado.'}
                    </p>
                    {!filter && isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                        Criar primeiro local
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.address}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {LOCATION_TYPE_LABELS[l.type]}
                      {l.type === 'outro' && l.otherDescription ? ` — ${l.otherDescription}` : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateBR(l.createdAt)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(l)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(l)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
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
            {meta.total} local{meta.total !== 1 ? 'is' : ''} • página {meta.page} de {meta.total_pages}
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
            <SheetTitle>Novo local</SheetTitle>
            <SheetDescription>Preencha os dados para cadastrar um novo local.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="loc-name">Nome *</Label>
              <Input
                id="loc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: UBS Central"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="loc-address">Endereço *</Label>
              <Input
                id="loc-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Ex: Rua das Flores, 123"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="loc-type">Tipo *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as LocationType, otherDescription: '' }))}
              >
                <SelectTrigger id="loc-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ubs">UBS</SelectItem>
                  <SelectItem value="lugar_temporario">Lugar Temporário</SelectItem>
                  <SelectItem value="escola">Escola</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === 'outro' && (
              <div className="space-y-1">
                <Label htmlFor="loc-other">Descrição do tipo *</Label>
                <Input
                  id="loc-other"
                  value={form.otherDescription}
                  onChange={(e) => setForm((f) => ({ ...f, otherDescription: e.target.value }))}
                  placeholder="Ex: Posto de saúde itinerante"
                />
              </div>
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar local'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit sheet (Admin only) */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar local</SheetTitle>
            <SheetDescription>Altere os dados do local e salve.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-loc-name">Nome *</Label>
              <Input
                id="edit-loc-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loc-address">Endereço *</Label>
              <Input
                id="edit-loc-address"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loc-type">Tipo *</Label>
              <Select
                value={editForm.type}
                onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as LocationType, otherDescription: '' }))}
              >
                <SelectTrigger id="edit-loc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ubs">UBS</SelectItem>
                  <SelectItem value="lugar_temporario">Lugar Temporário</SelectItem>
                  <SelectItem value="escola">Escola</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.type === 'outro' && (
              <div className="space-y-1">
                <Label htmlFor="edit-loc-other">Descrição do tipo *</Label>
                <Input
                  id="edit-loc-other"
                  value={editForm.otherDescription}
                  onChange={(e) => setEditForm((f) => ({ ...f, otherDescription: e.target.value }))}
                />
              </div>
            )}
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

      {/* Delete confirmation dialog (Admin only) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir local</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o local <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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
