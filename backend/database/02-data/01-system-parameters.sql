-- Seed: system_parameters default values
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING)

INSERT INTO system_parameters (key, value, description)
VALUES
  (
    'intervalo_alerta_abertura_minutos',
    '600',
    'Janela de tempo (minutos) para verificar se existe frasco da mesma vacina já aberto antes de permitir nova abertura.'
  ),
  (
    'expire_transfer_minutes',
    '2880',
    'Tempo máximo (minutos) para aceitar ou rejeitar uma transferência. Padrão: 2880 (48h).'
  )
ON CONFLICT (key) DO NOTHING;
