-- Private Excalidraw board schema.
-- Run this once in the Supabase SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled board',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scenes (
  board_id uuid primary key references public.boards (id) on delete cascade,
  elements jsonb not null default '[]'::jsonb,
  app_state jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.board_files (
  board_id uuid not null references public.boards (id) on delete cascade,
  file_id text not null,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now(),
  primary key (board_id, file_id)
);

create index if not exists boards_updated_at_idx
  on public.boards (updated_at desc);

create index if not exists board_files_board_id_idx
  on public.board_files (board_id);

-- Row Level Security is enabled but no policies are created on purpose:
-- the browser never connects to Supabase directly. Only the server-side
-- secret key (which bypasses RLS) can read/write these tables.
alter table public.boards enable row level security;
alter table public.scenes enable row level security;
alter table public.board_files enable row level security;
