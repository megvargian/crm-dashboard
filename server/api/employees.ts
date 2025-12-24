import { createClient } from '@supabase/supabase-js'

export default eventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing'
      })
    }

    // Use service role key to bypass RLS for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check authentication for POST requests (creating employees)
    const method = getMethod(event)

    if (method === 'POST') {
      const authorizationHeader = getHeader(event, 'authorization')

      if (!authorizationHeader) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Authorization header is required'
        })
      }

      const token = authorizationHeader.replace('Bearer ', '')

      // Verify token and check admin role
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)

      if (userError || !user) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid token'
        })
      }

      // Check if user is admin client (not employee)
      // First check if user is an employee
      const { data: employee, error: employeeCheckError } = await supabase
        .from('employee')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (employee) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Employees cannot access employee management'
        })
      }

      // Check if user is admin client
      const { data: profile, error: profileError } = await supabase
        .from('client_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile error:', profileError)
        throw createError({
          statusCode: 500,
          statusMessage: `Profile error: ${profileError.message}`
        })
      }

      if (!profile || profile.role !== 'admin') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Admin access required'
        })
      }
    }

    if (method === 'POST') {
      // Handle employee creation
      const body = await readBody(event)

      // Step 1: Create auth user using Admin API
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.full_name,
          role: body.role
        }
      })

      if (authError) {
        console.error('Auth user creation error:', authError)
        throw createError({
          statusCode: 400,
          statusMessage: authError.message
        })
      }

      // Step 2: Create employee record with the auth user's ID
      const { data: employee, error: employeeError } = await supabase
        .from('employee')
        .insert({
          id: authUser.user.id,
          full_name: body.full_name,
          email: body.email,
          password: body.password, // Store plain password for reference
          role: body.role,
          phone: body.phone,
          service_types: body.service_types,
          working_week_days: body.working_week_days,
          availability: body.availability,
          location: body.location
        })
        .select()
        .single()

      if (employeeError) {
        console.error('Employee creation error:', employeeError)
        // If employee creation fails, clean up auth user
        await supabase.auth.admin.deleteUser(authUser.user.id)
        throw createError({
          statusCode: 400,
          statusMessage: employeeError.message
        })
      }

      return { success: true, employee }
    } else {
      // GET - Fetch employees
      const { data: employees, error } = await supabase
        .from('employee')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch employees'
        })
      }

      return employees || []
    }
  } catch (error) {
    console.error('Employee API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
