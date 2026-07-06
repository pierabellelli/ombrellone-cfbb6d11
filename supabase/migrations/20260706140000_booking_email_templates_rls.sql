-- booking_email_templates had RLS enabled with zero policies (fully locked),
-- so the settings panel couldn't read or write it. Mirrors the existing
-- permissive convention already used on lidi/ordini in this app (broad
-- authenticated access, not per-lido row scoping).
CREATE POLICY auth_manage_booking_email_templates
  ON public.booking_email_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
