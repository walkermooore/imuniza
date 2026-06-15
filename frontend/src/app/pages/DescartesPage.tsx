import { useCallback, useEffect, useState, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { PaginatedResponse } from '../../types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DateInput, DateTimeInput } from '../../components/ui/date-input'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
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
import { formatDateTimeBR, toIsoDateInput, toLocalDateTimeInput } from '../../lib/utils'
import { paginate } from '../../lib/pagination'
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker'

const PAGE_SIZE = 20

// ─── API types ─────────────────────────────────────────────────────────────────

interface ApiBatch {
  id: string
  batch_code: string
  vaccine_id: string
  expiry_date: string
  open_bottle_expiry_minutes: number
  doses_per_bottle: number
  is_deleted: boolean
  created_at: string
  created_by: string
}

interface ApiBatchRoomEntry {
  id: string
  batch_id: string
  vaccine_room_id: string
  bottle_count: number
  is_deleted: boolean
  created_by: string
  created_at: string
}

interface ApiVaccine {
  id: string
  name: string
  laboratory_id: string
  is_deleted: boolean
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

interface ApiBottleDiscard {
  id: string
  batch_entry_id: string
  bottle_opening_id?: string
  discarded_at: string
  discard_reason_id: string
  remaining_doses?: number
  comment?: string
  is_cancelled: boolean
  cancelled_by?: string
  cancelled_at?: string
  bulk_discard_id?: string
  created_by: string
  created_at: string
}

interface ApiDiscardReason {
  id: string
  name: string
  is_default: boolean
  is_deleted: boolean
  created_at: string
}

interface ApiUser {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export default function DescartesPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { vaccineRooms } = useVaccineRooms()
  const { toast } = useToast()

  // ─── Reference data ────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])
  const [bottleDiscardReasons, setBottleDiscardReasons] = useState<ApiDiscardReason[]>([])
  const [users, setUsers] = useState<ApiUser[]>([])

  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [filterMode, setFilterMode] = useState<'' | 'A' | 'B'>('')
  const [filterDateFrom, setFilterDateFrom] = useState(toIsoDateInput(new Date()))
  const [filterDateTo, setFilterDateTo] = useState(toIsoDateInput(new Date()))
  const [currentPage, setCurrentPage] = useState(1)

  // Mode A sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formBatchEntryId, setFormBatchEntryId] = useState('')
  const [formDiscardReasonId, setFormDiscardReasonId] = useState('')
  const [formDateTime, setFormDateTime] = useState(toLocalDateTimeInput(new Date()))
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelTargetId, setCancelTargetId] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        discardsRes,
        entriesRes,
        batchesRes,
        vaccinesRes,
        discardReasonsRes,
        locationsRes,
        usersRes,
      ] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBottleDiscard>>('/bottle-discards?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiDiscardReason>>('/bottle-discard-reasons?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiUser>>('/users?page=1&page_size=20'),
      ])
      setBottleDiscards(discardsRes.data)
      setBatchRoomEntries(entriesRes.data)
      setBatches(batchesRes.data)
      setVaccines(vaccinesRes.data)
      setBottleDiscardReasons(discardReasonsRes.data)
      setLocations(locationsRes.data)
      setUsers(usersRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  // ─── Scope helpers ─────────────────────────────────────────────────────────

  const availableEntries = useMemo(() => {
    return batchRoomEntries.filter(e => {
      if (e.is_deleted) return false
      const batch = batches.find(b => b.id === e.batch_id && !b.is_deleted)
      if (!batch) return false
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(batch.expiry_date) < today) return false
      return true
    })
  }, [batchRoomEntries, batches])

  // ─── Mode A save ───────────────────────────────────────────────────────────

  function resetForm() {
    setFormBatchEntryId('')
    const defaultReason = bottleDiscardReasons.find(r => r.is_default && !r.is_deleted)
    setFormDiscardReasonId(defaultReason?.id ?? '')
    setFormDateTime(toLocalDateTimeInput(new Date()))
    setFormComment('')
  }

  function openSheet() {
    resetForm()
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!currentUser || !formBatchEntryId || !formDiscardReasonId) return
    setSaving(true)
    try {
      await apiClient.post<ApiBottleDiscard>('/bottle-discards', {
        batch_entry_id: formBatchEntryId,
        discarded_at: new Date(formDateTime).toISOString(),
        discard_reason_id: formDiscardReasonId,
        comment: formComment || undefined,
      })
      toast({ title: 'Frasco descartado com sucesso!' })
      setSheetOpen(false)
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  // ─── Cancel discard ────────────────────────────────────────────────────────

  function openCancelDialog(discardId: string) {
    setCancelTargetId(discardId)
    setCancelDialogOpen(true)
  }

  async function handleCancel() {
    if (!currentUser || !cancelTargetId) return
    setCancelling(true)
    try {
      await apiClient.post<void>(`/bottle-discards/${cancelTargetId}/cancel`, {})
      toast({ title: 'Descarte cancelado.' })
      setCancelDialogOpen(false)
      await fetchData()
    } finally {
      setCancelling(false)
    }
  }

  // ─── Listing data ──────────────────────────────────────────────────────────

  const displayRows = useMemo(() => {
    const dateFrom = filterDateFrom ? new Date(filterDateFrom + 'T00:00:00') : null
    const dateTo = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null

    return bottleDiscards
      .filter(d => {
        const entry = batchRoomEntries.find(e => e.id === d.batch_entry_id)
        if (!entry) return false

        const discardDate = new Date(d.discarded_at)
        if (dateFrom && discardDate < dateFrom) return false
        if (dateTo && discardDate > dateTo) return false

        // Mode filter
        if (filterMode === 'A' && d.bottle_opening_id) return false
        if (filterMode === 'B' && !d.bottle_opening_id) return false

        const batch = batches.find(b => b.id === entry.batch_id)
        const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : null
        const room = vaccineRooms.find(r => r.id === entry.vaccine_room_id)
        const loc = room ? locations.find(l => l.id === room.locationId) : null

        const q = filter.toLowerCase()
        if (!q) return true
        return (
          (vaccine?.name ?? '').toLowerCase().includes(q) ||
          (batch?.batch_code ?? '').toLowerCase().includes(q) ||
          (room?.description ?? '').toLowerCase().includes(q) ||
          (loc?.name ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.discarded_at).getTime() - new Date(a.discarded_at).getTime())
      .map(d => {
        const entry = batchRoomEntries.find(e => e.id === d.batch_entry_id)
        const batch = entry ? batches.find(b => b.id === entry.batch_id) : null
        const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : null
        const room = vaccineRooms.find(r => r.id === entry?.vaccine_room_id)
        const loc = room ? locations.find(l => l.id === room.locationId) : null
        const reason = bottleDiscardReasons.find(r => r.id === d.discard_reason_id)
        const creator = users.find(u => u.id === d.created_by)

        return {
          ...d,
          _vaccineName: vaccine?.name ?? '—',
          _batchCode: batch?.batch_code ?? '—',
          _roomDescription: room?.description ?? '—',
          _locationName: loc?.name ?? '—',
          _reasonName: reason?.name ?? '—',
          _creatorName: creator?.name ?? d.created_by,
          _mode: d.bottle_opening_id ? 'B' : 'A',
        }
      })
  }, [bottleDiscards, batchRoomEntries, batches, vaccines, vaccineRooms, locations, bottleDiscardReasons, users, filter, filterMode, filterDateFrom, filterDateTo])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(displayRows)
  const { data: paginated, meta } = paginate(sorted, currentPage, PAGE_SIZE)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Descartes de Frascos</h1>
          <p className="text-muted-foreground">
            Visualize e registre descartes de frascos fechados ou abertos.
          </p>
        </div>
        <Button onClick={openSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Descarte frasco fechado
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-1 space-y-1">
          <Label>Busca</Label>
          <Input
            placeholder="Vacina, lote, sala..."
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setCurrentPage(1) }}
          />
        </div>
        <div className="space-y-1">
          <Label>Modo</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={filterMode}
            onChange={(e) => { setFilterMode(e.target.value as any); setCurrentPage(1) }}
          >
            <option value="">Todos os modos</option>
            <option value="A">(Frasco Fechado)</option>
            <option value="B">(Frasco Aberto)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>De</Label>
          <DateInput
            value={filterDateFrom}
            onValueChange={(v) => { setFilterDateFrom(v); setCurrentPage(1) }}
          />
        </div>
        <div className="space-y-1">
          <Label>Até</Label>
          <DateInput
            value={filterDateTo}
            onValueChange={(v) => { setFilterDateTo(v); setCurrentPage(1) }}
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_vaccineName')}>
                <span className="flex items-center gap-1">
                  Vacina {sortKey === '_vaccineName' && (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  {sortKey !== '_vaccineName' && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Sala / UBS</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('discarded_at')}>
                <span className="flex items-center gap-1">
                  Descartado em {sortKey === 'discarded_at' && (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  {sortKey !== 'discarded_at' && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Doses</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={8} />
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Nenhum descarte encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((d) => (
                <TableRow key={d.id} className={d.is_cancelled ? 'bg-gray-50/50' : ''}>
                  <TableCell className="font-medium">{d._vaccineName}</TableCell>
                  <TableCell>{d._batchCode}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{d._roomDescription}</div>
                      <div className="text-xs text-muted-foreground">{d._locationName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTimeBR(d.discarded_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={d._mode === 'A' ? 'border-blue-200 text-blue-700' : 'border-purple-200 text-purple-700'}>
                      {d._mode === 'A' ? 'Frasco Fechado' : 'Frasco Aberto'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d._reasonName}</TableCell>
                  <TableCell className="text-sm">{d.remaining_doses ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {!d.is_cancelled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => openCancelDialog(d.id)}
                      >
                        <ArrowUpDown className="h-4 w-4 rotate-45" />
                      </Button>
                    )}
                    {d.is_cancelled && (
                      <Badge variant="outline" className="text-gray-400 line-through">Cancelado</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {paginated.length} de {meta.total} descartes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.has_prev}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm font-medium">
              Página {meta.page} de {meta.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.has_next}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Mode A Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Novo Descarte (Frasco Fechado)</SheetTitle>
            <SheetDescription>
              Registre o descarte de um frasco que ainda não foi aberto.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label>Lote / Sala *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formBatchEntryId}
                onChange={(e) => setFormBatchEntryId(e.target.value)}
              >
                <option value="">Selecione o lote e sala</option>
                {availableEntries.map(e => {
                  const batch = batches.find(b => b.id === e.batch_id)
                  const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : null
                  const room = vaccineRooms.find(r => r.id === e.vaccine_room_id)
                  const loc = room ? locations.find(l => l.id === room.locationId) : null
                  return (
                    <option key={e.id} value={e.id}>
                      {batch?.batch_code} — {vaccine?.name} ({room?.description}, {loc?.name})
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Data e Hora do Descarte *</Label>
              <DateTimePicker
                value={formDateTime}
                onValueChange={setFormDateTime}
              />
            </div>

            <div className="space-y-1">
              <Label>Motivo do Descarte *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formDiscardReasonId}
                onChange={(e) => setFormDiscardReasonId(e.target.value)}
              >
                <option value="">Selecione um motivo</option>
                {bottleDiscardReasons.filter(r => !r.is_deleted).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Alguma observação relevante..."
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving || !formBatchEntryId || !formDiscardReasonId}
            >
              {saving ? 'Salvando...' : 'Registrar Descarte'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSheetOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Descarte</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este registro de descarte? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
