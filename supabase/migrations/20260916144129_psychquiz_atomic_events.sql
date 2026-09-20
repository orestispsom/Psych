-- Orestis-only event authority. Existing aggregates/history remain intact.
-- No SECURITY DEFINER, RLS changes, credentials, or new public write grants.
lock table public.question_attempts, public.user_question_state in access exclusive mode;
do $$ begin
  if exists(select 1 from (select question_id,max(attempted_at) t from public.question_attempts where profile_id='orestis' group by question_id) a
    left join public.user_question_state s on s.profile_id='orestis' and s.question_id=a.question_id
    where s.last_answered_at is null or a.t>s.last_answered_at) then
    raise exception 'Cutover refused: answer history is newer than aggregate state. Reconcile before retrying.';
  end if;
end $$;
alter table public.question_attempts drop constraint question_attempts_selected_index_check;
alter table public.question_attempts add constraint question_attempts_selected_index_check check (selected_index between 0 and 5);
alter table public.question_attempts drop constraint question_attempts_selected_option_check;
alter table public.question_attempts add constraint question_attempts_selected_option_check check (selected_option in ('A','B','C','D','E','F'));
alter table public.user_question_state drop constraint user_question_state_last_selected_check;
alter table public.user_question_state add constraint user_question_state_last_selected_check check (last_selected between 0 and 5);
alter table public.question_attempts drop constraint question_attempts_mode_check;
alter table public.question_attempts add constraint question_attempts_mode_check check (mode in ('daily','random','sprint','weakness','written','category','bookmarks','due','exam','quick'));
alter table public.question_attempts add column event_origin text not null default 'app' check (event_origin in ('app','wow'));
alter table public.question_attempts add column event_payload jsonb;
alter table public.question_attempts add column event_version integer not null default 0;
alter table public.user_question_state add column event_baseline jsonb;
update public.user_question_state s set event_baseline=to_jsonb(s)-'event_baseline' where profile_id='orestis';

-- Stale legacy/application aggregate upserts cannot change answer-owned fields.
create or replace function public.preserve_question_state_counters()
returns trigger language plpgsql security invoker set search_path='' as $$
declare seen_time timestamptz;
begin
  if old.profile_id='orestis' then
    if pg_trigger_depth()>1 and current_setting('psychquiz.reducing',true)='on' and new.event_baseline is not null then return new; end if;
    seen_time=new.first_seen_at;
    new:=old;
    new.first_seen_at:=coalesce(old.first_seen_at,seen_time);
    new.last_seen_at:=greatest(old.last_seen_at,seen_time);
    new.seen_count:=greatest(old.seen_count,case when seen_time is not null then 1 else 0 end);
    return new;
  end if;
  if new.progress_reset_at is distinct from old.progress_reset_at then
    if old.progress_reset_at is null or (new.progress_reset_at is not null and new.progress_reset_at>old.progress_reset_at) then return new; end if;
    return old;
  end if;
  if old.updated_at is not null and new.updated_at is not null and new.updated_at<old.updated_at then return old; end if;
  new.seen_count:=greatest(old.seen_count,new.seen_count);
  new.correct_count:=greatest(old.correct_count,new.correct_count);
  new.wrong_count:=greatest(old.wrong_count,new.wrong_count);
  new.confident_wrong_count:=greatest(old.confident_wrong_count,new.confident_wrong_count);
  new.total_points:=greatest(old.total_points,new.total_points);
  return new;
end $$;

create function public.psychquiz_initialize_state()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.profile_id='orestis' then
    -- New direct aggregate uploads are observations only; answers arrive as events.
    new.correct_count:=0; new.wrong_count:=0; new.consecutive_correct:=0; new.consecutive_wrong:=0;
    new.mastery_level:=0; new.confident_wrong_count:=0; new.total_points:=0;
    new.last_answered_at:=null; new.next_review_at:=null; new.last_answer_correct:=null;
    new.last_selected:=null; new.last_confidence:=null; new.last_time_taken_ms:=null;
    new.last_points_awarded:=0; new.average_time_ms:=null; new.progress_reset_at:=null;
    new.seen_count:=case when new.first_seen_at is null then 0 else 1 end;
    new.event_baseline:=to_jsonb(new)-'event_baseline';
  end if;
  return new;
end $$;
create trigger psychquiz_initialize_state before insert on public.user_question_state for each row execute function public.psychquiz_initialize_state();

