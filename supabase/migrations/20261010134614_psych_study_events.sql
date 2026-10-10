-- Reuse existing shared Psych profiles; do not create a second identity system.
-- Matches the current deliberately shared profile access model.
create table public.psych_study_heads (
  profile_id text primary key references public.study_profiles(id),
  version bigint not null default 0 check (version >= 0)
);
create table public.psych_study_events (
  profile_id text not null references public.psych_study_heads(profile_id),
  id uuid not null,
  version bigint not null check (version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 5242880),
  primary key (profile_id, id),
  unique (profile_id, version)
);
alter table public.psych_study_heads enable row level security;
alter table public.psych_study_events enable row level security;
revoke all on public.psych_study_heads, public.psych_study_events from public, anon, authenticated;
grant select, insert, update on public.psych_study_heads to anon, authenticated;
grant select, insert on public.psych_study_events to anon, authenticated;
create policy psych_study_head_read on public.psych_study_heads for select to anon, authenticated using (true);
create policy psych_study_head_create on public.psych_study_heads for insert to anon, authenticated with check (true);
create policy psych_study_head_update on public.psych_study_heads for update to anon, authenticated using (true) with check (true);
create policy psych_study_event_read on public.psych_study_events for select to anon, authenticated using (true);
create policy psych_study_event_append on public.psych_study_events for insert to anon, authenticated with check (true);

create function public.psych_study_sync(p_profile_id text, p_events jsonb default '[]', p_after bigint default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v bigint; e jsonb; result jsonb;
begin
  if p_profile_id is null or char_length(p_profile_id) not between 1 and 200
    or p_after is null or p_after < 0 or p_events is null
    or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'Invalid study sync request';
  end if;
  -- The FK rejects unknown profiles; the RPC never creates or updates Psych identities.
  insert into public.psych_study_heads(profile_id) values(p_profile_id) on conflict do nothing;
  select version into v from public.psych_study_heads where profile_id = p_profile_id for update;
  if p_after > v then raise exception 'Study cursor is ahead of cloud history'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    if not exists(select 1 from public.psych_study_events where profile_id=p_profile_id and id=(e->>'id')::uuid) then
      v := v + 1;
      insert into public.psych_study_events(profile_id,id,version,payload)
        values(p_profile_id,(e->>'id')::uuid,v,e->'payload');
    end if;
  end loop;
  update public.psych_study_heads set version=v where profile_id=p_profile_id;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.version),'[]') into result from (
    select id,version,payload from public.psych_study_events
    where profile_id=p_profile_id and version>p_after order by version limit 500
  ) t;
  return jsonb_build_object('events',result,'version',v);
end;
$$;
revoke all on function public.psych_study_sync(text,jsonb,bigint) from public;
grant execute on function public.psych_study_sync(text,jsonb,bigint) to anon, authenticated;
