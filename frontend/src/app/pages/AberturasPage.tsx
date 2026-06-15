import { useCallback, useEffect, useState, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { PaginatedResponse, PaginatedMeta, BatchRoomEntry } from '../../types'
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
import {
  formatDateTimeBR,
  formatDateTimeWithAtBR,
  toIsoDateInput,
  toLocalDateTimeInput,
} from '../../lib/utils'
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker'
import { AsyncCombobox, type ComboboxOption } from '@/components/ui/async-combobox'

const PAGE_SIZE = 20

// ─── API types ─────────────────────────────────────────────────────────────────

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
  bulk_opening_id?: string
  created_by: string
  created_at: string
  user_name: string
}

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

interface ApiOpeningReason {
  id: string
  name: string
  is_default: boolean
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

interface ApiLocation {
  id: string
  name: string
  address: string
  type: string
  is_deleted: boolean
  created_at: string
}

// ─── Local view types ──────────────────────────────────────────────────────────

interface ViewOpening extends ApiBottleOpening {
  _vaccineName: string
  _batchCode: string
  _roomDescription: string
  _locationName: string
  _creatorName: string
  _openBottleExpiryMinutes: number
  _dosesPerBottle: number
  _batchId: string
  _vaccineRoomId: string
}

// ─── useCountdown hook ─────────────────────────────────────────────────────────

function useCountdown(openedAt: string, expiryMinutes: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const expiryMs = new Date(openedAt).getTime() + expiryMinutes * 60 * 1000
  const timeLeft = expiryMs - now
  const isExpired = timeLeft <= 0
  const isWarning = !isExpired && timeLeft < 30 * 60 * 1000
  return { timeLeft, isExpired, isWarning }
}

// ─── CountdownCell component ───────────────────────────────────────────────────

function CountdownCell({
  openedAt,
  expiryMinutes,
  isCancelled,
  isDiscarded,
}: {
  openedAt: string
  expiryMinutes: number
  isCancelled: boolean
  isDiscarded: boolean
}) {
  const { timeLeft, isExpired, isWarning } = useCountdown(openedAt, expiryMinutes)

  if (isCancelled || isDiscarded) return <span className="text-gray-400">—</span>

  const totalMs = expiryMinutes * 60 * 1000
  const progress = isExpired ? 0 : Math.max(0, Math.min(100, (timeLeft / totalMs) * 100))

  const absMs = Math.abs(timeLeft)
  const hours = Math.floor(absMs / (1000 * 60 * 60))
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((absMs % (1000 * 60)) / 1000)

  const text = isExpired
    ? 'Vencido'
    : hours > 0
      ? `${hours}h ${String(minutes).padStart(2, '0')}min`
      : `${String(minutes).padStart(2, '0')}min ${String(seconds).padStart(2, '0')}s`

  return (
    <div className="space-y-1 min-w-[110px]">
      <span
        className={`text-sm font-medium ${isExpired ? 'text-red-600' : isWarning ? 'text-yellow-700' : 'text-gray-700'
          }`}
      >
        {text}
      </span>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-none ${isExpired ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
            }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ─── LiveStatusBadge ────────────────────────────────────────────────────────────

function LiveStatusBadge({
  openedAt,
  expiryMinutes,
  isCancelled,
  isDiscarded,
}: {
  openedAt: string
  expiryMinutes: number
  isCancelled: boolean
  isDiscarded: boolean
}) {
  const { isExpired, isWarning } = useCountdown(openedAt, expiryMinutes)

  if (isCancelled) {
    return (
      <Badge variant="outline" className="line-through text-gray-500">
        Cancelado
      </Badge>
    )
  }
  if (isDiscarded) {
    return <Badge variant="outline" className="text-gray-500">Descartado</Badge>
  }
  if (isExpired) {
    return <Badge variant="destructive">Vencido</Badge>
  }
  if (isWarning) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 animate-pulse">
        Vencendo
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aberto</Badge>
  )
}

// ─── SkeletonRows ──────────────────────────────────────────────────────────────

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

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AberturasPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { vaccineRooms } = useVaccineRooms()
  const { toast } = useToast()

  // ─── Reference data ────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [openingReasons, setOpeningReasons] = useState<ApiOpeningReason[]>([])
  const [discardReasons, setDiscardReasons] = useState<ApiDiscardReason[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])

