import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../../stores/auth'
import { apiClient } from '../../lib/api-client'
import { useToast } from '../../components/ui/use-toast'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { Badge } from '../../components/ui/badge'
import { Trash2 } from 'lucide-react'
import { AsyncCombobox, type ComboboxOption } from '../../components/ui/async-combobox'
import type {
  Location,
  LocationType,
  NotificationEventType,
  NotificationEventConfig,
  NotificationLocationOverride,
  SystemParameter,
  PaginatedResponse,
} from '../../types'

interface ApiLocation {
  id: string
  name: string
  address: string
  type: LocationType
  other_description?: string
  is_deleted: boolean
  deleted_by?: string
  deleted_at?: string
  created_at: string
}

interface ApiNotificationEventConfig {
  id: string
  event_type: NotificationEventType
  label: string
  is_enabled: boolean
  updated_by?: string
  updated_at?: string
}

interface ApiNotificationLocationOverride {
  id: string
  event_config_id: string
  location_id: string
  is_enabled: boolean
  created_by: string
  created_at: string
}

function mapApiLocation(l: ApiLocation): Location {
  return {
    id: l.id,
    name: l.name,
    address: l.address,
    type: l.type,
    otherDescription: l.other_description,
    isDeleted: l.is_deleted,
    deletedBy: l.deleted_by,
    deletedAt: l.deleted_at,
    createdAt: l.created_at,
  }
}

function mapApiNotificationEventConfig(a: ApiNotificationEventConfig): NotificationEventConfig {
  return {
    id: a.id,
    eventType: a.event_type,
    label: a.label,
    isEnabled: a.is_enabled,
    updatedBy: a.updated_by,
    updatedAt: a.updated_at,
  }
}

function mapApiNotificationLocationOverride(a: ApiNotificationLocationOverride): NotificationLocationOverride {
  return {
    id: a.id,
    eventConfigId: a.event_config_id,
    locationId: a.location_id,
    isEnabled: a.is_enabled,
    createdBy: a.created_by,
    createdAt: a.created_at,
  }
}

