-- Paste into Supabase SQL Editor (Project → SQL → New query → Run)
-- Pepper must match PHONE_HASH_PEPPER = dev-pepper-change-me
--
-- After import of sample-contacts.csv, Find Connection → "Casey Morgan":
--   You → Alex Rivera → Casey Morgan   (2 steps)
-- Casey is linked ONLY to Alex. Casey's 5 contacts are private (no shared edges).

create extension if not exists pgcrypto;

do $$
declare
  pepper constant text := 'dev-pepper-change-me';

  -- sample-contacts.csv people
  alex_id   uuid := '11111111-1111-1111-1111-111111111101';
  sarah_id  uuid := '11111111-1111-1111-1111-111111111102';
  mike_id   uuid := '11111111-1111-1111-1111-111111111103';
  jordan_id uuid := '11111111-1111-1111-1111-111111111104';
  taylor_id uuid := '11111111-1111-1111-1111-111111111105';

  -- Casey = verified account, ONLY connected to Alex
  casey_id   uuid := '11111111-1111-1111-1111-111111111301';
  casey_auth uuid := 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

  -- Casey's private network (linked only to Casey)
  c1 uuid := '11111111-1111-1111-1111-111111111311';
  c2 uuid := '11111111-1111-1111-1111-111111111312';
  c3 uuid := '11111111-1111-1111-1111-111111111313';
  c4 uuid := '11111111-1111-1111-1111-111111111314';
  c5 uuid := '11111111-1111-1111-1111-111111111315';

  -- old alex hub ids from previous seed (clean up)
  old_hub uuid[] := array[
    '11111111-1111-1111-1111-111111111201'::uuid,
    '11111111-1111-1111-1111-111111111202'::uuid,
    '11111111-1111-1111-1111-111111111203'::uuid,
    '11111111-1111-1111-1111-111111111204'::uuid,
    '11111111-1111-1111-1111-111111111205'::uuid
  ];
  jordan_auth uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  all_ids uuid[] := array[
    alex_id, sarah_id, mike_id, jordan_id, taylor_id,
    casey_id, c1, c2, c3, c4, c5
  ] || old_hub;

  all_hashes text[] := array[
    encode(digest(pepper || ':+14155552671', 'sha256'), 'hex'),
    encode(digest(pepper || ':+12125551234', 'sha256'), 'hex'),
    encode(digest(pepper || ':+16475551234', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15195551234', 'sha256'), 'hex'),
    encode(digest(pepper || ':+14155559876', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15551234001', 'sha256'), 'hex'), -- Casey
    encode(digest(pepper || ':+15551234101', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15551234102', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15551234103', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15551234104', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15551234105', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15550001001', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15550001002', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15550001003', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15550001004', 'sha256'), 'hex'),
    encode(digest(pepper || ':+15550001005', 'sha256'), 'hex')
  ];
  conflicting uuid;
begin
  -- Wipe edges / imports that touch this demo set
  delete from public.connections
  where person_a_id = any (all_ids)
     or person_b_id = any (all_ids)
     or person_a_id in (select id from public.persons where phone_hash = any (all_hashes))
     or person_b_id in (select id from public.persons where phone_hash = any (all_hashes));

  delete from public.contact_imports
  where owner_user_id in (jordan_auth, casey_auth)
     or person_id = any (all_ids);

  delete from public.users where id in (jordan_auth, casey_auth);

  for conflicting in
    select id from public.persons
    where phone_hash = any (all_hashes)
      and id <> all (all_ids)
      and claimed = false
      and id not in (select person_id from public.users)
  loop
    delete from public.persons where id = conflicting;
  end loop;

  update public.persons
  set phone_hash = null
  where phone_hash = any (all_hashes)
    and id <> all (all_ids);

  -- Delete old alex-only hub persons if unused
  delete from public.persons
  where id = any (old_hub)
    and id not in (select person_id from public.users);

  -- Sample CSV persons (unclaimed except we no longer claim Jordan for this demo)
  insert into public.persons (id, phone_hash, claimed) values
    (alex_id,   encode(digest(pepper || ':+14155552671', 'sha256'), 'hex'), false),
    (sarah_id,  encode(digest(pepper || ':+12125551234', 'sha256'), 'hex'), false),
    (mike_id,   encode(digest(pepper || ':+16475551234', 'sha256'), 'hex'), false),
    (jordan_id, encode(digest(pepper || ':+15195551234', 'sha256'), 'hex'), false),
    (taylor_id, encode(digest(pepper || ':+14155559876', 'sha256'), 'hex'), false),
    -- Casey: verified, NOT in sample CSV
    (casey_id, encode(digest(pepper || ':+15551234001', 'sha256'), 'hex'), true),
    -- Casey private network
    (c1, encode(digest(pepper || ':+15551234101', 'sha256'), 'hex'), false),
    (c2, encode(digest(pepper || ':+15551234102', 'sha256'), 'hex'), false),
    (c3, encode(digest(pepper || ':+15551234103', 'sha256'), 'hex'), false),
    (c4, encode(digest(pepper || ':+15551234104', 'sha256'), 'hex'), false),
    (c5, encode(digest(pepper || ':+15551234105', 'sha256'), 'hex'), false)
  on conflict (id) do update
    set phone_hash = excluded.phone_hash,
        claimed = excluded.claimed;

  -- Auth + profile for Casey Morgan
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    casey_auth,
    'authenticated',
    'authenticated',
    'casey@demo.herekathenas.test',
    crypt('demo-password-not-for-prod', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Casey Morgan"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    casey_auth,
    casey_auth,
    jsonb_build_object(
      'sub', casey_auth::text,
      'email', 'casey@demo.herekathenas.test',
      'email_verified', true
    ),
    'email',
    casey_auth::text,
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do nothing;

  insert into public.users (
    id, person_id, username, display_name, bio, onboarding_completed
  ) values (
    casey_auth,
    casey_id,
    'caseymorgan',
    'Casey Morgan',
    'Demo verified account. Reachable in 2 steps via Alex Rivera after importing sample-contacts.csv.',
    true
  )
  on conflict (id) do update
    set person_id = excluded.person_id,
        username = excluded.username,
        display_name = excluded.display_name,
        bio = excluded.bio,
        onboarding_completed = excluded.onboarding_completed;

  -- ONLY bridge: Alex ↔ Casey  (no other sample people link to Casey)
  insert into public.connections (person_a_id, person_b_id, source) values
    (alex_id, casey_id, 'seed')
  on conflict do nothing;

  -- Casey's private network (only ↔ Casey)
  insert into public.connections (person_a_id, person_b_id, source) values
    (casey_id, c1, 'seed'),
    (casey_id, c2, 'seed'),
    (casey_id, c3, 'seed'),
    (casey_id, c4, 'seed'),
    (casey_id, c5, 'seed')
  on conflict do nothing;

  -- Labels for Casey's own imports (optional, for if someone signed in as Casey)
  insert into public.contact_imports (owner_user_id, person_id, contact_name) values
    (casey_auth, alex_id, 'Alex Rivera'),
    (casey_auth, c1, 'Riley Park'),
    (casey_auth, c2, 'Sam Ortiz'),
    (casey_auth, c3, 'Quinn Avery'),
    (casey_auth, c4, 'Morgan Ellis'),
    (casey_auth, c5, 'Jamie Blake')
  on conflict (owner_user_id, person_id) do nothing;
end $$;
