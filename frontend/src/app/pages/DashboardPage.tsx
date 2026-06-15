import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { Activity, FlaskConical, TrendingDown, Zap, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { PaginatedResponse } from '../../types'
import { paginate } from '../../lib/pagination'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { useTableSort } from '../../hooks/useTableSort'
import { formatDateBR, formatDateTimeBR } from '../../lib/utils'
import { DatePicker } from '@/components/ui/date-picker'

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

interface ApiUser {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Multi-select dropdown ─────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const displayLabel = selected.length === 0
    ? label
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? label
      : `${selected.length} selecionados`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-w-[160px] justify-between"
      >
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}>{displayLabel}</span>
        {open ? <ChevronUp className="h-3 w-3 text-gray-500" /> : <ChevronDown className="h-3 w-3 text-gray-500" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">Nenhuma opção</div>
          ) : (
            <div className="max-h-48 overflow-y-auto py-1">
              {options.map(opt => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  loading: boolean
}

function MetricCard({ label, value, icon, color, loading }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {loading ? (
        <>
          <Skeleton className="mb-3 h-4 w-32" />
          <Skeleton className="h-8 w-16" />
        </>
      ) : (
        <>
          <div className={`mb-3 inline-flex items-center gap-2 text-sm font-medium ${color}`}>
            {icon}
            {label}
          </div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
        </>
      )}
    </div>
  )
}

// ─── Bar chart ─────────────────────────────────────────────────────────────────

interface BarChartProps {
  data: { label: string; openings: number; discards: number }[]
  loading: boolean
}

function BarChart({ data, loading }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const maxVal = Math.max(...data.flatMap(d => [d.openings, d.discards]), 1)
  const chartH = 140
  const padLeft = 32
  const padBottom = 24
  const svgH = chartH + padBottom
  const n = data.length
  const innerGap = 2
  const groupGap = Math.max(6, Math.floor((containerW - padLeft) * 0.08 / Math.max(n - 1, 1)))
  const barW = Math.max(4, Math.floor((containerW - padLeft - groupGap * (n - 1) - innerGap * n) / (2 * n)))
  const totalW = containerW

  // eslint-disable-next-line react-hooks/purity
  const skeletonHeights = useMemo(() => Array.from({ length: Math.max(data.length, 7) }, () => 40 + Math.random() * 80), [data.length])

  if (loading) {
    return (
      <div className="flex items-end gap-2 h-40">
        {skeletonHeights.map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}px` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full" ref={containerRef}>
    <svg
      viewBox={`0 0 ${totalW} ${svgH}`}
      width="100%"
      height={svgH}
      className="overflow-visible"
    >
      {/* Y-axis grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = chartH - ratio * chartH
        const gridVal = Math.round(maxVal * ratio)
        return (
          <g key={ratio}>
            <line x1={padLeft} y1={y} x2={totalW} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padLeft - 4} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{gridVal}</text>
          </g>
        )
      })}
      {/* Grouped bars */}
      {data.map((d, i) => {
        const groupX = padLeft + i * (2 * barW + innerGap + groupGap)
        const labelX = groupX + barW + innerGap / 2

        const oH = Math.max(8, (d.openings / maxVal) * chartH)
        const dH = Math.max(8, (d.discards / maxVal) * chartH)
        const oY = chartH - oH
        const dY = chartH - dH
        const dX = groupX + barW + innerGap

        return (
          <g key={i}>
            {/* Aberturas */}
            <rect x={groupX} y={oY} width={barW} height={oH} rx={3} ry={3}
              fill="#1A2F7C" opacity={d.openings === 0 ? 0.2 : 0.85} />
            {d.openings > 0 && (
              <text x={groupX + barW / 2} y={oY - 3} textAnchor="middle" fontSize={9} fill="#1A2F7C" fontWeight="600">
                {d.openings}
              </text>
            )}
            {/* Descartes */}
            <rect x={dX} y={dY} width={barW} height={dH} rx={3} ry={3}
              fill="#dc2626" opacity={d.discards === 0 ? 0.2 : 0.85} />
            {d.discards > 0 && (
              <text x={dX + barW / 2} y={dY - 3} textAnchor="middle" fontSize={9} fill="#dc2626" fontWeight="600">
                {d.discards}
              </text>
            )}
            {/* Label da data */}
            <text x={labelX} y={svgH} textAnchor="middle" fontSize={10} fill="#6b7280">{d.label}</text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}

// ─── SkeletonRows ───────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentUser } = useAuthStore()
  const { vaccineRooms } = useVaccineRooms()

  const [loading, setLoading] = useState(true)

  // Lookups
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [bottleOpeningReasons, setBottleOpeningReasons] = useState<ApiOpeningReason[]>([])
  const [bottleDiscardReasons, setBottleDiscardReasons] = useState<ApiDiscardReason[]>([])
  const [users, setUsers] = useState<ApiUser[]>([])

  // Activity data
  const [bottleOpenings, setBottleOpenings] = useState<ApiBottleOpening[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])

  // Filters
  const firstDayOfMonth = useMemo(() => startOfMonth(new Date()).toISOString().split('T')[0], [])
  const lastDayOfMonth  = useMemo(() => endOfMonth(new Date()).toISOString().split('T')[0], [])

  const [filterFrom, setFilterFrom] = useState(firstDayOfMonth)
  const [filterTo, setFilterTo] = useState(lastDayOfMonth)
  const [filterUbs, setFilterUbs] = useState<string[]>([])
  const [filterSala, setFilterSala] = useState<string[]>([])
  const [filterUser, setFilterUser] = useState<string[]>([])

  // ─── Fetch lookups ──────────────────────────────────────────────────────────

  const fetchLookups = useCallback(async () => {
    try {
      const [locsRes, batchesRes, entriesRes, vacsRes, openReasonsRes, discReasonsRes, usersRes] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiOpeningReason>>('/bottle-opening-reasons?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiDiscardReason>>('/bottle-discard-reasons?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiUser>>('/users?page=1&page_size=20'),
      ])
      setLocations(locsRes.data.filter(l => !l.is_deleted))
      setBatches(batchesRes.data.filter(b => !b.is_deleted))
      setBatchRoomEntries(entriesRes.data.filter(e => !e.is_deleted))
      setVaccines(vacsRes.data.filter(v => !v.is_deleted))
      setBottleOpeningReasons(openReasonsRes.data.filter(r => !r.is_deleted))
      setBottleDiscardReasons(discReasonsRes.data.filter(r => !r.is_deleted))
      setUsers(usersRes.data.filter(u => u.is_active))
    } catch { /* ignore */ }
  }, [])

  // ─── Fetch activity ─────────────────────────────────────────────────────────

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    try {
      const [openingsRes, discardsRes] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiBottleOpening>>('/bottle-openings?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleDiscard>>('/bottle-discards?page=1&page_size=20'),
      ])
      setBottleOpenings(openingsRes.data)
      setBottleDiscards(discardsRes.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void fetchLookups()
    void fetchActivity()
  }, [fetchLookups, fetchActivity])

  // ─── Filter options ─────────────────────────────────────────────────────────

  const ubsOptions = useMemo(() => {
    return locations.map(l => ({ value: l.id, label: l.name }))
  }, [locations])

  const salaOptions = useMemo(() => {
    const filtered = filterUbs.length > 0
      ? vaccineRooms.filter(r => filterUbs.includes(r.locationId))
      : vaccineRooms
    return filtered.map(r => ({ value: r.id, label: r.description }))
  }, [vaccineRooms, filterUbs])

  const userOptions = useMemo(() => {
    return users.map(u => ({ value: u.id, label: u.name }))
  }, [users])

  // ─── Filtered data ──────────────────────────────────────────────────────────

  const fromDate = useMemo(() => startOfDay(new Date(filterFrom + 'T00:00:00')), [filterFrom])
  const toDateEnd = useMemo(() => endOfDay(new Date(filterTo + 'T00:00:00')), [filterTo])

  const effectiveSalaIds = useMemo(() => {
    if (filterSala.length > 0) return filterSala
    if (filterUbs.length > 0) {
      return vaccineRooms.filter(r => filterUbs.includes(r.locationId)).map(r => r.id)
    }
    return vaccineRooms.map(r => r.id)
  }, [filterSala, filterUbs, vaccineRooms])

  const filteredRoomIds = useMemo(() => effectiveSalaIds, [effectiveSalaIds])

  const filteredOpenings = useMemo(() => {
    return bottleOpenings.filter(op => {
      if (!filteredRoomIds.includes(op.vaccine_room_id)) return false
      const d = new Date(op.opened_at)
      if (d < fromDate || d > toDateEnd) return false
      if (filterUser.length > 0 && !filterUser.includes(op.created_by)) return false
      return true
    })
  }, [bottleOpenings, filteredRoomIds, fromDate, toDateEnd, filterUser])

  const filteredDiscards = useMemo(() => {
    return bottleDiscards.filter(disc => {
      // resolve room via batchRoomEntry
      const entry = batchRoomEntries.find(e => e.id === disc.batch_entry_id)
      if (!entry || !filteredRoomIds.includes(entry.vaccine_room_id)) return false
      const d = new Date(disc.discarded_at)
      if (d < fromDate || d > toDateEnd) return false
      if (filterUser.length > 0 && !filterUser.includes(disc.created_by)) return false
      return true
    })
  }, [bottleDiscards, batchRoomEntries, filteredRoomIds, fromDate, toDateEnd, filterUser])

  // ─── Metrics ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), [])
  const todayStart = todayMidnight()

  // 1. Total frascos abertos ativos hoje (opened today, not cancelled, not discarded)
  const metric1 = useMemo(() => {
    return filteredOpenings.filter(op => {
      if (op.is_cancelled) return false
      const hasDiscard = bottleDiscards.some(d => d.bottle_opening_id === op.id && !d.is_cancelled)
      if (hasDiscard) return false
      const openedDate = new Date(op.opened_at)
      return openedDate >= todayStart
    }).length
  }, [filteredOpenings, bottleDiscards, todayStart])

  // 2. Total vencidos ou vencendo em <30min (active openings)
  const metric2 = useMemo(() => {
    return filteredOpenings.filter(op => {
      if (op.is_cancelled) return false
      const hasDiscard = bottleDiscards.some(d => d.bottle_opening_id === op.id && !d.is_cancelled)
      if (hasDiscard) return false
      const entry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
      if (!entry) return false
      const batch = batches.find(b => b.id === entry.batch_id)
      if (!batch) return false
      const expiresAt = new Date(op.opened_at).getTime() + batch.open_bottle_expiry_minutes * 60 * 1000
      const timeLeft = expiresAt - now
      return timeLeft <= 30 * 60 * 1000 // ≤30min (includes expired)
    }).length
  }, [filteredOpenings, bottleDiscards, batchRoomEntries, batches, now])

  // 3. Total lotes vencendo nos próximos 30 dias (from today)
  const metric3 = useMemo(() => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const todayMs = todayStart.getTime()
    return batchRoomEntries.filter(entry => {
      if (entry.is_deleted) return false
      if (!filteredRoomIds.includes(entry.vaccine_room_id)) return false
      const batch = batches.find(b => b.id === entry.batch_id)
      if (!batch || batch.is_deleted) return false
      const expiry = new Date(batch.expiry_date + 'T00:00:00').getTime()
      return expiry >= todayMs && expiry <= todayMs + thirtyDaysMs
    }).length
  }, [batchRoomEntries, batches, filteredRoomIds, todayStart])

  // 4. Total operações do dia
  const metric4 = useMemo(() => {
    const openingsToday = filteredOpenings.filter(op => new Date(op.opened_at) >= todayStart).length
    const discardsToday = filteredDiscards.filter(d => new Date(d.discarded_at) >= todayStart).length
    return openingsToday + discardsToday
  }, [filteredOpenings, filteredDiscards, todayStart])

  // ─── Chart data — last 7 days ──────────────────────────────────────────────

  const chartData = useMemo(() => {
    const from = new Date(filterFrom + 'T00:00:00')
    const to   = new Date(filterTo   + 'T00:00:00')
    if (from > to) return []
    return eachDayOfInterval({ start: from, end: to }).flatMap(day => {
      const dayStart = startOfDay(day)
      const dayEnd   = endOfDay(day)

      const openCount = filteredOpenings.filter(op => {
        const d = new Date(op.opened_at)
        return d >= dayStart && d <= dayEnd
      }).length

      const discardCount = filteredDiscards.filter(disc => {
        const d = new Date(disc.discarded_at)
        return d >= dayStart && d <= dayEnd
      }).length

      if (openCount === 0 && discardCount === 0) return []
      return [{
        label: formatDateBR(day),
        openings: openCount,
        discards: discardCount,
      }]
    })
  }, [filteredOpenings, filteredDiscards, filterFrom, filterTo])

  // ─── Enriched rows for sorting ─────────────────────────────────────────────

  const enrichedOpenings = useMemo(() => {
    return filteredOpenings.map(op => {
      const entry = batchRoomEntries.find(e => e.id === op.batch_entry_id)
      const batch = entry ? batches.find(b => b.id === entry.batch_id) : undefined
      const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : undefined
      const room = vaccineRooms.find(r => r.id === op.vaccine_room_id)
      const loc = room ? locations.find(l => l.id === room.locationId) : undefined
      const reason = bottleOpeningReasons.find(r => r.id === op.opening_reason_id)
      const user = users.find(u => u.id === op.created_by)
      return {
        ...op,
        _vaccineName: vaccine?.name ?? '',
        _batchCode: batch?.batch_code ?? '',
        _roomDescription: room?.description ?? '',
        _locationName: loc?.name ?? '',
        _reasonName: reason?.name ?? '',
        _userName: user?.name ?? '',
      }
    })
  }, [filteredOpenings, batchRoomEntries, batches, vaccines, vaccineRooms, locations, bottleOpeningReasons, users])

  const enrichedDiscards = useMemo(() => {
    return filteredDiscards.map(d => {
      const entry = batchRoomEntries.find(e => e.id === d.batch_entry_id)
      const batch = entry ? batches.find(b => b.id === entry.batch_id) : undefined
      const vaccine = batch ? vaccines.find(v => v.id === batch.vaccine_id) : undefined
      const room = entry ? vaccineRooms.find(r => r.id === entry.vaccine_room_id) : undefined
      const loc = room ? locations.find(l => l.id === room.locationId) : undefined
      const reason = bottleDiscardReasons.find(r => r.id === d.discard_reason_id)
      const user = users.find(u => u.id === d.created_by)
      return {
        ...d,
        _vaccineName: vaccine?.name ?? '',
        _batchCode: batch?.batch_code ?? '',
        _roomDescription: room?.description ?? '',
        _locationName: loc?.name ?? '',
        _reasonName: reason?.name ?? '',
        _userName: user?.name ?? '',
        _tipo: d.bottle_opening_id ? 'Descarte Aberto' : 'Descarte Fechado',
      }
    })
  }, [filteredDiscards, batchRoomEntries, batches, vaccines, vaccineRooms, locations, bottleDiscardReasons, users])

  const enrichedAlerts = useMemo(() => enrichedOpenings.filter(op => op.alert_triggered), [enrichedOpenings])

  // ─── Sort state for detail tables ──────────────────────────────────────────

  const { sorted: openingsSorted, sortKey: openingsSortKey, sortDir: openingsSortDir, toggleSort: toggleOpeningsSort } = useTableSort(enrichedOpenings)
  const { sorted: discardsSorted, sortKey: discardsSortKey, sortDir: discardsSortDir, toggleSort: toggleDiscardsSort } = useTableSort(enrichedDiscards)
  const { sorted: alertsSorted, sortKey: alertsSortKey, sortDir: alertsSortDir, toggleSort: toggleAlertsSort } = useTableSort(enrichedAlerts)

  // ─── Detail collapse state ─────────────────────────────────────────────────

  const DETAIL_PAGE_SIZE = 20

  const [detailOpen, setDetailOpen] = useState<'openings' | 'discards' | 'alerts' | null>(null)
  const [openingsPage, setOpeningsPage] = useState(1)
  const [discardsPage, setDiscardsPage] = useState(1)
  const [alertsPage, setAlertsPage] = useState(1)

  function toggleDetail(section: 'openings' | 'discards' | 'alerts') {
    if (detailOpen !== section) {
      if (section === 'openings') setOpeningsPage(1)
      if (section === 'discards') setDiscardsPage(1)
      if (section === 'alerts') setAlertsPage(1)
    }
    setDetailOpen(prev => prev === section ? null : section)
  }

  // ─── Reset sala filter when ubs filter changes ─────────────────────────────

  const handleUbsChange = (vals: string[]) => {
    setFilterUbs(vals)
    setFilterSala([])
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">De</label>
            <DatePicker
              value={filterFrom}
              onValueChange={setFilterFrom}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Até</label>
            <DatePicker
              value={filterTo}
              onValueChange={setFilterTo}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">UBS / Local</label>
            <MultiSelect
              label="Todos os locais"
              options={ubsOptions}
              selected={filterUbs}
              onChange={handleUbsChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Sala de Vacina</label>
            <MultiSelect
              label="Todas as salas"
              options={salaOptions}
              selected={effectiveSalaIds}
              onChange={setFilterSala}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Usuário</label>
            <MultiSelect
              label="Todos os usuários"
              options={userOptions}
              selected={filterUser}
              onChange={setFilterUser}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterFrom(firstDayOfMonth)
              setFilterTo(lastDayOfMonth)
              setFilterUbs([])
              setFilterSala([])
              setFilterUser([])
            }}
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Frascos Abertos Ativos"
          value={metric1}
          icon={<Activity className="h-4 w-4" />}
          color="text-blue-700"
          loading={loading}
        />
        <MetricCard
          label="Vencidos / Vencendo"
          value={metric2}
          icon={<Zap className="h-4 w-4" />}
          color="text-amber-600"
          loading={loading}
        />
        <MetricCard
          label="Lotes Vencendo (30d)"
          value={metric3}
          icon={<FlaskConical className="h-4 w-4" />}
          color="text-purple-600"
          loading={loading}
        />
        <MetricCard
          label="Operações do Dia"
          value={metric4}
          icon={<TrendingDown className="h-4 w-4" />}
          color="text-green-600"
          loading={loading}
        />
      </div>

      {/* Chart Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Aberturas vs Descartes</h2>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-[#1A2F7C] opacity-85" />
              <span className="text-gray-600">Aberturas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-[#dc2626] opacity-85" />
              <span className="text-gray-600">Descartes</span>
            </div>
          </div>
        </div>
        <BarChart data={chartData} loading={loading} />
      </div>

      {/* Detail Sections */}
      <div className="space-y-4">
        {/* 1. Aberturas */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => toggleDetail('openings')}
            className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Detalhamento de Aberturas</h3>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {enrichedOpenings.length}
              </span>
            </div>
            {detailOpen === 'openings' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {detailOpen === 'openings' && (
            <div className="border-t border-gray-100 p-4">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleOpeningsSort('_vaccineName')}>
                        <div className="flex items-center gap-1">Vacina {openingsSortKey === '_vaccineName' ? (openingsSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</div>
                      </TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Sala / UBS</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleOpeningsSort('opened_at')}>
                        <div className="flex items-center gap-1">Aberto em {openingsSortKey === 'opened_at' ? (openingsSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</div>
                      </TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <SkeletonRows cols={6} /> : paginate(openingsSorted, openingsPage, DETAIL_PAGE_SIZE).data.map(op => (
                      <TableRow key={op.id} className={op.is_cancelled ? 'bg-gray-50/50' : ''}>
                        <TableCell className="font-medium">{op._vaccineName}</TableCell>
                        <TableCell>{op._batchCode}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{op._roomDescription}</div>
                            <div className="text-gray-500">{op._locationName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateTimeBR(op.opened_at)}</TableCell>
                        <TableCell className="text-xs">{op._userName}</TableCell>
                        <TableCell>
                          {op.is_cancelled ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">Cancelado</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Ativo</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {openingsSorted.length > DETAIL_PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Página {openingsPage} de {Math.ceil(openingsSorted.length / DETAIL_PAGE_SIZE)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={openingsPage === 1} onClick={() => setOpeningsPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={openingsPage >= Math.ceil(openingsSorted.length / DETAIL_PAGE_SIZE)} onClick={() => setOpeningsPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Descartes */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => toggleDetail('discards')}
            className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Detalhamento de Descartes</h3>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                {enrichedDiscards.length}
              </span>
            </div>
            {detailOpen === 'discards' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {detailOpen === 'discards' && (
            <div className="border-t border-gray-100 p-4">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleDiscardsSort('_vaccineName')}>
                        <div className="flex items-center gap-1">Vacina {discardsSortKey === '_vaccineName' ? (discardsSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</div>
                      </TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Sala / UBS</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleDiscardsSort('discarded_at')}>
                        <div className="flex items-center gap-1">Descartado em {discardsSortKey === 'discarded_at' ? (discardsSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</div>
                      </TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <SkeletonRows cols={6} /> : paginate(discardsSorted, discardsPage, DETAIL_PAGE_SIZE).data.map(d => (
                      <TableRow key={d.id} className={d.is_cancelled ? 'bg-gray-50/50' : ''}>
                        <TableCell className="font-medium">{d._vaccineName}</TableCell>
                        <TableCell>{d._batchCode}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{d._roomDescription}</div>
                            <div className="text-gray-500">{d._locationName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateTimeBR(d.discarded_at)}</TableCell>
                        <TableCell className="text-xs">{d._reasonName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${d.bottle_opening_id ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {d._tipo}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {discardsSorted.length > DETAIL_PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Página {discardsPage} de {Math.ceil(discardsSorted.length / DETAIL_PAGE_SIZE)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={discardsPage === 1} onClick={() => setDiscardsPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={discardsPage >= Math.ceil(discardsSorted.length / DETAIL_PAGE_SIZE)} onClick={() => setDiscardsPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Alertas */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => toggleDetail('alerts')}
            className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Alertas de Conflito</h3>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                {enrichedAlerts.length}
              </span>
            </div>
            {detailOpen === 'alerts' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {detailOpen === 'alerts' && (
            <div className="border-t border-gray-100 p-4">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vacina</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Sala / UBS</TableHead>
                      <TableHead>Aberto em</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <SkeletonRows cols={6} /> : paginate(alertsSorted, alertsPage, DETAIL_PAGE_SIZE).data.map(al => (
                      <TableRow key={al.id}>
                        <TableCell className="font-medium">{al._vaccineName}</TableCell>
                        <TableCell>{al._batchCode}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{al._roomDescription}</div>
                            <div className="text-gray-500">{al._locationName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateTimeBR(al.opened_at)}</TableCell>
                        <TableCell className="text-xs">{al._userName}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{al.comment || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {alertsSorted.length > DETAIL_PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Página {alertsPage} de {Math.ceil(alertsSorted.length / DETAIL_PAGE_SIZE)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={alertsPage === 1} onClick={() => setAlertsPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={alertsPage >= Math.ceil(alertsSorted.length / DETAIL_PAGE_SIZE)} onClick={() => setAlertsPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
