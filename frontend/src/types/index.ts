// ─── Paginação ────────────────────────────────────────────────────────────────

export interface PaginatedMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: PaginatedMeta
}

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'administrador' | 'gestor' | 'tecnico'
// 'cidadao' não existe como UserRole — acessa /disponibilidade sem login

export type LocationType = 'ubs' | 'lugar_temporario' | 'escola' | 'hospital' | 'outro'

export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export type BulkDiscardMode = 'A' | 'B'

export type NotificationEventType = 'bottle_opening' | 'bottle_discard'

// ─── Usuários ─────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  jobTitle?: string
  isActive: boolean
  createdAt: string
}

// ─── Estrutura física ─────────────────────────────────────────────────────────

export interface Location {
  id: string
  name: string
  address: string
  type: LocationType
  otherDescription?: string
  isDeleted: boolean
  deletedBy?: string
  deletedAt?: string
  createdAt: string
}

export interface VaccineRoom {
  id: string
  locationId: string
  locationName?: string
  description: string
  isDeleted: boolean
  deletedBy?: string
  deletedAt?: string
  createdAt: string
}

// ─── Vínculos de equipe ───────────────────────────────────────────────────────

export interface ManagerLocation {
  id: string
  userId: string
  locationId: string
  isDeleted: boolean
  createdAt: string
}

export interface TechnicianRoom {
  id: string
  userId: string
  vaccineRoomId: string
  isDeleted: boolean
  createdAt: string
}

// ─── Motivos ──────────────────────────────────────────────────────────────────

export interface BottleOpeningReason {
  id: string
  name: string
  isDefault: boolean
  isDeleted: boolean
  createdAt: string
}

export interface BottleDiscardReason {
  id: string
  name: string
  isDefault: boolean
  isDeleted: boolean
  createdAt: string
}

// ─── Vacinas e laboratórios ───────────────────────────────────────────────────

export interface Laboratory {
  id: string
  name: string
  isDeleted: boolean
  createdAt: string
}

export interface Vaccine {
  id: string
  name: string
  laboratoryId: string
  laboratoryName: string
  isDeleted: boolean
  createdAt: string
}

// ─── Lotes (arquitetura lote-mestre + entrada por sala) ───────────────────────
//
// Um lote-mestre (Batch) representa o lote do fabricante.
// Os dados físicos (validade, doses, ml) ficam no lote-mestre.
// Cada sala que recebe frascos deste lote cria um BatchRoomEntry com
// sua própria quantidade (bottleCount).
// O mesmo batchCode pode existir em múltiplas BatchRoomEntries (uma por sala).

export interface Batch {
  id: string
  batchCode: string                   // código do fabricante — único por vacina
  vaccineId: string
  expiryDate: string                  // ISO date — bloqueia abertura quando < hoje
  closedBottleExpiryDate: string      // ISO date — informativo; exibido só no detalhe
  openBottleExpiryMinutes: number     // validade após abertura (minutos)
  dosesPerBottle: number
  mlPerDose: number
  isDeleted: boolean
  createdBy: string
  createdAt: string
}

export interface BatchRoomEntry {
  id: string
  batchId: string                     // FK para Batch (lote-mestre)
  vaccineRoomId: string
  bottleCount: number                 // frascos recebidos por esta sala — imutável
  sourceBatchEntryId?: string         // preenchido quando criado por transferência aceita
  isDeleted: boolean
  createdBy: string
  createdAt: string
}

// Cálculo de frascos disponíveis de uma BatchRoomEntry (runtime — nunca persistir):
//   frascos_disponíveis =
//       entry.bottleCount
//     - BottleDiscards Modo A não cancelados vinculados a esta entry
//     - BottleOpenings não canceladas vinculadas a esta entry
//     - BatchTransfers pending vinculados a esta entry (em trânsito)
//     - BatchTransfers accepted vinculados a esta entry (já transferidos)

// ─── Aberturas individuais ────────────────────────────────────────────────────

export interface BottleOpening {
  id: string
  batchEntryId: string               // referência à BatchRoomEntry
  vaccineRoomId: string              // desnormalizado para filtros de monitoramento
  openedAt: string
  comment?: string
  openingReasonId?: string           // obrigatório quando alertTriggered = true
  alertTriggered: boolean
  isCancelled: boolean
  cancelledBy?: string
  cancelledAt?: string
  bulkOpeningId?: string             // null = individual; not null = criado por bulk
  createdBy: string
  createdAt: string
}

// ─── Descartes individuais ────────────────────────────────────────────────────

export interface BottleDiscard {
  id: string
  batchEntryId: string
  bottleOpeningId?: string           // null = Modo A (frasco fechado)
  discardedAt: string
  discardReasonId: string
  remainingDoses?: number            // obrigatório no Modo B; ≤ dosesPerBottle
  comment?: string
  isCancelled: boolean
  cancelledBy?: string
  cancelledAt?: string
  bulkDiscardId?: string             // null = individual; not null = criado por bulk
  createdBy: string
  createdAt: string
}

// ─── Operações em massa ───────────────────────────────────────────────────────

export interface BulkBottleOpening {
  id: string
  batchEntryId: string
  vaccineRoomId: string
  openedAt: string                   // mesmo valor para todos os N registros filhos
  quantity: number                   // frascos solicitados
  quantityExecuted: number           // efetivamente abertos (pode ser < quantity)
  quantityCancelled: number          // acumulado de cancelamentos parciais
  comment?: string
  openingReasonId?: string           // obrigatório quando alertTriggered = true
  alertTriggered: boolean
  createdBy: string
  createdAt: string
}

export interface BulkBottleDiscard {
  id: string
  batchEntryId: string
  vaccineRoomId: string
  mode: BulkDiscardMode              // 'A' = fechados, 'B' = abertos
  discardedAt: string
  discardReasonId: string
  quantity: number
  quantityExecuted: number
  quantityCancelled: number
  comment?: string
  createdBy: string
  createdAt: string
}

// ─── Transferências ───────────────────────────────────────────────────────────

export interface BatchTransfer {
  id: string
  sourceBatchEntryId: string         // BatchRoomEntry de origem
  destinedBatchEntryId?: string      // BatchRoomEntry criada no destino (após aceite)
  originVaccineRoomId: string
  destinationVaccineRoomId: string
  bottleCount: number
  status: TransferStatus
  expiresAt: string
  requestedBy: string
  requestedAt: string
  resolvedBy?: string
  resolvedAt?: string
  comment?: string
  createdAt: string
}

// ─── Notificações ─────────────────────────────────────────────────────────────

export interface NotificationEventConfig {
  id: string
  eventType: NotificationEventType
  label: string
  isEnabled: boolean                 // padrão global
  updatedBy?: string
  updatedAt?: string
}

export interface NotificationLocationOverride {
  id: string
  eventConfigId: string
  locationId: string
  isEnabled: boolean                 // sobrescreve o global para esta UBS
  createdBy: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  eventType: NotificationEventType
  entityId: string                   // id do registro de origem
  entityTable: string                // 'bottle_openings' | 'bulk_bottle_openings' | etc.
  sourceVaccineRoomId: string
  isRead: boolean
  readAt?: string
  createdAt: string
}

// ─── Parâmetros e auditoria ───────────────────────────────────────────────────

export interface SystemParameter {
  id: string
  key: string
  value: string
  description: string
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  entityName: string
  entityId?: string
  payload: Record<string, unknown>
  createdAt: string
}
