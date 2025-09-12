
-- Grant editor role by email (requires that the user has an Auth account already)
insert into public.editors(user_id)
select id from auth.users where email = 'noppharut4654@gmail.com'
on conflict do nothing;

-- Verify
select e.user_id, u.email
from public.editors e
join auth.users u on u.id = e.user_id
where u.email = 'noppharut4654@gmail.com';
