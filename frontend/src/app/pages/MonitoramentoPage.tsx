import { useCallback, useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useTableSort } from '../../hooks/useTableSort'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { PaginatedResponse } from '../../types'
import { Badge } from '../../components/ui/badge'
import { DateInput } from '../../components/ui/date-input'
import { Skeleton } from '../../components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { paginate } from '../../lib/pagination'
import { formatDateBR, formatDateTimeBR, toIsoDateInput } from '../../lib/utils'
import { DatePicker } from '@/components/ui/date-picker'

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

interface ApiTechnicianRoom {
  id: string
  user_id: string
  vaccine_room_id: string
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

// ─── CountdownCell component ────────────────────────────────────────────────────

function CountdownCell({
  openedAt,
  expiryMinutes,
}: {
  openedAt: string
  expiryMinutes: number
}) {
  const { timeLeft, isExpired, isWarning } = useCountdown(openedAt, expiryMinutes)

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
        className={`text-sm font-medium ${
          isExpired ? 'text-red-600' : isWarning ? 'text-yellow-700' : 'text-gray-700'
        }`}
      >
        {text}
      </span>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-none ${
            isExpired ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ─── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({
  openedAt,
  expiryMinutes,
}: {
  openedAt: string
  expiryMinutes: number
}) {
  const { isExpired, isWarning } = useCountdown(openedAt, expiryMinutes)

  if (isExpired) return <Badge variant="destructive">Vencido</Badge>
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

// ─── FrascosAbertos tab ─────────────────────────────────────────────────────────

function FrascosAbertosTab() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { vaccineRooms } = useVaccineRooms()

  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [bottleOpenings, setBottleOpenings] = useState<ApiBottleOpening[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])
  const [technicianRooms, setTechnicianRooms] = useState<ApiTechnicianRoom[]>([])
  const [users, setUsers] = useState<ApiUser[]>([])

  const [loading, setLoading] = useState(true)
  const [filterDateFrom, setFilterDateFrom] = useState(toIsoDateInput(new Date()))
  const [filterDateTo, setFilterDateTo] = useState(toIsoDateInput(new Date()))
  const [filterUbs, setFilterUbs] = useState('')
  const [filterSala, setFilterSala] = useState('')
  const [filterVacina, setFilterVacina] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        openingsRes,
        discardsRes,
        entriesRes,
        batchesRes,
        vaccinesRes,
        locationsRes,
        techRoomsRes,
        usersRes,
      ] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBottleOpening>>('/bottle-openings?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleDiscard>>('/bottle-discards?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiTechnicianRoom>>('/technician-rooms?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiUser>>('/users?page=1&page_size=20'),
      ])
      setBottleOpenings(openingsRes.data)
      setBottleDiscards(discardsRes.data)
      setBatchRoomEntries(entriesRes.data)
      setBatches(batchesRes.data)
      setVaccines(vaccinesRes.data)
      setLocations(locationsRes.data)
      setTechnicianRooms(techRoomsRes.data)
      setUsers(usersRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  // ─── Scope ──────────────────────────────────────────────────────────────────

  const scopedRoomIds = useMemo((): string[] => {
    if (!currentUser) return []
    if (currentUser.role === 'administrador') {
      return vaccineRooms.filter(r => !r.isDeleted).map(r => r.id)
    }
    if (currentUser.role === 'gestor') {
      return vaccineRooms.filter(r => !r.isDeleted).map(r => r.id)
    }
    return technicianRooms
      .filter(tr => tr.user_id === currentUser.id && !tr.is_deleted)
      .map(tr => tr.vaccine_room_id)
  }, [currentUser, vaccineRooms, technicianRooms])

  // ─── Filtered list ──────────────────────────────────────────────────────────

  const rows = useMemo(() => {
    function isDiscarded(openingId: string): boolean {
      return bottleDiscards.some(d => d.bottle_opening_id === openingId && !d.is_cancelled)
    }

    return bottleOpenings
      .filter(op => {
        if (op.is_cancelled) return false
        if (isDiscarded(op.id)) return false

        // Scope check
        const entry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
        if (!entry) return false
        if (!scopedRoomIds.includes(entry.vaccine_room_id)) return false

        // Date filter
        if (filterDateFrom) {
          const from = new Date(filterDateFrom + 'T00:00:00')
          if (new Date(op.opened_at) < from) return false
        }
        if (filterDateTo) {
          const to = new Date(filterDateTo + 'T23:59:59')
          if (new Date(op.opened_at) > to) return false
        }

        const room = vaccineRooms.find(r => r.id === entry.vaccine_room_id)
        const location = locations.find(l => l.id === room?.locationId)
        const batch = batches.find(b => b.id === entry.batch_id)
        const vaccine = vaccines.find(v => v.id === batch?.vaccine_id)

        // UBS filter
        if (filterUbs && location?.id !== filterUbs) return false
        // Sala filter
        if (filterSala && room?.id !== filterSala) return false
        // Vacina filter
        if (filterVacina && vaccine?.id !== filterVacina) return false

        return true
      })
      .map(op => {
        const entry = batchRoomEntries.find(e => e.id === op.batch_entry_id)!
        const room = vaccineRooms.find(r => r.id === entry.vaccine_room_id)
        const location = locations.find(l => l.id === room?.locationId)
        const batch = batches.find(b => b.id === entry.batch_id)
        const vaccine = vaccines.find(v => v.id === batch?.vaccine_id)
        const user = users.find(u => u.id === op.created_by)
        return {
          op, entry, room, location, batch, vaccine, user,
          _vaccineName: vaccine?.name ?? '',
          _batchCode: batch?.batch_code ?? '',
          _roomDescription: room?.description ?? '',
          _locationName: location?.name ?? '',
          _userName: user?.name ?? '',
        }
      })
      .sort((a, b) => new Date(b.op.opened_at).getTime() - new Date(a.op.opened_at).getTime())
  }, [bottleOpenings, bottleDiscards, batchRoomEntries, scopedRoomIds, vaccineRooms, locations, batches, vaccines, users, filterDateFrom, filterDateTo, filterUbs, filterSala, filterVacina])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(rows)
  const { data: paginated, meta } = paginate(sorted, currentPage, PAGE_SIZE)

  // Filter options
  const activeLocations = useMemo(() => {
    return locations.filter(l => !l.is_deleted && vaccineRooms.some(r => scopedRoomIds.includes(r.id) && r.locationId === l.id))
  }, [currentUser, locations, vaccineRooms, scopedRoomIds])

  const scopedRooms = useMemo(() => {
    return vaccineRooms.filter(r => !r.isDeleted && scopedRoomIds.includes(r.id))
  }, [vaccineRooms, scopedRoomIds])

  const availableVaccines = useMemo(() => {
    const vaccineIds = new Set(
      batchRoomEntries
        .filter(e => scopedRoomIds.includes(e.vaccine_room_id))
        .map(e => batches.find(b => b.id === e.batch_id)?.vaccine_id)
        .filter(Boolean) as string[]
    )
    return vaccines.filter(v => !v.is_deleted && vaccineIds.has(v.id))
  }, [vaccines, batchRoomEntries, batches, scopedRoomIds])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">De</label>
          <DatePicker
            value={filterDateFrom}
            onValueChange={value => { setFilterDateFrom(value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Até</label>
          <DatePicker
            value={filterDateTo}
            onValueChange={value => { setFilterDateTo(value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">UBS</label>
          <select
            value={filterUbs}
            onChange={e => { setFilterUbs(e.target.value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {activeLocations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Sala</label>
          <select
            value={filterSala}
            onChange={e => { setFilterSala(e.target.value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {scopedRooms
              .filter(r => !filterUbs || locations.find(l => l.id === r.locationId)?.id === filterUbs)
              .map(r => (
                <option key={r.id} value={r.id}>{r.description}</option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Vacina</label>
          <select
            value={filterVacina}
            onChange={e => { setFilterVacina(e.target.value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {availableVaccines.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_vaccineName')}>
                <span className="flex items-center gap-1">Vacina {sortKey === '_vaccineName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_vaccineName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_batchCode')}>
                <span className="flex items-center gap-1">Lote {sortKey === '_batchCode' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_batchCode' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_roomDescription')}>
                <span className="flex items-center gap-1">Sala {sortKey === '_roomDescription' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_roomDescription' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_locationName')}>
                <span className="flex items-center gap-1">UBS {sortKey === '_locationName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_locationName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead>Aberto em</TableHead>
              <TableHead>Validade restante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_userName')}>
                <span className="flex items-center gap-1">Usuário {sortKey === '_userName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_userName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={8} />
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-gray-400">
                  Nenhum frasco aberto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ op, room, location, batch, vaccine, user }) => (
                <TableRow key={op.id}>
                  <TableCell className="font-medium">{vaccine?.name ?? '—'}</TableCell>
                  <TableCell>{batch?.batch_code ?? '—'}</TableCell>
                  <TableCell>{room?.description ?? '—'}</TableCell>
                  <TableCell>{location?.name ?? '—'}</TableCell>
                  <TableCell>
                    {formatDateTimeBR(op.opened_at)}
                  </TableCell>
                  <TableCell>
                    <CountdownCell
                      openedAt={op.opened_at}
                      expiryMinutes={batch?.open_bottle_expiry_minutes ?? 0}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      openedAt={op.opened_at}
                      expiryMinutes={batch?.open_bottle_expiry_minutes ?? 0}
                    />
                  </TableCell>
                  <TableCell>{user?.name ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {meta.total} resultado{meta.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={!meta.has_prev}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {meta.page} / {meta.total_pages}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={!meta.has_next}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LotesTab (US-019) ─────────────────────────────────────────────────────────

function UrgencyBadge({ daysLeft, isExpired }: { daysLeft: number; isExpired: boolean }) {
  if (isExpired) {
    return <Badge variant="destructive">Bloqueado</Badge>
  }
  if (daysLeft <= 7) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Crítico</Badge>
  }
  if (daysLeft <= 30) {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Vencendo</Badge>
  }
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>
}

function LotesTab() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { vaccineRooms } = useVaccineRooms()

  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [technicianRooms, setTechnicianRooms] = useState<ApiTechnicianRoom[]>([])

  const [loading, setLoading] = useState(true)
  const [filterUbs, setFilterUbs] = useState('')
  const [filterSala, setFilterSala] = useState('')
  const [filterVacina, setFilterVacina] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        entriesRes,
        batchesRes,
        vaccinesRes,
        locationsRes,
        techRoomsRes,
      ] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiTechnicianRoom>>('/technician-rooms?page=1&page_size=20'),
      ])
      setBatchRoomEntries(entriesRes.data)
      setBatches(batchesRes.data)
      setVaccines(vaccinesRes.data)
      setLocations(locationsRes.data)
      setTechnicianRooms(techRoomsRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  // ─── Scope ──────────────────────────────────────────────────────────────────

  const scopedRoomIds = useMemo((): string[] => {
    if (!currentUser) return []
    if (currentUser.role === 'administrador') {
      return vaccineRooms.filter(r => !r.isDeleted).map(r => r.id)
    }
    if (currentUser.role === 'gestor') {
      return vaccineRooms.filter(r => !r.isDeleted).map(r => r.id)
    }
    return technicianRooms
      .filter(tr => tr.user_id === currentUser.id && !tr.is_deleted)
      .map(tr => tr.vaccine_room_id)
  }, [currentUser, vaccineRooms, technicianRooms])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // ─── Rows ────────────────────────────────────────────────────────────────────

  const rows = useMemo(() => {
    return batchRoomEntries
      .filter(e => !e.is_deleted && scopedRoomIds.includes(e.vaccine_room_id))
      .map(e => {
        const batch = batches.find(b => b.id === e.batch_id)
        const vaccine = vaccines.find(v => v.id === batch?.vaccine_id)
        const room = vaccineRooms.find(r => r.id === e.vaccine_room_id)
        const location = locations.find(l => l.id === room?.locationId)
        const expiryDate = batch ? new Date(batch.expiry_date) : null
        const daysLeft = expiryDate
          ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 0
        const isExpired = expiryDate ? expiryDate < today : false
        return {
          e, batch, vaccine, room, location, expiryDate, daysLeft, isExpired,
          _vaccineName: vaccine?.name ?? '',
          _batchCode: batch?.batch_code ?? '',
          _roomDescription: room?.description ?? '',
          _locationName: location?.name ?? '',
        }
      })
      .filter(row => {
        if (!row.batch || !row.vaccine || !row.room || !row.location) return false
        if (filterUbs && row.location.id !== filterUbs) return false
        if (filterSala && row.room.id !== filterSala) return false
        if (filterVacina && row.vaccine.id !== filterVacina) return false
        return true
      })
      .sort((a, b) => {
        if (!a.expiryDate) return 1
        if (!b.expiryDate) return -1
        return a.expiryDate.getTime() - b.expiryDate.getTime()
      })
  }, [batchRoomEntries, batches, vaccines, vaccineRooms, locations, scopedRoomIds, today, filterUbs, filterSala, filterVacina])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(rows)
  const { data: paginated, meta } = paginate(sorted, currentPage, PAGE_SIZE)

  // ─── Filter options ─────────────────────────────────────────────────────────

  const activeLocations = useMemo(() => {
    return locations.filter(l => !l.is_deleted && vaccineRooms.some(r => scopedRoomIds.includes(r.id) && r.locationId === l.id))
  }, [locations, vaccineRooms, scopedRoomIds])

  const scopedRooms = useMemo(() => {
    return vaccineRooms.filter(r => !r.isDeleted && scopedRoomIds.includes(r.id))
  }, [vaccineRooms, scopedRoomIds])

  const availableVaccines = useMemo(() => {
    const vaccineIds = new Set(
      batchRoomEntries
        .filter(e => scopedRoomIds.includes(e.vaccine_room_id))
        .map(e => batches.find(b => b.id === e.batch_id)?.vaccine_id)
        .filter(Boolean) as string[]
    )
    return vaccines.filter(v => !v.is_deleted && vaccineIds.has(v.id))
  }, [vaccines, batchRoomEntries, batches, scopedRoomIds])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">UBS</label>
          <select
            value={filterUbs}
            onChange={e => { setFilterUbs(e.target.value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {activeLocations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Sala</label>
          <select
            value={filterSala}
            onChange={e => { setFilterSala(e.target.value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {scopedRooms
              .filter(r => !filterUbs || locations.find(l => l.id === r.locationId)?.id === filterUbs)
              .map(r => (
                <option key={r.id} value={r.id}>{r.description}</option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Vacina</label>
          <select
            value={filterVacina}
            onChange={e => { setFilterVacina(e.target.value); setCurrentPage(1) }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {availableVaccines.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_vaccineName')}>
                <span className="flex items-center gap-1">Vacina {sortKey === '_vaccineName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_vaccineName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_batchCode')}>
                <span className="flex items-center gap-1">Lote {sortKey === '_batchCode' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_batchCode' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_roomDescription')}>
                <span className="flex items-center gap-1">Sala {sortKey === '_roomDescription' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_roomDescription' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('_locationName')}>
                <span className="flex items-center gap-1">UBS {sortKey === '_locationName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === '_locationName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('expiryDate')}>
                <span className="flex items-center gap-1">Vencimento {sortKey === 'expiryDate' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'expiryDate' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('daysLeft')}>
                <span className="flex items-center gap-1">Dias restantes {sortKey === 'daysLeft' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'daysLeft' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={7} />
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                  Nenhum lote encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ e, batch, vaccine, room, location, expiryDate, daysLeft, isExpired }) => (
                <TableRow key={e.id} className={isExpired ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{vaccine?.name ?? '—'}</TableCell>
                  <TableCell>{batch?.batch_code ?? '—'}</TableCell>
                  <TableCell>{room?.description ?? '—'}</TableCell>
                  <TableCell>{location?.name ?? '—'}</TableCell>
                  <TableCell>
                    {expiryDate
                          ? formatDateBR(expiryDate)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {isExpired ? (
                      <span className="text-red-600 text-sm">Vencido</span>
                    ) : (
                      <span
                        className={`text-sm font-medium ${
                          daysLeft <= 7
                            ? 'text-red-700'
                            : daysLeft <= 30
                              ? 'text-yellow-700'
                              : 'text-gray-700'
                        }`}
                      >
                        {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <UrgencyBadge daysLeft={daysLeft} isExpired={isExpired} />
                      {isExpired && (
                        <span className="text-xs text-red-500">Abertura bloqueada</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {meta.total} resultado{meta.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={!meta.has_prev}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {meta.page} / {meta.total_pages}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={!meta.has_next}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MonitoramentoPage() {
  const [activeTab, setActiveTab] = useState<'frascos' | 'lotes'>('frascos')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monitoramento</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe frascos abertos e vencimentos de lotes em tempo real.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('frascos')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'frascos'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Frascos Abertos
          </button>
          <button
            onClick={() => setActiveTab('lotes')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'lotes'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Lotes
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'frascos' ? <FrascosAbertosTab /> : <LotesTab />}
    </div>
  )
}
