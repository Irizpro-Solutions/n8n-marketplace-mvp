-- ==================================================
-- ADD AUTH TRIGGER FOR AUTOMATIC PROFILE CREATION
-- ==================================================
-- This trigger automatically creates a profile when a user signs up
-- Fixes: New users not getting profiles, causing payment failures
-- ==================================================

-- 1. Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    credits,
    total_spent,
    total_executions,
    membership_tier,
    is_active,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    0,                    -- credits
    0,                    -- total_spent
    0,                    -- total_executions
    'free',               -- membership_tier
    true,                 -- is_active
    'user',               -- role
    NOW(),                -- created_at
    NOW()                 -- updated_at
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent duplicates

  RETURN NEW;
END;
$$;

-- 2. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a user signs up via Supabase Auth';

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ==================================================
-- END OF MIGRATION
-- ==================================================
