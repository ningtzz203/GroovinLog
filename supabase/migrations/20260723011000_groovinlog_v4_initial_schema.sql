-- GroovinLog V4 initial Supabase schema.
-- Scope: database architecture only. This migration does not change existing
-- localStorage behavior and does not create Storage buckets, vectors, AI memory,
-- realtime subscriptions, or app UI.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_date date not null,
  teacher text not null,
  dance_style text not null,
  class_theme text not null,
  difficulty text,
  class_condition text check (class_condition is null or class_condition in ('Tired', 'Okay', 'Great')),
  what_i_learned text not null default '',
  not_digested text not null default '',
  video_reference_type text check (
    video_reference_type is null
    or video_reference_type in ('album_note', 'local_filename', 'cloud_link', 'external_link')
  ),
  video_reference_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (
    (video_reference_type is null and video_reference_value is null)
    or (video_reference_type is not null and video_reference_value is not null)
  )
);

create table if not exists public.practice_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_review_id uuid,
  title text not null,
  key_points text not null default '',
  focus_tags text[] not null default '{}',
  is_high_priority boolean not null default false,
  suggested_duration_minutes integer check (
    suggested_duration_minutes is null
    or suggested_duration_minutes between 1 and 999
  ),
  duration_unit text check (duration_unit is null or duration_unit in ('minutes', 'songs')),
  duration_value integer check (duration_value is null or duration_value between 1 and 999),
  status text not null default 'active' check (
    status in ('active', 'practicing', 'done', 'digested', 'completed', 'paused')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (class_review_id, user_id)
    references public.class_reviews(id, user_id)
    on delete set null (class_review_id)
);

create table if not exists public.practice_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  class_review_id uuid,
  practice_date date not null,
  duration_unit text not null default 'minutes' check (duration_unit in ('minutes', 'songs')),
  duration_value integer not null check (duration_value between 1 and 999),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 999),
  songs_count integer check (songs_count is null or songs_count between 1 and 999),
  practice_content text not null,
  progress_score integer not null check (progress_score between 1 and 5),
  next_focus text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, user_id)
    references public.practice_tasks(id, user_id),
  foreign key (class_review_id, user_id)
    references public.class_reviews(id, user_id)
    on delete set null (class_review_id)
);

create table if not exists public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  improved text not null default '',
  still_stuck text not null default '',
  next_focus_note text not null default '',
  next_focus_tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_practice_duration_minutes integer not null default 20 check (
    default_practice_duration_minutes between 1 and 999
  ),
  practice_queue_sort_order text not null default 'newest' check (
    practice_queue_sort_order in ('newest', 'oldest')
  ),
  show_difficulty boolean not null default false,
  show_body_status boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.local_storage_migrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  migration_version text not null,
  source_fingerprint text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  imported_counts jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, migration_version, source_fingerprint)
);

create index if not exists class_reviews_user_date_idx
  on public.class_reviews(user_id, class_date desc);

create index if not exists practice_tasks_user_status_created_idx
  on public.practice_tasks(user_id, status, created_at desc);

create index if not exists practice_tasks_user_class_idx
  on public.practice_tasks(user_id, class_review_id);

create index if not exists practice_tasks_focus_tags_idx
  on public.practice_tasks using gin (focus_tags);

create index if not exists practice_logs_user_date_idx
  on public.practice_logs(user_id, practice_date desc);

create index if not exists practice_logs_user_task_idx
  on public.practice_logs(user_id, task_id);

create index if not exists weekly_reflections_user_week_idx
  on public.weekly_reflections(user_id, week_start desc);

