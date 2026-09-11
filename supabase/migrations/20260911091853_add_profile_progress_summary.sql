-- Keep the profile chooser lightweight while reporting authoritative progress.
-- This view returns one small row per profile instead of loading every profile's
-- legacy mcq_progress and oral_progress JSON snapshots into the browser.
create or replace view public.profile_progress_summary
with (security_invoker = true)
as
select
  p.id as profile_id,
  count(uqs.question_id) filter (
    where greatest(uqs.seen_count, uqs.correct_count + uqs.wrong_count) > 0
  )::integer as attempted_questions,
  count(uqs.question_id) filter (
    where uqs.mastery_level = 5
  )::integer as mastered_questions,
  coalesce(oral.mastered_questions, 0)::integer as mastered_oral_questions
from public.study_profiles p
left join public.user_question_state uqs
  on uqs.profile_id = p.id
left join lateral (
  select count(*)::integer as mastered_questions
  from jsonb_each(
    case
      when jsonb_typeof(p.oral_progress -> 'mastered') = 'object'
        then p.oral_progress -> 'mastered'
      else '{}'::jsonb
    end
  ) entry
  where entry.value = 'true'::jsonb
) oral on true
group by p.id, oral.mastered_questions;

grant select on public.profile_progress_summary to anon, authenticated;

comment on view public.profile_progress_summary is
  'Compact authoritative MCQ and oral mastery counts for the profile chooser.';
