import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'
import type { Customer } from '~/types'

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)

  // Get the authorization header
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing or invalid authorization header'
    })
  }

  const token = authHeader.replace('Bearer ', '')

  // Verify the token with Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired token'
    })
  }

  try {
    switch (method) {
      case 'GET':
        return await getCustomers()

      case 'POST':
        const newCustomerData = await readBody(event)
        return await createCustomer(newCustomerData)

      case 'PUT':
        const updateData = await readBody(event)
        const customerId = query.id as string
        if (!customerId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Customer ID is required for updates'
          })
        }
        return await updateCustomer(customerId, updateData)

      case 'DELETE':
        const customerIdToDelete = query.id as string
        if (!customerIdToDelete) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Customer ID is required for deletion'
          })
        }
        return await deleteCustomer(customerIdToDelete)

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

async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customer')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch customers: ${error.message}`
    })
  }

  return data || []
}

async function createCustomer(customerData: Partial<Customer>): Promise<Customer> {
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

async function updateCustomer(customerId: string, customerData: Partial<Customer>): Promise<Customer> {
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

async function deleteCustomer(customerId: string): Promise<{ message: string }> {
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
