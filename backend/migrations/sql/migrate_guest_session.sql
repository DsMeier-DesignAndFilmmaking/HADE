-- RPC: Migrate anonymous guest context_states to an authenticated user.
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.migrate_guest_session(
  guest_user_id UUID,
  new_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER;
BEGIN
  UPDATE public.context_states
  SET user_id = new_user_id
  WHERE user_id = guest_user_id;

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  -- Clean up the anonymous user row
  DELETE FROM public.users WHERE id = guest_user_id;

  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
