-- MyCare -> Laravel existing patient identity mapping.
-- Apply only after reviewing against the target Supabase project.
-- This migration does not link any patient automatically.
begin;

create table if not exists public.patient_external_ids (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid not null references public.patients(id) on delete cascade,
    source_system text not null,
    external_user_id text not null,
    link_status text not null default 'verified',
    verification_method text not null,
    verified_at timestamptz not null default now(),
    verified_by_clerk_user_id text not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint patient_external_ids_source_chk check (source_system = 'chirothird'),
    constraint patient_external_ids_id_chk check (
        external_user_id ~ '^[1-9][0-9]{0,18}$'
    ),
    constraint patient_external_ids_status_chk check (link_status in ('verified', 'revoked')),
    constraint patient_external_ids_verified_method_chk check (
        verification_method = 'admin_manual'
    ),
    constraint patient_external_ids_revocation_chk check (
        (link_status = 'verified' and revoked_at is null)
        or (link_status = 'revoked' and revoked_at is not null)
    )
);

-- No two current patients may refer to the same Laravel account.
create unique index if not exists patient_external_ids_active_external_unique
on public.patient_external_ids(source_system, external_user_id)
where link_status = 'verified';

-- One patient may have at most one active Laravel mapping.
create unique index if not exists patient_external_ids_active_patient_unique
on public.patient_external_ids(source_system, patient_id)
where link_status = 'verified';

create index if not exists patient_external_ids_patient_history_idx
on public.patient_external_ids(patient_id, created_at desc);

alter table public.patient_external_ids enable row level security;

-- No policies for anon/authenticated users.
-- This table can be read or written only from trusted server-side code using
-- service_role, after explicit role checks. Never expose service_role in client code.
revoke all on table public.patient_external_ids from anon, authenticated;
commit;
