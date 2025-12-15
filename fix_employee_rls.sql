-- Fix INSERT policy for employee table
-- This policy allows admins to insert new employees

DROP POLICY IF EXISTS "Admins can insert employees" ON public.employee;
CREATE POLICY "Admins can insert employees"
ON public.employee
FOR INSERT
WITH CHECK (
  (SELECT role FROM client_profile WHERE user_id = auth.uid()) = 'admin'
);

-- Also update the existing admin policy to be more explicit
DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employee;
CREATE POLICY "Admins can manage all employees"
ON public.employee
FOR SELECT
USING (
  (SELECT role FROM client_profile WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can update all employees"
ON public.employee
FOR UPDATE
USING (
  (SELECT role FROM client_profile WHERE user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can delete all employees"
ON public.employee
FOR DELETE
USING (
  (SELECT role FROM client_profile WHERE user_id = auth.uid()) = 'admin'
);
