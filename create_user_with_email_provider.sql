-- ============================================================================
-- PROPER WAY TO CREATE AUTH USERS WITH EMAIL PROVIDER
-- Run this in Supabase SQL Editor
-- ============================================================================

-- This function properly creates an auth user with email provider
CREATE OR REPLACE FUNCTION create_client_with_auth(
  p_email TEXT,
  p_password TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'client'
)
RETURNS jsonb AS $$
DECLARE
  new_user_id UUID;
  hashed_password TEXT;
BEGIN
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();

  -- Hash the password using crypt
  hashed_password := crypt(p_password, gen_salt('bf'));

  -- Insert into auth.users with proper email provider
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    hashed_password,
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'full_name', TRIM(COALESCE(p_first_name || ' ' || p_last_name, p_email)),
      'role', p_role
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- Insert into auth.identities for email provider
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- Insert into client_profile
  INSERT INTO public.client_profile (
    id,
    email,
    first_name,
    last_name,
    address,
    role,
    created_at
  ) VALUES (
    new_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_address,
    p_role,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'message', 'Client created successfully with email provider'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Create a client with email provider:
SELECT create_client_with_auth(
  'test@client.com',           -- email
  'SecurePassword123!',         -- password
  'John',                       -- first_name
  'Doe',                        -- last_name
  '123 Main St',                -- address (optional)
  'client'                      -- role
);

-- Create another client:
SELECT create_client_with_auth(
  'jane@client.com',
  'AnotherPass456!',
  'Jane',
  'Smith'
);


-- ============================================================================
-- VERIFY THE USER WAS CREATED PROPERLY
-- ============================================================================

-- Check auth.users:
SELECT
  id,
  email,
  raw_app_meta_data->>'provider' as provider,
  raw_app_meta_data->'providers' as providers,
  raw_user_meta_data->>'role' as role,
  email_confirmed_at
FROM auth.users
WHERE email = 'test@client.com';

-- Check auth.identities (should show email provider):
SELECT
  user_id,
  provider,
  identity_data
FROM auth.identities
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@client.com');

-- Check client_profile:
SELECT * FROM client_profile WHERE email = 'test@client.com';


-- ============================================================================
-- DELETE A SPECIFIC USER (properly)
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_by_email(p_email TEXT)
RETURNS jsonb AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get user ID
  SELECT id INTO user_uuid FROM auth.users WHERE email = p_email;

  IF user_uuid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Delete from client_profile (if exists)
  DELETE FROM public.client_profile WHERE id = user_uuid;

  -- Delete from employee (if exists)
  DELETE FROM public.employee WHERE id = user_uuid;

  -- Delete from auth.identities
  DELETE FROM auth.identities WHERE user_id = user_uuid;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = user_uuid;

  RETURN jsonb_build_object('success', true, 'message', 'User deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage:
SELECT delete_user_by_email('test@client.com');
