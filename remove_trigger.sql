-- Run this in Supabase SQL editor to disable the employee trigger
DROP TRIGGER IF EXISTS update_employee_trigger ON employee;
DROP FUNCTION IF EXISTS update_employee_function();
