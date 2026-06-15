import { useCallback, useEffect, useState } from 'react'
import { Syringe, Pencil, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import type { BottleOpeningReason, PaginatedMeta, PaginatedResponse } from '../../types'
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
import { useToast } from '../../components/ui/use-toast'
import { useTableSort } from '../../hooks/useTableSort'
import { formatDateBR } from '../../lib/utils'

const PAGE_SIZE = 20

interface ApiBottleOpeningReason {
  id: string
  name: string
  is_default: boolean
  is_deleted: boolean
  created_at: string
}

function mapApiReason(a: ApiBottleOpeningReason): BottleOpeningReason {
  return {
    id: a.id,
    name: a.name,
    isDefault: a.is_default,
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

export default function MotivosAberturaPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { toast } = useToast()

  const [reasons, setReasons] = useState<BottleOpeningReason[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)

  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [editTarget, setEditTarget] = useState<BottleOpeningReason | null>(null)
  const [editName, setEditName] = useState('')
  const [editIsDefault, setEditIsDefault] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BottleOpeningReason | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchReasons = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      const res = await apiClient.get<PaginatedResponse<ApiBottleOpeningReason>>(
        `/bottle-opening-reasons?${params}`,
      )
      setReasons(res.data.map(mapApiReason))
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReasons(page)
  }, [page, fetchReasons])

  const q = filter.toLowerCase()
  const filtered = reasons.filter((r) => r.name.toLowerCase().includes(q))
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered)

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

  function openSheet() {
    setFormName('')
    setFormIsDefault(false)
    setFormError('')
    setSheetOpen(true)
  }

  async function handleCreate() {
    setFormError('')
    if (!formName.trim()) {
      setFormError('Informe o nome do motivo.')
      return
    }
    setSaving(true)
    try {
      await apiClient.post('/bottle-opening-reasons', {
        name: formName.trim(),
        is_default: formIsDefault,
      })
      toast({ title: 'Motivo de abertura criado com sucesso.' })
      setSheetOpen(false)
      await fetchReasons(page)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setFormError(msg)
        } else {
          setFormError('Erro ao criar motivo. Tente novamente.')
        }
      } else {
        setFormError('Erro ao conectar com o servidor. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  function openEdit(r: BottleOpeningReason) {
    setEditTarget(r)
    setEditName(r.name)
    setEditIsDefault(r.isDefault)
    setEditError('')
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditError('')
    if (!editName.trim()) {
      setEditError('Informe o nome do motivo.')
      return
    }
    setEditSaving(true)
    try {
      await apiClient.put(`/bottle-opening-reasons/${editTarget.id}`, {
        name: editName.trim(),
        is_default: editIsDefault,
      })
      toast({ title: 'Motivo atualizado com sucesso.' })
      setEditTarget(null)
      await fetchReasons(page)
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 422) {
          const msg = await getApiErrorMessage(err)
          setEditError(msg)
        } else {
          setEditError('Erro ao atualizar motivo. Tente novamente.')
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
      await apiClient.delete(`/bottle-opening-reasons/${deleteTarget.id}`)
      toast({ title: `Motivo "${deleteTarget.name}" excluído.` })
      await fetchReasons(page)
    } catch {
      toast({ title: 'Erro ao excluir motivo.', variant: 'destructive' })
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
          <h1 className="text-2xl font-bold">Motivos de Abertura</h1>
          <p className="text-sm text-muted-foreground">Gerencie os motivos disponíveis para abertura de frascos.</p>
        </div>
        <Button onClick={openSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Novo motivo
        </Button>
      </div>

      {/* Filter */}
      <Input
        placeholder="Filtrar por nome…"
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
                <span className="flex items-center gap-1">
                  Nome
                  {sortKey === 'name' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'name' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('isDefault')}>
                <span className="flex items-center gap-1">
                  Padrão
                  {sortKey === 'isDefault' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'isDefault' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                <span className="flex items-center gap-1">
                  Data de cadastro
                  {sortKey === 'createdAt' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'createdAt' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Syringe className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {filter ? 'Nenhum motivo encontrado para o filtro aplicado.' : 'Nenhum motivo cadastrado.'}
                    </p>
                    {!filter && (
                      <Button variant="outline" size="sm" onClick={openSheet}>
                        Criar primeiro motivo
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    {r.isDefault ? (
                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white">Padrão</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateBR(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
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
            {meta.total} motivo{meta.total !== 1 ? 's' : ''} • página {meta.page} de {meta.total_pages}
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

      {/* Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Novo motivo de abertura</SheetTitle>
            <SheetDescription>Preencha os dados para cadastrar um novo motivo.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reason-name">Nome *</Label>
              <Input
                id="reason-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Demanda espontânea"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Motivo padrão</span>
            </label>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar motivo'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar motivo de abertura</SheetTitle>
            <SheetDescription>Altere o nome e o status padrão do motivo.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-reason-name">Nome *</Label>
              <Input
                id="edit-reason-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Demanda espontânea"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editIsDefault}
                onChange={(e) => setEditIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Motivo padrão</span>
            </label>
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir motivo de abertura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o motivo <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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
