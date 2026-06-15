import { useCallback, useEffect, useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Syringe, MapPin, ChevronRight, Search } from 'lucide-react'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { PaginatedResponse, Vaccine } from '../../types'
import { formatDateTimeWithAtBR } from '../../lib/utils'
import { AsyncCombobox, type ComboboxOption } from '@/components/ui/async-combobox'

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
  laboratory_name: string
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function locationTypeLabel(type: string): string {
  switch (type) {
    case 'ubs': return 'UBS'
    case 'hospital': return 'Hospital'
    case 'escola': return 'Escola'
    case 'lugar_temporario': return 'Ponto temporário'
    default: return 'Local de vacinação'
  }
}

// ─── Availability logic ───────────────────────────────────────────────────────

interface AvailableVaccine {
  vaccineId: string
  vaccineName: string
  roomId: string
  roomDescription: string
}

function computeAvailability(
  locationId: string,
  db: {
    batches: ApiBatch[]
    batchRoomEntries: ApiBatchRoomEntry[]
    vaccines: ApiVaccine[]
    vaccineRooms: { id: string; locationId: string; isDeleted: boolean; description: string }[]
    bottleOpenings: ApiBottleOpening[]
    bottleDiscards: ApiBottleDiscard[]
  }
): AvailableVaccine[] {
  const { batches, batchRoomEntries, vaccines, vaccineRooms, bottleOpenings, bottleDiscards } = db
  const now = Date.now()
  const todayMidnight = new Date().setHours(0, 0, 0, 0)

  const rooms = vaccineRooms.filter(r => !r.isDeleted && r.locationId === locationId)
  const seen = new Set<string>()
  const results: AvailableVaccine[] = []

  for (const room of rooms) {
    const entries = batchRoomEntries.filter(e => !e.is_deleted && e.vaccine_room_id === room.id)

    for (const entry of entries) {
      const batch = batches.find(b => b.id === entry.batch_id)
      if (!batch || batch.is_deleted) continue

      const vaccine = vaccines.find(v => v.id === batch.vaccine_id)
      if (!vaccine || vaccine.is_deleted) continue

      // Expired batch: never available
      const expiryMs = new Date(batch.expiry_date + 'T00:00:00').getTime()
      if (expiryMs < todayMidnight) continue

      // Check for active open bottle still within expiry
      const hasActiveOpenBottle = bottleOpenings.some(op => {
        if (op.batch_entry_id !== entry.id) return false
        if (op.is_cancelled) return false
        if (bottleDiscards.some(d => d.bottle_opening_id === op.id && !d.is_cancelled)) return false
        const openExpiry = new Date(op.opened_at).getTime() + batch.open_bottle_expiry_minutes * 60 * 1000
        return openExpiry > now
      })

      // Count available closed bottles
      const discardedClosed = bottleDiscards.filter(
        d => d.batch_entry_id === entry.id && !d.is_cancelled && !d.bottle_opening_id
      ).length
      const openings = bottleOpenings.filter(op => op.batch_entry_id === entry.id && !op.is_cancelled).length
      const availableBottles = entry.bottle_count - discardedClosed - openings

      if (availableBottles <= 0 && !hasActiveOpenBottle) continue

      const key = `${room.id}-${vaccine.id}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({
          vaccineId: vaccine.id,
          vaccineName: vaccine.name,
          roomId: room.id,
          roomDescription: room.description,
        })
      }
    }
  }

  results.sort((a, b) => a.vaccineName.localeCompare(b.vaccineName, 'pt-BR'))
  return results
}

// ─── DisponibilidadePage ──────────────────────────────────────────────────────

export default function DisponibilidadePage() {
  const { vaccineRooms } = useVaccineRooms()

  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [bottleOpenings, setBottleOpenings] = useState<ApiBottleOpening[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])

  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [filterVacina, setFilterVacina] = useState('')
  const [lastUpdated] = useState(() => new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        locationsRes,
        vaccinesRes,
        batchesRes,
        entriesRes,
        openingsRes,
        discardsRes,
      ] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiLocation>>('/locations?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatchRoomEntry>>('/batch-room-entries?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleOpening>>('/bottle-openings?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBottleDiscard>>('/bottle-discards?page=1&page_size=20'),
      ])
      setLocations(locationsRes.data)
      setVaccines(vaccinesRes.data)
      setBatches(batchesRes.data)
      setBatchRoomEntries(entriesRes.data)
      setBottleOpenings(openingsRes.data)
      setBottleDiscards(discardsRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const activeLocations = useMemo(
    () => locations.filter(l => !l.is_deleted),
    [locations]
  )

  const activeVaccines = useMemo(
    () => vaccines.filter(v => !v.is_deleted),
    [vaccines]
  )

  // Compute availability per location
  const locationCards = useMemo(() => {
    const db = { batches, batchRoomEntries, vaccines, vaccineRooms, bottleOpenings, bottleDiscards }
    return activeLocations.map(loc => {
      const available = computeAvailability(loc.id, db)
      return { location: loc, available }
    })
  }, [activeLocations, batches, batchRoomEntries, vaccines, vaccineRooms, bottleOpenings, bottleDiscards])

  // Filter
  const filteredCards = useMemo(() => {
    const q = filterText.toLowerCase()
    return locationCards.filter(({ location, available }) => {
      // Text filter across name + address
      if (q && !location.name.toLowerCase().includes(q) && !location.address.toLowerCase().includes(q)) {
        return false
      }
      // Vaccine filter
      if (filterVacina && !available.some(a => a.vaccineId === filterVacina)) {
        return false
      }
      return true
    })
  }, [locationCards, filterText, filterVacina])

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

  const vaccinesMap = new Map(vaccines.map((l) => [l.id, l]))

  const fetchVaccinesOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiVaccine>>(`/vaccines?${params}`)
      const nextItems = res.data.filter((l) => !l.is_deleted).map(mapApiVaccine)
      setVaccines((current) => {
        const merged = new Map(current.map((item) => [item.id, item]))
        nextItems.forEach((vaccine) => merged.set(vaccine.id, vaccine as unknown as ApiVaccine))
        return Array.from(merged.values())
      })
      return nextItems.map((vaccine) => ({
        value: vaccine.id,
        label: vaccine.name,
      }))
    } catch {
      return []
    }
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10 flex">
        <div className="flex items-center border-b h-14 shrink-0 px-4 gap-2 m-auto">
          <img src="/logo.svg" width={25} alt="Imunize-Me logo" />
          <span className="font-bold text-base truncate" style={{ color: '#1A2F7C' }}>
            Imunize-Me
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-blue-50 border-b">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Consulte vacinas disponíveis perto de você
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            Veja onde as vacinas estão disponíveis hoje nos postos de saúde da sua cidade.
          </p>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Search + filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cidade, bairro ou nome do posto..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full h-11 rounded-lg border border-gray-200 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* <select
            value={filterVacina}
            onChange={e => setFilterVacina(e.target.value)}
            className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Todas as vacinas</option>
            {activeVaccines.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select> */}

          <AsyncCombobox
            // id="room-location"
            value={filterVacina}
            valueLabel={vaccinesMap.get(filterVacina)?.name}
            onValueChange={e => setFilterVacina(e)}
            fetchOptions={fetchVaccinesOptions}
            placeholder="Selecione uma vacina"
            searchPlaceholder="Busque uma vacina"
            emptyMessage="Nenhuma vacina encontrada."
          />
        </div>

        {/* Last updated */}
        <p className="text-xs text-gray-400">
          Atualizado em {formatDateTimeWithAtBR(lastUpdated)}
        </p>

        {/* Cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-48 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-64 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-16">
            <Syringe className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-600">Nenhum posto encontrado</h2>
            <p className="text-sm text-gray-400 mt-2">
              {filterText || filterVacina
                ? 'Tente outros termos ou remova os filtros.'
                : 'No momento não há vacinas disponíveis nos postos cadastrados.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCards.map(({ location, available }) => (
              <div
                key={location.id}
                className="rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow p-5"
              >
                {/* Location header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 text-base">{location.name}</h2>
                      <span className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-0.5 border border-gray-100">
                        {locationTypeLabel(location.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-500 truncate">{location.address}</span>
                    </div>
                  </div>
                  <Link
                    to="/disponibilidade/ubs/$id"
                    params={{ id: location.id }}
                    className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    Ver detalhes
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Available vaccines */}
                <div className="mt-4">
                  {available.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">
                      Nenhuma vacina disponível no momento.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {available.map(a => (
                        <span
                          key={`${a.roomId}-${a.vaccineId}`}
                          className="inline-flex items-center text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1"
                        >
                          {a.vaccineName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-3xl mx-auto px-4 py-6 flex justify-end">
          <Link
            to="/login"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Acesso para profissionais →
          </Link>
        </div>
      </footer>
    </div>
  )
}
