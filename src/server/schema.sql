create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  username text not null default 'guest',
  display_name text not null default 'Adventurer',
  account_type text not null default 'guest' check (account_type in ('guest', 'registered')),
  role text not null default 'player' check (role in ('player', 'moderator', 'admin', 'owner')),
  password_hash text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists password_hash text;
alter table users add column if not exists deleted_at timestamptz;

create table if not exists player_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists players (
  user_id uuid primary key references users(id) on delete cascade,
  player_name text not null default 'Adventurer',
  map_id text not null default 'starter_village',
  x integer not null default 128,
  y integer not null default 128,
  hp integer not null default 40 check (hp >= 0),
  max_hp integer not null default 40 check (max_hp > 0),
  mp integer not null default 18 check (mp >= 0),
  max_mp integer not null default 18 check (max_mp > 0),
  level integer not null default 1 check (level > 0),
  exp integer not null default 0 check (exp >= 0),
  gold integer not null default 0 check (gold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists player_quests (
  user_id uuid not null references users(id) on delete cascade,
  quest_id text not null,
  state text not null check (state in ('locked', 'available', 'active', 'completed', 'claimed')),
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

create table if not exists player_inventory (
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null,
  quantity integer not null default 1 check (quantity >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists player_equipment (
  user_id uuid not null references users(id) on delete cascade,
  slot text not null check (slot in ('weapon', 'armor', 'ring', 'necklace')),
  item_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

create table if not exists player_flags (
  user_id uuid not null references users(id) on delete cascade,
  flag_key text not null,
  flag_value jsonb not null default 'true'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, flag_key)
);

create table if not exists leaderboard (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  score_type text not null default 'level' check (score_type in ('level', 'exp', 'gold', 'boss_kills', 'event_points', 'combat_power')),
  score integer not null check (score >= 0),
  level integer not null check (level > 0),
  submitted_at timestamptz not null default now(),
  unique (user_id, score_type)
);

create table if not exists leaderboard_snapshots (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  score_type text not null check (score_type in ('level', 'exp', 'gold', 'boss_kills', 'event_points', 'combat_power')),
  score integer not null check (score >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists player_save_logs (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists battle_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  enemy_id text not null,
  enemy_name text not null,
  player_level integer not null check (player_level > 0),
  exp_reward integer not null check (exp_reward >= 0),
  gold_reward integer not null check (gold_reward >= 0),
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists shop_transactions (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  shop_id text not null,
  item_id text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  direction text not null check (direction in ('buy', 'sell')),
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists item_transactions (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null,
  quantity integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists player_events (
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null,
  state text not null check (state in ('locked', 'scheduled', 'active', 'completed', 'claimed', 'expired')),
  progress jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists event_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null,
  result_type text not null,
  rewards jsonb not null default '{}'::jsonb,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists boss_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null,
  boss_id text not null,
  boss_name text not null,
  rewards jsonb not null default '{}'::jsonb,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists cutscene_progress (
  user_id uuid not null references users(id) on delete cascade,
  cutscene_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, cutscene_id)
);

create table if not exists daily_claims (
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null,
  claim_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, claim_date)
);

create table if not exists admin_audit_logs (
  id bigserial primary key,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists player_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reason text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references users(id) on delete set null,
  revoked_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists giftcodes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rewards_json jsonb not null default '{}'::jsonb,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references users(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists giftcode_redemptions (
  user_id uuid not null references users(id) on delete cascade,
  giftcode_id uuid not null references giftcodes(id) on delete cascade,
  rewards_json jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz not null default now(),
  primary key (user_id, giftcode_id)
);

create table if not exists player_admin_grants (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  admin_user_id uuid references users(id) on delete set null,
  gold integer not null default 0 check (gold >= 0),
  exp integer not null default 0 check (exp >= 0),
  item_id text,
  quantity integer check (quantity is null or quantity > 0),
  pet_id text,
  mount_id text,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists player_wallets (
  user_id uuid primary key references users(id) on delete cascade,
  red_ruby bigint not null default 0 check (red_ruby >= 0),
  gold bigint not null default 0 check (gold >= 0),
  blue_diamond bigint not null default 0 check (blue_diamond >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  currency text not null check (currency in ('red_ruby', 'gold', 'blue_diamond')),
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null,
  source text not null,
  reference_id text,
  created_by uuid references users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(trim(reason)) > 0 and length(reason) <= 240),
  check (length(source) > 0 and length(source) <= 80),
  check (reference_id is null or length(reference_id) <= 160)
);

create table if not exists wallet_shop_items (
  shop_item_id text primary key,
  item_id text not null,
  name text not null,
  description text not null default '',
  currency_type text not null check (currency_type in ('red_ruby', 'gold', 'blue_diamond')),
  price bigint not null check (price > 0),
  stock_limit integer check (stock_limit is null or stock_limit > 0),
  enabled boolean not null default true,
  category text not null check (category in ('normal', 'ruby', 'blue_diamond')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(shop_item_id)) > 0 and length(shop_item_id) <= 80),
  check (length(trim(item_id)) > 0 and length(item_id) <= 120),
  check (length(trim(name)) > 0 and length(name) <= 120),
  check (length(description) <= 400)
);

create table if not exists wallet_shop_purchases (
  purchase_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  shop_item_id text not null references wallet_shop_items(shop_item_id),
  item_id text not null,
  currency_type text not null check (currency_type in ('red_ruby', 'gold', 'blue_diamond')),
  price bigint not null check (price > 0),
  quantity integer not null check (quantity > 0),
  total_price bigint not null check (total_price > 0),
  wallet_transaction_id uuid not null references wallet_transactions(id),
  created_at timestamptz not null default now()
);

create table if not exists topup_packages (
  package_id text primary key,
  name text not null,
  price_vnd integer not null check (price_vnd > 0),
  red_ruby_amount integer not null check (red_ruby_amount > 0),
  bonus_red_ruby integer not null default 0 check (bonus_red_ruby >= 0),
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(package_id)) > 0 and length(package_id) <= 80),
  check (length(trim(name)) > 0 and length(name) <= 120)
);

create table if not exists topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  package_id text not null references topup_packages(package_id),
  price_vnd integer not null check (price_vnd > 0),
  red_ruby_amount integer not null check (red_ruby_amount > 0),
  bonus_red_ruby integer not null default 0 check (bonus_red_ruby >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  player_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id) on delete set null,
  wallet_transaction_id uuid references wallet_transactions(id) on delete set null,
  check (player_note is null or length(player_note) <= 240),
  check (admin_note is null or length(admin_note) <= 240)
);

create table if not exists topup_sales (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sale_type text not null check (sale_type in ('normal_sale', 'big_sale')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  enabled boolean not null default true,
  bonus_percent integer not null default 0 check (bonus_percent >= 0 and bonus_percent <= 1000),
  bonus_red_ruby integer not null default 0 check (bonus_red_ruby >= 0),
  applies_to_all boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0 and length(name) <= 120),
  check (ends_at > starts_at),
  check (bonus_percent > 0 or bonus_red_ruby > 0)
);

create table if not exists topup_sale_packages (
  sale_id uuid not null references topup_sales(id) on delete cascade,
  package_id text not null references topup_packages(package_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sale_id, package_id)
);

alter table topup_requests add column if not exists sale_id uuid references topup_sales(id) on delete set null;
alter table topup_requests add column if not exists sale_name text;
alter table topup_requests add column if not exists sale_bonus_red_ruby integer not null default 0 check (sale_bonus_red_ruby >= 0);
alter table topup_requests add column if not exists final_red_ruby_amount integer;

update topup_requests
set final_red_ruby_amount = red_ruby_amount + bonus_red_ruby + sale_bonus_red_ruby
where final_red_ruby_amount is null;

alter table topup_requests alter column final_red_ruby_amount set default 0;
alter table topup_requests alter column final_red_ruby_amount set not null;

insert into topup_packages (package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order)
values
  ('ruby_25000', 'Gói Ruby Đỏ 25.000đ', 25000, 250, 0, true, 10),
  ('ruby_50000', 'Gói Ruby Đỏ 50.000đ', 50000, 520, 0, true, 20),
  ('ruby_100000', 'Gói Ruby Đỏ 100.000đ', 100000, 1080, 0, true, 30),
  ('ruby_200000', 'Gói Ruby Đỏ 200.000đ', 200000, 2250, 0, true, 40),
  ('ruby_500000', 'Gói Ruby Đỏ 500.000đ', 500000, 5800, 0, true, 50),
  ('ruby_1000000', 'Gói Ruby Đỏ 1.000.000đ', 1000000, 12000, 0, true, 60),
  ('ruby_2650000', 'Gói Ruby Đỏ 2.650.000đ', 2650000, 33000, 0, true, 70)
on conflict (package_id) do nothing;

insert into wallet_shop_items (shop_item_id, item_id, name, description, currency_type, price, stock_limit, enabled, category, display_order)
values
  ('normal_hp_potion', 'hp-potion', 'Bình máu', 'Hồi máu cơ bản cho hành trình đầu game.', 'gold', 20, null, true, 'normal', 10),
  ('normal_mp_potion', 'mp-potion', 'Bình nội lực', 'Hồi nội lực để tiếp tục dùng kỹ năng.', 'gold', 24, null, true, 'normal', 20),
  ('normal_wild_herb', 'wild-herb', 'Thảo dược hoang', 'Nguyên liệu phổ thông dùng cho chế tác và nhiệm vụ.', 'gold', 12, null, true, 'normal', 30),
  ('ruby_moon_crystal', 'moon-crystal', 'Pha lê trắng', 'Nguyên liệu hiếm, tiện lợi nhưng không phá cân bằng chiến đấu.', 'red_ruby', 35, null, true, 'ruby', 10),
  ('ruby_wisp_dust', 'wisp-dust', 'Bụi ma trơi', 'Nguyên liệu phát sáng dành cho người muốn tiết kiệm thời gian thu thập.', 'red_ruby', 22, null, true, 'ruby', 20),
  ('blue_sentinel_core', 'sentinel-core', 'Lõi hộ vệ', 'Nguyên liệu hiếm từ hộ vệ cổ, dành cho trao đổi đặc biệt.', 'blue_diamond', 8, null, true, 'blue_diamond', 10),
  ('blue_moonwood', 'moonwood', 'Gỗ trắng', 'Vật liệu đặc biệt dùng trong chế tác hiếm.', 'blue_diamond', 3, null, true, 'blue_diamond', 20)
on conflict (shop_item_id) do nothing;

create table if not exists player_map_progress (
  user_id uuid not null references users(id) on delete cascade,
  map_id text not null,
  x integer not null default 128,
  y integer not null default 128,
  portal_id text,
  visited_at timestamptz not null default now(),
  primary key (user_id, map_id)
);

create table if not exists dungeon_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  dungeon_id text not null,
  map_id text not null,
  cleared boolean not null default false,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists dungeon_clears (
  user_id uuid not null references users(id) on delete cascade,
  dungeon_id text not null,
  map_id text not null,
  clear_count integer not null default 0 check (clear_count >= 0),
  last_cleared_at timestamptz,
  primary key (user_id, dungeon_id)
);

create table if not exists player_classes (
  user_id uuid primary key references users(id) on delete cascade,
  class_id text not null check (class_id in ('warrior', 'mage', 'ranger', 'priest', 'assassin')),
  selected_at timestamptz not null default now()
);

create table if not exists player_skills (
  user_id uuid not null references users(id) on delete cascade,
  skill_id text not null,
  unlocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists player_hotbar (
  user_id uuid not null references users(id) on delete cascade,
  slot integer not null check (slot between 1 and 4),
  skill_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

create table if not exists skill_cast_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  skill_id text not null,
  target_id text,
  damage integer check (damage is null or damage >= 0),
  healing integer check (healing is null or healing >= 0),
  mp_after integer not null default 0 check (mp_after >= 0),
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists player_stat_snapshots (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  class_id text,
  level integer not null default 1,
  stats_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists gathering_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  node_id text not null,
  map_id text not null,
  drops_json jsonb not null default '[]'::jsonb,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists pet_gathering_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  pet_id text not null,
  node_id text not null,
  map_id text not null,
  bonus_json jsonb not null default '{}'::jsonb,
  drops_json jsonb not null default '[]'::jsonb,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists player_gathering_history (
  user_id uuid not null references users(id) on delete cascade,
  node_id text not null,
  gathered_count integer not null default 0 check (gathered_count >= 0),
  last_gathered_at timestamptz,
  primary key (user_id, node_id)
);

create table if not exists crafting_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  recipe_id text not null,
  success boolean not null default false,
  output_item_id text,
  output_quantity integer not null default 0 check (output_quantity >= 0),
  materials_json jsonb not null default '[]'::jsonb,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists player_crafting_history (
  user_id uuid not null references users(id) on delete cascade,
  recipe_id text not null,
  craft_count integer not null default 0 check (craft_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  last_crafted_at timestamptz,
  primary key (user_id, recipe_id)
);

create table if not exists equipment_upgrades (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null,
  source text not null check (source in ('equipment', 'inventory')),
  slot text,
  from_level integer not null default 0 check (from_level >= 0),
  to_level integer not null default 0 check (to_level >= 0),
  success boolean not null default false,
  cost_json jsonb not null default '{}'::jsonb,
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists player_pets (
  user_id uuid not null references users(id) on delete cascade,
  pet_id text not null,
  level integer not null default 1 check (level > 0),
  exp integer not null default 0 check (exp >= 0),
  active boolean not null default false,
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pet_id)
);

create table if not exists player_pet_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  pet_id text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pet_combat_results (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  pet_id text not null,
  enemy_id text,
  damage_dealt integer not null default 0 check (damage_dealt >= 0),
  healing_done integer not null default 0 check (healing_done >= 0),
  exp_delta integer not null default 0 check (exp_delta >= 0),
  player_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists player_mounts (
  user_id uuid not null references users(id) on delete cascade,
  mount_id text not null,
  active boolean not null default false,
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mount_id)
);

create table if not exists player_mount_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  mount_id text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists player_achievements (
  user_id uuid not null references users(id) on delete cascade,
  achievement_id text not null,
  state text not null check (state in ('locked', 'active', 'completed', 'claimable', 'claimed')),
  progress integer not null default 0 check (progress >= 0),
  target integer not null default 1 check (target > 0),
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists achievement_claims (
  user_id uuid not null references users(id) on delete cascade,
  achievement_id text not null,
  rewards_json jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists player_titles (
  user_id uuid not null references users(id) on delete cascade,
  title_id text not null,
  unlock_source text not null default 'achievement',
  metadata jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table if not exists player_active_titles (
  user_id uuid primary key references users(id) on delete cascade,
  title_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists player_collections (
  user_id uuid not null references users(id) on delete cascade,
  collection_id text not null,
  category text not null check (category in ('pets', 'mounts', 'items', 'enemies', 'bosses', 'maps', 'titles')),
  entry_id text not null,
  state text not null check (state in ('hidden', 'undiscovered', 'discovered', 'completed', 'claimable', 'claimed')),
  progress integer not null default 0 check (progress >= 0),
  discovered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

create table if not exists collection_claims (
  user_id uuid not null references users(id) on delete cascade,
  set_id text not null,
  rewards_json jsonb not null default '{}'::jsonb,
  points integer not null default 0 check (points >= 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id, set_id)
);

create table if not exists player_mailbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  sender_type text not null check (sender_type in ('system', 'admin')),
  sender_name text not null default 'System',
  title text not null,
  message text not null default '',
  rewards_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists mailbox_reads (
  user_id uuid not null references users(id) on delete cascade,
  mail_id uuid not null references player_mailbox(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, mail_id)
);

create table if not exists mailbox_claims (
  user_id uuid not null references users(id) on delete cascade,
  mail_id uuid not null references player_mailbox(id) on delete cascade,
  rewards_json jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mail_id)
);

create table if not exists player_friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table if not exists player_friends (
  user_id uuid not null references users(id) on delete cascade,
  friend_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_user_id),
  check (user_id <> friend_user_id)
);

create table if not exists player_blocks (
  user_id uuid not null references users(id) on delete cascade,
  blocked_user_id uuid not null references users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);

create table if not exists social_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  target_user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null check (message_type in ('world_chat', 'map_chat', 'system_message', 'moderation_notice')),
  sender_user_id uuid references users(id) on delete set null,
  map_id text,
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists private_messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table if not exists chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references users(id) on delete cascade,
  message_id uuid not null,
  message_kind text not null check (message_kind in ('chat', 'private', 'party', 'guild')),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  unique (reporter_user_id, message_id, message_kind)
);

alter table if exists chat_reports
  drop constraint if exists chat_reports_message_kind_check;

alter table if exists chat_reports
  add constraint chat_reports_message_kind_check
  check (message_kind in ('chat', 'private', 'party', 'guild'));

create table if not exists player_chat_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reason text not null,
  expires_at timestamptz,
  created_by uuid references users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists chat_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  leader_user_id uuid not null references users(id) on delete cascade,
  loot_mode text not null default 'free_for_all' check (loot_mode in ('free_for_all', 'round_robin', 'leader')),
  exp_mode text not null default 'nearby_only' check (exp_mode in ('nearby_only', 'equal_share')),
  max_members integer not null default 5 check (max_members between 2 and 8),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists party_members (
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists party_invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  party_id uuid references parties(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table if not exists party_chat_messages (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists party_exp_events (
  id bigserial primary key,
  party_id uuid not null references parties(id) on delete cascade,
  source_user_id uuid not null references users(id) on delete cascade,
  enemy_id text not null,
  enemy_name text not null,
  exp_reward integer not null check (exp_reward >= 0),
  exp_mode text not null check (exp_mode in ('nearby_only', 'equal_share')),
  map_id text,
  eligible_member_ids jsonb not null default '[]'::jsonb,
  allocations_json jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists party_loot_events (
  id bigserial primary key,
  party_id uuid not null references parties(id) on delete cascade,
  source_user_id uuid not null references users(id) on delete cascade,
  assigned_user_id uuid references users(id) on delete set null,
  enemy_id text not null,
  enemy_name text not null,
  loot_mode text not null check (loot_mode in ('free_for_all', 'round_robin', 'leader')),
  gold_reward integer not null default 0 check (gold_reward >= 0),
  drops_json jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists party_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text not null unique,
  description text not null default '',
  level integer not null default 1 check (level > 0),
  exp integer not null default 0 check (exp >= 0),
  notice text not null default '',
  join_mode text not null default 'application' check (join_mode in ('open', 'application', 'invite_only')),
  max_members integer not null default 50 check (max_members between 1 and 300),
  active boolean not null default true,
  enabled boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guild_members (
  guild_id uuid not null references guilds(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'deputy', 'officer', 'member')),
  contribution integer not null default 0 check (contribution >= 0),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists guild_applications (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  applicant_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guild_invites (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table if not exists guild_events (
  id bigserial primary key,
  guild_id uuid references guilds(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guild_storage_gold (
  guild_id uuid primary key references guilds(id) on delete cascade,
  gold integer not null default 0 check (gold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guild_storage_items (
  guild_id uuid not null references guilds(id) on delete cascade,
  item_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  deposited_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, item_id)
);

create table if not exists guild_storage_logs (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  actor_player_id uuid references users(id) on delete set null,
  action text not null check (action in ('deposit', 'withdraw')),
  item_id text,
  gold_amount integer check (gold_amount is null or gold_amount > 0),
  quantity integer check (quantity is null or quantity > 0),
  created_at timestamptz not null default now(),
  check (gold_amount is not null or (item_id is not null and quantity is not null))
);

create table if not exists guild_quests (
  guild_id uuid not null references guilds(id) on delete cascade,
  guild_quest_id text not null,
  state text not null default 'active' check (state in ('locked', 'active', 'completed', 'claimable', 'claimed', 'expired')),
  cycle_key text not null default 'default',
  definition_json jsonb not null default '{}'::jsonb,
  progress_json jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, guild_quest_id, cycle_key)
);

create table if not exists guild_quest_progress (
  guild_id uuid not null references guilds(id) on delete cascade,
  guild_quest_id text not null,
  cycle_key text not null default 'default',
  objective_id text not null,
  progress integer not null default 0 check (progress >= 0),
  updated_at timestamptz not null default now(),
  primary key (guild_id, guild_quest_id, cycle_key, objective_id)
);

create table if not exists guild_quest_contributions (
  guild_id uuid not null references guilds(id) on delete cascade,
  guild_quest_id text not null,
  cycle_key text not null default 'default',
  user_id uuid not null references users(id) on delete cascade,
  contribution integer not null default 0 check (contribution >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, guild_quest_id, cycle_key, user_id)
);

create table if not exists guild_quest_claims (
  guild_id uuid not null references guilds(id) on delete cascade,
  guild_quest_id text not null,
  cycle_key text not null default 'default',
  user_id uuid not null references users(id) on delete cascade,
  rewards_json jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  primary key (guild_id, guild_quest_id, cycle_key, user_id)
);

create table if not exists guild_contribution_points (
  guild_id uuid not null references guilds(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists guild_boss_summons (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  guild_boss_id text not null,
  state text not null default 'active' check (state in ('active', 'defeated', 'expired')),
  hp integer not null check (hp >= 0),
  max_hp integer not null check (max_hp > 0),
  total_damage integer not null default 0 check (total_damage >= 0),
  summoned_by uuid references users(id) on delete set null,
  summoned_at timestamptz not null default now(),
  defeated_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists guild_boss_summons_one_active_idx on guild_boss_summons (guild_id) where state = 'active';

create table if not exists guild_boss_damage (
  guild_id uuid not null references guilds(id) on delete cascade,
  summon_id uuid not null references guild_boss_summons(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  damage integer not null default 0 check (damage >= 0),
  updated_at timestamptz not null default now(),
  primary key (guild_id, summon_id, user_id)
);

create table if not exists guild_boss_results (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  summon_id uuid not null unique references guild_boss_summons(id) on delete cascade,
  guild_boss_id text not null,
  rewards_json jsonb not null default '{}'::jsonb,
  total_damage integer not null default 0 check (total_damage >= 0),
  defeated_at timestamptz not null default now()
);

create table if not exists guild_boss_claims (
  guild_id uuid not null references guilds(id) on delete cascade,
  summon_id uuid not null references guild_boss_summons(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  rewards_json jsonb not null default '{}'::jsonb,
  damage integer not null default 0 check (damage >= 0),
  claimed_at timestamptz not null default now(),
  primary key (guild_id, summon_id, user_id)
);

create table if not exists guild_boss_events (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  summon_id uuid references guild_boss_summons(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guild_leaderboard (
  guild_id uuid not null references guilds(id) on delete cascade,
  score_type text not null check (score_type in ('guild_level', 'guild_exp', 'member_count', 'guild_contribution', 'guild_boss_kills', 'guild_boss_damage', 'guild_storage_gold', 'guild_quest_points')),
  score integer not null default 0 check (score >= 0),
  level integer not null default 1 check (level > 0),
  member_count integer not null default 0 check (member_count >= 0),
  submitted_at timestamptz not null default now(),
  primary key (guild_id, score_type)
);

create table if not exists guild_leaderboard_snapshots (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  score_type text not null check (score_type in ('guild_level', 'guild_exp', 'member_count', 'guild_contribution', 'guild_boss_kills', 'guild_boss_damage', 'guild_storage_gold', 'guild_quest_points')),
  score integer not null default 0 check (score >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guild_score_events (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guild_chat_messages (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists guild_chat_events (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guild_member_events (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guild_permission_events (
  id bigserial primary key,
  guild_id uuid not null references guilds(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists admin_npcs (
  npc_id text primary key,
  name text not null,
  role text not null default 'npc',
  map_id text not null default 'starter_village',
  x integer not null default 128,
  y integer not null default 128,
  dialogue_json jsonb not null default '{}'::jsonb,
  shop_id text,
  quest_ids text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_quests (
  quest_id text primary key,
  title text not null,
  description text not null default '',
  state_rules_json jsonb not null default '{}'::jsonb,
  objectives_json jsonb not null default '[]'::jsonb,
  rewards_json jsonb not null default '{}'::jsonb,
  required_level integer not null default 1 check (required_level >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_items (
  item_id text primary key,
  name text not null,
  type text not null check (type in ('consumable', 'weapon', 'armor', 'accessory', 'material', 'quest_item')),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  description text not null default '',
  icon text not null default '?',
  stat_bonuses_json jsonb not null default '{}'::jsonb,
  buy_price integer check (buy_price is null or buy_price >= 0),
  sell_price integer not null default 0 check (sell_price >= 0),
  stackable boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_enemies (
  enemy_id text primary key,
  name text not null,
  level integer not null default 1 check (level > 0),
  hp integer not null default 20 check (hp > 0),
  attack integer not null default 4 check (attack >= 0),
  defense integer not null default 1 check (defense >= 0),
  exp_reward integer not null default 1 check (exp_reward >= 0),
  gold_reward integer not null default 1 check (gold_reward >= 0),
  drops_json jsonb not null default '[]'::jsonb,
  aggro_range integer not null default 160 check (aggro_range >= 0),
  attack_range integer not null default 34 check (attack_range >= 0),
  chase_speed integer not null default 80 check (chase_speed >= 0),
  respawn_ms integer not null default 12000 check (respawn_ms >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_events (
  event_id text primary key,
  title text not null,
  type text not null check (type in ('world_event', 'map_event', 'boss_event', 'cutscene', 'daily_event', 'quest_event')),
  state text not null check (state in ('locked', 'scheduled', 'active', 'completed', 'claimed', 'expired')),
  trigger_json jsonb not null default '[]'::jsonb,
  rewards_json jsonb not null default '{}'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pvp_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  rating integer not null default 1000 check (rating >= 0),
  ranked_wins integer not null default 0 check (ranked_wins >= 0),
  ranked_losses integer not null default 0 check (ranked_losses >= 0),
  ranked_draws integer not null default 0 check (ranked_draws >= 0),
  current_streak integer not null default 0,
  best_rating integer not null default 1000 check (best_rating >= 0),
  last_ranked_match_at timestamptz,
  pvp_points integer not null default 0 check (pvp_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pvp_profiles add column if not exists ranked_wins integer not null default 0 check (ranked_wins >= 0);
alter table pvp_profiles add column if not exists ranked_losses integer not null default 0 check (ranked_losses >= 0);
alter table pvp_profiles add column if not exists ranked_draws integer not null default 0 check (ranked_draws >= 0);
alter table pvp_profiles add column if not exists current_streak integer not null default 0;
alter table pvp_profiles add column if not exists best_rating integer not null default 1000 check (best_rating >= 0);
alter table pvp_profiles add column if not exists last_ranked_match_at timestamptz;
update pvp_profiles set best_rating = greatest(best_rating, rating);

create table if not exists pvp_seasons (
  season_id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null check (state in ('scheduled', 'active', 'ended', 'archived')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists pvp_season_profiles (
  season_id uuid not null references pvp_seasons(season_id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  season_points integer not null default 0 check (season_points >= 0),
  season_wins integer not null default 0 check (season_wins >= 0),
  season_losses integer not null default 0 check (season_losses >= 0),
  season_draws integer not null default 0 check (season_draws >= 0),
  highest_rating integer not null default 1000 check (highest_rating >= 0),
  current_rating integer not null default 1000 check (current_rating >= 0),
  matches_played integer not null default 0 check (matches_played >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);

create table if not exists pvp_season_events (
  id bigserial primary key,
  season_id uuid references pvp_seasons(season_id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_season_reward_rules (
  reward_rule_id uuid primary key default gen_random_uuid(),
  season_id uuid not null references pvp_seasons(season_id) on delete cascade,
  tier text not null,
  min_rank integer check (min_rank is null or min_rank >= 1),
  max_rank integer check (max_rank is null or max_rank >= 1),
  min_rating integer check (min_rating is null or min_rating >= 0),
  min_season_points integer check (min_season_points is null or min_season_points >= 0),
  rewards_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_rank is null or max_rank is null or min_rank <= max_rank)
);

create table if not exists pvp_season_reward_claims (
  claim_id uuid primary key default gen_random_uuid(),
  season_id uuid not null references pvp_seasons(season_id) on delete cascade,
  reward_rule_id uuid not null references pvp_season_reward_rules(reward_rule_id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  rewards_json jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  unique (reward_rule_id, player_id)
);

create table if not exists pvp_shop_items (
  shop_item_id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  price_pvp_points integer not null check (price_pvp_points >= 0),
  rewards_json jsonb not null default '{}'::jsonb,
  min_rating integer check (min_rating is null or min_rating >= 0),
  min_season_points integer check (min_season_points is null or min_season_points >= 0),
  min_rank integer check (min_rank is null or min_rank >= 1),
  stock_limit integer check (stock_limit is null or stock_limit >= 0),
  per_player_limit integer check (per_player_limit is null or per_player_limit >= 0),
  enabled boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists pvp_shop_purchases (
  purchase_id uuid primary key default gen_random_uuid(),
  shop_item_id uuid not null references pvp_shop_items(shop_item_id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  price_pvp_points integer not null check (price_pvp_points >= 0),
  rewards_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_shop_events (
  id bigserial primary key,
  shop_item_id uuid references pvp_shop_items(shop_item_id) on delete set null,
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_duel_challenges (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('duel_1v1')),
  challenger_user_id uuid not null references users(id) on delete cascade,
  target_user_id uuid not null references users(id) on delete cascade,
  state text not null check (state in ('pending', 'accepted', 'active', 'completed', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_user_id <> target_user_id)
);

create table if not exists pvp_duel_matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid unique references pvp_duel_challenges(id) on delete set null,
  mode text not null check (mode in ('duel_1v1')),
  state text not null check (state in ('pending', 'accepted', 'active', 'completed', 'cancelled', 'expired')),
  player_a_user_id uuid not null references users(id) on delete cascade,
  player_b_user_id uuid not null references users(id) on delete cascade,
  map_id text not null default 'duel_arena_1',
  player_a_spawn jsonb not null default '{"x":192,"y":384}'::jsonb,
  player_b_spawn jsonb not null default '{"x":832,"y":384}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_a_user_id <> player_b_user_id)
);

create table if not exists pvp_duel_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references pvp_duel_matches(id) on delete cascade,
  winner_player_id uuid references users(id) on delete set null,
  loser_player_id uuid references users(id) on delete set null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  player_a_damage integer not null default 0 check (player_a_damage >= 0),
  player_b_damage integer not null default 0 check (player_b_damage >= 0),
  ended_reason text not null default 'submitted',
  created_at timestamptz not null default now(),
  check (winner_player_id is null or loser_player_id is null or winner_player_id <> loser_player_id)
);

create table if not exists pvp_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  challenge_id uuid references pvp_duel_challenges(id) on delete set null,
  match_id uuid references pvp_duel_matches(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_ranked_matches (
  id uuid primary key default gen_random_uuid(),
  state text not null check (state in ('queued', 'matched', 'active', 'completed', 'cancelled', 'expired')),
  player_a_user_id uuid not null references users(id) on delete cascade,
  player_b_user_id uuid not null references users(id) on delete cascade,
  player_a_rating integer not null default 1000 check (player_a_rating >= 0),
  player_b_rating integer not null default 1000 check (player_b_rating >= 0),
  map_id text not null default 'duel_arena_1',
  player_a_spawn jsonb not null default '{"x":192,"y":384}'::jsonb,
  player_b_spawn jsonb not null default '{"x":832,"y":384}'::jsonb,
  matched_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_a_user_id <> player_b_user_id)
);

create table if not exists pvp_ranked_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  state text not null check (state in ('waiting', 'matched', 'cancelled', 'expired')),
  rating integer not null default 1000 check (rating >= 0),
  match_id uuid references pvp_ranked_matches(id) on delete set null,
  queued_at timestamptz not null default now(),
  matched_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pvp_ranked_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references pvp_ranked_matches(id) on delete cascade,
  winner_player_id uuid references users(id) on delete set null,
  loser_player_id uuid references users(id) on delete set null,
  draw boolean not null default false,
  player_a_damage integer not null default 0 check (player_a_damage >= 0),
  player_b_damage integer not null default 0 check (player_b_damage >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  ended_reason text not null check (ended_reason in ('knockout', 'surrender', 'timeout', 'disconnect', 'draw')),
  created_at timestamptz not null default now(),
  check (
    (draw = true and winner_player_id is null and loser_player_id is null)
    or (draw = false and winner_player_id is not null and loser_player_id is not null and winner_player_id <> loser_player_id)
  )
);

create table if not exists pvp_ranked_rating_changes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references pvp_ranked_matches(id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  opponent_player_id uuid not null references users(id) on delete cascade,
  rating_before integer not null check (rating_before >= 0),
  rating_after integer not null check (rating_after >= 0),
  rating_delta integer not null,
  result_type text not null check (result_type in ('win', 'loss', 'draw')),
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists pvp_ranked_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  queue_id uuid references pvp_ranked_queue(id) on delete set null,
  match_id uuid references pvp_ranked_matches(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_reports (
  report_id uuid primary key default gen_random_uuid(),
  reporter_player_id uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('ranked_match', 'duel_match')),
  ranked_match_id uuid references pvp_ranked_matches(id) on delete cascade,
  duel_match_id uuid references pvp_duel_matches(id) on delete cascade,
  target_match_id uuid generated always as (coalesce(ranked_match_id, duel_match_id)) stored,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(reason)) > 0 and length(reason) <= 160),
  check (length(details) <= 2000),
  check (resolution_note is null or length(resolution_note) <= 1000),
  check (
    (target_type = 'ranked_match' and ranked_match_id is not null and duel_match_id is null)
    or (target_type = 'duel_match' and duel_match_id is not null and ranked_match_id is null)
  )
);

alter table pvp_reports add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table pvp_reports add column if not exists reviewed_at timestamptz;
alter table pvp_reports add column if not exists resolution_note text;

create table if not exists pvp_report_events (
  id bigserial primary key,
  report_id uuid not null references pvp_reports(report_id) on delete cascade,
  actor_player_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_penalties (
  penalty_id uuid primary key default gen_random_uuid(),
  target_player_id uuid not null references users(id) on delete cascade,
  penalty_type text not null check (penalty_type in ('warning', 'ranked_suspension', 'duel_suspension', 'pvp_full_ban', 'shop_suspension')),
  status text not null default 'active' check (status in ('active', 'expired', 'lifted')),
  reason text not null,
  details text not null default '',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  permanent boolean not null default false,
  created_by_admin_id uuid not null references users(id) on delete restrict,
  lifted_by_admin_id uuid references users(id) on delete set null,
  lifted_at timestamptz,
  lift_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(reason)) > 0 and length(reason) <= 240),
  check (length(details) <= 2000),
  check (lift_reason is null or length(lift_reason) <= 1000),
  check (penalty_type = 'warning' or permanent = true or expires_at is not null),
  check (expires_at is null or expires_at > starts_at)
);

create table if not exists pvp_penalty_events (
  id bigserial primary key,
  penalty_id uuid not null references pvp_penalties(penalty_id) on delete cascade,
  actor_admin_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_penalty_appeals (
  appeal_id uuid primary key default gen_random_uuid(),
  penalty_id uuid not null references pvp_penalties(penalty_id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'reviewing', 'approved', 'rejected')),
  reason text not null,
  details text not null default '',
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(reason)) > 0 and length(reason) <= 240),
  check (length(details) <= 2000),
  check (resolution_note is null or length(resolution_note) <= 1000)
);

alter table pvp_penalty_appeals add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table pvp_penalty_appeals add column if not exists reviewed_at timestamptz;
alter table pvp_penalty_appeals add column if not exists resolution_note text;

create table if not exists pvp_penalty_appeal_events (
  id bigserial primary key,
  appeal_id uuid not null references pvp_penalty_appeals(appeal_id) on delete cascade,
  actor_player_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pvp_report_penalties (
  report_id uuid not null references pvp_reports(report_id) on delete cascade,
  penalty_id uuid not null references pvp_penalties(penalty_id) on delete cascade,
  linked_by_admin_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (report_id, penalty_id)
);

create table if not exists pvp_moderation_watchlist (
  player_id uuid primary key references users(id) on delete cascade,
  status text not null check (status in ('watching', 'reviewed', 'cleared')),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  note text not null default '',
  created_by_admin_id uuid references users(id) on delete set null,
  updated_by_admin_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (length(note) <= 2000)
);

create table if not exists pvp_moderation_watchlist_events (
  event_id bigserial primary key,
  player_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  note text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  admin_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (length(note) <= 2000)
);

create index if not exists player_sessions_token_idx on player_sessions (token);
create index if not exists leaderboard_score_idx on leaderboard (score_type, score desc, submitted_at asc);
create index if not exists leaderboard_snapshots_user_created_idx on leaderboard_snapshots (user_id, created_at desc);
create index if not exists player_save_logs_user_created_idx on player_save_logs (user_id, created_at desc);
create index if not exists player_quests_state_idx on player_quests (state);
create index if not exists battle_results_user_created_idx on battle_results (user_id, created_at desc);
create index if not exists shop_transactions_user_created_idx on shop_transactions (user_id, created_at desc);
create index if not exists item_transactions_user_created_idx on item_transactions (user_id, created_at desc);
create index if not exists player_events_state_idx on player_events (state);
create index if not exists event_results_user_created_idx on event_results (user_id, created_at desc);
create index if not exists boss_results_user_created_idx on boss_results (user_id, created_at desc);
create index if not exists admin_audit_logs_actor_created_idx on admin_audit_logs (actor_user_id, created_at desc);
create index if not exists player_bans_user_active_idx on player_bans (user_id, revoked_at, expires_at);
create index if not exists giftcodes_code_idx on giftcodes (code);
create index if not exists giftcode_redemptions_user_idx on giftcode_redemptions (user_id, redeemed_at desc);
create index if not exists player_admin_grants_user_created_idx on player_admin_grants (user_id, created_at desc);
create index if not exists wallet_transactions_user_created_idx on wallet_transactions (user_id, created_at desc);
create index if not exists wallet_transactions_currency_created_idx on wallet_transactions (currency, created_at desc);
create index if not exists wallet_transactions_created_by_idx on wallet_transactions (created_by, created_at desc);
create index if not exists wallet_shop_items_enabled_category_order_idx on wallet_shop_items (enabled, category, display_order);
create index if not exists wallet_shop_items_item_idx on wallet_shop_items (item_id);
create index if not exists wallet_shop_purchases_user_created_idx on wallet_shop_purchases (user_id, created_at desc);
create index if not exists wallet_shop_purchases_shop_item_idx on wallet_shop_purchases (shop_item_id, created_at desc);
create index if not exists wallet_shop_purchases_transaction_idx on wallet_shop_purchases (wallet_transaction_id);
create index if not exists topup_packages_enabled_order_idx on topup_packages (enabled, display_order);
create index if not exists topup_requests_user_created_idx on topup_requests (user_id, created_at desc);
create index if not exists topup_requests_status_created_idx on topup_requests (status, created_at desc);
create index if not exists topup_requests_package_idx on topup_requests (package_id, created_at desc);
create unique index if not exists topup_requests_wallet_transaction_unique_idx on topup_requests (wallet_transaction_id) where wallet_transaction_id is not null;
create index if not exists topup_sales_enabled_window_idx on topup_sales (enabled, starts_at, ends_at);
create index if not exists topup_sales_type_idx on topup_sales (sale_type, enabled, starts_at desc);
create index if not exists topup_sale_packages_package_idx on topup_sale_packages (package_id, sale_id);
create index if not exists player_map_progress_user_visited_idx on player_map_progress (user_id, visited_at desc);
create index if not exists dungeon_results_user_created_idx on dungeon_results (user_id, created_at desc);
create index if not exists dungeon_clears_user_idx on dungeon_clears (user_id, clear_count desc);
create index if not exists player_skills_user_idx on player_skills (user_id, unlocked);
create index if not exists skill_cast_results_user_created_idx on skill_cast_results (user_id, created_at desc);
create index if not exists player_stat_snapshots_user_created_idx on player_stat_snapshots (user_id, created_at desc);
create index if not exists gathering_results_user_created_idx on gathering_results (user_id, created_at desc);
create index if not exists pet_gathering_results_user_created_idx on pet_gathering_results (user_id, created_at desc);
create index if not exists crafting_results_user_created_idx on crafting_results (user_id, created_at desc);
create index if not exists equipment_upgrades_user_created_idx on equipment_upgrades (user_id, created_at desc);
create index if not exists player_pets_user_active_idx on player_pets (user_id, active);
create index if not exists player_pet_events_user_created_idx on player_pet_events (user_id, created_at desc);
create index if not exists pet_combat_results_user_created_idx on pet_combat_results (user_id, created_at desc);
create index if not exists player_mounts_user_active_idx on player_mounts (user_id, active);
create index if not exists player_mount_events_user_created_idx on player_mount_events (user_id, created_at desc);
create index if not exists player_achievements_state_idx on player_achievements (user_id, state);
create index if not exists achievement_claims_user_claimed_idx on achievement_claims (user_id, claimed_at desc);
create index if not exists player_titles_user_idx on player_titles (user_id, unlocked_at desc);
create index if not exists player_active_titles_title_idx on player_active_titles (title_id);
create index if not exists player_collections_user_category_idx on player_collections (user_id, category, state);
create index if not exists collection_claims_user_claimed_idx on collection_claims (user_id, claimed_at desc);
create index if not exists player_mailbox_user_created_idx on player_mailbox (user_id, created_at desc);
create index if not exists player_mailbox_user_expires_idx on player_mailbox (user_id, expires_at);
create index if not exists mailbox_reads_user_idx on mailbox_reads (user_id, read_at desc);
create index if not exists mailbox_claims_user_idx on mailbox_claims (user_id, claimed_at desc);
create index if not exists player_friend_requests_to_status_idx on player_friend_requests (to_user_id, status, created_at desc);
create index if not exists player_friend_requests_from_status_idx on player_friend_requests (from_user_id, status, created_at desc);
create index if not exists player_friends_user_created_idx on player_friends (user_id, created_at desc);
create index if not exists player_blocks_user_created_idx on player_blocks (user_id, created_at desc);
create index if not exists social_events_user_created_idx on social_events (user_id, created_at desc);
create index if not exists chat_messages_type_created_idx on chat_messages (message_type, created_at desc);
create index if not exists chat_messages_map_created_idx on chat_messages (map_id, created_at desc);
create index if not exists private_messages_conversation_idx on private_messages (from_user_id, to_user_id, created_at desc);
create index if not exists private_messages_recipient_created_idx on private_messages (to_user_id, created_at desc);
create index if not exists chat_reports_status_created_idx on chat_reports (status, created_at desc);
create index if not exists player_chat_mutes_user_active_idx on player_chat_mutes (user_id, revoked_at, expires_at);
create index if not exists chat_events_user_created_idx on chat_events (user_id, created_at desc);
create index if not exists parties_leader_active_idx on parties (leader_user_id, active);
create index if not exists party_members_user_idx on party_members (user_id, joined_at desc);
create index if not exists party_members_party_role_idx on party_members (party_id, role);
create index if not exists party_invites_to_status_idx on party_invites (to_user_id, status, created_at desc);
create index if not exists party_invites_from_status_idx on party_invites (from_user_id, status, created_at desc);
create index if not exists party_chat_messages_party_created_idx on party_chat_messages (party_id, created_at desc);
create index if not exists party_chat_messages_sender_created_idx on party_chat_messages (sender_user_id, created_at desc);
create index if not exists party_exp_events_party_created_idx on party_exp_events (party_id, created_at desc);
create index if not exists party_exp_events_source_created_idx on party_exp_events (source_user_id, created_at desc);
create index if not exists party_loot_events_party_created_idx on party_loot_events (party_id, created_at desc);
create index if not exists party_loot_events_assigned_created_idx on party_loot_events (assigned_user_id, created_at desc);
create index if not exists party_events_user_created_idx on party_events (user_id, created_at desc);
create index if not exists guilds_active_level_idx on guilds (active, level desc, exp desc);
create index if not exists guilds_name_lower_idx on guilds (lower(name));
create index if not exists guilds_tag_lower_idx on guilds (lower(tag));
create index if not exists guild_members_user_idx on guild_members (user_id, joined_at desc);
create index if not exists guild_members_guild_role_idx on guild_members (guild_id, role);
create index if not exists guild_applications_guild_status_idx on guild_applications (guild_id, status, created_at desc);
create index if not exists guild_applications_user_status_idx on guild_applications (applicant_user_id, status, created_at desc);
create index if not exists guild_invites_to_status_idx on guild_invites (to_user_id, status, created_at desc);
create index if not exists guild_invites_guild_status_idx on guild_invites (guild_id, status, created_at desc);
create index if not exists guild_events_guild_created_idx on guild_events (guild_id, created_at desc);
create index if not exists guild_storage_items_guild_updated_idx on guild_storage_items (guild_id, updated_at desc);
create index if not exists guild_storage_items_depositor_idx on guild_storage_items (deposited_by, updated_at desc);
create index if not exists guild_storage_logs_guild_created_idx on guild_storage_logs (guild_id, created_at desc);
create index if not exists guild_storage_logs_actor_created_idx on guild_storage_logs (actor_player_id, created_at desc);
create index if not exists guild_quests_state_idx on guild_quests (guild_id, state, updated_at desc);
create index if not exists guild_quest_progress_quest_idx on guild_quest_progress (guild_id, guild_quest_id, cycle_key);
create index if not exists guild_quest_contributions_user_idx on guild_quest_contributions (user_id, updated_at desc);
create index if not exists guild_quest_claims_user_idx on guild_quest_claims (user_id, claimed_at desc);
create index if not exists guild_contribution_points_guild_idx on guild_contribution_points (guild_id, points desc);
create index if not exists guild_boss_summons_guild_state_idx on guild_boss_summons (guild_id, state, summoned_at desc);
create index if not exists guild_boss_damage_summon_damage_idx on guild_boss_damage (summon_id, damage desc);
create index if not exists guild_boss_results_guild_defeated_idx on guild_boss_results (guild_id, defeated_at desc);
create index if not exists guild_boss_claims_user_idx on guild_boss_claims (user_id, claimed_at desc);
create index if not exists guild_boss_events_guild_created_idx on guild_boss_events (guild_id, created_at desc);
create index if not exists guild_leaderboard_score_idx on guild_leaderboard (score_type, score desc, submitted_at asc);
create index if not exists guild_leaderboard_snapshots_guild_created_idx on guild_leaderboard_snapshots (guild_id, created_at desc);
create index if not exists guild_score_events_guild_created_idx on guild_score_events (guild_id, created_at desc);
create index if not exists guild_chat_messages_guild_created_idx on guild_chat_messages (guild_id, created_at desc);
create index if not exists guild_chat_messages_sender_created_idx on guild_chat_messages (sender_user_id, created_at desc);
create index if not exists guild_chat_events_guild_created_idx on guild_chat_events (guild_id, created_at desc);
create index if not exists guild_member_events_guild_created_idx on guild_member_events (guild_id, created_at desc);
create index if not exists guild_permission_events_guild_created_idx on guild_permission_events (guild_id, created_at desc);
create index if not exists admin_npcs_enabled_idx on admin_npcs (enabled);
create index if not exists admin_quests_enabled_idx on admin_quests (enabled);
create index if not exists admin_items_enabled_idx on admin_items (enabled);
create index if not exists admin_enemies_enabled_idx on admin_enemies (enabled);
create index if not exists admin_events_enabled_idx on admin_events (enabled);
create index if not exists pvp_profiles_rating_idx on pvp_profiles (rating desc, wins desc);
create index if not exists pvp_profiles_ranked_idx on pvp_profiles (rating desc, ranked_wins desc, last_ranked_match_at desc);
create index if not exists pvp_seasons_state_window_idx on pvp_seasons (state, start_at, end_at);
create index if not exists pvp_season_profiles_points_idx on pvp_season_profiles (season_id, season_points desc, current_rating desc);
create index if not exists pvp_season_profiles_player_idx on pvp_season_profiles (player_id, updated_at desc);
create index if not exists pvp_season_events_season_created_idx on pvp_season_events (season_id, created_at desc);
create index if not exists pvp_season_reward_rules_season_enabled_idx on pvp_season_reward_rules (season_id, enabled, min_rank, max_rank);
create index if not exists pvp_season_reward_claims_player_idx on pvp_season_reward_claims (player_id, season_id, claimed_at desc);
create index if not exists pvp_shop_items_catalog_idx on pvp_shop_items (enabled, category, price_pvp_points, created_at desc);
create index if not exists pvp_shop_items_window_idx on pvp_shop_items (starts_at, ends_at);
create index if not exists pvp_shop_purchases_item_idx on pvp_shop_purchases (shop_item_id, created_at desc);
create index if not exists pvp_shop_purchases_user_item_idx on pvp_shop_purchases (user_id, shop_item_id, created_at desc);
create index if not exists pvp_shop_events_created_idx on pvp_shop_events (created_at desc);
create index if not exists pvp_duel_challenges_target_state_idx on pvp_duel_challenges (target_user_id, state, expires_at desc);
create index if not exists pvp_duel_challenges_pair_state_idx on pvp_duel_challenges (challenger_user_id, target_user_id, state);
create index if not exists pvp_duel_matches_player_a_state_idx on pvp_duel_matches (player_a_user_id, state, updated_at desc);
create index if not exists pvp_duel_matches_player_b_state_idx on pvp_duel_matches (player_b_user_id, state, updated_at desc);
create index if not exists pvp_duel_results_match_created_idx on pvp_duel_results (match_id, created_at desc);
create index if not exists pvp_events_user_created_idx on pvp_events (user_id, created_at desc);
create index if not exists pvp_events_match_created_idx on pvp_events (match_id, created_at desc);
create index if not exists pvp_ranked_queue_user_state_idx on pvp_ranked_queue (user_id, state, queued_at desc);
create index if not exists pvp_ranked_queue_waiting_rating_idx on pvp_ranked_queue (state, rating, queued_at);
create index if not exists pvp_ranked_matches_player_a_state_idx on pvp_ranked_matches (player_a_user_id, state, updated_at desc);
create index if not exists pvp_ranked_matches_player_b_state_idx on pvp_ranked_matches (player_b_user_id, state, updated_at desc);
create index if not exists pvp_ranked_results_created_idx on pvp_ranked_results (created_at desc);
create index if not exists pvp_ranked_results_winner_idx on pvp_ranked_results (winner_player_id, created_at desc);
create index if not exists pvp_ranked_results_loser_idx on pvp_ranked_results (loser_player_id, created_at desc);
create index if not exists pvp_ranked_rating_changes_match_idx on pvp_ranked_rating_changes (match_id, created_at desc);
create index if not exists pvp_ranked_rating_changes_player_idx on pvp_ranked_rating_changes (player_id, created_at desc);
create index if not exists pvp_ranked_events_user_created_idx on pvp_ranked_events (user_id, created_at desc);
create index if not exists pvp_ranked_events_match_created_idx on pvp_ranked_events (match_id, created_at desc);
create index if not exists pvp_reports_status_created_idx on pvp_reports (status, created_at desc);
create index if not exists pvp_reports_reporter_created_idx on pvp_reports (reporter_player_id, created_at desc);
create index if not exists pvp_reports_target_idx on pvp_reports (target_type, target_match_id, created_at desc);
create unique index if not exists pvp_reports_open_ranked_unique_idx on pvp_reports (reporter_player_id, ranked_match_id)
  where status in ('open', 'reviewing') and ranked_match_id is not null;
create unique index if not exists pvp_reports_open_duel_unique_idx on pvp_reports (reporter_player_id, duel_match_id)
  where status in ('open', 'reviewing') and duel_match_id is not null;
create index if not exists pvp_report_events_report_created_idx on pvp_report_events (report_id, created_at desc);
create index if not exists pvp_penalties_status_created_idx on pvp_penalties (status, created_at desc);
create index if not exists pvp_penalties_target_status_idx on pvp_penalties (target_player_id, status, created_at desc);
create index if not exists pvp_penalties_type_status_idx on pvp_penalties (penalty_type, status, created_at desc);
create index if not exists pvp_penalties_active_lookup_idx on pvp_penalties (target_player_id, status, penalty_type, expires_at);
create index if not exists pvp_penalty_events_penalty_created_idx on pvp_penalty_events (penalty_id, created_at desc);
create index if not exists pvp_penalty_appeals_penalty_idx on pvp_penalty_appeals (penalty_id, created_at desc);
create index if not exists pvp_penalty_appeals_player_idx on pvp_penalty_appeals (player_id, created_at desc);
create index if not exists pvp_penalty_appeals_status_idx on pvp_penalty_appeals (status, created_at desc);
create index if not exists pvp_penalty_appeals_created_idx on pvp_penalty_appeals (created_at desc);
create unique index if not exists pvp_penalty_appeals_open_unique_idx on pvp_penalty_appeals (penalty_id, player_id)
  where status in ('open', 'reviewing');
create index if not exists pvp_penalty_appeal_events_appeal_idx on pvp_penalty_appeal_events (appeal_id, created_at desc);
create index if not exists pvp_report_penalties_report_idx on pvp_report_penalties (report_id, created_at desc);
create index if not exists pvp_report_penalties_penalty_idx on pvp_report_penalties (penalty_id, created_at desc);
create index if not exists pvp_moderation_watchlist_player_idx on pvp_moderation_watchlist (player_id);
create index if not exists pvp_moderation_watchlist_status_idx on pvp_moderation_watchlist (status);
create index if not exists pvp_moderation_watchlist_priority_idx on pvp_moderation_watchlist (priority);
create index if not exists pvp_moderation_watchlist_updated_idx on pvp_moderation_watchlist (updated_at desc);
create index if not exists pvp_moderation_watchlist_events_player_idx on pvp_moderation_watchlist_events (player_id, created_at desc);
