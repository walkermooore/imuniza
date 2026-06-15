-- =============================================================================
-- ImunizeMe — DDL completo
-- Banco de dados: PostgreSQL 15+
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'administrador',
  'gestor',
  'tecnico'
);
-- Nota: 'cidadao' não é um papel de usuário — acessa /disponibilidade sem login.

CREATE TYPE location_type AS ENUM (
  'ubs',
  'lugar_temporario',
  'escola',
  'hospital',
  'outro'
);

CREATE TYPE transfer_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'expired',
  'cancelled'
);

CREATE TYPE bulk_discard_mode AS ENUM (
  'A',   -- frasco fechado
  'B'    -- frasco aberto
);

CREATE TYPE notification_event_type AS ENUM (
  'bottle_opening',
  'bottle_discard'
);

-- =============================================================================
-- TABELAS (ordem de dependência: sem FK → com FK)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Usuários
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  email         TEXT          NOT NULL UNIQUE,
  role          user_role     NOT NULL,
  job_title     TEXT,
  password_hash TEXT,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by    UUID          REFERENCES users (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by    UUID          REFERENCES users (id),
  updated_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 2. Locais (UBS, escolas, postos temporários, hospitais, outros)
-- ---------------------------------------------------------------------------
CREATE TABLE locations (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT          NOT NULL,
  address           TEXT          NOT NULL,
  type              location_type NOT NULL,
  -- Descrição livre obrigatória apenas quando type = 'outro'
  other_description TEXT,
  is_deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
  deleted_by        UUID          REFERENCES users (id),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID          REFERENCES users (id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by        UUID          REFERENCES users (id),
  updated_at        TIMESTAMPTZ,

  CONSTRAINT chk_locations_other_description
    CHECK (
      type <> 'outro'
      OR (type = 'outro' AND other_description IS NOT NULL AND other_description <> '')
    ),
  CONSTRAINT chk_locations_deleted_consistency
    CHECK (
      (is_deleted = FALSE AND deleted_by IS NULL AND deleted_at IS NULL)
      OR
      (is_deleted = TRUE  AND deleted_by IS NOT NULL AND deleted_at IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- 3. Salas de vacinação
-- ---------------------------------------------------------------------------
CREATE TABLE vaccine_rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID        NOT NULL REFERENCES locations (id),
  description TEXT        NOT NULL,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_by  UUID        REFERENCES users (id),
  deleted_at  TIMESTAMPTZ,
  created_by  UUID        REFERENCES users (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES users (id),
  updated_at  TIMESTAMPTZ,

  CONSTRAINT chk_vaccine_rooms_deleted_consistency
    CHECK (
      (is_deleted = FALSE AND deleted_by IS NULL AND deleted_at IS NULL)
      OR
      (is_deleted = TRUE  AND deleted_by IS NOT NULL AND deleted_at IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- 4. Vínculos de equipe — Gestor ↔ Local
-- ---------------------------------------------------------------------------
CREATE TABLE manager_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id),
  location_id UUID        NOT NULL REFERENCES locations (id),
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by  UUID        NOT NULL REFERENCES users (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um gestor pode ser vinculado ao mesmo local apenas uma vez (quando não excluído)
  CONSTRAINT uq_manager_locations_active
    UNIQUE NULLS NOT DISTINCT (user_id, location_id)   -- unicidade tratada via índice parcial abaixo
);

-- Índice parcial: impede duplicata ativa (usuário × local não excluído)
CREATE UNIQUE INDEX uix_manager_locations_active
  ON manager_locations (user_id, location_id)
  WHERE is_deleted = FALSE;

-- ---------------------------------------------------------------------------
-- 5. Vínculos de equipe — Técnico ↔ Sala
-- ---------------------------------------------------------------------------
CREATE TABLE technician_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users (id),
  vaccine_room_id UUID        NOT NULL REFERENCES vaccine_rooms (id),
  is_deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by      UUID        NOT NULL REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial: impede duplicata ativa (técnico × sala não excluída)
CREATE UNIQUE INDEX uix_technician_rooms_active
  ON technician_rooms (user_id, vaccine_room_id)
  WHERE is_deleted = FALSE;

-- ---------------------------------------------------------------------------
-- 6. Motivos de abertura de frasco
-- ---------------------------------------------------------------------------
CREATE TABLE bottle_opening_reasons (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  is_default BOOLEAN     NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by UUID        REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES users (id),
  updated_at TIMESTAMPTZ
);

-- Regra de negócio: apenas UM motivo pode ser padrão por vez (entre os não excluídos)
CREATE UNIQUE INDEX uix_bottle_opening_reasons_default
  ON bottle_opening_reasons (is_default)
  WHERE is_default = TRUE AND is_deleted = FALSE;

-- ---------------------------------------------------------------------------
-- 7. Motivos de descarte de frasco
-- ---------------------------------------------------------------------------
CREATE TABLE bottle_discard_reasons (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  is_default BOOLEAN     NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by UUID        REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES users (id),
  updated_at TIMESTAMPTZ
);

-- Regra de negócio: apenas UM motivo de descarte pode ser padrão por vez
CREATE UNIQUE INDEX uix_bottle_discard_reasons_default
  ON bottle_discard_reasons (is_default)
  WHERE is_default = TRUE AND is_deleted = FALSE;

-- ---------------------------------------------------------------------------
-- 8. Laboratórios
-- ---------------------------------------------------------------------------
CREATE TABLE laboratories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by UUID        REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES users (id),
  updated_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 9. Vacinas
-- ---------------------------------------------------------------------------
CREATE TABLE vaccines (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  laboratory_id UUID        NOT NULL REFERENCES laboratories (id),
  is_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by    UUID        REFERENCES users (id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID        REFERENCES users (id),
  updated_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 10. Lotes-mestre (dados do fabricante)
-- ---------------------------------------------------------------------------
-- Um lote-mestre representa o lote do fabricante.
-- Os dados físicos (validade, doses, ml) ficam aqui.
-- Cada sala que recebe frascos deste lote cria um batch_room_entry.
CREATE TABLE batches (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code                 TEXT        NOT NULL,
  vaccine_id                 UUID        NOT NULL REFERENCES vaccines (id),
  -- Regra: bloqueia abertura de frasco quando expiry_date < CURRENT_DATE
  expiry_date                DATE        NOT NULL,
  -- Informativo; exibido apenas no detalhe do lote
  closed_bottle_expiry_date  DATE        NOT NULL,
  -- Validade do frasco após abertura (em minutos)
  open_bottle_expiry_minutes INTEGER     NOT NULL CHECK (open_bottle_expiry_minutes > 0),
  doses_per_bottle           INTEGER     NOT NULL CHECK (doses_per_bottle > 0),
  ml_per_dose                NUMERIC(8,2) NOT NULL CHECK (ml_per_dose > 0),
  is_deleted                 BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by                 UUID        NOT NULL REFERENCES users (id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ,

  -- Regra de negócio: batch_code único por vacina
  CONSTRAINT uq_batches_code_vaccine UNIQUE (batch_code, vaccine_id)
);

-- ---------------------------------------------------------------------------
-- 11. Entradas de lote por sala (instância de lote em uma sala específica)
-- ---------------------------------------------------------------------------
-- bottle_count é imutável após criação.
CREATE TABLE batch_room_entries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID        NOT NULL REFERENCES batches (id),
  vaccine_room_id       UUID        NOT NULL REFERENCES vaccine_rooms (id),
  -- Quantidade de frascos recebidos por esta sala — imutável após INSERT
  bottle_count          INTEGER     NOT NULL CHECK (bottle_count > 0),
  -- Preenchido quando esta entrada foi criada por uma transferência aceita
  source_batch_entry_id UUID        REFERENCES batch_room_entries (id),
  is_deleted            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by            UUID        NOT NULL REFERENCES users (id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 12. Aberturas em massa (operação bulk de abertura)
-- ---------------------------------------------------------------------------
CREATE TABLE bulk_bottle_openings (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_entry_id     UUID        NOT NULL REFERENCES batch_room_entries (id),
  vaccine_room_id    UUID        NOT NULL REFERENCES vaccine_rooms (id),
  -- Mesmo timestamp aplicado a todos os registros filhos
  opened_at          TIMESTAMPTZ NOT NULL,
  quantity           INTEGER     NOT NULL CHECK (quantity > 0),
  quantity_executed  INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_executed >= 0),
  quantity_cancelled INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_cancelled >= 0),
  comment            TEXT,
  -- Obrigatório quando alert_triggered = TRUE
  opening_reason_id  UUID        REFERENCES bottle_opening_reasons (id),
  alert_triggered    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by         UUID        NOT NULL REFERENCES users (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_bulk_openings_executed_lte_quantity
    CHECK (quantity_executed <= quantity),
  CONSTRAINT chk_bulk_openings_cancelled_lte_executed
    CHECK (quantity_cancelled <= quantity_executed),
  CONSTRAINT chk_bulk_openings_alert_requires_reason
    CHECK (alert_triggered = FALSE OR opening_reason_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 13. Aberturas individuais de frasco
-- ---------------------------------------------------------------------------
CREATE TABLE bottle_openings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_entry_id    UUID        NOT NULL REFERENCES batch_room_entries (id),
  -- Desnormalizado para filtros de monitoramento (evita JOIN frequente)
  vaccine_room_id   UUID        NOT NULL REFERENCES vaccine_rooms (id),
  opened_at         TIMESTAMPTZ NOT NULL,
  comment           TEXT,
  -- Obrigatório quando alert_triggered = TRUE
  opening_reason_id UUID        REFERENCES bottle_opening_reasons (id),
  alert_triggered   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_cancelled      BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelled_by      UUID        REFERENCES users (id),
  cancelled_at      TIMESTAMPTZ,
  -- null = abertura individual; preenchido = criada por operação bulk
  bulk_opening_id   UUID        REFERENCES bulk_bottle_openings (id),
  created_by        UUID        NOT NULL REFERENCES users (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_bottle_openings_alert_requires_reason
    CHECK (alert_triggered = FALSE OR opening_reason_id IS NOT NULL),
  CONSTRAINT chk_bottle_openings_cancelled_consistency
    CHECK (
      (is_cancelled = FALSE AND cancelled_by IS NULL AND cancelled_at IS NULL)
      OR
      (is_cancelled = TRUE  AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- 14. Descartes em massa (operação bulk de descarte)
-- ---------------------------------------------------------------------------
CREATE TABLE bulk_bottle_discards (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_entry_id     UUID              NOT NULL REFERENCES batch_room_entries (id),
  vaccine_room_id    UUID              NOT NULL REFERENCES vaccine_rooms (id),
  mode               bulk_discard_mode NOT NULL,   -- 'A' = fechado, 'B' = aberto
  discarded_at       TIMESTAMPTZ       NOT NULL,
  discard_reason_id  UUID              NOT NULL REFERENCES bottle_discard_reasons (id),
  quantity           INTEGER           NOT NULL CHECK (quantity > 0),
  quantity_executed  INTEGER           NOT NULL DEFAULT 0 CHECK (quantity_executed >= 0),
  quantity_cancelled INTEGER           NOT NULL DEFAULT 0 CHECK (quantity_cancelled >= 0),
  comment            TEXT,
  created_by         UUID              NOT NULL REFERENCES users (id),
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_bulk_discards_executed_lte_quantity
    CHECK (quantity_executed <= quantity),
  CONSTRAINT chk_bulk_discards_cancelled_lte_executed
    CHECK (quantity_cancelled <= quantity_executed)
);

-- ---------------------------------------------------------------------------
-- 15. Descartes individuais de frasco
-- ---------------------------------------------------------------------------
-- Modo A (frasco fechado): bottle_opening_id IS NULL
-- Modo B (frasco aberto) : bottle_opening_id IS NOT NULL, remaining_doses obrigatório
CREATE TABLE bottle_discards (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_entry_id    UUID        NOT NULL REFERENCES batch_room_entries (id),
  -- null  → Modo A (frasco fechado)
  -- not null → Modo B (frasco aberto, vinculado à abertura específica)
  bottle_opening_id UUID        REFERENCES bottle_openings (id),
  discarded_at      TIMESTAMPTZ NOT NULL,
  discard_reason_id UUID        NOT NULL REFERENCES bottle_discard_reasons (id),
  -- Obrigatório no Modo B; deve ser ≤ doses_per_bottle do lote (validado na aplicação)
  remaining_doses   INTEGER     CHECK (remaining_doses >= 0),
  comment           TEXT,
  is_cancelled      BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelled_by      UUID        REFERENCES users (id),
  cancelled_at      TIMESTAMPTZ,
  -- null = descarte individual; preenchido = criado por operação bulk
  bulk_discard_id   UUID        REFERENCES bulk_bottle_discards (id),
  created_by        UUID        NOT NULL REFERENCES users (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Modo B exige remaining_doses; Modo A não deve ter
  CONSTRAINT chk_bottle_discards_mode_b_requires_opening_and_doses
    CHECK (
      (bottle_opening_id IS NULL     AND remaining_doses IS NULL)   -- Modo A
      OR
      (bottle_opening_id IS NOT NULL AND remaining_doses IS NOT NULL) -- Modo B
    ),
  CONSTRAINT chk_bottle_discards_cancelled_consistency
    CHECK (
      (is_cancelled = FALSE AND cancelled_by IS NULL AND cancelled_at IS NULL)
      OR
      (is_cancelled = TRUE  AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- 16. Transferências de lote entre salas
-- ---------------------------------------------------------------------------
-- Ao ser aceita, uma nova batch_room_entry é criada no destino com
-- source_batch_entry_id apontando para a entrada de origem.
-- Transferências pending/accepted bloqueiam frascos no cálculo de disponibilidade.
CREATE TABLE batch_transfers (
  id                        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  source_batch_entry_id     UUID            NOT NULL REFERENCES batch_room_entries (id),
  -- Criada automaticamente na aceitação da transferência
  destined_batch_entry_id   UUID            REFERENCES batch_room_entries (id),
  origin_vaccine_room_id    UUID            NOT NULL REFERENCES vaccine_rooms (id),
  destination_vaccine_room_id UUID          NOT NULL REFERENCES vaccine_rooms (id),
  bottle_count              INTEGER         NOT NULL CHECK (bottle_count > 0),
  status                    transfer_status NOT NULL DEFAULT 'pending',
  -- Janela padrão: NOW() + parâmetro 'expire_transfer_minutes' (padrão 2880 min = 48h)
  expires_at                TIMESTAMPTZ     NOT NULL,
  requested_by              UUID            NOT NULL REFERENCES users (id),
  requested_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  resolved_by               UUID            REFERENCES users (id),
  resolved_at               TIMESTAMPTZ,
  comment                   TEXT,
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_batch_transfers_different_rooms
    CHECK (origin_vaccine_room_id <> destination_vaccine_room_id),
  CONSTRAINT chk_batch_transfers_resolved_consistency
    CHECK (
      (status IN ('pending') AND resolved_by IS NULL AND resolved_at IS NULL)
      OR
      (status IN ('accepted', 'rejected', 'expired', 'cancelled')
        AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    ),
  -- destined_batch_entry_id só deve existir quando a transferência foi aceita
  CONSTRAINT chk_batch_transfers_destined_entry_only_on_accepted
    CHECK (
      (status <> 'accepted' AND destined_batch_entry_id IS NULL)
      OR
      (status = 'accepted'  AND destined_batch_entry_id IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- 17. Configuração global de eventos de notificação
-- ---------------------------------------------------------------------------
CREATE TABLE notification_event_configs (
  id          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  notification_event_type NOT NULL UNIQUE,
  label       TEXT                    NOT NULL,
  is_enabled  BOOLEAN                 NOT NULL DEFAULT TRUE,   -- padrão global
  created_by  UUID                    REFERENCES users (id),
  created_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_by  UUID                    REFERENCES users (id),
  updated_at  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 18. Sobrescrita de notificação por local (UBS)
-- ---------------------------------------------------------------------------
-- Sobrescreve a configuração global para um local específico.
CREATE TABLE notification_location_overrides (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_config_id UUID        NOT NULL REFERENCES notification_event_configs (id),
  location_id     UUID        NOT NULL REFERENCES locations (id),
  is_enabled      BOOLEAN     NOT NULL,
  created_by      UUID        NOT NULL REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_notification_location_overrides
    UNIQUE (event_config_id, location_id)
);

-- ---------------------------------------------------------------------------
-- 19. Notificações de usuário
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id                    UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID                    NOT NULL REFERENCES users (id),
  event_type            notification_event_type NOT NULL,
  -- ID do registro de origem (abertura, descarte, etc.)
  entity_id             UUID                    NOT NULL,
  -- Nome da tabela de origem (ex.: 'bottle_openings', 'bulk_bottle_openings')
  entity_table          TEXT                    NOT NULL,
  source_vaccine_room_id UUID                   NOT NULL REFERENCES vaccine_rooms (id),
  is_read               BOOLEAN                 NOT NULL DEFAULT FALSE,
  read_at               TIMESTAMPTZ,
  created_by            UUID                    REFERENCES users (id),
  created_at            TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_notifications_read_consistency
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR
      (is_read = TRUE  AND read_at IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- 20. Parâmetros de sistema
-- ---------------------------------------------------------------------------
-- Valores configuráveis em runtime (ex.: janela de alerta, tempo de expiração).
CREATE TABLE system_parameters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  value       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  updated_by  UUID        REFERENCES users (id),
  updated_at  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 21. Log de auditoria
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id),
  action      TEXT        NOT NULL,     -- ex.: 'BOTTLE_OPENING_CREATED'
  entity_name TEXT        NOT NULL,     -- nome da tabela afetada
  entity_id   UUID,                     -- ID do registro afetado (opcional)
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- users
CREATE INDEX idx_users_role       ON users (role);
CREATE INDEX idx_users_is_active  ON users (is_active);

-- locations
CREATE INDEX idx_locations_is_deleted ON locations (is_deleted);

-- vaccine_rooms
CREATE INDEX idx_vaccine_rooms_location_id ON vaccine_rooms (location_id);
CREATE INDEX idx_vaccine_rooms_is_deleted  ON vaccine_rooms (is_deleted);

-- manager_locations
CREATE INDEX idx_manager_locations_user_id     ON manager_locations (user_id);
CREATE INDEX idx_manager_locations_location_id ON manager_locations (location_id);

-- technician_rooms
CREATE INDEX idx_technician_rooms_user_id         ON technician_rooms (user_id);
CREATE INDEX idx_technician_rooms_vaccine_room_id ON technician_rooms (vaccine_room_id);

-- batches
CREATE INDEX idx_batches_vaccine_id   ON batches (vaccine_id);
CREATE INDEX idx_batches_expiry_date  ON batches (expiry_date);
CREATE INDEX idx_batches_is_deleted   ON batches (is_deleted);

-- batch_room_entries
CREATE INDEX idx_batch_room_entries_batch_id        ON batch_room_entries (batch_id);
CREATE INDEX idx_batch_room_entries_vaccine_room_id ON batch_room_entries (vaccine_room_id);
CREATE INDEX idx_batch_room_entries_is_deleted      ON batch_room_entries (is_deleted);

-- bottle_openings — principais consultas: por sala, por entry, por cancelamento
CREATE INDEX idx_bottle_openings_batch_entry_id    ON bottle_openings (batch_entry_id);
CREATE INDEX idx_bottle_openings_vaccine_room_id   ON bottle_openings (vaccine_room_id);
CREATE INDEX idx_bottle_openings_is_cancelled      ON bottle_openings (is_cancelled);
CREATE INDEX idx_bottle_openings_opened_at         ON bottle_openings (opened_at DESC);
CREATE INDEX idx_bottle_openings_bulk_opening_id   ON bottle_openings (bulk_opening_id);

-- bottle_discards
CREATE INDEX idx_bottle_discards_batch_entry_id    ON bottle_discards (batch_entry_id);
CREATE INDEX idx_bottle_discards_bottle_opening_id ON bottle_discards (bottle_opening_id);
CREATE INDEX idx_bottle_discards_is_cancelled      ON bottle_discards (is_cancelled);
CREATE INDEX idx_bottle_discards_bulk_discard_id   ON bottle_discards (bulk_discard_id);

-- bulk_bottle_openings
CREATE INDEX idx_bulk_bottle_openings_batch_entry_id  ON bulk_bottle_openings (batch_entry_id);
CREATE INDEX idx_bulk_bottle_openings_vaccine_room_id ON bulk_bottle_openings (vaccine_room_id);

-- bulk_bottle_discards
CREATE INDEX idx_bulk_bottle_discards_batch_entry_id  ON bulk_bottle_discards (batch_entry_id);
CREATE INDEX idx_bulk_bottle_discards_vaccine_room_id ON bulk_bottle_discards (vaccine_room_id);

-- batch_transfers
CREATE INDEX idx_batch_transfers_source_entry_id ON batch_transfers (source_batch_entry_id);
CREATE INDEX idx_batch_transfers_status          ON batch_transfers (status);
CREATE INDEX idx_batch_transfers_expires_at      ON batch_transfers (expires_at);
CREATE INDEX idx_batch_transfers_origin_room     ON batch_transfers (origin_vaccine_room_id);
CREATE INDEX idx_batch_transfers_dest_room       ON batch_transfers (destination_vaccine_room_id);

-- notifications
CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_is_read    ON notifications (is_read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);

-- notification_location_overrides
CREATE INDEX idx_notification_overrides_location_id ON notification_location_overrides (location_id);

-- audit_logs
CREATE INDEX idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity      ON audit_logs (entity_name, entity_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_payload     ON audit_logs USING GIN (payload);

-- =============================================================================
-- COMENTÁRIOS DE REGRAS DE NEGÓCIO (referência)
-- =============================================================================

COMMENT ON TABLE batches IS
  'Lote-mestre do fabricante. O mesmo lote pode existir em múltiplas salas via batch_room_entries.';

COMMENT ON COLUMN batches.expiry_date IS
  'Bloqueia abertura de frasco quando expiry_date < CURRENT_DATE (validado na aplicação).';

COMMENT ON COLUMN batches.open_bottle_expiry_minutes IS
  'Validade do frasco após abertura em minutos. O timer de contagem regressiva exibe alerta quando restam ≤ 30 minutos.';

COMMENT ON COLUMN batch_room_entries.bottle_count IS
  'Imutável após INSERT. Nunca deve ser atualizado; representa os frascos físicos recebidos pela sala.';

COMMENT ON COLUMN batch_room_entries.source_batch_entry_id IS
  'Preenchido apenas quando esta entrada foi criada automaticamente pela aceitação de uma transferência.';

COMMENT ON TABLE bottle_discards IS
  'Modo A (frasco fechado): bottle_opening_id IS NULL, remaining_doses IS NULL.
   Modo B (frasco aberto): bottle_opening_id NOT NULL, remaining_doses NOT NULL e ≤ doses_per_bottle do lote.
   A validação remaining_doses ≤ doses_per_bottle é feita na camada de aplicação (requer JOIN com batches).';

COMMENT ON TABLE batch_transfers IS
  'Janela padrão de expiração: 2880 minutos (48h), configurável via system_parameters.expire_transfer_minutes.
   Transferências com status pending ou accepted deduzem frascos do cálculo de disponibilidade da sala de origem.';

COMMENT ON TABLE system_parameters IS
  'Parâmetros configuráveis em runtime.
   Chaves conhecidas:
     intervalo_alerta_abertura_minutos — janela para alerta de abertura duplicada (padrão: 600).
     expire_transfer_minutes           — tempo até expiração de transferência (padrão: 2880).';

COMMENT ON TABLE notification_event_configs IS
  'Configuração global de notificações por tipo de evento. Pode ser sobrescrita por local em notification_location_overrides.';

COMMENT ON TABLE audit_logs IS
  'Imutável. Nunca deve haver UPDATE ou DELETE nesta tabela. Ações: BOTTLE_OPENING_CREATED, BATCH_TRANSFER_ACCEPTED, etc.';
