-- ============================================================================
-- AUTO-CREATE AUTH USERS WHEN CLIENT_PROFILE OR EMPLOYEE IS INSERTED
-- This trigger creates proper auth users with email provider
-- ============================================================================

-- ============================================================================
-- TRIGGER: Auto-create Auth User when Client Profile is created
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_auth_user_for_client()
RETURNS TRIGGER AS $$
DECLARE
  new_user_id UUID;
  user_password TEXT;
  hashed_password TEXT;
  full_name_value TEXT;
  user_exists BOOLEAN;
BEGIN
  -- Check if user already exists (if id is provided)
  IF NEW.id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = NEW.id) INTO user_exists;
    IF user_exists THEN
      RETURN NEW; -- User already exists, skip creation
    END IF;
  END IF;

  -- Generate new UUID if not provided
  new_user_id := COALESCE(NEW.id, gen_random_uuid());

  -- Use provided password or generate a temporary one
  user_password := COALESCE(NEW.password, 'TempPass' || substring(md5(random()::text) from 1 for 8) || '!');

  -- Hash the password properly
  hashed_password := crypt(user_password, gen_salt('bf'));

  -- Build full name from first_name and last_name
  full_name_value := TRIM(COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email));

  -- Create the auth user with proper email provider
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
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    NEW.email,
    hashed_password,
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'full_name', full_name_value,
      'address', NEW.address,
      'role', COALESCE(NEW.role, 'client'),
      'client_business_id', NEW.client_business_id
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
    provider_id,
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    new_user_id::text,
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', NEW.email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- Set the id in the profile to match the auth user
  NEW.id := new_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for client_profile table
DROP TRIGGER IF EXISTS on_client_profile_created ON public.client_profile;
CREATE TRIGGER on_client_profile_created
  BEFORE INSERT ON public.client_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.create_auth_user_for_client();


-- ============================================================================
-- TRIGGER: Auto-create Auth User when Employee is created
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_auth_user_for_employee()
RETURNS TRIGGER AS $$
DECLARE
  new_user_id UUID;
  temp_password TEXT;
  hashed_password TEXT;
  user_exists BOOLEAN;
BEGIN
  -- Check if user already exists (if id is provided)
  IF NEW.id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = NEW.id) INTO user_exists;
    IF user_exists THEN
      RETURN NEW; -- User already exists, skip creation
    END IF;
  END IF;

  -- Generate new UUID if not provided
  new_user_id := COALESCE(NEW.id, gen_random_uuid());

  -- Generate a temporary password (employees should reset it)
  temp_password := 'TempPass' || substring(md5(random()::text) from 1 for 8) || '!';

  -- Hash the password properly
  hashed_password := crypt(temp_password, gen_salt('bf'));

  -- Create the auth user with proper email provider
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
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    NEW.email,
    hashed_password,
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'full_name', NEW.full_name,
      'role', COALESCE(NEW.role, 'employee'),
      'phone_number', NEW.phone_number,
      'service_types', NEW.service_types,
      'is_active', COALESCE(NEW.is_active, true),
      'start_working_hour', NEW.start_working_hour,
      'end_working_hours', NEW.end_working_hours,
      'working_week_days', NEW.working_week_days,
      'temp_password', temp_password
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
    provider_id,
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    new_user_id::text,
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', NEW.email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- Set the id in the employee to match the auth user
  NEW.id := new_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for employee table
DROP TRIGGER IF EXISTS on_employee_created ON public.employee;
CREATE TRIGGER on_employee_created
  BEFORE INSERT ON public.employee
  FOR EACH ROW
  EXECUTE FUNCTION public.create_auth_user_for_employee();


-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE public.client_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee ENABLE ROW LEVEL SECURITY;

-- Client Profile Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.client_profile;
CREATE POLICY "Users can view own profile"
ON public.client_profile
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.client_profile;
CREATE POLICY "Users can update own profile"
ON public.client_profile
FOR UPDATE
USING (auth.uid() = id);

-- Employee Policies
DROP POLICY IF EXISTS "Employees can view own profile" ON public.employee;
CREATE POLICY "Employees can view own profile"
ON public.employee
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Employees can update own profile" ON public.employee;
CREATE POLICY "Employees can update own profile"
ON public.employee
FOR UPDATE
USING (auth.uid() = id);

-- Admin policies (users with role='admin' can manage everything)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.client_profile;
CREATE POLICY "Admins can manage all profiles"
ON public.client_profile
FOR ALL
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employee;
CREATE POLICY "Admins can manage all employees"
ON public.employee
FOR ALL
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);


-- ============================================================================
-- HOW TO USE
-- ============================================================================

-- Example 1: Create a client profile (auth user is auto-created)
-- INSERT INTO client_profile (email, first_name, last_name, password, role)
-- VALUES ('client@example.com', 'John', 'Doe', 'SecurePass123!', 'client');

-- Example 2: Create an employee (auth user is auto-created)
-- INSERT INTO employee (email, full_name, phone_number, role, is_active)
-- VALUES ('employee@example.com', 'Jane Smith', '555-1234', 'employee', true);

-- Verify auth users were created:
-- SELECT id, email, raw_user_meta_data->>'role' as role FROM auth.users;

-- The triggers will automatically:
-- 1. Create a matching auth.users record
-- 2. Set the same UUID for both records
-- 3. Store relevant metadata in raw_user_meta_data
-- 4. Assign role (client/employee/admin)
