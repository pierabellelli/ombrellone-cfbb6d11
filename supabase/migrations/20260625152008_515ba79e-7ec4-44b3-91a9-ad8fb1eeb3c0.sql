
CREATE POLICY "prodotti-immagini auth all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'prodotti-immagini')
  WITH CHECK (bucket_id = 'prodotti-immagini');

CREATE POLICY "lido-assets auth all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'lido-assets')
  WITH CHECK (bucket_id = 'lido-assets');
