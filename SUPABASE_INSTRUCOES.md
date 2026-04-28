# Instrucoes para salvar os flashcards no Supabase gratis

O site agora usa Supabase para salvar a memoria online dos flashcards.
Assim, quando voce cria pastas, flashcards e historico em um computador,
os mesmos dados aparecem no celular usando o mesmo link do site.

## 1. Criar ou abrir o projeto no Supabase

1. Entre em https://supabase.com/dashboard.
2. Crie uma conta ou faca login.
3. Clique em `New project`.
4. Escolha o plano gratis.
5. Crie o projeto.
6. Espere o Supabase terminar de preparar o banco.

## 2. Criar a tabela de memoria

1. No menu do Supabase, clique em `SQL Editor`.
2. Clique em `New query`.
3. Cole este codigo:

```sql
create table if not exists public.studyagent_app_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.studyagent_app_state enable row level security;

drop policy if exists "Public can read shared study state"
on public.studyagent_app_state;

create policy "Public can read shared study state"
on public.studyagent_app_state
for select
to anon, authenticated
using (true);

drop policy if exists "Public can write shared study state"
on public.studyagent_app_state;

create policy "Public can write shared study state"
on public.studyagent_app_state
for insert
to anon, authenticated
with check (key = 'shared-study-state');

drop policy if exists "Public can update shared study state"
on public.studyagent_app_state;

create policy "Public can update shared study state"
on public.studyagent_app_state
for update
to anon, authenticated
using (key = 'shared-study-state')
with check (key = 'shared-study-state');

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.studyagent_app_state to anon, authenticated;
```

4. Clique em `Run`.

## 3. Pegar as chaves certas

1. No Supabase, va em `Project Settings`.
2. Clique em `API`.
3. Copie o `Project URL`.
4. Copie a chave `anon public` ou `publishable`.

Nao use a senha do banco. Nao precisa de login para esse app simples.

## 4. Colocar as variaveis na Vercel

1. Entre em https://vercel.com.
2. Abra o projeto do site.
3. Va em `Settings`.
4. Clique em `Environment Variables`.
5. Adicione:

```txt
NEXT_PUBLIC_SUPABASE_URL=sua_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_ou_publishable
```

6. Marque `Production` e `Preview`.
7. Salve.

## 5. Publicar de novo

Depois de salvar as variaveis:

1. Va em `Deployments`.
2. Clique nos tres pontinhos do ultimo deploy.
3. Clique em `Redeploy`.
4. Aguarde terminar.

## 6. Testar

1. Abra o site no computador.
2. Crie uma pasta ou flashcard.
3. Espere aparecer `Memoria online salva no Supabase.`
4. Abra o mesmo site no celular.

Se aparecer que nao conseguiu salvar, abra `/api/health` no final do link do site
para ver se as variaveis do Supabase aparecem como configuradas.
