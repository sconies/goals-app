-- Storage's rules for the markups bucket call nothing in faro (backlog 0c, outside review of PR #93, 10 Nov).
-- Rules on storage.objects run as whoever uses Storage, which includes the other app's signed-in users. Two of them
-- called Faro functions (0024): faro_owner owns those, so it could have rewritten them to run its own code as that user.
--   1. "markups: builders read" goes. It let signed-in builders read pictures; the bucket has been public-read since
--      0031, so nothing needs it.
--   2. "markups: upload" checks the markup id's shape inline (mk_ and 16 hex digits, as okr_markups.id requires) instead
--      of asking faro.okr_markup_id_ok whether the id was issued in the last two hours. The bucket still takes only the
--      four pictures, as png or jpeg up to 5 MB, in a folder named like a markup id, and never replaces or deletes one;
--      a markup itself still needs an issued id (okr_markups' own rule).
-- It changes rules on storage.objects, so it must run as postgres (before CI's DATABASE_URL becomes faro_owner). Run as
-- faro_owner it changes nothing and the fence check fails until it is applied as postgres; run as any other role that
-- can't, it stops. Safe to run twice.

do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  if not pg_has_role(current_user, (select relowner from pg_class where oid = 'storage.objects'::regclass), 'usage') then
    -- The Faro role can't, by design: the fence check then reports the rules still to change. Anyone else stops here.
    if current_user = 'faro_owner' then
      raise notice 'Not changing Storage''s rules: faro_owner can''t. Apply 0037 as postgres.';
      return;
    end if;
    raise exception '% can''t change Storage''s rules (storage.objects). Apply 0037 as postgres.', current_user;
  end if;
  execute 'drop policy if exists "markups: builders read" on storage.objects';
  execute 'drop policy if exists "markups: upload" on storage.objects';
  execute $policy$
    create policy "markups: upload" on storage.objects for insert to anon with check (
      bucket_id = 'markups'
      and array_length(storage.foldername(name), 1) = 1
      and (storage.foldername(name))[1] ~ '^mk_[0-9a-f]{16}$'
      and storage.filename(name) in ('screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg')
    )
  $policy$;
end $$;
