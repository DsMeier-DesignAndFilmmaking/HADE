-- Trigger: Automatically create a public.users row when a new auth.users row is inserted.
-- Run this in the Supabase SQL Editor (Alembic cannot access the auth schema).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, home_city, onboarding_complete, created_at, last_active)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      'HADE Traveler'
    ),
    NEW.email,
    NEW.phone,
    'Unknown',
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    name = CASE
      WHEN public.users.name IS NULL OR public.users.name = '' OR public.users.name = 'HADE Traveler'
      THEN COALESCE(EXCLUDED.name, public.users.name)
      ELSE public.users.name
    END,
    last_active = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
