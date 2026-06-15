import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Info } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../lib/api-client'
import { mapApiVaccineRoom, useVaccineRooms, type ApiVaccineRoom } from '../hooks/useVaccineRooms'
import type { Batch, PaginatedResponse, VaccineRoom } from '../types'
import { Button } from './ui/button'
import { AsyncCombobox, type ComboboxOption } from './ui/async-combobox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet'
import { useToast } from './ui/use-toast'
import { DatePicker } from './ui/date-picker'

// ─── Local API shapes ─────────────────────────────────────────────────────────

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
  is_deleted: boolean
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


async function getApiErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string; message?: string }
    return body.detail ?? body.message ?? 'Erro desconhecido.'
  } catch {
    return 'Erro desconhecido.'
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-blue-700' : 'text-green-600'}`}>
        {step > 1 ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-700 text-xs font-bold">1</span>
        )}
        <span className="text-sm font-medium">Identificar lote</span>
      </div>
      <div className="h-px flex-1 bg-gray-200" />
      <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-blue-700' : 'text-gray-400'}`}>
        <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold ${step === 2 ? 'border-blue-700' : 'border-gray-300'}`}>2</span>
        <span className="text-sm font-medium">Registrar entrada</span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface CreateBatchWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the vaccine field is pre-selected and locked. */
  lockedVaccineId?: string
  /** Display name for the locked vaccine — shown immediately without waiting for the lookup. */
  lockedVaccineName?: string
  /** Called after a batch entry is successfully created. */
  onSuccess?: () => void
}

export function CreateBatchWizard({ open, onOpenChange, lockedVaccineId, lockedVaccineName, onSuccess }: CreateBatchWizardProps) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const [vaccineRooms, setVaccinesRooms] = useState(useVaccineRooms().vaccineRooms)
  const { toast } = useToast()

  // ── Lookups ─────────────────────────────────────────────────────────────────
  const [vaccines, setVaccines] = useState<{ id: string; name: string }[]>([])
  const [batches, setBatches] = useState<Batch[]>([])

  // ── Wizard state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)
  const [s1BatchCode, setS1BatchCode] = useState('')
  const [s1VaccineId, setS1VaccineId] = useState('')
  const [s1ExpiryDate, setS1ExpiryDate] = useState('')
  const [s1ClosedExpiryDate, setS1ClosedExpiryDate] = useState('')
  const [s1OpenExpiryValue, setS1OpenExpiryValue] = useState('')
  const [s1OpenExpiryUnit, setS1OpenExpiryUnit] = useState<'minutos' | 'horas'>('horas')
  const [s1DosesPerBottle, setS1DosesPerBottle] = useState('')
  const [s1MlPerDose, setS1MlPerDose] = useState('')
  const [s1Error, setS1Error] = useState('')
  const [existingBatch, setExistingBatch] = useState<Batch | null>(null)
  const [s2RoomId, setS2RoomId] = useState('')
  const [s2BottleCount, setS2BottleCount] = useState('')
  const [s2Error, setS2Error] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Fetch lookups ────────────────────────────────────────────────────────────

  const fetchLookups = useCallback(async () => {
    try {
      const [vaccinesRes, batchesRes] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiVaccine>>('/vaccines?page=1&page_size=20'),
        apiClient.get<PaginatedResponse<ApiBatch>>('/batches?page=1&page_size=20'),
      ])
      setVaccines(vaccinesRes.data.filter((v) => !v.is_deleted).map((v) => ({ id: v.id, name: v.name })))
      setBatches(batchesRes.data.map(mapApiBatch))
    } catch {
      // lookups degrade gracefully
    }
  }, [])

  useEffect(() => {
    if (open) void fetchLookups()
  }, [open, fetchLookups])

  const fetchVaccineRoomsOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiVaccineRoom>>(
        `/vaccine-rooms?${params}`
      )

      const nextVaccineRooms = res.data.filter((l) => !l.is_deleted).map(mapApiVaccineRoom)

      setVaccinesRooms((current) => {
        const merged = new Map(current.map((location) => [location.id, location]))
        nextVaccineRooms.forEach((location) => merged.set(location.id, location))
        return Array.from(merged.values())
      })

      return nextVaccineRooms.map((vaccineRoom) => ({
        value: vaccineRoom.id,
        label: vaccineRoom.description + ' ' + vaccineRoom.locationName,
      }))
    } catch {
      return []
    }
  }, [])

  // ── Reset & pre-fill on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    setStep(1)
    setS1BatchCode('')
    setS1VaccineId(lockedVaccineId ?? '')
    setS1ExpiryDate('')
    setS1ClosedExpiryDate('')
    setS1OpenExpiryValue('')
    setS1OpenExpiryUnit('horas')
    setS1DosesPerBottle('')
    setS1MlPerDose('')
    setS1Error('')
    setExistingBatch(null)
    setS2RoomId('')
    setS2BottleCount('')
    setS2Error('')
  }, [open, lockedVaccineId])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const vaccinesRoomsMap = new Map(vaccineRooms.map((l) => [l.id, l]))

  // Default room on step 2
  useEffect(() => {
    if (step === 2 && !s2RoomId && vaccineRooms.length > 0) {
      setS2RoomId(vaccineRooms[0]?.id)
    }
  }, [step, s2RoomId, vaccineRooms])

  const readOnly = !!existingBatch

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleBatchCodeBlur() {
    if (!s1BatchCode.trim() || !s1VaccineId) return
    const found = batches.find(
      (b) => b.batchCode === s1BatchCode.trim() && b.vaccineId === s1VaccineId && !b.isDeleted
    )
    if (found) {
      setExistingBatch(found)
      setS1ExpiryDate(found.expiryDate)
      setS1ClosedExpiryDate(found.closedBottleExpiryDate)
      const isHours = found.openBottleExpiryMinutes % 60 === 0
      if (isHours) {
        setS1OpenExpiryValue(String(found.openBottleExpiryMinutes / 60))
        setS1OpenExpiryUnit('horas')
      } else {
        setS1OpenExpiryValue(String(found.openBottleExpiryMinutes))
        setS1OpenExpiryUnit('minutos')
      }
      setS1DosesPerBottle(String(found.dosesPerBottle))
      setS1MlPerDose(String(found.mlPerDose))
    } else {
      setExistingBatch(null)
    }
  }

  function isNegativeNumber(value: string) {
    const num = Number(value)
    return isNaN(num) || num < 0
  }

  function handleNext() {
    setS1Error('')
    if (!s1BatchCode.trim() || !s1VaccineId || !s1ExpiryDate || !s1ClosedExpiryDate || !s1OpenExpiryValue || isNegativeNumber(s1OpenExpiryValue) || !s1DosesPerBottle || isNegativeNumber(s1DosesPerBottle) || !s1MlPerDose || isNegativeNumber(s1MlPerDose)) {
      setS1Error('Por favor, preencha todos os campos obrigatórios e de forma válida.')
      return
    }
    setStep(2)
  }

  async function handleFinish() {
    setS2Error('')
    if (!s2RoomId || !s2BottleCount) {
      setS2Error('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    setSaving(true)
    try {
      let batchId = existingBatch?.id

      // 1. Create batch if it doesn't exist
      if (!batchId) {
        const openExpiryMinutes = s1OpenExpiryUnit === 'horas'
          ? Number(s1OpenExpiryValue) * 60
          : Number(s1OpenExpiryValue)

        const batchRes = await apiClient.post<{ success: boolean; data: ApiBatch }>('/batches', {
          batch_code: s1BatchCode.trim(),
          vaccine_id: s1VaccineId,
          expiry_date: new Date(s1ExpiryDate).toISOString().split("T")[0],
          closed_bottle_expiry_date: new Date(s1ClosedExpiryDate).toISOString().split("T")[0],
          open_bottle_expiry_minutes: openExpiryMinutes,
          doses_per_bottle: Number(s1DosesPerBottle),
          ml_per_dose: Number(s1MlPerDose),
        })
        batchId = batchRes.data.id
      }

      // 2. Create batch room entry
      await apiClient.post<ApiBatchRoomEntry>('/batch-room-entries', {
        batch_id: batchId,
        vaccine_room_id: s2RoomId,
        bottle_count: Number(s2BottleCount),
      })

      toast({ title: 'Entrada de lote registrada com sucesso!' })
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setS2Error(await getApiErrorMessage(err as Response))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo Lote por Sala</SheetTitle>
          <SheetDescription>
            Identifique o lote e registre a entrada de frascos em uma sala.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8">
          <StepIndicator step={step} />

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Vacina *</Label>
                {lockedVaccineId ? (
                  <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    {lockedVaccineName ?? vaccines.find(v => v.id === lockedVaccineId)?.name ?? 'Carregando...'}
                  </div>
                ) : (
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={s1VaccineId}
                    onChange={(e) => setS1VaccineId(e.target.value)}
                  >
                    <option value="">Selecione uma vacina</option>
                    {vaccines.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Código do Lote *</Label>
                <Input
                  placeholder="Ex: 210214"
                  value={s1BatchCode}
                  onChange={(e) => setS1BatchCode(e.target.value)}
                  onBlur={handleBatchCodeBlur}
                />
                {existingBatch && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded border border-blue-100">
                    <Info className="h-3.5 w-3.5" />
                    Lote já cadastrado. Informações preenchidas automaticamente.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Validade do Lote *</Label>
                  <DatePicker
                    value={s1ExpiryDate}
                    onValueChange={setS1ExpiryDate}
                    readOnly={readOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Validade Frasco Fechado *</Label>
                  <DatePicker
                    value={s1ClosedExpiryDate}
                    onValueChange={setS1ClosedExpiryDate}
                    readOnly={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Validade Frasco Aberto *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Ex: 6"
                      value={s1OpenExpiryValue}
                      onChange={(e) => setS1OpenExpiryValue(e.target.value)}
                      readOnly={readOnly}
                    />
                    <select
                      className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-gray-50"
                      value={s1OpenExpiryUnit}
                      onChange={(e) => setS1OpenExpiryUnit(e.target.value as any)}
                      disabled={readOnly}
                    >
                      <option value="minutos">min</option>
                      <option value="horas">horas</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Doses por Frasco *</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 10"
                    value={s1DosesPerBottle}
                    onChange={(e) => setS1DosesPerBottle(e.target.value)}
                    readOnly={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>ML por Dose *</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 0.5"
                  value={s1MlPerDose}
                  onChange={(e) => setS1MlPerDose(e.target.value)}
                  readOnly={readOnly}
                />
              </div>

              {s1Error && <p className="text-sm text-red-500 font-medium">{s1Error}</p>}

              <div className="pt-4">
                <Button className="w-full" onClick={handleNext}>
                  Continuar <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm">
                <div className="font-semibold text-gray-900 mb-1">Resumo do Lote:</div>
                <div className="text-gray-600">
                  {vaccines.find(v => v.id === s1VaccineId)?.name} — Lote {s1BatchCode}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Sala de Vacina *</Label>
                <AsyncCombobox
                  placeholder="Selecione a sala..."
                  fetchOptions={fetchVaccineRoomsOptions}
                  value={s2RoomId}
                  onValueChange={setS2RoomId}
                  valueLabel={vaccinesRoomsMap.get(s2RoomId)?.description + ' ' + vaccinesRoomsMap.get(s2RoomId)?.locationName}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Quantidade de Frascos *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 50"
                  value={s2BottleCount}
                  onChange={(e) => setS2BottleCount(e.target.value)}
                />
              </div>

              {s2Error && <p className="text-sm text-red-500 font-medium">{s2Error}</p>}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button className="flex-[2]" onClick={handleFinish} disabled={saving}>
                  {saving ? 'Salvando...' : 'Finalizar Cadastro'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
