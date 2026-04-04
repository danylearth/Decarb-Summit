-- =============================================================================
-- Seed data for Decarb Connect
-- Runs after migrations on `supabase db reset` as superuser (RLS bypassed)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. auth.users — must exist before profiles (FK dependency)
-- ---------------------------------------------------------------------------
-- Hardcoded UUIDs for deterministic references across tables.
-- Password for all seed users: "password123" (bcrypt hash below)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'sarah.chen@greentech.io',
    '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    now(), '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Sarah Chen","avatar_url":""}'::jsonb,
    now(), now(), ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b2222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'marcus.johnson@carboncap.com',
    '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    now(), '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Marcus Johnson","avatar_url":""}'::jsonb,
    now(), now(), ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c3333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'elena.rodriguez@steelworks.eu',
    '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    now(), '{"provider":"linkedin_oidc","providers":["linkedin_oidc"]}'::jsonb,
    '{"full_name":"Elena Rodriguez","avatar_url":""}'::jsonb,
    now(), now(), ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd4444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated',
    'raj.patel@h2future.in',
    '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    now(), '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Raj Patel","avatar_url":""}'::jsonb,
    now(), now(), ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e5555555-5555-5555-5555-555555555555',
    'authenticated', 'authenticated',
    'admin@decarbconnect.com',
    '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin User","avatar_url":""}'::jsonb,
    now(), now(), ''
  );

-- Create identities for each user (required by Supabase Auth)
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (
    'a1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    '{"sub":"a1111111-1111-1111-1111-111111111111","email":"sarah.chen@greentech.io"}'::jsonb,
    'google', now(), now(), now()
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'b2222222-2222-2222-2222-222222222222',
    'b2222222-2222-2222-2222-222222222222',
    '{"sub":"b2222222-2222-2222-2222-222222222222","email":"marcus.johnson@carboncap.com"}'::jsonb,
    'google', now(), now(), now()
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'c3333333-3333-3333-3333-333333333333',
    'c3333333-3333-3333-3333-333333333333',
    '{"sub":"c3333333-3333-3333-3333-333333333333","email":"elena.rodriguez@steelworks.eu"}'::jsonb,
    'linkedin_oidc', now(), now(), now()
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'd4444444-4444-4444-4444-444444444444',
    'd4444444-4444-4444-4444-444444444444',
    '{"sub":"d4444444-4444-4444-4444-444444444444","email":"raj.patel@h2future.in"}'::jsonb,
    'google', now(), now(), now()
  ),
  (
    'e5555555-5555-5555-5555-555555555555',
    'e5555555-5555-5555-5555-555555555555',
    'e5555555-5555-5555-5555-555555555555',
    '{"sub":"e5555555-5555-5555-5555-555555555555","email":"admin@decarbconnect.com"}'::jsonb,
    'email', now(), now(), now()
  );

-- ---------------------------------------------------------------------------
-- 2. profiles — references auth.users
-- ---------------------------------------------------------------------------

