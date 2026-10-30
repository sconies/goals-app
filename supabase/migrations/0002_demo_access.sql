-- Demo access, until sign-in lands: the app's public key may read and write the okr_ tables,
-- and nothing else. The data is the invented developer-platform example.
-- Replace these with per-person policies when sign-in arrives.
do $$
declare t text;
begin
  foreach t in array array['okr_teams', 'okr_people', 'okr_cycles', 'okr_goals', 'okr_stages', 'okr_check_ins'] loop
    execute format('create policy "demo: read" on %I for select to anon using (true)', t);
    execute format('create policy "demo: add" on %I for insert to anon with check (true)', t);
    execute format('create policy "demo: change" on %I for update to anon using (true) with check (true)', t);
    execute format('create policy "demo: remove" on %I for delete to anon using (true)', t);
    execute format('grant select, insert, update, delete on %I to anon', t);
  end loop;
end $$;
