
GRANT INSERT, SELECT ON public.ordini TO anon;
GRANT INSERT, SELECT ON public.ordine_items TO anon;

CREATE POLICY "anon_insert_ordini" ON public.ordini
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_insert_ordine_items" ON public.ordine_items
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_ordini" ON public.ordini
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_select_ordine_items" ON public.ordine_items
  FOR SELECT TO anon
  USING (true);
