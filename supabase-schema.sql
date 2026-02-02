-- FoodTracker Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (linked to auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  weight numeric,
  height numeric,
  age integer,
  gender text check (gender in ('male', 'female')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goals text[] default '{}',
  tdee numeric,
  -- New fields for manual TDEE and weight loss rate
  custom_tdee numeric,              -- Manual TDEE (e.g., from Garmin)
  use_custom_tdee boolean default false,  -- Use manual value?
  calorie_adjustment numeric,       -- Calorie deficit/surplus
  target_weight numeric,            -- Goal weight in kg
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Migration for existing tables (run if table already exists)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_tdee numeric;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_custom_tdee boolean default false;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calorie_adjustment numeric;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_weight numeric;

-- Meals table
create table if not exists meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  time time not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text,
  photo_url text,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  created_at timestamp with time zone default now()
);

-- Migration for existing meals table (run if table already exists)
-- ALTER TABLE meals ADD COLUMN IF NOT EXISTS meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));

-- Workouts table
create table if not exists workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  type text not null,
  duration integer default 0,
  calories_burned numeric default 0,
  notes text,
  created_at timestamp with time zone default now()
);

-- Daily log table (for tracking daily states like menstruation)
create table if not exists daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  is_menstruation boolean default false,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, date)
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table meals enable row level security;
alter table workouts enable row level security;
alter table daily_logs enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Meals policies
create policy "Users can view own meals"
  on meals for select
  using (auth.uid() = user_id);

create policy "Users can insert own meals"
  on meals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own meals"
  on meals for update
  using (auth.uid() = user_id);

create policy "Users can delete own meals"
  on meals for delete
  using (auth.uid() = user_id);

-- Workouts policies
create policy "Users can view own workouts"
  on workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on workouts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workouts"
  on workouts for update
  using (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on workouts for delete
  using (auth.uid() = user_id);

-- Daily logs policies
create policy "Users can view own daily_logs"
  on daily_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily_logs"
  on daily_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily_logs"
  on daily_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own daily_logs"
  on daily_logs for delete
  using (auth.uid() = user_id);

-- Create indexes for performance
create index if not exists meals_user_date_idx on meals(user_id, date);
create index if not exists workouts_user_date_idx on workouts(user_id, date);
create index if not exists daily_logs_user_date_idx on daily_logs(user_id, date);

-- Favorite meals table (for quick meal logging)
create table if not exists favorite_meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  default_meal_type text check (default_meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  use_count integer default 0,
  created_at timestamp with time zone default now()
);

-- Saved ingredients table (for building custom meals)
create table if not exists saved_ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  serving_size text,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  use_count integer default 0,
  created_at timestamp with time zone default now()
);

-- Enable RLS for new tables
alter table favorite_meals enable row level security;
alter table saved_ingredients enable row level security;

-- Favorite meals policies
create policy "Users can view own favorite_meals"
  on favorite_meals for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorite_meals"
  on favorite_meals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own favorite_meals"
  on favorite_meals for update
  using (auth.uid() = user_id);

create policy "Users can delete own favorite_meals"
  on favorite_meals for delete
  using (auth.uid() = user_id);

-- Saved ingredients policies
create policy "Users can view own saved_ingredients"
  on saved_ingredients for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved_ingredients"
  on saved_ingredients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saved_ingredients"
  on saved_ingredients for update
  using (auth.uid() = user_id);

create policy "Users can delete own saved_ingredients"
  on saved_ingredients for delete
  using (auth.uid() = user_id);

-- Create indexes for favorites and ingredients
create index if not exists favorite_meals_user_idx on favorite_meals(user_id);
create index if not exists saved_ingredients_user_idx on saved_ingredients(user_id);

-- Migration for existing databases (run these if tables already exist):
-- CREATE TABLE IF NOT EXISTS daily_logs (
--   id uuid default gen_random_uuid() primary key,
--   user_id uuid references profiles(id) on delete cascade not null,
--   date date not null,
--   is_menstruation boolean default false,
--   notes text,
--   created_at timestamp with time zone default now(),
--   updated_at timestamp with time zone default now(),
--   unique(user_id, date)
-- );
-- ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can manage own daily_logs" ON daily_logs FOR ALL USING (auth.uid() = user_id);

-- Storage bucket for meal photos
-- Note: Run this in Supabase Dashboard > Storage > Create new bucket
-- Bucket name: meal-photos
-- Public: Yes (for easy image loading)

-- Storage policy (add via Dashboard > Storage > Policies)
-- Policy name: Users can upload own photos
-- Allowed operations: INSERT
-- Target roles: authenticated
-- Policy definition: (bucket_id = 'meal-photos'::text AND (storage.foldername(name))[1] = auth.uid()::text)

-- Policy name: Public read access
-- Allowed operations: SELECT
-- Target roles: public
-- Policy definition: bucket_id = 'meal-photos'::text