  // ─── Openings (paginated) ──────────────────────────────────────────────────
  const [openings, setOpenings] = useState<ApiBottleOpening[]>([])
  const [meta, setMeta] = useState<PaginatedMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // ─── Filter state ──────────────────────────────────────────────────────────
  const [filter, setFilter] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(toIsoDateInput(new Date()))
  const [filterDateTo, setFilterDateTo] = useState(toIsoDateInput(new Date()))

  // ─── Opening Sheet state ───────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formBatchEntryId, setFormBatchEntryId] = useState('')
  const [formOpenedAt, setFormOpenedAt] = useState(toLocalDateTimeInput(new Date()))
  const [formOpeningReasonId, setFormOpeningReasonId] = useState('')
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving] = useState(false)

  // ─── Alert modal state ─────────────────────────────────────────────────────
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertReasonId, setAlertReasonId] = useState('')
  const [alertConflicts, setAlertConflicts] = useState<ViewOpening[]>([])

  // ─── Cancel dialog state ───────────────────────────────────────────────────
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelTargetId, setCancelTargetId] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // ─── Edit opening dialog state ─────────────────────────────────────────────
  const [editOpeningId, setEditOpeningId] = useState('')
  const [editComment, setEditComment] = useState('')
  const [editReasonId, setEditReasonId] = useState('')
  const [editAlertTriggered, setEditAlertTriggered] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // ─── Mode B discard modal state ────────────────────────────────────────────
  const [discardModalOpen, setDiscardModalOpen] = useState(false)
  const [discardOpeningId, setDiscardOpeningId] = useState('')
  const [discardBatchEntryId, setDiscardBatchEntryId] = useState('')
  const [discardReasonId, setDiscardReasonId] = useState('')
  const [discardDoses, setDiscardDoses] = useState('')
  const [discardComment, setDiscardComment] = useState('')
  const [discardDateTime, setDiscardDateTime] = useState(toLocalDateTimeInput(new Date()))
  const [discardSaving, setDiscardSaving] = useState(false)

  // ─── Fetch reference data ──────────────────────────────────────────────────

  const fetchReferenceData = useCallback(async () => {
    try {
      const [
        batchesRes,
        entriesRes,
        vaccinesRes,
        locationsRes,
        openingReasonsRes,
        discardReasonsRes,
        discardsRes,
      ] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiOpeningReason>>('/bottle-opening-reasons?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiDiscardReason>>('/bottle-discard-reasons?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleDiscard>>('/bottle-discards?page=1&page_size=20'),
      ])
      setBatches(batchesRes.data)
      setBatchRoomEntries(entriesRes.data)
      setVaccines(vaccinesRes.data)
      setLocations(locationsRes.data)
      setOpeningReasons(openingReasonsRes.data)
      setDiscardReasons(discardReasonsRes.data)
      setBottleDiscards(discardsRes.data)
    } catch {
      // non-critical — page still loads with empty dropdowns
    }
  }, [])

  // ─── Fetch openings (server-side pagination) ───────────────────────────────

  const fetchOpenings = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      const res = await apiClient.get<PaginatedResponse<ApiBottleOpening>>(`/bottle-openings?${params}`)
      setOpenings(res.data)
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReferenceData()
  }, [fetchReferenceData])

  useEffect(() => {
    void fetchOpenings(currentPage)
  }, [currentPage, fetchOpenings])

  // ─── Scope helpers ─────────────────────────────────────────────────────────

  const availableEntries = useMemo(() => {
    return batchRoomEntries.filter(e => {
      if (e.is_deleted) return false
      const batch = batches.find(b => b.id === e.batch_id && !b.is_deleted)
      if (!batch) return false
      return true
    })
  }, [batchRoomEntries, batches])

  function isBatchExpired(batchEntryId: string): boolean {
    const entry = batchRoomEntries.find(e => e.id === batchEntryId)
    if (!entry) return false
    const batch = batches.find(b => b.id === entry.batch_id)
    if (!batch) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(batch.expiry_date) < today
  }

  function isDiscarded(openingId: string): boolean {
    return bottleDiscards.some(d => d.bottle_opening_id === openingId && !d.is_cancelled)
  }

  // ─── Derived defaults ──────────────────────────────────────────────────────
  const defaultOpeningReason = openingReasons.find(r => r.is_default && !r.is_deleted)

  // ─── Alert check logic ─────────────────────────────────────────────────────

  function checkForConflicts(batchEntryId: string): ViewOpening[] {
    const entry = batchRoomEntries.find(e => e.id === batchEntryId)
    if (!entry) return []
    const batch = batches.find(b => b.id === entry.batch_id)
    if (!batch) return []
    const vaccineId = batch.vaccine_id
    const roomId = entry.vaccine_room_id

    const windowMs = 600 * 60 * 1000 // default 600 minutes window

    return openings
      .filter(op => {
        if (op.is_cancelled) return false
        if (isDiscarded(op.id)) return false
        if (op.vaccine_room_id !== roomId) return false
        const opEntry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
        if (!opEntry) return false
        const opBatch = batches.find(b => b.id === opEntry.batch_id)
        if (!opBatch) return false
        if (opBatch.vaccine_id !== vaccineId) return false
        const openedAgo = Date.now() - new Date(op.opened_at).getTime()
        if (openedAgo > windowMs) return false
        return true
      })
      .map(op => {
        const opEntry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
        const opBatch = opEntry ? batches.find(b => b.id === opEntry.batch_id) : undefined
        const vaccine = opBatch ? vaccines.find(v => v.id === opBatch.vaccine_id) : undefined
        const room = vaccineRooms.find(r => r.id === op.vaccine_room_id)
        const loc = room ? locations.find(l => l.id === room.locationId) : undefined
        return {
          ...op,
          _vaccineName: vaccine?.name ?? '',
          _batchCode: opBatch?.batch_code ?? '',
          _roomDescription: room?.description ?? '',
          _locationName: loc?.name ?? '',
          _creatorName: op.created_by,
          _openBottleExpiryMinutes: opBatch?.open_bottle_expiry_minutes ?? 0,
          _dosesPerBottle: opBatch?.doses_per_bottle ?? 0,
          _batchId: opBatch?.id ?? '',
          _vaccineRoomId: opEntry?.vaccine_room_id ?? '',
        }
      })
  }

  // ─── Save opening ──────────────────────────────────────────────────────────

  async function handleSave(alertTriggered: boolean, reasonId?: string) {
    if (!currentUser || !formBatchEntryId) return
    setSaving(true)
    try {
      const entry = batchRoomEntries.find(e => e.id === formBatchEntryId)!
      const openedAtIso = new Date(formOpenedAt).toISOString()

      await apiClient.post('/bottle-openings', {
        batch_entry_id: formBatchEntryId,
        vaccine_room_id: entry.vaccine_room_id,
        opened_at: openedAtIso,
        comment: formComment || undefined,
        opening_reason_id: reasonId || undefined,
        alert_triggered: alertTriggered,
      })

      toast({ title: 'Abertura registrada com sucesso!' })
      setSheetOpen(false)
      resetForm()
      await fetchOpenings(currentPage)
      await fetchReferenceData()
    } catch {
      toast({ title: 'Erro ao registrar abertura.', variant: 'destructive' })
    } finally {
      setSaving(false)
      setAlertOpen(false)
    }
  }

  async function handleFormSubmit() {
    if (!formBatchEntryId) return
    if (isBatchExpired(formBatchEntryId)) return

    const conflicts = checkForConflicts(formBatchEntryId)
    if (conflicts.length > 0) {
      setAlertConflicts(conflicts)
      setAlertReasonId(formOpeningReasonId || (defaultOpeningReason?.id ?? ''))
      setAlertOpen(true)
    } else {
      await handleSave(false, formOpeningReasonId || undefined)
    }
  }

  function openEditDialog(op: ApiBottleOpening) {
    setEditOpeningId(op.id)
    setEditComment(op.comment ?? '')
    setEditReasonId(op.opening_reason_id ?? defaultOpeningReason?.id ?? '')
    setEditAlertTriggered(op.alert_triggered)
    setEditDialogOpen(true)
  }

  async function handleEditSave() {
    if (!editOpeningId) return
    setEditSaving(true)
    try {
      await apiClient.put(`/bottle-openings/${editOpeningId}`, {
        comment: editComment || undefined,
        opening_reason_id: editReasonId || undefined,
      })
      toast({ title: 'Abertura atualizada com sucesso.' })
      setEditDialogOpen(false)
      await fetchOpenings(currentPage)
    } catch {
      toast({ title: 'Erro ao atualizar abertura.', variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  function resetForm() {
    setFormBatchEntryId('')
    setFormOpenedAt(toLocalDateTimeInput(new Date()))
    setFormOpeningReasonId(defaultOpeningReason?.id ?? '')
    setFormComment('')
  }

  // ─── Cancel opening ────────────────────────────────────────────────────────

  function openCancelDialog(openingId: string) {
    setCancelTargetId(openingId)
    setCancelDialogOpen(true)
  }

  async function handleCancel() {
    if (!currentUser || !cancelTargetId) return
    setCancelling(true)
    try {
      await apiClient.post(`/bottle-openings/${cancelTargetId}/cancel`, {})
      toast({ title: 'Abertura cancelada.' })
      setCancelDialogOpen(false)
      await fetchOpenings(currentPage)
    } catch {
      toast({ title: 'Erro ao cancelar abertura.', variant: 'destructive' })
    } finally {
      setCancelling(false)
    }
  }

  // ─── Mode B discard ────────────────────────────────────────────────────────

  function openDiscardModal(openingId: string, batchEntryId: string) {
    setDiscardOpeningId(openingId)
    setDiscardBatchEntryId(batchEntryId)
    const defaultReason = discardReasons.find(r => r.is_default && !r.is_deleted)
    setDiscardReasonId(defaultReason?.id ?? '')
    setDiscardDoses('')
    setDiscardComment('')
    setDiscardDateTime(toLocalDateTimeInput(new Date()))
    setDiscardModalOpen(true)
  }

  async function handleDiscardSave() {
    if (!currentUser || !discardOpeningId || !discardBatchEntryId || !discardReasonId) return
    const entry = batchRoomEntries.find(e => e.id === discardBatchEntryId)
    const batch = entry ? batches.find(b => b.id === entry.batch_id) : undefined

    const dosesVal = parseInt(discardDoses, 10)
    if (isNaN(dosesVal) || dosesVal < 0) return
    if (batch && dosesVal > batch.doses_per_bottle) return

    setDiscardSaving(true)
    try {
      await apiClient.post('/bottle-discards', {
        batch_entry_id: discardBatchEntryId,
        bottle_opening_id: discardOpeningId,
        discarded_at: new Date(discardDateTime).toISOString(),
        discard_reason_id: discardReasonId,
        remaining_doses: dosesVal,
        comment: discardComment || undefined,
      })

      toast({ title: 'Frasco descartado com sucesso!' })
      setDiscardModalOpen(false)
      await fetchOpenings(currentPage)
      await fetchReferenceData()
    } catch {
      toast({ title: 'Erro ao registrar descarte.', variant: 'destructive' })
    } finally {
      setDiscardSaving(false)
    }
  }

  // ─── Display rows ──────────────────────────────────────────────────────────

  const displayRows = useMemo((): ViewOpening[] => {
    const dateFrom = filterDateFrom ? new Date(filterDateFrom + 'T00:00:00') : null
    const dateTo = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null

    return openings
      .filter(op => {
        const entry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
        if (!entry) return false

        const opDate = new Date(op.opened_at)
        if (dateFrom && opDate < dateFrom) return false
        if (dateTo && opDate > dateTo) return false

        const batch = batches.find(b => b.id === entry.batch_id)
        const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : undefined
        const room = vaccineRooms.find(r => r.id === op.vaccine_room_id)
        const loc = room ? locations.find(l => l.id === room.locationId) : undefined

        const q = filter.toLowerCase()
        if (!q) return true
        return (
          (vaccine?.name ?? '').toLowerCase().includes(q) ||
          (batch?.batch_code ?? '').toLowerCase().includes(q) ||
          (room?.description ?? '').toLowerCase().includes(q) ||
          (loc?.name ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .map(op => {
        const entry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
        const batch = entry ? batches.find(b => b.id === entry.batch_id) : undefined
        const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : undefined
        const room = vaccineRooms.find(r => r.id === op.vaccine_room_id)
        const loc = room ? locations.find(l => l.id === room.locationId) : undefined
        return {
          ...op,
          _vaccineName: vaccine?.name ?? '',
          _batchCode: batch?.batch_code ?? '',
          _roomDescription: room?.description ?? '',
          _locationName: loc?.name ?? '',
          _creatorName: op.created_by,
          _openBottleExpiryMinutes: batch?.open_bottle_expiry_minutes ?? 0,
          _dosesPerBottle: batch?.doses_per_bottle ?? 0,
          _batchId: batch?.id ?? '',
          _vaccineRoomId: entry?.vaccine_room_id ?? '',
        }
      })
  }, [openings, batchRoomEntries, batches, vaccines, vaccineRooms, locations, filter, filterDateFrom, filterDateTo])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(displayRows)

  function setFilterAndReset(v: string) {
    setFilter(v)
    setCurrentPage(1)
  }

  function setDateFilterAndReset(from: string, to: string) {
    setFilterDateFrom(from)
    setFilterDateTo(to)
    setCurrentPage(1)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getEntryLabel(entryId: string): string {
    const entry = batchRoomEntries.find(e => e.id === entryId)
    if (!entry) return entryId
    const batch = batches.find(b => b.id === entry.batch_id)
    const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : undefined
    const room = vaccineRooms.find(r => r.id === entry.vaccine_room_id)
    const loc = room ? locations.find(l => l.id === room.locationId) : undefined
    return `${batch?.batch_code ?? '?'} — ${vaccine?.name ?? '?'} (${room?.description ?? '?'}, ${loc?.name ?? '?'})`
  }

  const fetchBatchEntryOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({
        page: '1',
        page_size: String(limit),
        q: search,
      })
      const res = await apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>(`/batch-room-entries?${params}`)
      return res.data.map(entry => {
        const batch = batches.find(b => b.id === entry.batch_id)
        const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : undefined
        const room = vaccineRooms.find(r => r.id === entry.vaccine_room_id)
        const loc = room ? locations.find(l => l.id === room.locationId) : undefined
        return {
          value: entry.id,
          label: `${batch?.batch_code ?? '?'} — ${vaccine?.name ?? '?'} (${room?.description ?? '?'}, ${loc?.name ?? '?'})`,
        }
      })
    } catch {
      return []
    }
  }, [batches, vaccines, vaccineRooms, locations])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aberturas de Frascos</h1>
          <p className="text-muted-foreground">
            Gerencie o tempo de vida de frascos abertos e controle o desperdício.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Abertura
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1">
          <Label>Filtrar por vacina, lote ou sala</Label>
          <Input
            placeholder="Ex: BCG, Lote 123, Sala 01..."
            value={filter}
            onChange={(e) => setFilterAndReset(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>De</Label>
          <DateInput
            value={filterDateFrom}
            onValueChange={(v) => setDateFilterAndReset(v, filterDateTo)}
          />
        </div>
        <div className="space-y-1">
          <Label>Até</Label>
          <DateInput
            value={filterDateTo}
            onValueChange={(v) => setDateFilterAndReset(filterDateFrom, v)}
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
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('opened_at')}>
                <span className="flex items-center gap-1">
                  Aberto em {sortKey === 'opened_at' && (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  {sortKey !== 'opened_at' && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </TableHead>
              <TableHead>Tempo Restante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Nenhuma abertura encontrada.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((op) => (
                <TableRow key={op.id} className={op.is_cancelled ? 'bg-gray-50/50' : ''}>
                  <TableCell className="font-medium">{op._vaccineName}</TableCell>
                  <TableCell>{op._batchCode}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{op._roomDescription}</div>
                      <div className="text-xs text-muted-foreground">{op._locationName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTimeBR(op.opened_at)}
                  </TableCell>
                  <TableCell>
                    <CountdownCell
                      openedAt={op.opened_at}
                      expiryMinutes={op._openBottleExpiryMinutes}
                      isCancelled={op.is_cancelled}
                      isDiscarded={isDiscarded(op.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <LiveStatusBadge
                      openedAt={op.opened_at}
                      expiryMinutes={op._openBottleExpiryMinutes}
                      isCancelled={op.is_cancelled}
                      isDiscarded={isDiscarded(op.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {op.user_name || op._creatorName}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!op.is_cancelled && !isDiscarded(op.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => openDiscardModal(op.id, op.batch_entry_id)}
                        >
                          Descartar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(op)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!op.is_cancelled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => openCancelDialog(op.id)}
                        >
                          <AlertTriangle className="h-4 w-4" />
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

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {sorted.length} de {meta.total} aberturas
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

      {/* Opening Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nova Abertura de Frasco</SheetTitle>
            <SheetDescription>
              Selecione o lote e informe o horário de abertura.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label>Lote / Sala *</Label>
              <AsyncCombobox
                value={formBatchEntryId}
                onValueChange={setFormBatchEntryId}
                fetchOptions={fetchBatchEntryOptions}
                placeholder="Pesquisar lote ou sala..."
                emptyMessage="Nenhum lote encontrado."
                valueLabel={formBatchEntryId ? getEntryLabel(formBatchEntryId) : undefined}
              />
              {formBatchEntryId && isBatchExpired(formBatchEntryId) && (
                <p className="text-xs text-red-500 font-medium mt-1">
                  Atenção: Este lote está com a data de validade vencida.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Data e Hora de Abertura *</Label>
              <DateTimePicker
                value={formOpenedAt}
                onValueChange={setFormOpenedAt}
              />
            </div>

            <div className="space-y-1">
              <Label>Motivo da Abertura</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formOpeningReasonId}
                onChange={(e) => setFormOpeningReasonId(e.target.value)}
              >
                <option value="">Selecione um motivo (opcional)</option>
                {openingReasons.filter(r => !r.is_deleted).map(r => (
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
              onClick={handleFormSubmit}
              disabled={saving || !formBatchEntryId || isBatchExpired(formBatchEntryId)}
            >
              {saving ? 'Salvando...' : 'Registrar Abertura'}
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

      {/* Alert Dialog for Conflicts */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
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
            {alertConflicts.map(op => (
              <div key={op.id} className="text-sm p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                <div className="font-medium">{op._vaccineName} — Lote {op._batchCode}</div>
                <div className="text-xs text-muted-foreground">
                  Aberto em {formatDateTimeWithAtBR(op.opened_at)} por {op.user_name || op._creatorName}
                </div>
              </div>
            ))}
            <p className="text-sm font-medium pt-2">
              Deseja abrir um novo frasco mesmo assim?
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setAlertOpen(false)} className="flex-1">
              Não, cancelar
            </Button>
            <Button onClick={() => handleSave(true, alertReasonId)} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
              Sim, abrir novo frasco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Abertura</DialogTitle>
            <DialogDescription>
              Atualize as informações da abertura selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Motivo da Abertura</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editReasonId}
                onChange={(e) => setEditReasonId(e.target.value)}
              >
                <option value="">Selecione um motivo</option>
                {openingReasons.filter(r => !r.is_deleted).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Abertura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este registro de abertura? Esta ação não pode ser desfeita.
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

      {/* Mode B Discard Modal */}
      <Dialog open={discardModalOpen} onOpenChange={setDiscardModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar Frasco</DialogTitle>
            <DialogDescription>
              Informe os detalhes do descarte deste frasco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Data e Hora do Descarte *</Label>
              <DateTimePicker
                value={discardDateTime}
                onValueChange={setDiscardDateTime}
              />
            </div>
            <div className="space-y-1">
              <Label>Motivo do Descarte *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={discardReasonId}
                onChange={(e) => setDiscardReasonId(e.target.value)}
              >
                <option value="">Selecione um motivo</option>
                {discardReasons.filter(r => !r.is_deleted).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Doses Restantes (Opcional)</Label>
              <Input
                type="number"
                placeholder="Ex: 2"
                value={discardDoses}
                onChange={(e) => setDiscardDoses(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={discardComment}
                onChange={(e) => setDiscardComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDiscardSave}
              disabled={discardSaving || !discardReasonId}
            >
              {discardSaving ? 'Salvando...' : 'Confirmar Descarte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