create index if not exists local_storage_migrations_user_idx
  on public.local_storage_migrations(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.set_updated_at() to service_role;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists class_reviews_set_updated_at on public.class_reviews;
create trigger class_reviews_set_updated_at
before update on public.class_reviews
for each row execute function public.set_updated_at();

drop trigger if exists practice_tasks_set_updated_at on public.practice_tasks;
create trigger practice_tasks_set_updated_at
before update on public.practice_tasks
for each row execute function public.set_updated_at();

drop trigger if exists practice_logs_set_updated_at on public.practice_logs;
create trigger practice_logs_set_updated_at
before update on public.practice_logs
for each row execute function public.set_updated_at();

drop trigger if exists weekly_reflections_set_updated_at on public.weekly_reflections;
create trigger weekly_reflections_set_updated_at
before update on public.weekly_reflections
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.class_reviews enable row level security;
alter table public.practice_tasks enable row level security;
alter table public.practice_logs enable row level security;
alter table public.weekly_reflections enable row level security;
alter table public.user_preferences enable row level security;
alter table public.local_storage_migrations enable row level security;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.class_reviews from anon;
revoke all privileges on table public.practice_tasks from anon;
revoke all privileges on table public.practice_logs from anon;
revoke all privileges on table public.weekly_reflections from anon;
revoke all privileges on table public.user_preferences from anon;
revoke all privileges on table public.local_storage_migrations from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.class_reviews to authenticated;
grant select, insert, update, delete on table public.practice_tasks to authenticated;
grant select, insert, update, delete on table public.practice_logs to authenticated;
grant select, insert, update, delete on table public.weekly_reflections to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.local_storage_migrations to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.class_reviews to service_role;
grant all on table public.practice_tasks to service_role;
grant all on table public.practice_logs to service_role;
grant all on table public.weekly_reflections to service_role;
grant all on table public.user_preferences to service_role;
grant all on table public.local_storage_migrations to service_role;

drop policy if exists "Users can select their own profile." on public.profiles;
create policy "Users can select their own profile."
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile." on public.profiles;
create policy "Users can update their own profile."
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can delete their own profile." on public.profiles;
create policy "Users can delete their own profile."
on public.profiles for delete
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can select their own class reviews." on public.class_reviews;
create policy "Users can select their own class reviews."
on public.class_reviews for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own class reviews." on public.class_reviews;
create policy "Users can insert their own class reviews."
on public.class_reviews for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own class reviews." on public.class_reviews;
create policy "Users can update their own class reviews."
on public.class_reviews for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own class reviews." on public.class_reviews;
create policy "Users can delete their own class reviews."
on public.class_reviews for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select their own practice tasks." on public.practice_tasks;
create policy "Users can select their own practice tasks."
on public.practice_tasks for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own practice tasks." on public.practice_tasks;
create policy "Users can insert their own practice tasks."
on public.practice_tasks for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own practice tasks." on public.practice_tasks;
create policy "Users can update their own practice tasks."
on public.practice_tasks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own practice tasks." on public.practice_tasks;
create policy "Users can delete their own practice tasks."
on public.practice_tasks for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select their own practice logs." on public.practice_logs;
create policy "Users can select their own practice logs."
on public.practice_logs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own practice logs." on public.practice_logs;
create policy "Users can insert their own practice logs."
on public.practice_logs for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own practice logs." on public.practice_logs;
create policy "Users can update their own practice logs."
on public.practice_logs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own practice logs." on public.practice_logs;
create policy "Users can delete their own practice logs."
on public.practice_logs for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select their own weekly reflections." on public.weekly_reflections;
create policy "Users can select their own weekly reflections."
on public.weekly_reflections for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own weekly reflections." on public.weekly_reflections;
create policy "Users can insert their own weekly reflections."
on public.weekly_reflections for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own weekly reflections." on public.weekly_reflections;
create policy "Users can update their own weekly reflections."
on public.weekly_reflections for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own weekly reflections." on public.weekly_reflections;
create policy "Users can delete their own weekly reflections."
on public.weekly_reflections for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select their own preferences." on public.user_preferences;
create policy "Users can select their own preferences."
on public.user_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own preferences." on public.user_preferences;
create policy "Users can insert their own preferences."
on public.user_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own preferences." on public.user_preferences;
create policy "Users can update their own preferences."
on public.user_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own preferences." on public.user_preferences;
create policy "Users can delete their own preferences."
on public.user_preferences for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select their own migration records." on public.local_storage_migrations;
create policy "Users can select their own migration records."
on public.local_storage_migrations for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own migration records." on public.local_storage_migrations;
create policy "Users can insert their own migration records."
on public.local_storage_migrations for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own migration records." on public.local_storage_migrations;
create policy "Users can update their own migration records."
on public.local_storage_migrations for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own migration records." on public.local_storage_migrations;
create policy "Users can delete their own migration records."
on public.local_storage_migrations for delete
to authenticated
using ((select auth.uid()) = user_id);