create function public.psychquiz_guard_event()
returns trigger language plpgsql security invoker set search_path='' as $$
declare existing public.question_attempts; cutoff timestamptz;
begin
  if new.profile_id<>'orestis' then return new; end if;
  perform pg_advisory_xact_lock(716093161::bigint);
  if tg_op='UPDATE' then
    if to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'Answer history is immutable for Orestis'; end if;
    return old;
  end if;
  if new.client_attempt_id is null then raise exception 'Stable answer event ID required'; end if;
  select * into existing from public.question_attempts where profile_id='orestis' and client_attempt_id=new.client_attempt_id;
  if found then
    if (to_jsonb(existing)-array['id','event_version']) is distinct from (to_jsonb(new)-array['id','event_version']) then
      raise exception 'Conflicting event ID: %',new.client_attempt_id;
    end if;
    return null;
  end if;
  select (event_baseline->>'last_answered_at')::timestamptz into cutoff from public.user_question_state where profile_id='orestis' and question_id=new.question_id;
  if cutoff is not null and new.attempted_at<=cutoff then
    raise exception 'Unseen event % predates the preserved baseline; manual reconciliation required',new.client_attempt_id;
  end if;
  if new.attempted_at>now()+interval '5 minutes' then raise exception 'Answer timestamp is in the future'; end if;
  new.event_version:=1;
  return new;
end $$;
create trigger psychquiz_guard_event before insert or update on public.question_attempts for each row execute function public.psychquiz_guard_event();

create function public.psychquiz_reduce_events()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.user_question_state; current_state public.user_question_state; e public.question_attempts; n integer; days numeric; confidence_value integer;
begin
  if new.profile_id<>'orestis' then return new; end if;
  insert into public.user_question_state(profile_id,question_id) values ('orestis',new.question_id) on conflict do nothing;
  select * into current_state from public.user_question_state where profile_id='orestis' and question_id=new.question_id for update;
  s:=jsonb_populate_record(null::public.user_question_state,current_state.event_baseline);
  for e in select * from public.question_attempts where profile_id='orestis' and question_id=new.question_id and event_version=1 order by attempted_at,client_attempt_id loop
    n:=s.correct_count+s.wrong_count;
    confidence_value:=coalesce(e.confidence,3);
    if e.time_taken_ms is not null then s.average_time_ms:=round((coalesce(s.average_time_ms,0)::numeric*n+e.time_taken_ms)/(n+1)); end if;
    s.correct_count:=s.correct_count+case when e.is_correct then 1 else 0 end;
    s.wrong_count:=s.wrong_count+case when e.is_correct then 0 else 1 end;
    s.seen_count:=s.seen_count+1;
    s.consecutive_correct:=case when e.is_correct then s.consecutive_correct+1 else 0 end;
    s.consecutive_wrong:=case when e.is_correct then 0 else s.consecutive_wrong+1 end;
    if e.is_correct and s.consecutive_correct>=3 then s.mastery_level:=5;
    elsif e.is_correct then s.mastery_level:=least(5,s.mastery_level+case when confidence_value=4 then 2 else 1 end);
    elsif s.mastery_level>=5 then s.mastery_level:=3;
    else s.mastery_level:=greatest(0,s.mastery_level-case when confidence_value>=3 then 2 else 1 end); end if;
    days:=case when not e.is_correct then case when confidence_value>=3 then 0.25 else 1 end
      when s.consecutive_correct>=3 then 21 when s.mastery_level<=1 then 1 when s.mastery_level=2 then 3 when s.mastery_level=3 then 7 when s.mastery_level=4 then 14 else 21 end;
    s.next_review_at:=e.attempted_at+days*interval '1 day';
    s.first_seen_at:=least(coalesce(s.first_seen_at,e.attempted_at),e.attempted_at);
    s.last_seen_at:=greatest(s.last_seen_at,e.attempted_at);
    s.last_answered_at:=e.attempted_at; s.last_selected:=e.selected_index; s.last_answer_correct:=e.is_correct;
    s.last_confidence:=e.confidence; s.last_time_taken_ms:=e.time_taken_ms; s.last_points_awarded:=e.points_awarded;
    s.total_points:=s.total_points+e.points_awarded;
    s.confident_wrong_count:=s.confident_wrong_count+case when not e.is_correct and confidence_value>=3 then 1 else 0 end;
  end loop;
  perform set_config('psychquiz.reducing','on',true);
  update public.user_question_state set correct_count=s.correct_count,wrong_count=s.wrong_count,
    seen_count=greatest(s.seen_count,current_state.seen_count),consecutive_correct=s.consecutive_correct,consecutive_wrong=s.consecutive_wrong,
    mastery_level=s.mastery_level,next_review_at=s.next_review_at,first_seen_at=s.first_seen_at,last_seen_at=greatest(s.last_seen_at,current_state.last_seen_at),
    last_answered_at=s.last_answered_at,last_selected=s.last_selected,last_answer_correct=s.last_answer_correct,last_confidence=s.last_confidence,
    last_time_taken_ms=s.last_time_taken_ms,last_points_awarded=s.last_points_awarded,total_points=s.total_points,
    confident_wrong_count=s.confident_wrong_count,average_time_ms=s.average_time_ms,updated_at=clock_timestamp()
    where profile_id='orestis' and question_id=new.question_id;
  perform set_config('psychquiz.reducing','off',true);
  return new;