insert into public.profiles (
  id, name, handle, role, company, bio, tags, email,
  linkedin_url, twitter_url, is_online, is_verified, is_admin, onboarded
) values
  (
    'a1111111-1111-1111-1111-111111111111',
    'Sarah Chen', 'sarahchen',
    'Head of Sustainability', 'GreenTech Solutions',
    'Leading industrial decarbonization initiatives across manufacturing. 10+ years in clean energy transitions.',
    array['carbon-capture', 'hydrogen', 'renewable-energy', 'manufacturing'],
    'sarah.chen@greentech.io',
    'https://linkedin.com/in/sarahchen', 'https://twitter.com/sarahchen',
    true, true, false, true
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'Marcus Johnson', 'marcusj',
    'Carbon Markets Analyst', 'CarbonCap Partners',
    'Tracking voluntary and compliance carbon markets. Helping heavy industry navigate emissions trading.',
    array['carbon-markets', 'emissions-trading', 'policy', 'steel'],
    'marcus.johnson@carboncap.com',
    'https://linkedin.com/in/marcusjohnson', null,
    false, true, false, true
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'Elena Rodriguez', 'elenarodriguez',
    'Process Engineer', 'European Steelworks GmbH',
    'Working on DRI-EAF transition for green steel production. Passionate about industrial heat decarbonization.',
    array['green-steel', 'DRI', 'industrial-heat', 'electrification'],
    'elena.rodriguez@steelworks.eu',
    'https://linkedin.com/in/elenarodriguez', 'https://twitter.com/elenasteeleng',
    true, false, false, true
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'Raj Patel', 'rajpatel',
    'Hydrogen Strategy Lead', 'H2 Future India',
    'Building green hydrogen supply chains for Indian industry. Focused on electrolyzer scale-up and cost reduction.',
    array['green-hydrogen', 'electrolysis', 'supply-chain', 'india'],
    'raj.patel@h2future.in',
    'https://linkedin.com/in/rajpatel', null,
    false, false, false, true
  ),
  (
    'e5555555-5555-5555-5555-555555555555',
    'Admin User', 'decarbadmin',
    'Platform Administrator', 'Decarb Connect',
    'Summit platform administrator.',
    array['admin'],
    'admin@decarbconnect.com',
    null, null,
    true, true, true, true
  );

-- ---------------------------------------------------------------------------
-- 3. posts — references profiles
-- ---------------------------------------------------------------------------

-- Use deterministic UUIDs for posts so likes/comments can reference them
insert into public.posts (id, author_id, content, likes_count, comments_count, is_sponsored) values
  (
    'f0000001-0001-0001-0001-000000000001',
    'a1111111-1111-1111-1111-111111111111',
    'Excited to announce that our facility just hit 40% emissions reduction ahead of schedule! The combination of waste heat recovery and green hydrogen co-firing has been transformative. Happy to share learnings with anyone tackling similar challenges. #IndustrialDecarb',
    3, 2, false
  ),
  (
    'f0000002-0002-0002-0002-000000000002',
    'b2222222-2222-2222-2222-222222222222',
    'New EU CBAM reporting requirements are creating real urgency in the steel sector. If you''re still on the fence about decarbonization investments, the compliance cost curve is about to make the decision for you. Let''s discuss at tomorrow''s panel.',
    2, 1, false
  ),
  (
    'f0000003-0003-0003-0003-000000000003',
    'c3333333-3333-3333-3333-333333333333',
    'Just toured the HYBRIT pilot plant in Sweden. The DRI-EAF route using green hydrogen is no longer theoretical — it''s producing commercial-grade steel. The energy intensity numbers are better than expected. Detailed write-up coming soon.',
    4, 2, false
  ),
  (
    'f0000004-0004-0004-0004-000000000004',
    'd4444444-4444-4444-4444-444444444444',
    'India''s National Green Hydrogen Mission just allocated $2.1B for electrolyzer manufacturing. This will be a game-changer for industrial hydrogen costs in South Asia. Looking for partners to collaborate on supply chain optimization.',
    1, 0, false
  );

-- ---------------------------------------------------------------------------
-- 4. post_likes — references posts + profiles
-- ---------------------------------------------------------------------------

