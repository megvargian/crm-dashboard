-- Disable the employee trigger since we're now handling auth user creation in the application
DROP TRIGGER IF EXISTS update_employee_trigger ON employee;
DROP FUNCTION IF EXISTS update_employee_function();
