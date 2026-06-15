import { useCallback, useEffect, useState, useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Syringe, MapPin, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { apiClient } from '../../lib/api-client'
import { useVaccineRooms } from '../../hooks/useVaccineRooms'
import type { PaginatedResponse } from '../../types'
import { formatDateTimeWithAtBR } from '../../lib/utils'

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

// ─── DisponibilidadeUbsPage ───────────────────────────────────────────────────

export default function DisponibilidadeUbsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = useParams({ strict: false }) as any
  const locationId = params?.id as string | undefined

  const { vaccineRooms } = useVaccineRooms()

  const [batches, setBatches] = useState<ApiBatch[]>([])
  const [batchRoomEntries, setBatchRoomEntries] = useState<ApiBatchRoomEntry[]>([])
  const [vaccines, setVaccines] = useState<ApiVaccine[]>([])
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [bottleOpenings, setBottleOpenings] = useState<ApiBottleOpening[]>([])
  const [bottleDiscards, setBottleDiscards] = useState<ApiBottleDiscard[]>([])

  const [loading, setLoading] = useState(true)
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

  const location = useMemo(
    () => locations.find(l => l.id === locationId && !l.is_deleted),
    [locations, locationId]
  )

  // Rooms for this location
  const rooms = useMemo(
    () => vaccineRooms.filter(r => !r.isDeleted && r.locationId === locationId),
    [vaccineRooms, locationId]
  )

  // Vaccine status per room
  const roomsWithVaccines = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const todayMidnight = new Date().setHours(0, 0, 0, 0)

    return rooms.map(room => {
      const entries = batchRoomEntries.filter(e => !e.is_deleted && e.vaccine_room_id === room.id)

      const vaccineMap = new Map<string, {
        vaccineId: string
        vaccineName: string
        available: boolean
        hasOpenBottle: boolean
        expiryDate: string
      }>()

      for (const entry of entries) {
        const batch = batches.find(b => b.id === entry.batch_id)
        if (!batch || batch.is_deleted) continue

        const vaccine = vaccines.find(v => v.id === batch.vaccine_id)
        if (!vaccine || vaccine.is_deleted) continue

        // Expired batch: skip
        const expiryMs = new Date(batch.expiry_date + 'T00:00:00').getTime()
        if (expiryMs < todayMidnight) continue

        const hasActiveOpenBottle = bottleOpenings.some(op => {
          if (op.batch_entry_id !== entry.id) return false
          if (op.is_cancelled) return false
          if (bottleDiscards.some(d => d.bottle_opening_id === op.id && !d.is_cancelled)) return false
          const openExpiry = new Date(op.opened_at).getTime() + batch.open_bottle_expiry_minutes * 60 * 1000
          return openExpiry > now
        })

        const discardedClosed = bottleDiscards.filter(
          d => d.batch_entry_id === entry.id && !d.is_cancelled && !d.bottle_opening_id
        ).length
        const openings = bottleOpenings.filter(op => op.batch_entry_id === entry.id && !op.is_cancelled).length
        const availableBottles = entry.bottle_count - discardedClosed - openings

        const isAvailable = availableBottles > 0 || hasActiveOpenBottle

        const existing = vaccineMap.get(vaccine.id)
        if (!existing || (!existing.available && isAvailable)) {
          vaccineMap.set(vaccine.id, {
            vaccineId: vaccine.id,
            vaccineName: vaccine.name,
            available: isAvailable,
            hasOpenBottle: hasActiveOpenBottle,
            expiryDate: batch.expiry_date,
          })
        }
      }

      const vaccineList = Array.from(vaccineMap.values()).sort((a, b) =>
        a.vaccineName.localeCompare(b.vaccineName, 'pt-BR')
      )

      return { room, vaccines: vaccineList }
    })
  }, [rooms, batchRoomEntries, batches, vaccines, bottleOpenings, bottleDiscards])

  if (!loading && !location) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 text-center">
          <XCircle className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-600">Posto não encontrado</h2>
          <p className="text-sm text-gray-400 mt-2">
            Este local não existe ou não está disponível.
          </p>
          <Link
            to="/disponibilidade"
            className="inline-flex items-center gap-1 mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à busca
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      {/* Location hero */}
      <div className="bg-blue-50 border-b">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            to="/disponibilidade"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à busca
          </Link>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{location!.name}</h1>
                <span className="text-xs text-gray-400 bg-white rounded px-2 py-0.5 border border-gray-100">
                  {locationTypeLabel(location!.type)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-sm text-gray-500">{location!.address}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Last updated */}
        <p className="text-xs text-gray-400">
          Atualizado em {formatDateTimeWithAtBR(lastUpdated)}
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-32 mb-4" />
                <div className="space-y-2">
                  <div className="h-10 bg-gray-100 rounded" />
                  <div className="h-10 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : roomsWithVaccines.length === 0 ? (
          <div className="text-center py-16">
            <XCircle className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-600">Nenhuma sala cadastrada</h2>
            <p className="text-sm text-gray-400 mt-2">
              Este posto ainda não tem salas de vacinação registradas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {roomsWithVaccines.map(({ room, vaccines: vaccineList }) => (
              <div key={room.id} className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 text-sm mb-3">{room.description}</h2>

                {vaccineList.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    Nenhuma vacina disponível nesta sala no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {vaccineList.map(v => (
                      <div
                        key={v.vaccineId}
                        className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                          v.available ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {v.available ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${v.available ? 'text-gray-800' : 'text-gray-400'}`}>
                            {v.vaccineName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {v.hasOpenBottle && v.available && (
                            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                              Frasco aberto
                            </span>
                          )}
                          <span className={`text-xs font-semibold ${v.available ? 'text-green-700' : 'text-gray-400'}`}>
                            {v.available ? 'Disponível' : 'Indisponível'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
        <Syringe className="h-6 w-6" style={{ color: '#1A2F7C' }} />
        <span
          className="text-xl font-bold"
          style={{ color: '#1A2F7C', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Imunize-Me
        </span>
      </div>
    </header>
  )
}

function Footer() {
  return (
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
  )
}
