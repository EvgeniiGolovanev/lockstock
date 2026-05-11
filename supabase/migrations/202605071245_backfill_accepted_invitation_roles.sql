with latest_accepted_invitation as (
  select distinct on (oi.org_id, oi.accepted_by)
    oi.org_id,
    oi.accepted_by as user_id,
    oi.role
  from public.org_invitations oi
  where oi.status = 'accepted'
    and oi.accepted_by is not null
  order by oi.org_id, oi.accepted_by, oi.accepted_at desc nulls last, oi.created_at desc
)
update public.org_users ou
set role = lai.role
from latest_accepted_invitation lai
where ou.org_id = lai.org_id
  and ou.user_id = lai.user_id
  and ou.role is distinct from lai.role;
