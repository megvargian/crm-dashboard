import { createClient } from '@supabase/supabase-js'
import type { Customer } from '~/types'

// Helper function to parse cookies
function parseCookies(cookieHeader: string) {
  const cookies: Record<string, string> = {}
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(c => c.trim())
      if (name && value) {
        cookies[name] = decodeURIComponent(value)
      }
    })
  }
  return cookies
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const method = getMethod(event)
  const query = getQuery(event)

  // Check if environment variables are available
  if (!config.public.supabaseUrl && !config.supabaseUrl) {
    console.error('Missing SUPABASE_URL environment variable')
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error: Missing Supabase URL'
    })
  }

  if (!config.supabaseServiceKey && !config.supabase.serviceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error: Missing Supabase service key'
    })
  }

  // Initialize Supabase client with service role key for server-side operations
  const supabase = createClient(
    config.supabaseUrl || config.public.supabaseUrl!,
    config.supabaseServiceKey || config.supabase.serviceKey!
  )

  // Try to get token from Authorization header first, then from Supabase cookies
  let token = null
  let user = null

  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '')
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (!authError && userData.user) {
      user = userData.user
    }
  }

  // If no valid token from header, try to get session from cookies
  if (!user) {
    try {
      // Get session from cookies using the public supabase client
      const publicSupabase = createClient(
        config.public.supabaseUrl!,
        config.public.supabaseAnonKey!
      )

      // Get cookies from request
      const cookies = parseCookies(getHeader(event, 'cookie') || '')

      // Check for Supabase session in cookies
      if (cookies['sb-access-token'] || cookies['supabase.auth.token']) {
        const sessionToken = cookies['sb-access-token'] || cookies['supabase.auth.token']
        if (sessionToken) {
          const { data: userData, error: authError } = await publicSupabase.auth.getUser(sessionToken)
          if (!authError && userData.user) {
            user = userData.user
            token = sessionToken
          }
        }
      }
    } catch (error) {
      console.error('Failed to get session from cookies:', error)
    }
  }

  if (!user || !token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required - please login'
    })
  }

  try {
    switch (method) {
      case 'GET':
        return await getCustomers(supabase)

      case 'POST':
        const newCustomerData = await readBody(event)
        return await createCustomer(supabase, newCustomerData)

      case 'PUT':
        const updateData = await readBody(event)
        const customerId = query.id as string
        if (!customerId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Customer ID is required for updates'
          })
        }
        return await updateCustomer(supabase, customerId, updateData)

      case 'DELETE':
        const customerIdToDelete = query.id as string
        if (!customerIdToDelete) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Customer ID is required for deletion'
          })
        }
        return await deleteCustomer(supabase, customerIdToDelete)

      default:
        throw createError({
          statusCode: 405,
          statusMessage: 'Method not allowed'
        })
    }
  } catch (error: any) {
    console.error('Customers API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})

async function getCustomers(supabase: any): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from('customer')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error in getCustomers:', error)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch customers: ${error.message}`
      })
    }

    console.log(`Successfully fetched ${data?.length || 0} customers`)
    return data || []
  } catch (error: any) {
    console.error('Error in getCustomers function:', error)
    throw error
  }
}

async function createCustomer(supabase: any, customerData: Partial<Customer>): Promise<Customer> {
  // Validate required fields
  if (!customerData.full_name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Full name is required'
    })
  }

  // Prepare data for insertion
  const insertData = {
    full_name: customerData.full_name,
    email: customerData.email || null,
    phone_number: customerData.phone_number || null,
    gender: customerData.gender || null,
    date_of_birth: customerData.date_of_birth || null
  }

  const { data, error } = await supabase
    .from('customer')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: `Failed to create customer: ${error.message}`
    })
  }

  return data
}

async function updateCustomer(supabase: any, customerId: string, customerData: Partial<Customer>): Promise<Customer> {
  // Validate required fields
  if (!customerData.full_name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Full name is required'
    })
  }

  // Prepare data for update (exclude id and created_at)
  const updateData = {
    full_name: customerData.full_name,
    email: customerData.email || null,
    phone_number: customerData.phone_number || null,
    gender: customerData.gender || null,
    date_of_birth: customerData.date_of_birth || null
  }

  const { data, error } = await supabase
    .from('customer')
    .update(updateData)
    .eq('id', customerId)
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: `Failed to update customer: ${error.message}`
    })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Customer not found'
    })
  }

  return data
}

async function deleteCustomer(supabase: any, customerId: string): Promise<{ message: string }> {
  const { error } = await supabase
    .from('customer')
    .delete()
    .eq('id', customerId)

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: `Failed to delete customer: ${error.message}`
    })
  }

  return { message: 'Customer deleted successfully' }
}
