
CREATE POLICY "lidi_branding_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'lidi-branding');

CREATE POLICY "lidi_branding_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lidi-branding');

CREATE POLICY "lidi_branding_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lidi-branding');

CREATE POLICY "lidi_branding_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lidi-branding');
