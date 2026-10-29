-- =====================================================================
-- Step 3: gives each demo account its role and links it to a sample record.
-- Run after 06 (or after creating the four users by hand). Safe to run more than once.
--   restaurant   -> Zaytoun Mezze Bar (Business Bay), has a batch waiting for a coordinator
--   volunteer    -> Bilal Sharma (van, 15 completed deliveries in the history)
--   fridge host  -> FR-014 Downtown Dubai Mall Entrance
--   coordinator  -> sees the whole sample network
-- =====================================================================
insert into public.profiles (id, role, full_name, restaurant_id)
select u.id, 'restaurant', 'Demo Restaurant', public._i('restaurant', '5')
from auth.users u where u.email = 'restaurant.demo@barakat.test'
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, restaurant_id = excluded.restaurant_id;

update public.restaurants
set owner_user_id = (select id from auth.users where email = 'restaurant.demo@barakat.test')
where id = public._i('restaurant', '5');

insert into public.profiles (id, role, full_name, volunteer_id)
select u.id, 'volunteer', 'Demo Volunteer', public._i('volunteer', '34')
from auth.users u where u.email = 'volunteer.demo@barakat.test'
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, volunteer_id = excluded.volunteer_id;

update public.volunteers
set user_id = (select id from auth.users where email = 'volunteer.demo@barakat.test')
where id = public._i('volunteer', '34');

insert into public.profiles (id, role, full_name, fridge_id)
select u.id, 'fridge_host', 'Demo Fridge Host', public._i('fridge', '13')
from auth.users u where u.email = 'host.demo@barakat.test'
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, fridge_id = excluded.fridge_id;

insert into public.profiles (id, role, full_name)
select u.id, 'coordinator', 'Demo Coordinator'
from auth.users u where u.email = 'coordinator.demo@barakat.test'
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Check: four rows, each with the right role and link
select u.email, p.role, p.full_name,
       p.restaurant_id is not null as has_restaurant,
       p.volunteer_id is not null  as has_volunteer,
       p.fridge_id is not null     as has_fridge
from public.profiles p join auth.users u on u.id = p.id
where u.email like '%.demo@barakat.test'
order by u.email;