insert into public.post_likes (post_id, user_id) values
  -- Post 1 (Sarah's) liked by Marcus, Elena, Raj
  ('f0000001-0001-0001-0001-000000000001', 'b2222222-2222-2222-2222-222222222222'),
  ('f0000001-0001-0001-0001-000000000001', 'c3333333-3333-3333-3333-333333333333'),
  ('f0000001-0001-0001-0001-000000000001', 'd4444444-4444-4444-4444-444444444444'),
  -- Post 2 (Marcus's) liked by Sarah, Elena
  ('f0000002-0002-0002-0002-000000000002', 'a1111111-1111-1111-1111-111111111111'),
  ('f0000002-0002-0002-0002-000000000002', 'c3333333-3333-3333-3333-333333333333'),
  -- Post 3 (Elena's) liked by Sarah, Marcus, Raj, Admin
  ('f0000003-0003-0003-0003-000000000003', 'a1111111-1111-1111-1111-111111111111'),
  ('f0000003-0003-0003-0003-000000000003', 'b2222222-2222-2222-2222-222222222222'),
  ('f0000003-0003-0003-0003-000000000003', 'd4444444-4444-4444-4444-444444444444'),
  ('f0000003-0003-0003-0003-000000000003', 'e5555555-5555-5555-5555-555555555555'),
  -- Post 4 (Raj's) liked by Sarah
  ('f0000004-0004-0004-0004-000000000004', 'a1111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- 5. post_comments — references posts + profiles
-- ---------------------------------------------------------------------------

insert into public.post_comments (id, post_id, author_id, content) values
  -- Comments on Post 1 (Sarah's emissions reduction)
  (
    'cc000001-0001-0001-0001-000000000001',
    'f0000001-0001-0001-0001-000000000001',
    'b2222222-2222-2222-2222-222222222222',
    'Impressive results! What was the capex payback period on the waste heat recovery system?'
  ),
  (
    'cc000002-0002-0002-0002-000000000002',
    'f0000001-0001-0001-0001-000000000001',
    'c3333333-3333-3333-3333-333333333333',
    'Would love to compare notes — we''re seeing similar gains with our EAF optimization. Let''s connect!'
  ),
  -- Comment on Post 2 (Marcus's CBAM post)
  (
    'cc000003-0003-0003-0003-000000000003',
    'f0000002-0002-0002-0002-000000000002',
    'a1111111-1111-1111-1111-111111111111',
    'Completely agree. We ran the numbers and early movers save 30-40% on compliance costs vs waiting. The panel tomorrow should be great.'
  ),
  -- Comments on Post 3 (Elena's HYBRIT tour)
  (
    'cc000004-0004-0004-0004-000000000004',
    'f0000003-0003-0003-0003-000000000003',
    'd4444444-4444-4444-4444-444444444444',
    'The hydrogen consumption per tonne of DRI — did they share the actual numbers? We''re benchmarking for our feasibility study.'
  ),
  (
    'cc000005-0005-0005-0005-000000000005',
    'f0000003-0003-0003-0003-000000000003',
    'a1111111-1111-1111-1111-111111111111',
    'Fantastic update! The scale-up timeline is what excites me most. Can you share the write-up when it''s ready?'
  );

-- ---------------------------------------------------------------------------
-- 6. resources — standalone (admin-managed content)
-- ---------------------------------------------------------------------------

insert into public.resources (id, title, description, type, category, author, duration, stats, icon) values
  (
    'a0000001-0001-0001-0001-000000000001',
    'Green Hydrogen in Heavy Industry: A Practical Guide',
    'Comprehensive overview of green hydrogen applications in steel, cement, and chemicals production. Covers production methods, storage, transport, and end-use economics.',
    'Report', 'Hydrogen',
    'International Energy Agency',
    null, '142 pages', 'FileText'
  ),
  (
    'a0000002-0002-0002-0002-000000000002',
    'CCUS Technology Landscape 2026',
    'Annual review of carbon capture, utilization, and storage technologies. Includes cost curves, project pipeline, and policy analysis across 40 countries.',
    'Report', 'Carbon Capture',
    'Global CCS Institute',
    null, '98 pages', 'FileText'
  ),
  (
    'a0000003-0003-0003-0003-000000000003',
    'Electrification of Industrial Heat: Keynote',
    'Recording of the keynote presentation on replacing fossil-fuel process heat with electric alternatives. Covers resistance heating, heat pumps, and plasma torches.',
    'Video', 'Electrification',
    'Dr. Maria Santos',
    '45 min', '2.3k views', 'Play'
  ),
  (
    'a0000004-0004-0004-0004-000000000004',
    'Carbon Border Adjustment Mechanisms Explained',
    'Concise explainer on how CBAM policies work, which sectors are affected, and what companies need to do to prepare for reporting requirements.',
    'Insight', 'Policy',
    'Carbon Policy Institute',
    '8 min read', null, 'Lightbulb'
  ),
  (
    'a0000005-0005-0005-0005-000000000005',
    'The DRI-EAF Steelmaking Revolution',
    'Panel discussion featuring operators of three pilot green steel plants. Real-world data on energy consumption, product quality, and cost trajectories.',
    'Video', 'Green Steel',
    'World Steel Association',
    '62 min', '5.1k views', 'Play'
  );

-- ---------------------------------------------------------------------------
-- 7. saved_resources — references profiles + resources
-- ---------------------------------------------------------------------------

insert into public.saved_resources (user_id, resource_id) values
  ('a1111111-1111-1111-1111-111111111111', 'a0000001-0001-0001-0001-000000000001'),
  ('a1111111-1111-1111-1111-111111111111', 'a0000003-0003-0003-0003-000000000003'),
  ('b2222222-2222-2222-2222-222222222222', 'a0000004-0004-0004-0004-000000000004'),
  ('c3333333-3333-3333-3333-333333333333', 'a0000005-0005-0005-0005-000000000005'),
  ('c3333333-3333-3333-3333-333333333333', 'a0000001-0001-0001-0001-000000000001'),
  ('d4444444-4444-4444-4444-444444444444', 'a0000001-0001-0001-0001-000000000001'),
  ('d4444444-4444-4444-4444-444444444444', 'a0000005-0005-0005-0005-000000000005');

-- ---------------------------------------------------------------------------
-- 8. messages — references profiles (sender + receiver)
-- ---------------------------------------------------------------------------

insert into public.messages (sender_id, receiver_id, content, is_read, created_at) values
  -- Conversation between Sarah and Elena
  (
    'a1111111-1111-1111-1111-111111111111',
    'c3333333-3333-3333-3333-333333333333',
    'Hi Elena! Loved your post about the HYBRIT visit. We''re evaluating hydrogen for our furnaces — would you have 15 min to chat?',
    true, now() - interval '2 days'
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'a1111111-1111-1111-1111-111111111111',
    'Hey Sarah! Absolutely, I''d love to share what I learned. Are you free during the networking break tomorrow?',
    true, now() - interval '2 days' + interval '30 minutes'
  ),
  (
    'a1111111-1111-1111-1111-111111111111',
    'c3333333-3333-3333-3333-333333333333',
    'Perfect, see you at the coffee station around 10:30!',
    true, now() - interval '1 day'
  ),
  -- Conversation between Marcus and Raj
  (
    'b2222222-2222-2222-2222-222222222222',
    'd4444444-4444-4444-4444-444444444444',
    'Raj, the India hydrogen mission numbers are huge. Do you think the electrolyzer supply chain can scale fast enough?',
    true, now() - interval '1 day'
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'b2222222-2222-2222-2222-222222222222',
    'Good question — the manufacturing capacity targets are ambitious but there''s strong private sector interest. Let me send you our latest supply chain analysis.',
    false, now() - interval '12 hours'
  ),
  -- Message from Elena to Raj
  (
    'c3333333-3333-3333-3333-333333333333',
    'd4444444-4444-4444-4444-444444444444',
    'Hi Raj! I saw your post about the hydrogen mission. We''re sourcing DRI-grade hydrogen and would love to explore Indian suppliers. Can we connect?',
    false, now() - interval '6 hours'
  );

-- ---------------------------------------------------------------------------
-- 9. connections — references profiles
-- ---------------------------------------------------------------------------

insert into public.connections (user_id, other_user_id, status, created_at) values
  -- Sarah ↔ Elena: accepted (mutual connection)
  ('a1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'accepted', now() - interval '3 days'),
  -- Sarah ↔ Marcus: accepted
  ('a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'accepted', now() - interval '5 days'),
  -- Marcus → Raj: pending
  ('b2222222-2222-2222-2222-222222222222', 'd4444444-4444-4444-4444-444444444444', 'pending', now() - interval '1 day'),
  -- Elena → Raj: pending
  ('c3333333-3333-3333-3333-333333333333', 'd4444444-4444-4444-4444-444444444444', 'pending', now() - interval '6 hours'),
  -- Raj → Sarah: rejected (she already has a connection)
  ('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'rejected', now() - interval '4 days');