end $$;
create trigger psychquiz_reduce_events after insert on public.question_attempts for each row execute function public.psychquiz_reduce_events();

create function public.psychquiz_sync(events jsonb, dry_run boolean default true)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e jsonb; prior jsonb; inserted integer:=0; duplicates integer:=0; cutoff timestamptz;
begin
  if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>1000 then raise exception 'Expected at most 1000 events'; end if;
  perform pg_advisory_xact_lock(716093161::bigint);
  if exists(select 1 from jsonb_array_elements(events) x group by x->>'eventId' having count(*)>1) then raise exception 'Duplicate IDs in batch'; end if;
  for e in select value from jsonb_array_elements(events) order by value->>'answeredAt',value->>'eventId' loop
    if e->>'profileId' is distinct from 'orestis' or e->>'source' is distinct from 'wow' or e->>'schemaVersion' is distinct from '1'
      or coalesce(e->>'eventId','') !~ '^wow:[A-Za-z0-9_-]+:[0-9]+$'
      or coalesce(e->>'questionId','') !~ '^[0-9]+$'
      or coalesce(e->>'selectedIndex','') !~ '^[0-5]$' or coalesce(e->>'correctIndex','') !~ '^[0-5]$'
      or e->>'confidence' is distinct from '3'
      or (e->>'isCorrect')::boolean is distinct from ((e->>'selectedIndex')::integer=(e->>'correctIndex')::integer)
      or coalesce(e->>'questionHash','') !~ '^[0-9a-f]{64}$'
      or coalesce(e->>'bankVersion','') !~ '^[0-9a-f]{64}$'
      or coalesce(e->>'sessionId','') not like 'wow-session:%'
      or coalesce(e->>'mode','') not in ('random','category','weakness','due','exam','quick')
      or coalesce(e->>'answeredAt','') !~ '^[0-9]+$'
      or to_timestamp((e->>'answeredAt')::bigint)>now()+interval '5 minutes'
    then raise exception 'Malformed WoW event'; end if;
    select event_payload into prior from public.question_attempts where profile_id='orestis' and client_attempt_id=e->>'eventId';
    if found then
      if prior is distinct from e then raise exception 'Conflicting event ID: %',e->>'eventId'; end if;
      duplicates:=duplicates+1; continue;
    end if;
    select (event_baseline->>'last_answered_at')::timestamptz into cutoff from public.user_question_state where profile_id='orestis' and question_id=(e->>'questionId')::bigint;
    if cutoff is not null and to_timestamp((e->>'answeredAt')::bigint)<=cutoff then raise exception 'Event predates preserved baseline: %',e->>'eventId'; end if;
    inserted:=inserted+1;
    if not dry_run then
      insert into public.question_attempts(profile_id,question_id,client_attempt_id,client_session_id,mode,selected_index,selected_option,is_correct,confidence,attempted_at,event_origin,event_payload)
      values ('orestis',(e->>'questionId')::bigint,e->>'eventId',e->>'sessionId',e->>'mode',(e->>'selectedIndex')::integer,
        chr(65+(e->>'selectedIndex')::integer),(e->>'isCorrect')::boolean,3,to_timestamp((e->>'answeredAt')::bigint),'wow',e);
    end if;
  end loop;
  return jsonb_build_object('dryRun',dry_run,'inserted',case when dry_run then 0 else inserted end,'wouldInsert',inserted,'duplicates',duplicates,'profileId','orestis');
end $$;
revoke all on function public.psychquiz_sync(jsonb,boolean) from public;
grant execute on function public.psychquiz_sync(jsonb,boolean) to anon,authenticated;
revoke all on function public.psychquiz_initialize_state(),public.psychquiz_guard_event(),public.psychquiz_reduce_events() from public;

create function public.psychquiz_snapshot()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform pg_advisory_xact_lock(716093161::bigint);
  select jsonb_build_object('profileId','orestis','generatedAt',extract(epoch from clock_timestamp())::bigint,
    'questions',coalesce((select jsonb_agg(to_jsonb(s)-'event_baseline' order by question_id) from public.user_question_state s where profile_id='orestis'),'[]'::jsonb),
    'includedEventIds',coalesce((select jsonb_object_agg(client_attempt_id,true) from public.question_attempts where profile_id='orestis' and event_origin='wow'),'{}'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.psychquiz_snapshot() from public;
grant execute on function public.psychquiz_snapshot() to anon,authenticated;
