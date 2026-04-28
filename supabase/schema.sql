create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  intro text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.study_plans(id) on delete cascade,
  title text not null,
  details text[] not null default '{}',
  completed boolean not null default false,
  review_days integer not null default 3,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references public.flashcard_folders(id) on delete cascade,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text not null,
  topic text not null,
  difficulty text not null default 'medio',
  review_days integer not null default 3,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  topic text,
  created_at timestamptz not null default now()
);

alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.flashcard_folders enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_answers enable row level security;

create policy "Users manage own study plans"
on public.study_plans
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own study tasks"
on public.study_tasks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own flashcard folders"
on public.flashcard_folders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own flashcards"
on public.flashcards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own flashcard answers"
on public.flashcard_answers
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists study_tasks_user_created_idx
on public.study_tasks(user_id, created_at desc);

create index if not exists flashcard_folders_user_created_idx
on public.flashcard_folders(user_id, created_at desc);

create index if not exists flashcards_user_folder_idx
on public.flashcards(user_id, folder_id, created_at desc);

create index if not exists flashcard_answers_user_created_idx
on public.flashcard_answers(user_id, created_at desc);