export default function ParametrosPage() {
  const { currentUser } = useAuthStore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)

  // System parameters from API
  const [systemParameters, setSystemParameters] = useState<SystemParameter[]>([])

  // Locations from API
  const [locations, setLocations] = useState<Location[]>([])

  // Notification event configs from API
  const [notificationEventConfigs, setNotificationEventConfigs] = useState<NotificationEventConfig[]>([])

  // Notification location overrides from API
  const [notificationLocationOverrides, setNotificationLocationOverrides] = useState<NotificationLocationOverride[]>([])

  // Local editable state for system parameters
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [savingParam, setSavingParam] = useState<string | null>(null)
  const [togglingConfig, setTogglingConfig] = useState<string | null>(null)

  // Override form
  const [overrideLocationId, setOverrideLocationId] = useState('')
  const [overrideEventType, setOverrideEventType] = useState<NotificationEventType>('bottle_opening')
  const [overrideEnabled, setOverrideEnabled] = useState(true)
  const [savingOverride, setSavingOverride] = useState(false)
  const [removingOverride, setRemovingOverride] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [paramsRes, eventConfigsRes, overridesRes] = await Promise.all([
          apiClient.get<{ data: SystemParameter[] }>('/system-parameters'),
          apiClient.get<{ data: ApiNotificationEventConfig[] } | ApiNotificationEventConfig[]>('/notification-event-configs'),
          apiClient.get<{ data: ApiNotificationLocationOverride[] } | ApiNotificationLocationOverride[]>('/notification-location-overrides'),
        ])
        const params = paramsRes.data
        setSystemParameters(params)
        const values: Record<string, string> = {}
        params.forEach((p) => { values[p.id] = p.value })
        setParamValues(values)

        const eventConfigItems = Array.isArray(eventConfigsRes)
          ? eventConfigsRes
          : (eventConfigsRes as { data: ApiNotificationEventConfig[] }).data
        setNotificationEventConfigs(eventConfigItems.map(mapApiNotificationEventConfig))

        const overrideItems = Array.isArray(overridesRes)
          ? overridesRes
          : (overridesRes as { data: ApiNotificationLocationOverride[] }).data
        setNotificationLocationOverrides(overrideItems.map(mapApiNotificationLocationOverride))
      } catch {
        toast({ title: 'Erro ao carregar dados.', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchLocationsOptions = useCallback(async (search: string, limit: number): Promise<ComboboxOption[]> => {
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(limit) })
      if (search) params.set('search', search)
      const res = await apiClient.get<PaginatedResponse<ApiLocation>>(`/locations?${params}`)
      const nextLocations = res.data.filter((l) => !l.is_deleted).map(mapApiLocation)
      setLocations((current) => {
        const merged = new Map(current.map((loc) => [loc.id, loc]))
        nextLocations.forEach((loc) => merged.set(loc.id, loc))
        return Array.from(merged.values())
      })
      return nextLocations.map((loc) => ({
        value: loc.id,
        label: loc.name,
      }))
    } catch {
      return []
    }
  }, [])

  if (currentUser?.role !== 'administrador') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    )
  }

  const activeLocations = locations.filter((l) => !l.isDeleted)
  const locationMap = new Map(locations.map((l) => [l.id, l.name]))
  const eventConfigMap = new Map(notificationEventConfigs.map((c) => [c.id, c]))

  async function handleSaveParam(id: string) {
    setSavingParam(id)
    try {
      await apiClient.put(`/system-parameters/${id}`, { value: paramValues[id] ?? '' })
      toast({ title: 'Parâmetro salvo com sucesso.' })
    } catch {
      toast({ title: 'Erro ao salvar parâmetro.', variant: 'destructive' })
    } finally {
      setSavingParam(null)
    }
  }

  async function handleToggleConfig(id: string, current: boolean) {
    setTogglingConfig(id)
    try {
      await apiClient.put(`/notification-event-configs/${id}`, { is_enabled: !current })
      setNotificationEventConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isEnabled: !current } : c))
      )
      toast({ title: 'Configuração de notificação atualizada.' })
    } finally {
      setTogglingConfig(null)
    }
  }

  async function handleAddOverride() {
    if (!currentUser) return
    if (!overrideLocationId) {
      toast({ title: 'Selecione uma UBS.', variant: 'destructive' })
      return
    }
    const eventConfig = notificationEventConfigs.find((c) => c.eventType === overrideEventType)
    if (!eventConfig) {
      toast({ title: 'Tipo de evento inválido.', variant: 'destructive' })
      return
    }
    // Check if override already exists
    const exists = notificationLocationOverrides.some(
      (o) => o.locationId === overrideLocationId && o.eventConfigId === eventConfig.id
    )
    if (exists) {
      toast({ title: 'Já existe uma regra para esta UBS e tipo de evento.', variant: 'destructive' })
      return
    }
    setSavingOverride(true)
    try {
      const res = await apiClient.post<ApiNotificationLocationOverride | { data: ApiNotificationLocationOverride }>(
        '/notification-location-overrides',
        {
          event_config_id: eventConfig.id,
          location_id: overrideLocationId,
          is_enabled: overrideEnabled,
        }
      )
      const created = 'data' in res ? res.data : res
      setNotificationLocationOverrides((prev) => [...prev, mapApiNotificationLocationOverride(created)])
      toast({ title: 'Regra de notificação adicionada.' })
      setOverrideLocationId('')
    } finally {
      setSavingOverride(false)
    }
  }

  async function handleToggleOverride(id: string, current: boolean) {
    setRemovingOverride(id)
    try {
      await apiClient.put(`/notification-location-overrides/${id}`, { is_enabled: !current })
      setNotificationLocationOverrides((prev) =>
        prev.map((o) => (o.id === id ? { ...o, isEnabled: !current } : o))
      )
      toast({ title: 'Regra de notificação atualizada.' })
    } finally {
      setRemovingOverride(null)
    }
  }

  async function handleRemoveOverride(id: string) {
    setRemovingOverride(id)
    try {
      await apiClient.delete(`/notification-location-overrides/${id}`)
      setNotificationLocationOverrides((prev) => prev.filter((o) => o.id !== id))
      toast({ title: 'Regra de notificação removida.' })
    } finally {
      setRemovingOverride(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Parâmetros do Sistema</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure o comportamento do sistema.</p>
      </div>

      {/* ── System Parameters ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Parâmetros Gerais</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          systemParameters.map((param) => (
            <div key={param.id} className="border rounded-lg p-4 space-y-2">
              <div>
                <p className="font-medium text-sm">{param.key}</p>
                {param.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{param.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  className="w-32 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={paramValues[param.id] ?? param.value}
                  onChange={(e) => setParamValues((prev) => ({ ...prev, [param.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  onClick={() => handleSaveParam(param.id)}
                  disabled={savingParam === param.id}
                >
                  {savingParam === param.id ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Notification Event Configs ────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Notificações por Evento</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          notificationEventConfigs.map((config) => (
            <div key={config.id} className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <p className="font-medium text-sm">{config.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Evento: {config.eventType}</p>
              </div>
              <Button
                size="sm"
                variant={config.isEnabled ? 'default' : 'outline'}
                onClick={() => handleToggleConfig(config.id, config.isEnabled)}
                disabled={togglingConfig === config.id}
              >
                {togglingConfig === config.id ? 'Atualizando…' : config.isEnabled ? 'Desabilitar' : 'Habilitar'}
              </Button>
            </div>
          ))
        )}
      </section>

      {/* ── Notification Location Overrides ────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Regras por UBS</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {notificationLocationOverrides.map((override) => {
              const config = eventConfigMap.get(override.eventConfigId)
              return (
                <div key={override.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div>
                    <p className="font-medium">{locationMap.get(override.locationId) ?? override.locationId}</p>
                    <p className="text-xs text-muted-foreground">{config?.label ?? override.eventConfigId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={override.isEnabled ? 'default' : 'secondary'}>
                      {override.isEnabled ? 'Habilitado' : 'Desabilitado'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleOverride(override.id, override.isEnabled)}
                      disabled={removingOverride === override.id}
                    >
                      {override.isEnabled ? 'Desabilitar' : 'Habilitar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveOverride(override.id)}
                      disabled={removingOverride === override.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add override form */}
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="font-medium text-sm">Adicionar regra</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AsyncCombobox
              placeholder="Selecione a UBS…"
              fetchOptions={fetchLocationsOptions}
              value={overrideLocationId}
              onValueChange={setOverrideLocationId}
              valueLabel={locationMap.get(overrideLocationId)}
            />

            <select
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              value={overrideEventType}
              onChange={(e) => setOverrideEventType(e.target.value as NotificationEventType)}
            >
              {notificationEventConfigs.map((c) => (
                <option key={c.id} value={c.eventType}>{c.label}</option>
              ))}
            </select>

            <select
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              value={overrideEnabled ? 'true' : 'false'}
              onChange={(e) => setOverrideEnabled(e.target.value === 'true')}
            >
              <option value="true">Habilitado</option>
              <option value="false">Desabilitado</option>
            </select>
          </div>
          <Button
            size="sm"
            onClick={handleAddOverride}
            disabled={savingOverride || !overrideLocationId}
          >
            {savingOverride ? 'Adicionando…' : 'Adicionar Regra'}
          </Button>
        </div>
      </section>
    </div>
  )
}
