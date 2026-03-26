alter table public.org_invitations
  add column if not exists org_name text;

update public.org_invitations oi
set org_name = o.name
from public.organizations o
where oi.org_id = o.id
  and (oi.org_name is null or length(trim(oi.org_name)) = 0);

alter table public.org_invitations
  alter column org_name set not null;
