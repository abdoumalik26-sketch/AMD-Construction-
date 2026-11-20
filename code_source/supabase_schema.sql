-- =========================================================
-- 2AM CONSTRUCTION — base de synchronisation (Supabase)
-- Rôles : admin (bureau, voit tout) / collab (chantiers affectés, sans prix)
-- Le premier compte créé devient administrateur ; les suivants
-- sont inactifs jusqu'à validation par l'administrateur.
-- =========================================================

create table if not exists public.membres (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nom text default '',
  role text not null default 'collab' check (role in ('admin', 'collab')),
  actif boolean not null default false,
  created_at timestamptz default now()
);

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membres where user_id = auth.uid() and role = 'admin' and actif)
$$;

create or replace function public.nouveau_membre() returns trigger
language plpgsql security definer set search_path = public as $$
declare premier boolean;
begin
  select not exists (select 1 from public.membres where role = 'admin') into premier;
  insert into public.membres (user_id, email, nom, role, actif)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nom', ''),
          case when premier then 'admin' else 'collab' end, premier);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nouveau_membre();

create table if not exists public.projets (
  id text primary key,
  nom text,
  data jsonb not null,
  archive boolean default false,
  supprime boolean default false,
  updated_at timestamptz default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.affectations (
  projet_id text references public.projets(id) on delete cascade,
  user_id uuid references public.membres(user_id) on delete cascade,
  primary key (projet_id, user_id)
);

create table if not exists public.chantiers (
  projet_id text primary key references public.projets(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.rapports (
  id text primary key,
  projet_id text references public.projets(id) on delete cascade,
  auteur uuid default auth.uid() references public.membres(user_id) on delete set null,
  date date,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists public.parametres (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.partages (
  token text primary key,
  projet_id text references public.projets(id) on delete cascade,
  data jsonb,
  actif boolean default true,
  updated_at timestamptz default now()
);

create or replace function public.est_affecte(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.affectations a join public.membres m on m.user_id = a.user_id
                 where a.projet_id = pid and a.user_id = auth.uid() and m.actif)
$$;

-- Sécurité : RLS partout, aucun accès anonyme aux tables
alter table public.membres enable row level security;
alter table public.projets enable row level security;
alter table public.affectations enable row level security;
alter table public.chantiers enable row level security;
alter table public.rapports enable row level security;
alter table public.parametres enable row level security;
alter table public.partages enable row level security;

revoke all on public.membres, public.projets, public.affectations, public.chantiers, public.rapports, public.parametres, public.partages from anon;
grant select, insert, update, delete on public.membres, public.projets, public.affectations, public.chantiers, public.rapports, public.parametres, public.partages to authenticated;

drop policy if exists membres_lecture on public.membres;
create policy membres_lecture on public.membres for select to authenticated using (user_id = auth.uid() or public.est_admin());
drop policy if exists membres_admin on public.membres;
create policy membres_admin on public.membres for update to authenticated using (public.est_admin()) with check (public.est_admin());
drop policy if exists membres_suppr on public.membres;
create policy membres_suppr on public.membres for delete to authenticated using (public.est_admin() and user_id <> auth.uid());

drop policy if exists projets_admin on public.projets;
create policy projets_admin on public.projets for all to authenticated using (public.est_admin()) with check (public.est_admin());

drop policy if exists affect_admin on public.affectations;
create policy affect_admin on public.affectations for all to authenticated using (public.est_admin()) with check (public.est_admin());
drop policy if exists affect_moi on public.affectations;
create policy affect_moi on public.affectations for select to authenticated using (user_id = auth.uid());

drop policy if exists chantiers_admin on public.chantiers;
create policy chantiers_admin on public.chantiers for all to authenticated using (public.est_admin()) with check (public.est_admin());
drop policy if exists chantiers_collab on public.chantiers;
create policy chantiers_collab on public.chantiers for select to authenticated using (public.est_affecte(projet_id));

drop policy if exists rapports_admin on public.rapports;
create policy rapports_admin on public.rapports for all to authenticated using (public.est_admin()) with check (public.est_admin());
drop policy if exists rapports_collab_ecrire on public.rapports;
create policy rapports_collab_ecrire on public.rapports for insert to authenticated with check (public.est_affecte(projet_id) and auteur = auth.uid());
drop policy if exists rapports_collab_lire on public.rapports;
create policy rapports_collab_lire on public.rapports for select to authenticated using (auteur = auth.uid());

drop policy if exists parametres_admin on public.parametres;
create policy parametres_admin on public.parametres for all to authenticated using (public.est_admin()) with check (public.est_admin());

drop policy if exists partages_admin on public.partages;
create policy partages_admin on public.partages for all to authenticated using (public.est_admin()) with check (public.est_admin());

-- Espace client : lecture d'un seul suivi par son lien secret, sans compte
create or replace function public.vue_client(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.partages where token = t and actif and length(t) >= 20
$$;
revoke all on function public.vue_client(text) from public;
grant execute on function public.vue_client(text) to anon, authenticated;

-- Photos des rapports (stockage privé, rangées par projet)
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists photos_admin on storage.objects;
create policy photos_admin on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.est_admin()) with check (bucket_id = 'photos' and public.est_admin());
drop policy if exists photos_collab_ecrire on storage.objects;
create policy photos_collab_ecrire on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.est_affecte((storage.foldername(name))[1]));
drop policy if exists photos_collab_lire on storage.objects;
create policy photos_collab_lire on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.est_affecte((storage.foldername(name))[1]));
