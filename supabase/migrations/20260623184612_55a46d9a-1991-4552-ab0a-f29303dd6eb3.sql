
-- RLS for prodotti-foto bucket
CREATE POLICY "prodotti_foto_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'prodotti-foto');

CREATE POLICY "prodotti_foto_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prodotti-foto');

CREATE POLICY "prodotti_foto_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'prodotti-foto');

CREATE POLICY "prodotti_foto_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prodotti-foto');
