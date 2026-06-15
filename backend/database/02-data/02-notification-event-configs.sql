-- Seed: notification_event_configs default values
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING)

INSERT INTO notification_event_configs (event_type, label, is_enabled)
VALUES
  ('bottle_opening', 'Abertura de frasco', TRUE),
  ('bottle_discard', 'Descarte de frasco', FALSE)
ON CONFLICT (event_type) DO NOTHING;
