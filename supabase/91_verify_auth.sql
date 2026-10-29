-- Shows every profile with its role and links. After step 3 setup you should see the four demo accounts.
select u.email, p.role, p.full_name,
       p.restaurant_id is not null as has_restaurant,
       p.volunteer_id is not null  as has_volunteer,
       p.fridge_id is not null     as has_fridge
from public.profiles p join auth.users u on u.id = p.id
order by p.role, u.email;
