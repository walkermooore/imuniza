import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { Batch, BatchRoomEntry, BottleOpening, PaginatedMeta, PaginatedResponse } from '../../types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DateInput, DateTimeInput } from '../../components/ui/date-input'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
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
import { formatDateBR, formatDateTimeWithAtBR, toIsoDateInput, toLocalDateTimeInput } from '../../lib/utils'
import { paginate } from '../../lib/pagination'
import { CreateBatchWizard } from '../../components/CreateBatchWizard'
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker'

const PAGE_SIZE = 20

// ─── API shapes (snake_case) ──────────────────────────────────────────────────

interface ApiBatch {
  id: string
  batch_code: string
  vaccine_id: string
  expiry_date: string
  closed_bottle_expiry_date: string
  open_bottle_expiry_minutes: number
  doses_per_bottle: number
  ml_per_dose: number
  is_deleted: boolean
  created_by: string
  created_at: string
}

interface ApiBatchRoomEntry {
  id: string
  batch_id: string
  vaccine_room_id: string
  bottle_count: number
  source_batch_entry_id?: string
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

interface ApiDiscardReason {
  id: string
  name: string
  is_default: boolean
  is_deleted: boolean
  created_at: string
}

interface ApiOpeningReason {
  id: string
  name: string
  is_default: boolean
  is_deleted: boolean
  created_at: string
}

interface ApiBottleOpening {
  id: string
  batch_entry_id: string
  vaccine_room_id: string
  opened_at: string
  comment?: string
  opening_reason_id?: string
  alert_triggered: boolean
  is_cancelled: boolean
  cancelled_by?: string
  cancelled_at?: string
  created_by: string
  created_at: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapApiBatch(a: ApiBatch): Batch {
  return {
    id: a.id,
    batchCode: a.batch_code,
    vaccineId: a.vaccine_id,
    expiryDate: a.expiry_date,
    closedBottleExpiryDate: a.closed_bottle_expiry_date,
    openBottleExpiryMinutes: a.open_bottle_expiry_minutes,
    dosesPerBottle: a.doses_per_bottle,
    mlPerDose: a.ml_per_dose,
    isDeleted: a.is_deleted,
    createdBy: a.created_by,
    createdAt: a.created_at,
  }
}

function mapApiBatchRoomEntry(a: ApiBatchRoomEntry): BatchRoomEntry {
  return {
    id: a.id,
    batchId: a.batch_id,
    vaccineRoomId: a.vaccine_room_id,
    bottleCount: a.bottle_count,
    sourceBatchEntryId: a.source_batch_entry_id,
    isDeleted: a.is_deleted,
    createdBy: a.created_by,
    createdAt: a.created_at,
  }
}

function mapApiBottleOpening(a: ApiBottleOpening): BottleOpening {
  return {
    id: a.id,
    batchEntryId: a.batch_entry_id,
    vaccineRoomId: a.vaccine_room_id,
    openedAt: a.opened_at,
    comment: a.comment,
    openingReasonId: a.opening_reason_id,
    alertTriggered: a.alert_triggered,
    isCancelled: a.is_cancelled,
    cancelledBy: a.cancelled_by,
    cancelledAt: a.cancelled_at,
    createdBy: a.created_by,
    createdAt: a.created_at,
  }
}

// ─── Error helper ─────────────────────────────────────────────────────────────

async function getApiErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string; message?: string }
    return body.detail ?? body.message ?? 'Erro desconhecido.'
  } catch {
    return 'Erro desconhecido.'
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 9 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function BatchStatusBadge({ expiryDate }: { expiryDate: string }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  const diffMs = exp.getTime() - today.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return <Badge variant="destructive">Vencido</Badge>
  if (diffDays <= 30) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Vencendo</Badge>
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Válido</Badge>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LotesPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { vaccineRooms } = useVaccineRooms()
  const { toast } = useToast()
  const role = currentUser?.role
  const isAdmin = role === 'administrador'
  const isGestor = role === 'gestor'
  const canCreate = isAdmin || isGestor
  const canDelete = isAdmin || isGestor

  // ── API state ───────────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<BatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<{ id: string; name: string; isDeleted: boolean }[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string; isDeleted: boolean }[]>([])
  const [bottleDiscardReasons, setBottleDiscardReasons] = useState<{ id: string; name: string; isDefault: boolean; isDeleted: boolean }[]>([])
  const [bottleOpeningReasons, setBottleOpeningReasons] = useState<{ id: string; name: string; isDefault: boolean; isDeleted: boolean }[]>([])
  const [bottleOpenings, setBottleOpenings] = useState<BottleOpening[]>([])

  // ── Loading / pagination ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  // ── Wizard sheet ────────────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false)

  // ── Delete dialog ───────────────────────────────────────────────────────────
  const [deleteEntry, setDeleteEntry] = useState<BatchRoomEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Edit dialog ─────────────────────────────────────────────────────────────
  const [editEntry, setEditEntry] = useState<BatchRoomEntry | null>(null)
  const [editExpiryDate, setEditExpiryDate] = useState('')
  const [editClosedExpiryDate, setEditClosedExpiryDate] = useState('')
  const [editOpenExpiryValue, setEditOpenExpiryValue] = useState('')
  const [editOpenExpiryUnit, setEditOpenExpiryUnit] = useState<'minutos' | 'horas'>('horas')
  const [editDosesPerBottle, setEditDosesPerBottle] = useState('')
  const [editMlPerDose, setEditMlPerDose] = useState('')
  const [editBottleCount, setEditBottleCount] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── Mode A discard dialog ───────────────────────────────────────────────────
  const [discardEntry, setDiscardEntry] = useState<BatchRoomEntry | null>(null)
  const [discardReasonId, setDiscardReasonId] = useState('')
  const [discardComment, setDiscardComment] = useState('')
  const [discardError, setDiscardError] = useState('')
  const [discardSaving, setDiscardSaving] = useState(false)

  // ── Opening dialog ──────────────────────────────────────────────────────────
  const [openingEntry, setOpeningEntry] = useState<BatchRoomEntry | null>(null)
  const [openingDateTime, setOpeningDateTime] = useState(toLocalDateTimeInput(new Date()))
  const [openingReasonId, setOpeningReasonId] = useState('')
  const [openingComment, setOpeningComment] = useState('')
  const [openingError, setOpeningError] = useState('')
  const [openingSaving, setOpeningSaving] = useState(false)
  const [openingAlertOpen, setOpeningAlertOpen] = useState(false)
  const [openingAlertReasonId, setOpeningAlertReasonId] = useState('')
  const [openingAlertConflicts, setOpeningAlertConflicts] = useState<BottleOpening[]>([])

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      const [entriesRes, batchesRes] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>(`/batch-room-entries?${params}`),
        apiClient.get<PaginatedResponse<ApiBatch>>(`/batches?page=1&page_size=20`),
      ])
      setBatchRoomEntries(entriesRes.data.map(mapApiBatchRoomEntry))
      setBatches(batchesRes.data.map(mapApiBatch))
      setMeta(entriesRes.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLookups = useCallback(async () => {
    try {
      const [vaccinesRes, locationsRes, discardReasonsRes, openingReasonsRes, openingsRes] =
        await Promise.all([
          apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
          apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
          apiClient.get<PaginatedResponse<ApiDiscardReason>>('/bottle-discard-reasons?page=1&page_size=20'),
          apiClient.get<PaginatedResponse<ApiOpeningReason>>('/bottle-opening-reasons?page=1&page_size=20'),
          apiClient.get<PaginatedResponse<ApiBottleOpening>>('/bottle-openings?page=1&page_size=20'),
        ])
      setVaccines(vaccinesRes.data.map((v) => ({ id: v.id, name: v.name, isDeleted: v.is_deleted })))
      setLocations(locationsRes.data.map((l) => ({ id: l.id, name: l.name, isDeleted: l.is_deleted })))
      setBottleDiscardReasons(discardReasonsRes.data.map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default, isDeleted: r.is_deleted })))
      setBottleOpeningReasons(openingReasonsRes.data.map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default, isDeleted: r.is_deleted })))
      setBottleOpenings(openingsRes.data.map(mapApiBottleOpening))
    } catch {
      // non-critical lookups — UI degrades gracefully
    }
  }, [])

  useEffect(() => {
    void fetchEntries(page)
  }, [page, fetchEntries])

  useEffect(() => {
    void fetchLookups()
  }, [fetchLookups])

  // ── Derived data ────────────────────────────────────────────────────────────
  const activeVaccines = vaccines.filter((v) => !v.isDeleted)
  const activeRooms = vaccineRooms.filter((r) => !r.isDeleted)
  const activeLocations = locations.filter((l) => !l.isDeleted)
  const activeDiscardReasons = bottleDiscardReasons.filter((r) => !r.isDeleted)
  const defaultDiscardReason = activeDiscardReasons.find((r) => r.isDefault)
  const activeOpeningReasons = bottleOpeningReasons.filter((r) => !r.isDeleted)
  const defaultOpeningReason = activeOpeningReasons.find((r) => r.isDefault)

  const locationById = new Map(activeLocations.map((l) => [l.id, l]))
  const vaccineById = new Map(activeVaccines.map((v) => [v.id, v]))
  const roomById = new Map(vaccineRooms.map((r) => [r.id, r]))

  // List data: join entries with batches + vaccines + rooms
  interface EntryRow {
    entry: BatchRoomEntry
    batch: Batch
    frascosDisponiveis: number
    vaccineName: string
    roomDescription: string
    locationName: string
    batchCode: string
    expiryDate: string
    frascosRecebidos: number
  }

  const entryRows: EntryRow[] = batchRoomEntries.flatMap((entry) => {
    const batch = batches.find((b) => b.id === entry.batchId)
    if (!batch) return []
    // frascosDisponiveis: simplified — show bottleCount (deductions require extra data)
    const frascosDisponiveis = entry.bottleCount
    const vaccine = vaccineById.get(batch.vaccineId)
    const room = roomById.get(entry.vaccineRoomId)
    const loc = locationById.get(room?.locationId ?? '')
    return [{
      entry,
      batch,
      frascosDisponiveis,
      vaccineName: vaccine?.name ?? '',
      roomDescription: room?.description ?? '',
      locationName: loc?.name ?? '',
      batchCode: batch.batchCode,
      expiryDate: batch.expiryDate,
      frascosRecebidos: entry.bottleCount,
    }]
  })

  const q = filter.toLowerCase()
  const filtered = entryRows.filter(({ vaccineName, batch, roomDescription, locationName }) => {
    return (
      batch.batchCode.toLowerCase().includes(q) ||
      vaccineName.toLowerCase().includes(q) ||
      roomDescription.toLowerCase().includes(q) ||
      locationName.toLowerCase().includes(q)
    )
  })

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered)
  const { data: paginated, meta: localMeta } = paginate(sorted, page, PAGE_SIZE)
  const displayMeta = meta ?? localMeta

  function handleFilterChange(value: string) {
    setFilter(value)
  }

  // ── Edit helpers ────────────────────────────────────────────────────────────

  function openEditDialog(entry: BatchRoomEntry) {
    const batch = batches.find((b) => b.id === entry.batchId)
    if (!batch) return
    setEditEntry(entry)
    setEditExpiryDate(toIsoDateInput(new Date(batch.expiryDate)))
    setEditClosedExpiryDate(toIsoDateInput(new Date(batch.closedBottleExpiryDate)))
    const isHours = batch.openBottleExpiryMinutes % 60 === 0
    if (isHours) {
      setEditOpenExpiryValue(String(batch.openBottleExpiryMinutes / 60))
      setEditOpenExpiryUnit('horas')
    } else {
      setEditOpenExpiryValue(String(batch.openBottleExpiryMinutes))
      setEditOpenExpiryUnit('minutos')
    }
    setEditDosesPerBottle(String(batch.dosesPerBottle))
    setEditMlPerDose(String(batch.mlPerDose))
    setEditBottleCount(String(entry.bottleCount))
    setEditError('')
  }

  async function handleEdit() {
    if (!editEntry) return
    setEditError('')
    const openExpiryMinutes = editOpenExpiryUnit === 'horas'
      ? Number(editOpenExpiryValue) * 60
      : Number(editOpenExpiryValue)

    setEditSaving(true)
    try {
      // 1. Update batch
      await apiClient.put(`/batches/${editEntry.batchId}`, {
        expiry_date: new Date(editExpiryDate).toISOString(),
        closed_bottle_expiry_date: new Date(editClosedExpiryDate).toISOString(),
        open_bottle_expiry_minutes: openExpiryMinutes,
        doses_per_bottle: Number(editDosesPerBottle),
        ml_per_dose: Number(editMlPerDose),
      })
      // 2. Update entry
      await apiClient.put(`/batch-room-entries/${editEntry.id}`, {
        bottle_count: Number(editBottleCount),
      })

      toast({ title: 'Lote atualizado com sucesso.' })
      setEditEntry(null)
      void fetchEntries(page)
    } catch (err) {
      setEditError(await getApiErrorMessage(err as Response))
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete helpers ──────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteEntry) return
    setDeleting(true)
    try {
      await apiClient.delete(`/batch-room-entries/${deleteEntry.id}`)
      toast({ title: 'Lote removido da sala.' })
      setDeleteEntry(null)
      void fetchEntries(page)
    } catch (err) {
      toast({ title: 'Erro ao remover lote.', description: await getApiErrorMessage(err as Response), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Mode A Discard helpers ──────────────────────────────────────────────────

  function openDiscardDialog(entry: BatchRoomEntry) {
    setDiscardEntry(entry)
    setDiscardReasonId(defaultDiscardReason?.id ?? '')
    setDiscardComment('')
    setDiscardError('')
  }

  async function handleDiscard() {
    if (!discardEntry || !discardReasonId) return
    setDiscardSaving(true)
    try {
      await apiClient.post('/bottle-discards', {
        batch_entry_id: discardEntry.id,
        discard_reason_id: discardReasonId,
        discarded_at: new Date().toISOString(),
        comment: discardComment || undefined,
      })
      toast({ title: 'Frasco descartado com sucesso.' })
      setDiscardEntry(null)
      void fetchEntries(page)
    } catch (err) {
      setDiscardError(await getApiErrorMessage(err as Response))
    } finally {
      setDiscardSaving(false)
    }
  }

  // ── Opening helpers ─────────────────────────────────────────────────────────

  function openOpeningDialog(entry: BatchRoomEntry) {
    setOpeningEntry(entry)
    setOpeningDateTime(toLocalDateTimeInput(new Date()))
    setOpeningReasonId(defaultOpeningReason?.id ?? '')
    setOpeningComment('')
    setOpeningError('')
  }

  function checkForConflicts(entry: BatchRoomEntry): BottleOpening[] {
    const batch = batches.find(b => b.id === entry.batchId)
    if (!batch) return []
    const vaccineId = batch.vaccineId
    const roomId = entry.vaccineRoomId
    const windowMs = 600 * 60 * 1000 // 10 hours

    return bottleOpenings.filter(op => {
      if (op.isCancelled) return false
      if (op.vaccineRoomId !== roomId) return false
      const opEntry = batchRoomEntries.find(e => e.id === op.batchEntryId)
      const opBatch = opEntry ? batches.find(b => b.id === opEntry.batchId) : null
      if (!opBatch || opBatch.vaccineId !== vaccineId) return false
      const openedAgo = Date.now() - new Date(op.openedAt).getTime()
      return openedAgo <= windowMs
    })
  }

  async function handleOpeningSubmit() {
    if (!openingEntry) return
    const conflicts = checkForConflicts(openingEntry)
    if (conflicts.length > 0) {
      setOpeningAlertConflicts(conflicts)
      setOpeningAlertReasonId(openingReasonId)
      setOpeningAlertOpen(true)
    } else {
      await saveOpening(false, openingReasonId)
    }
  }

  async function saveOpening(alertTriggered: boolean, reasonId: string) {
    if (!openingEntry) return
    setOpeningSaving(true)
    try {
      await apiClient.post('/bottle-openings', {
        batch_entry_id: openingEntry.id,
        vaccine_room_id: openingEntry.vaccineRoomId,
        opened_at: new Date(openingDateTime).toISOString(),
        opening_reason_id: reasonId || undefined,
        comment: openingComment || undefined,
        alert_triggered: alertTriggered,
      })
      toast({ title: 'Abertura registrada com sucesso.' })
      setOpeningEntry(null)
      setOpeningAlertOpen(false)
      void fetchEntries(page)
      void fetchLookups()
    } catch (err) {
      setOpeningError(await getApiErrorMessage(err as Response))
    } finally {
      setOpeningSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lotes por Sala</h1>
          <p className="text-muted-foreground">
            Gerencie o estoque de frascos em cada sala de vacina.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lote
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Filtrar por vacina, lote, sala ou UBS..."
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('vaccineName')}>
                <span className="flex items-center gap-1">
                  Vacina {sortKey === 'vaccineName' && (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  {sortKey !== 'vaccineName' && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Sala / UBS</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('expiryDate')}>
                <span className="flex items-center gap-1">
                  Validade {sortKey === 'expiryDate' && (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  {sortKey !== 'expiryDate' && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Frascos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhum lote encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ entry, batch, vaccineName, roomDescription, locationName, frascosDisponiveis }) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{vaccineName}</TableCell>
                  <TableCell>{batch.batchCode}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{roomDescription}</div>
                      <div className="text-xs text-muted-foreground">{locationName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateBR(batch.expiryDate)}
                  </TableCell>
                  <TableCell>
                    <BatchStatusBadge expiryDate={batch.expiryDate} />
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {frascosDisponiveis}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => openOpeningDialog(entry)}
                      >
                        Abrir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => openDiscardDialog(entry)}
                      >
                        Descartar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteEntry(entry)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {displayMeta && displayMeta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {paginated.length} de {displayMeta.total} lotes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!displayMeta.has_prev}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm font-medium">
              Página {displayMeta.page} de {displayMeta.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!displayMeta.has_next}
              onClick={() => setPage(p => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Wizard */}
      <CreateBatchWizard
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => { setSheetOpen(false); void fetchEntries(1) }}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Lote</DialogTitle>
            <DialogDescription>
              Atualize as informações do lote e estoque para esta sala.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1">
              <Label>Validade do Lote *</Label>
              <DatePicker value={editExpiryDate} onValueChange={setEditExpiryDate} />
            </div>
            <div className="space-y-1">
              <Label>Validade Frasco Fechado *</Label>
              <DatePicker value={editClosedExpiryDate} onValueChange={setEditClosedExpiryDate} />
            </div>
            <div className="space-y-1">
              <Label>Validade Frasco Aberto *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={editOpenExpiryValue}
                  onChange={(e) => setEditOpenExpiryValue(e.target.value)}
                />
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editOpenExpiryUnit}
                  onChange={(e) => setEditOpenExpiryUnit(e.target.value as any)}
                >
                  <option value="minutos">min</option>
                  <option value="horas">horas</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Doses por Frasco *</Label>
              <Input
                type="number"
                value={editDosesPerBottle}
                onChange={(e) => setEditDosesPerBottle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>ML por Dose *</Label>
              <Input
                type="number"
                step="0.1"
                value={editMlPerDose}
                onChange={(e) => setEditMlPerDose(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Quantidade de Frascos *</Label>
              <Input
                type="number"
                value={editBottleCount}
                onChange={(e) => setEditBottleCount(e.target.value)}
              />
            </div>
          </div>
          {editError && <p className="text-sm text-red-500 font-medium">{editError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Lote</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este lote desta sala? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo...' : 'Confirmar Remoção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mode A Discard Dialog */}
      <Dialog open={!!discardEntry} onOpenChange={(open) => !open && setDiscardEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar Frasco (Frasco Fechado)</DialogTitle>
            <DialogDescription>
              Registre o descarte de um frasco fechado deste lote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Motivo do Descarte *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={discardReasonId}
                onChange={(e) => setDiscardReasonId(e.target.value)}
              >
                <option value="">Selecione um motivo</option>
                {activeDiscardReasons.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Alguma observação relevante..."
                value={discardComment}
                onChange={(e) => setDiscardComment(e.target.value)}
              />
            </div>
          </div>
          {discardError && <p className="text-sm text-red-500 font-medium">{discardError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardEntry(null)}>Cancelar</Button>
            <Button onClick={handleDiscard} disabled={discardSaving || !discardReasonId}>
              {discardSaving ? 'Salvando...' : 'Confirmar Descarte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opening Dialog */}
      <Dialog open={!!openingEntry} onOpenChange={(open) => !open && setOpeningEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Frasco</DialogTitle>
            <DialogDescription>
              Registre a abertura de um novo frasco deste lote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Data e Hora de Abertura *</Label>
              <DateTimePicker value={openingDateTime} onValueChange={setOpeningDateTime} />
            </div>
            <div className="space-y-1">
              <Label>Motivo da Abertura</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={openingReasonId}
                onChange={(e) => setOpeningReasonId(e.target.value)}
              >
                <option value="">Selecione um motivo (opcional)</option>
                {activeOpeningReasons.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Alguma observação relevante..."
                value={openingComment}
                onChange={(e) => setOpeningComment(e.target.value)}
              />
            </div>
          </div>
          {openingError && <p className="text-sm text-red-500 font-medium">{openingError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpeningEntry(null)}>Cancelar</Button>
            <Button onClick={handleOpeningSubmit} disabled={openingSaving}>
              {openingSaving ? 'Salvando...' : 'Registrar Abertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opening Conflict Alert */}
      <Dialog open={openingAlertOpen} onOpenChange={setOpeningAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Frasco já aberto
            </DialogTitle>
            <DialogDescription className="pt-2">
              Já existe um frasco desta mesma vacina aberto nesta sala nas últimas 10 horas:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {openingAlertConflicts.map(op => (
              <div key={op.id} className="text-sm p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                <div className="font-medium">Aberto em {formatDateTimeWithAtBR(op.openedAt)}</div>
                <div className="text-xs text-muted-foreground">Por {op.createdBy}</div>
              </div>
            ))}
            <p className="text-sm font-medium pt-2">
              Deseja abrir um novo frasco mesmo assim?
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpeningAlertOpen(false)} className="flex-1">
              Não, cancelar
            </Button>
            <Button onClick={() => saveOpening(true, openingAlertReasonId)} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
              Sim, abrir novo frasco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
