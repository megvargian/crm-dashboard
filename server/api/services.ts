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

    // Check authentication for POST, PUT, DELETE requests
    const method = getMethod(event)

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
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

      // Check if user is an employee (block access)
      const { data: employee, error: employeeCheckError } = await supabase
        .from('employee')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (employee) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Employees cannot access service management'
        })
      }

      // Check if user is admin client
      const { data: profile, error: profileError } = await supabase
        .from('client_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError || !profile || profile.role !== 'admin') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Admin access required'
        })
      }
    }

    if (method === 'POST') {
      // Handle service creation
      const body = await readBody(event)

      const { data: service, error: serviceError } = await supabase
        .from('service')
        .insert({
          name: body.name,
          description: body.description,
          price: body.price,
          categories: body.categories,
          duration_service_in_s: body.duration_service_in_s
        })
        .select()
        .single()

      if (serviceError) {
        console.error('Service creation error:', serviceError)
        throw createError({
          statusCode: 400,
          statusMessage: serviceError.message
        })
      }

      return { success: true, service }
    } else if (method === 'PUT') {
      // Handle service update
      const body = await readBody(event)
      const serviceId = getQuery(event).id

      if (!serviceId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Service ID is required'
        })
      }

      const { data: service, error: serviceError } = await supabase
        .from('service')
        .update({
          name: body.name,
          description: body.description,
          price: body.price,
          categories: body.categories,
          duration_service_in_s: body.duration_service_in_s
        })
        .eq('id', serviceId)
        .select()
        .single()

      if (serviceError) {
        console.error('Service update error:', serviceError)
        throw createError({
          statusCode: 400,
          statusMessage: serviceError.message
        })
      }

      return { success: true, service }
    } else if (method === 'DELETE') {
      // Handle service deletion
      const serviceId = getQuery(event).id

      if (!serviceId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Service ID is required'
        })
      }

      const { error: serviceError } = await supabase
        .from('service')
        .delete()
        .eq('id', serviceId)

      if (serviceError) {
        console.error('Service deletion error:', serviceError)
        throw createError({
          statusCode: 400,
          statusMessage: serviceError.message
        })
      }

      return { success: true }
    } else {
      // GET - Fetch services
      const { data: services, error } = await supabase
        .from('service')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch services'
        })
      }

      return services || []
    }
  } catch (error) {
    console.error('Services API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
