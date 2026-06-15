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
import { formatDateBR, toIsoDateInput } from '../../lib/utils'
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

// ─── DisponibilidadeInternaPage ───────────────────────────────────────────────

export default function DisponibilidadeInternaPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const { vaccineRooms } = useVaccineRooms()

  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [bottleOpenings, setBottleOpenings] = useState<ApiBottleOpening[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])
  const [technicianRooms, setTechnicianRooms] = useState<ApiTechnicianRoom[]>([])

  const [loading, setLoading] = useState(true)
  const [filterUbs, setFilterUbs] = useState('')
  const [filterVacina, setFilterVacina] = useState('')
  const [filterDate, setFilterDate] = useState(toIsoDateInput(new Date()))
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        entriesRes,
        batchesRes,
        vaccinesRes,
        locationsRes,
        openingsRes,
        discardsRes,
        techRoomsRes,
      ] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleOpening>>('/bottle-openings?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleDiscard>>('/bottle-discards?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiTechnicianRoom>>('/technician-rooms?page=1&page_size=20'),
      ])
      setBatchRoomEntries(entriesRes.data)
      setBatches(batchesRes.data)
      setVaccines(vaccinesRes.data)
      setLocations(locationsRes.data)
      setBottleOpenings(openingsRes.data)
      setBottleDiscards(discardsRes.data)
      setTechnicianRooms(techRoomsRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  // ─── Scope ────────────────────────────────────────────────────────────────

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

  // ─── Available UBSs and vaccines for filters ──────────────────────────────

  const scopedLocations = useMemo(() => {
    const locationIds = new Set(
      vaccineRooms
        .filter(r => scopedRoomIds.includes(r.id))
        .map(r => r.locationId)
    )
    return locations.filter(l => !l.is_deleted && locationIds.has(l.id))
  }, [scopedRoomIds, vaccineRooms, locations])

  const activeVaccines = useMemo(
    () => vaccines.filter(v => !v.is_deleted),
    [vaccines]
  )

  // ─── Availability rows ────────────────────────────────────────────────────

  const rows = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    // Reference date at midnight local time
    const dateAtMidnight = filterDate
      ? new Date(filterDate + 'T00:00:00').getTime()
      : new Date().setHours(0, 0, 0, 0)

    const results: {
      roomId: string
      roomDescription: string
      locationId: string
      locationName: string
      vaccineId: string
      vaccineName: string
      availableBottles: number
      hasActiveOpenBottle: boolean
      batchCode: string
      expiryDate: string
    }[] = []

    for (const entry of batchRoomEntries) {
      if (entry.is_deleted) continue
      if (!scopedRoomIds.includes(entry.vaccine_room_id)) continue

      const batch = batches.find(b => b.id === entry.batch_id)
      if (!batch || batch.is_deleted) continue

      const vaccine = vaccines.find(v => v.id === batch.vaccine_id)
      if (!vaccine || vaccine.is_deleted) continue

      const room = vaccineRooms.find(r => r.id === entry.vaccine_room_id)
      if (!room || room.isDeleted) continue

      const location = locations.find(l => l.id === room.locationId)
      if (!location || location.is_deleted) continue

      // Filters
      if (filterUbs && location.id !== filterUbs) continue
      if (filterVacina && vaccine.id !== filterVacina) continue

      // Expired batch: never show as available
      const expiryMs = new Date(batch.expiry_date + 'T00:00:00').getTime()
      if (expiryMs < dateAtMidnight) continue

      // Check for active (non-cancelled, non-discarded) open bottle
      const activeOpenBottle = bottleOpenings.find(op => {
        if (op.batch_entry_id !== entry.id) return false
        if (op.is_cancelled) return false
        if (bottleDiscards.some(d => d.bottle_opening_id === op.id && !d.is_cancelled)) return false
        // Open bottle still valid (not expired)
        const expiryTime = new Date(op.opened_at).getTime() + batch.open_bottle_expiry_minutes * 60 * 1000
        return expiryTime > now
      })

      // Count available closed bottles
      const nonCancelledDiscards = bottleDiscards.filter(
        d => d.batch_entry_id === entry.id && !d.is_cancelled && !d.bottle_opening_id
      ).length
      const nonCancelledOpenings = bottleOpenings.filter(
        op => op.batch_entry_id === entry.id && !op.is_cancelled
      ).length
      const availableBottles = entry.bottle_count - nonCancelledDiscards - nonCancelledOpenings

      // Available if: has closed bottles > 0 OR has active open bottle
      if (availableBottles <= 0 && !activeOpenBottle) continue

      results.push({
        roomId: room.id,
        roomDescription: room.description,
        locationId: location.id,
        locationName: location.name,
        vaccineId: vaccine.id,
        vaccineName: vaccine.name,
        availableBottles: Math.max(0, availableBottles),
        hasActiveOpenBottle: !!activeOpenBottle,
        batchCode: batch.batch_code,
        expiryDate: batch.expiry_date,
      })
    }

    // Sort by location name, then room, then vaccine
    results.sort((a, b) => {
      const loc = a.locationName.localeCompare(b.locationName, 'pt-BR')
      if (loc !== 0) return loc
      const room = a.roomDescription.localeCompare(b.roomDescription, 'pt-BR')
      if (room !== 0) return room
      return a.vaccineName.localeCompare(b.vaccineName, 'pt-BR')
    })

    return results
  }, [
    batchRoomEntries,
    batches,
    vaccines,
    vaccineRooms,
    locations,
    bottleOpenings,
    bottleDiscards,
    scopedRoomIds,
    filterUbs,
    filterVacina,
    filterDate,
  ])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(rows)
  const { data: paginatedRows, meta } = paginate(sorted, currentPage, PAGE_SIZE)

  function handleFilterChange() {
    setCurrentPage(1)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disponibilidade Interna</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vacinas disponíveis por sala em todas as UBSs
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Data</label>
          <DatePicker
            value={filterDate}
            onValueChange={value => { setFilterDate(value); handleFilterChange() }}
            className="h-9 rounded-md border border-input px-3 text-sm bg-background"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">UBS / Local</label>
          <select
            value={filterUbs}
            onChange={e => { setFilterUbs(e.target.value); handleFilterChange() }}
            className="h-9 rounded-md border border-input px-3 text-sm bg-background min-w-[180px]"
          >
            <option value="">Todas as UBSs</option>
            {scopedLocations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Vacina</label>
          <select
            value={filterVacina}
            onChange={e => { setFilterVacina(e.target.value); handleFilterChange() }}
            className="h-9 rounded-md border border-input px-3 text-sm bg-background min-w-[180px]"
          >
            <option value="">Todas as vacinas</option>
            {activeVaccines.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('locationName')}>
                <span className="flex items-center gap-1">UBS / Local {sortKey === 'locationName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'locationName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('roomDescription')}>
                <span className="flex items-center gap-1">Sala {sortKey === 'roomDescription' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'roomDescription' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('vaccineName')}>
                <span className="flex items-center gap-1">Vacina {sortKey === 'vaccineName' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'vaccineName' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('batchCode')}>
                <span className="flex items-center gap-1">Lote {sortKey === 'batchCode' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'batchCode' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('availableBottles')}>
                <span className="flex items-center gap-1">Frascos disponíveis {sortKey === 'availableBottles' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'availableBottles' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
              <TableHead>Frasco aberto</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('expiryDate')}>
                <span className="flex items-center gap-1">Vencimento {sortKey === 'expiryDate' && sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortKey === 'expiryDate' && sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={7} />
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Nenhuma vacina disponível encontrada para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row, i) => (
                <TableRow key={`${row.roomId}-${row.vaccineId}-${row.batchCode}-${i}`}>
                  <TableCell className="font-medium">{row.locationName}</TableCell>
                  <TableCell>{row.roomDescription}</TableCell>
                  <TableCell>{row.vaccineName}</TableCell>
                  <TableCell className="font-mono text-sm">{row.batchCode}</TableCell>
                  <TableCell>
                    {row.availableBottles > 0 ? (
                      <span className="font-semibold text-green-700">{row.availableBottles}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.hasActiveOpenBottle ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        Sim
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDateBR(row.expiryDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} resultado{meta.total !== 1 ? 's' : ''} — página {meta.page} de {meta.total_pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={!meta.has_prev}
              className="p-1 rounded border disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={!meta.has_next}
              className="p-1 rounded border disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
