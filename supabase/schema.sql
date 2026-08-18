-- Run this once in your Supabase project → SQL Editor → New query

create table public.wishes (
  id              text        primary key,
  created_at      timestamptz default now() not null,
  owner           text        not null,
  title           text        not null,
  description     text        default '',
  link            text        default '',
  occasion        text        default '',
  custom_occasion text        default '',
  photo           text,
  received        boolean     default false,
  received_date   text,
  received_photos text[]      default '{}'
);

-- Lock down public access; all reads/writes go through the server-side service role key
alter table public.wishes enable row level security;
