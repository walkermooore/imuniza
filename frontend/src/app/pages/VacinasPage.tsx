import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Pencil, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, PackagePlus } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import type { Vaccine, Laboratory, PaginatedMeta, PaginatedResponse } from '../../types'
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
import { AsyncCombobox, type ComboboxOption } from '../../components/ui/async-combobox'
import { useToast } from '../../components/ui/use-toast'
import { useTableSort } from '../../hooks/useTableSort'
import { formatDateBR } from '../../lib/utils'
import { CreateBatchWizard } from '../../components/CreateBatchWizard'

const PAGE_SIZE = 20

interface ApiVaccine {
  id: string
  name: string
  laboratory_id: string
  laboratory_name: string
  is_deleted: boolean
  created_at: string
}

interface ApiLaboratory {
  id: string
  name: string
  is_deleted: boolean
  created_at: string
}

function mapApiVaccine(a: ApiVaccine): Vaccine {
  return {
    id: a.id,
    name: a.name,
    laboratoryId: a.laboratory_id,
    laboratoryName: a.laboratory_name,
    isDeleted: a.is_deleted,
    createdAt: a.created_at,
  }
}

function mapApiLaboratory(a: ApiLaboratory): Laboratory {
  return {
    id: a.id,
    name: a.name,
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

export default function VacinasPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { toast } = useToast()

  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [laboratories, setLaboratories] = useState<Laboratory[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)

  const isAdmin = currentUser?.role === 'administrador'
  const isGestor = currentUser?.role === 'gestor'
  const canCreateBatch = isAdmin || isGestor

  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  // Batch wizard
  const [batchWizardOpen, setBatchWizardOpen] = useState(false)
  const [batchWizardVaccineId, setBatchWizardVaccineId] = useState('')
  const [batchWizardVaccineName, setBatchWizardVaccineName] = useState('')

  // Vaccine create sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formLabId, setFormLabId] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Lab create dialog (inline from vaccine sheet)
  const [labDialogOpen, setLabDialogOpen] = useState(false)
  const [newLabName, setNewLabName] = useState('')
  const [labError, setLabError] = useState('')
  const [savingLab, setSavingLab] = useState(false)

  // Edit vaccine sheet
  const [editTarget, setEditTarget] = useState<Vaccine | null>(null)
  const [editName, setEditName] = useState('')
  const [editLabId, setEditLabId] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete vaccine dialog
  const [deleteTarget, setDeleteTarget] = useState<Vaccine | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchVaccines = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      const res = await apiClient.get<PaginatedResponse<ApiVaccine>>(`/vaccines?${params}`)
      setVaccines(res.data.map(mapApiVaccine))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLaboratories = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<ApiLaboratory>>('/laboratories?page=1&page_size=20')
      setLaboratories(res.data.filter((l) => !l.is_deleted).map(mapApiLaboratory))
    } catch {
      // non-critical — dropdown just stays empty
    }
  }, [])

  useEffect(() => {
    void fetchVaccines(page)
  }, [page, fetchVaccines])

  useEffect(() => {
    void fetchLaboratories()
  }, [fetchLaboratories])

  const fetchLaboratoryOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiLaboratory>>(`/laboratories?${params}`)
      const nextLabs = res.data.filter((lab) => !lab.is_deleted).map(mapApiLaboratory)
      setLaboratories((current) => {
        const merged = new Map(current.map((lab) => [lab.id, lab]))
        nextLabs.forEach((lab) => merged.set(lab.id, lab))
        return Array.from(merged.values())
      })
      return nextLabs.map((lab) => ({
        value: lab.id,
        label: lab.name,
      }))
    } catch {
      return []
    }
  }, [])

  const activeLabs = laboratories
  const labById = new Map<string, Laboratory>(activeLabs.map((l) => [l.id, l]))

  const q = filter.toLowerCase()
  const filtered = vaccines.filter((v) => {
    const labName = v.laboratoryName || labById.get(v.laboratoryId)?.name || ''
    return v.name.toLowerCase().includes(q) || labName.toLowerCase().includes(q)
  })
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered)

  function handleFilterChange(value: string) {
    setFilter(value)
  }

  function openSheet() {
    setFormName('')
    setFormLabId(activeLabs[0]?.id ?? '')
    setFormError('')
    setSheetOpen(true)
  }

  async function handleCreate() {
    setFormError('')
    if (!formName.trim()) {
      setFormError('Informe o nome da vacina.')
      return
    }
    if (!formLabId) {
      setFormError('Selecione um laboratório.')
      return
    }
    setSaving(true)
    try {
      await apiClient.post('/vaccines', { name: formName.trim(), laboratory_id: formLabId })
      toast({ title: 'Vacina cadastrada com sucesso.' })
      setSheetOpen(false)
      await fetchVaccines(page)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setFormError(msg)
        } else {
          setFormError('Erro ao criar vacina. Tente novamente.')
        }
      } else {
        setFormError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateLab() {
    setLabError('')
    if (!newLabName.trim()) {
      setLabError('Informe o nome do laboratório.')
      return
    }
    setSavingLab(true)
    try {
      const res = await apiClient.post<{ success: boolean; data: ApiLaboratory }>('/laboratories', { name: newLabName.trim() })
      const created = mapApiLaboratory(res.data)
      toast({ title: `Laboratório "${created.name}" criado.` })
      await fetchLaboratories()
      setFormLabId(created.id)
      setLabDialogOpen(false)
      setNewLabName('')
    } catch (err) {
      if (err instanceof Response) {
        const msg = await getApiErrorMessage(err)
        setLabError(msg)
      } else {
        setLabError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setSavingLab(false)
    }
  }

  function openEdit(v: Vaccine) {
    setEditTarget(v)
    setEditName(v.name)
    setEditLabId(v.laboratoryId)
    setEditError('')
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editName.trim()) {
      setEditError('Informe o nome da vacina.')
      return
    }
    if (!editLabId) {
      setEditError('Selecione um laboratório.')
      return
    }
    setEditSaving(true)
    try {
      await apiClient.put(`/vaccines/${editTarget.id}`, { name: editName.trim(), laboratory_id: editLabId })
      toast({ title: 'Vacina atualizada com sucesso.' })
      setEditTarget(null)
      await fetchVaccines(page)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setEditError(msg)
        } else {
          setEditError('Erro ao atualizar vacina. Tente novamente.')
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
      await apiClient.delete(`/vaccines/${deleteTarget.id}`)
      toast({ title: `Vacina "${deleteTarget.name}" excluída.` })
      await fetchVaccines(page)
    } catch {
      toast({ title: 'Erro ao excluir vacina.', variant: 'destructive' })
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
          <h1 className="text-2xl font-bold">Vacinas</h1>
          <p className="text-sm text-muted-foreground">Gerencie o catálogo de vacinas e laboratórios.</p>
        </div>
        {isAdmin && (
          <Button onClick={openSheet}>
            <Plus className="h-4 w-4 mr-2" />
            Nova vacina
          </Button>
        )}
      </div>

      {/* Filter */}
      <Input
        placeholder="Filtrar por nome ou laboratório…"
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
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('laboratoryName')}>
                <span className="flex items-center gap-1">Laboratório {sortKey === 'laboratoryName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'laboratoryName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                <span className="flex items-center gap-1">Data de cadastro {sortKey === 'createdAt' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'createdAt' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              {(isAdmin || canCreateBatch) && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(isAdmin || canCreateBatch) ? 4 : 3} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <FlaskConical className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {filter ? 'Nenhuma vacina encontrada para o filtro aplicado.' : 'Nenhuma vacina cadastrada.'}
                    </p>
                    {!filter && isAdmin && (
                      <Button variant="outline" size="sm" onClick={openSheet}>
                        Cadastrar primeira vacina
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {v.laboratoryName ?? '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateBR(v.createdAt)}
                  </TableCell>
                  {(isAdmin || canCreateBatch) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canCreateBatch && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setBatchWizardVaccineId(v.id); setBatchWizardVaccineName(v.name); setBatchWizardOpen(true) }}
                          >
                            <PackagePlus className="h-4 w-4 mr-1" />
                            Novo Lote
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(v)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(v)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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
            {meta.total} vacina{meta.total !== 1 ? 's' : ''} • página {meta.page} de {meta.total_pages}
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

      {/* Create vaccine sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nova vacina</SheetTitle>
            <SheetDescription>Preencha os dados para cadastrar uma nova vacina.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="vaccine-name">Nome da vacina *</Label>
              <Input
                id="vaccine-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: BCG"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="vaccine-lab">Laboratório *</Label>
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => { setNewLabName(''); setLabError(''); setLabDialogOpen(true) }}
                >
                  + Novo laboratório
                </button>
              </div>
              <AsyncCombobox
                id="vaccine-lab"
                value={formLabId}
                valueLabel={labById.get(formLabId)?.name}
                onValueChange={setFormLabId}
                fetchOptions={fetchLaboratoryOptions}
                placeholder="Selecione..."
                searchPlaceholder="Busque um laboratório"
                emptyMessage="Nenhum laboratório encontrado."
              />
              <select
                id="vaccine-lab"
                value={formLabId}
                onChange={(e) => setFormLabId(e.target.value)}
                className="hidden"
              >
                <option value="">Selecione…</option>
                {activeLabs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar vacina'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit vaccine sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar vacina</SheetTitle>
            <SheetDescription>Altere o nome e o laboratório da vacina.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-vaccine-name">Nome da vacina *</Label>
              <Input
                id="edit-vaccine-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: BCG"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-vaccine-lab">Laboratório *</Label>
              <AsyncCombobox
                id="edit-vaccine-lab"
                value={editLabId}
                valueLabel={labById.get(editLabId)?.name}
                onValueChange={setEditLabId}
                fetchOptions={fetchLaboratoryOptions}
                placeholder="Selecione..."
                searchPlaceholder="Busque um laboratório"
                emptyMessage="Nenhum laboratório encontrado."
              />
              <select
                id="edit-vaccine-lab"
                value={editLabId}
                onChange={(e) => setEditLabId(e.target.value)}
                className="hidden"
              >
                <option value="">Selecione…</option>
                {activeLabs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
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

      {/* Create laboratory dialog */}
      <Dialog open={labDialogOpen} onOpenChange={setLabDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo laboratório</DialogTitle>
            <DialogDescription>Cadastre um laboratório para associar às vacinas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lab-name">Nome *</Label>
            <Input
              id="lab-name"
              value={newLabName}
              onChange={(e) => setNewLabName(e.target.value)}
              placeholder="Ex: Butantan"
            />
            {labError && <p className="text-sm text-destructive">{labError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabDialogOpen(false)} disabled={savingLab}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLab} disabled={savingLab}>
              {savingLab ? 'Salvando…' : 'Criar laboratório'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch wizard */}
      <CreateBatchWizard
        open={batchWizardOpen}
        onOpenChange={setBatchWizardOpen}
        lockedVaccineId={batchWizardVaccineId}
        lockedVaccineName={batchWizardVaccineName}
      />

      {/* Delete vaccine dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir vacina</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a vacina <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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
