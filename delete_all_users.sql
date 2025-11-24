-- ============================================================================
-- DELETE ALL AUTH USERS AND RELATED PROFILES
-- Run this in Supabase SQL Editor to clean up
-- ============================================================================

-- WARNING: This will delete ALL users and their profiles!
-- Make sure this is what you want before running

-- 1. Delete all client profiles (will cascade delete due to foreign key)
DELETE FROM public.client_profile;

-- 2. Delete all employees
DELETE FROM public.employee;

-- 3. Delete all auth users (this is the main cleanup)
-- Note: You need to use the Supabase Dashboard for this or use the admin API
-- Go to: Authentication → Users → Select All → Delete

-- Or use this function to delete all auth users:
CREATE OR REPLACE FUNCTION delete_all_auth_users()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    DELETE FROM auth.users WHERE id = user_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to delete all users:
SELECT delete_all_auth_users();

-- Drop the function after use:
DROP FUNCTION IF EXISTS delete_all_auth_users();


-- ============================================================================
-- VERIFY CLEANUP
-- ============================================================================

-- Check if any users remain:
SELECT COUNT(*) as remaining_auth_users FROM auth.users;
SELECT COUNT(*) as remaining_client_profiles FROM public.client_profile;
SELECT COUNT(*) as remaining_employees FROM public.employee;
