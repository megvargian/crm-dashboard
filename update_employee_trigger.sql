-- Updated trigger to use provided password instead of generating random one
CREATE OR REPLACE FUNCTION public.create_auth_user_for_employee()
RETURNS TRIGGER AS $$
DECLARE
  new_user_id UUID;
  user_password TEXT;
  user_exists BOOLEAN;
BEGIN
  -- Check if user already exists (if id is provided)
  IF NEW.id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = NEW.id) INTO user_exists;
    IF user_exists THEN
      RETURN NEW; -- User already exists, skip creation
    END IF;
  END IF;

  -- Use provided password or generate a temporary one if none provided
  user_password := COALESCE(NEW.password, encode(gen_random_bytes(16), 'base64'));

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
    crypt(user_password, gen_salt('bf')),
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
