/* eslint-disable no-case-declarations */
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const assignServiceSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  service_id: z.string().uuid('Invalid service ID')
})

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get authorization header
    const authorizationHeader = getHeader(event, 'authorization')
    if (!authorizationHeader) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authorization header is required'
      })
    }

    const token = authorizationHeader.replace('Bearer ', '')

    // Verify token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token'
      })
    }

    // Check if user is admin client
    const { data: clientProfile } = await supabase
      .from('client_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!clientProfile || clientProfile.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }

    const method = getMethod(event)

    switch (method) {
      case 'GET':
        const { employee_id } = getQuery(event)

        let query = supabase
          .from('employee_services')
          .select(`
            *,
            service:service_id(*)
          `)

        if (employee_id) {
          query = query.eq('employee_id', employee_id)
        }

        const { data, error } = await query

        if (error) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to fetch employee services: ${error.message}`
          })
        }

        return data || []

      case 'POST':
        const body = await readBody(event)
        const validatedData = assignServiceSchema.parse(body)

        const { data: newAssignment, error: insertError } = await supabase
          .from('employee_services')
          .insert(validatedData)
          .select()
          .single()

        if (insertError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to assign service: ${insertError.message}`
          })
        }

        return newAssignment

      case 'DELETE':
        const { employee_id: empId, service_id: servId } = getQuery(event)

        if (!empId || !servId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Employee ID and Service ID are required'
          })
        }

        const { error: deleteError } = await supabase
          .from('employee_services')
          .delete()
          .eq('employee_id', empId)
          .eq('service_id', servId)

        if (deleteError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to remove service assignment: ${deleteError.message}`
          })
        }

        return { success: true }

      default:
        throw createError({
          statusCode: 405,
          statusMessage: 'Method not allowed'
        })
    }
  } catch (error) {
    console.error('Employee Services API error:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
