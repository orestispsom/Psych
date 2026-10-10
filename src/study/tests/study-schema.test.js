// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create table public.study_profiles(id text primary key, mcq_progress jsonb, oral_progress jsonb);
    insert into public.study_profiles values('profile-A','{"sentinel":true}','{"mastered":{"old":true}}'),('profile-B','{}','{}');`);
  await db.exec(readFileSync(resolve(process.cwd(), 'supabase/migrations/20261010134614_psych_study_events.sql'), 'utf8'));
});
afterAll(() => db.close());
const event = { id: '0f86a1bf-0043-4db2-a98a-c251bb034db1', payload: { schemaVersion: 1, test: 'original' } };
it('uses existing profile IDs and append-only idempotent history without touching MCQ/oral data', async () => {
  const sync = async (id, events, after = 0) => (await db.query('select public.psych_study_sync($1,$2::jsonb,$3) as result', [id, JSON.stringify(events), after])).rows[0].result;
  expect((await sync('profile-A', [event])).version).toBe(1);
  expect((await sync('profile-A', [{ ...event, payload: { test: 'overwrite' } }])).events[0].payload.test).toBe('original');
  expect((await sync('profile-A', [event], 1)).events).toEqual([]);
  expect((await sync('profile-B', [])).version).toBe(0);
  await expect(sync('unknown-profile', [event])).rejects.toThrow();
  await expect(sync('profile-A', [], 3)).rejects.toThrow();
  const profile = (await db.query("select * from public.study_profiles where id='profile-A'")).rows[0];
  expect(profile.mcq_progress).toEqual({ sentinel: true });
  expect(profile.oral_progress).toEqual({ mastered: { old: true } });
});
it('enables RLS and denies browser deletion or modification of saved events', async () => {
  const rows = (await db.query("select relrowsecurity from pg_class where relname in ('psych_study_heads','psych_study_events')")).rows;
  expect(rows.every(row => row.relrowsecurity)).toBe(true);
  const rights = (await db.query("select has_table_privilege('anon','public.psych_study_events','update') as update, has_table_privilege('anon','public.psych_study_events','delete') as delete")).rows[0];
  expect(rights).toEqual({ update: false, delete: false });
  await db.exec('set role anon');
  expect((await db.query("select public.psych_study_sync('profile-A','[]',0) as result")).rows[0].result.version).toBe(1);
  await db.exec('reset role');
});
