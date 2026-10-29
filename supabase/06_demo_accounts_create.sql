-- =====================================================================
-- Step 3: creates four one-tap demo accounts (password: BarakatDemo#2026).
-- Run once. If it fails (Supabase changes its internals now and then), create the same four users by hand
-- in Authentication > Users > Add user (tick "Auto Confirm User"), then run 07_demo_accounts_link.sql.
--   restaurant.demo@barakat.test    volunteer.demo@barakat.test
--   host.demo@barakat.test          coordinator.demo@barakat.test
-- The ".test" addresses cannot receive email, on purpose.
-- Before a real launch, run 08_remove_demo_accounts.sql.
-- =====================================================================
do $$
declare
  acct record;
  uid  uuid;
begin
  for acct in
    select * from (values
      ('restaurant.demo@barakat.test',  'Demo Restaurant',  'restaurant'),
      ('volunteer.demo@barakat.test',   'Demo Volunteer',   'volunteer'),
      ('host.demo@barakat.test',        'Demo Fridge Host', 'fridge_host'),
      ('coordinator.demo@barakat.test', 'Demo Coordinator', 'coordinator')
    ) as v(email, full_name, wanted_role)
  loop
    select id into uid from auth.users where email = acct.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acct.email,
        crypt('BarakatDemo#2026', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', acct.full_name, 'role', acct.wanted_role),
        now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', acct.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $$;
