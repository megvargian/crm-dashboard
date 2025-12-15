-- ============================================================================
-- AUTO-CREATE AUTH USERS FOR EMPLOYEE TABLE
-- When an employee is created, automatically create a corresponding auth user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_auth_user_for_employee()
RETURNS TRIGGER AS $$
DECLARE
  new_user_id UUID;
  temp_password TEXT;
  user_exists BOOLEAN;
BEGIN
  -- Check if user already exists (if id is provided)
  IF NEW.id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = NEW.id) INTO user_exists;
    IF user_exists THEN
      RETURN NEW; -- User already exists, skip creation
    END IF;
  END IF;

  -- Generate a temporary password (employees should reset it)
  temp_password := encode(gen_random_bytes(16), 'base64');

  -- Create the auth user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  )
  VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    '00000000-0000-0000-0000-000000000000'::uuid,
    NEW.email,
    crypt(temp_password, gen_salt('bf')),
    NOW(), -- Auto-confirm email (set to NULL if you want email verification)
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', NEW.full_name,
      'role', COALESCE(NEW.role, 'employee'),
      'phone_number', NEW.phone_number,
      'service_types', NEW.service_types,
      'is_active', COALESCE(NEW.is_active, true),
      'start_working_hour', NEW.start_working_hour,
      'end_working_hours', NEW.end_working_hours,
      'working_week_days', NEW.working_week_days
    ),
    false,
    'authenticated'
  )
  RETURNING id INTO new_user_id;

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
-- DELETE TRIGGER FOR EMPLOYEE TABLE
-- When an employee is deleted, also delete the corresponding auth user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_auth_user_for_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the auth.users record matching the id
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create delete trigger for employee table
DROP TRIGGER IF EXISTS on_employee_deleted ON public.employee;
CREATE TRIGGER on_employee_deleted
  AFTER DELETE ON public.employee
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user_for_employee();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR EMPLOYEE TABLE
-- ============================================================================

-- Enable RLS on employee table
ALTER TABLE public.employee ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employee;
CREATE POLICY "Admins can manage all employees"
ON public.employee
FOR ALL
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  OR
  (SELECT role FROM client_profile WHERE user_id = auth.uid()) = 'admin'
);

-- ============================================================================
-- USAGE EXAMPLE
-- ============================================================================

-- Example: Create an employee (auth user is auto-created)
-- INSERT INTO employee (email, full_name, phone_number, role, is_active)
-- VALUES ('employee@example.com', 'Jane Smith', '555-1234', 'employee', true);
