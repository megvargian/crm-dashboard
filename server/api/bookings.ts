/* eslint-disable no-case-declarations */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

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

const createBookingSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  client_profile_id: z.string().uuid('Invalid client profile ID').optional(),
  client_business_id: z.string().uuid('Invalid client business ID').nullable().optional(),
  employee_id: z.string().uuid('Invalid employee ID'),
  service_id: z.string().uuid('Invalid service ID'),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  start_time: z.string().refine((val) => {
    // Accept either HH:MM format or ISO timestamp
    return /^\d{2}:\d{2}$/.test(val) || !isNaN(Date.parse(val))
  }, 'Time must be in HH:MM format or valid ISO timestamp'),
  notes: z.string().optional()
})

const updateBookingSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID').optional(),
  client_profile_id: z.string().uuid('Invalid client profile ID').optional(),
  client_business_id: z.string().uuid('Invalid client business ID').nullable().optional(),
  employee_id: z.string().uuid('Invalid employee ID').optional(),
  service_id: z.string().uuid('Invalid service ID').optional(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  start_time: z.string().refine((val) => {
    // Accept either HH:MM format or ISO timestamp
    return /^\d{2}:\d{2}$/.test(val) || !isNaN(Date.parse(val))
  }, 'Time must be in HH:MM format or valid ISO timestamp').optional(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  notes: z.string().optional()
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

    // Try to get token from Authorization header first, then from Supabase cookies
    let token = null
    let user = null

    const authorizationHeader = getHeader(event, 'authorization')
    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      token = authorizationHeader.replace('Bearer ', '')
      const { data: userData, error: userError } = await supabase.auth.getUser(token)
      if (!userError && userData.user) {
        user = userData.user
      }
    }

    // If no valid token from header, try to get session from cookies
    if (!user) {
      try {
        // Get session from cookies using the public supabase client
        const publicSupabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!)

        // Get cookies from request
        const cookies = parseCookies(getHeader(event, 'cookie') || '')

        // Check for Supabase session in cookies
        if (cookies['sb-access-token'] || cookies['supabase.auth.token']) {
          const sessionToken = cookies['sb-access-token'] || cookies['supabase.auth.token']
          if (sessionToken) {
            const { data: userData, error: userError } = await publicSupabase.auth.getUser(sessionToken)
            if (!userError && userData.user) {
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

    const method = getMethod(event)

    // Check if user is admin (client_profile with admin role)
    const { data: clientProfile } = await supabase
      .from('client_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin = clientProfile?.role === 'admin'

    // Check if user is an employee
    const { data: employee } = await supabase
      .from('employee')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    const isEmployee = !!employee

    if (isEmployee) {
      // Employees: only allow GET requests to view their own bookings
      if (method !== 'GET') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Employees can only view bookings'
        })
      }

      // Return only bookings assigned to this employee
      const { data: bookings, error } = await supabase
        .from('booking')
        .select(`
          *,
          client_profile(*),
          employee(*),
          service(*)
        `)
        .eq('employee_id', user.id)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to fetch bookings: ${error.message}`
        })
      }

      return bookings || []
    }

    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }

    switch (method) {
      case 'GET':
        // Admin users: return ALL bookings for all employees and customers with relations
        const { data: allBookings, error: fetchError } = await supabase
          .from('booking')
          .select(`
            *,
            client_profile(*),
            employee(*),
            service(*)
          `)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true })

        if (fetchError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to fetch bookings: ${fetchError.message}`
          })
        }

        return allBookings || []

      case 'POST':
        const body = await readBody(event)
        const validatedData = createBookingSchema.parse(body)

        // Use provided client_profile_id and client_business_id if available, otherwise look them up
        let actualClientProfileId = validatedData.client_profile_id
        let actualClientBusinessId = validatedData.client_business_id

        if (!actualClientProfileId) {
          // Fallback: Look up client_profile data based on customer_id
          const { data: clientProfile, error: clientProfileError } = await supabase
            .from('client_profile')
            .select('id, client_business_id')
            .eq('customer_id', validatedData.customer_id)
            .single()

          if (clientProfileError || !clientProfile) {
            throw createError({
              statusCode: 400,
              statusMessage: 'No client profile found for this customer'
            })
          }

          actualClientProfileId = clientProfile.id
          actualClientBusinessId = clientProfile.client_business_id || null
        }

        // Get service details to calculate end time and price
        const { data: service, error: serviceError } = await supabase
          .from('service')
          .select('price, duration_service_in_s')
          .eq('id', validatedData.service_id)
          .single()

        if (serviceError || !service) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid service ID'
          })
        }

        // Calculate start and end timestamps
        let startTime: Date
        if (/^\d{2}:\d{2}$/.test(validatedData.start_time)) {
          // HH:MM format - combine with booking date
          startTime = new Date(`${validatedData.booking_date}T${validatedData.start_time}:00`)
        } else {
          // ISO timestamp format
          startTime = new Date(validatedData.start_time)
        }

        console.log('🔧 Booking calculation debug:')
        console.log('📅 Start time:', startTime.toISOString())
        console.log('⏱️  Service duration (seconds):', service.duration_service_in_s)

        const endTime = new Date(startTime.getTime() + (service.duration_service_in_s * 1000))
        console.log('🏁 End time:', endTime.toISOString())

        const bookingData = {
          customer_id: validatedData.customer_id,
          client_profile_id: actualClientProfileId,
          client_business_id: actualClientBusinessId || null,
          employee_id: validatedData.employee_id,
          service_id: validatedData.service_id,
          booking_date: validatedData.booking_date,
          start_time: startTime.toISOString(), // Full timestamp
          end_time: endTime.toISOString(), // Full timestamp
          total_price: service.price,
          status: 'pending' as const,
          notes: validatedData.notes
        }

        const { data: newBooking, error: insertError } = await supabase
          .from('booking')
          .insert(bookingData)
          .select(`
            *,
            client_profile(*),
            employee(*),
            service(*)
          `)
          .single()

        if (insertError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to create booking: ${insertError.message}`
          })
        }

        return newBooking

      case 'PUT':
        const updateBody = await readBody(event)
        const { id: bookingId } = getQuery(event)

        if (!bookingId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Booking ID is required'
          })
        }

        const validatedUpdateData = updateBookingSchema.parse(updateBody)
        const finalUpdateData = { ...validatedUpdateData }

        // If customer is being changed, update client_profile_id and client_business_id
        if (validatedUpdateData.customer_id && !validatedUpdateData.client_profile_id) {
          const { data: clientProfile, error: clientProfileError } = await supabase
            .from('client_profile')
            .select('id, client_business_id')
            .eq('customer_id', validatedUpdateData.customer_id)
            .single()

          if (clientProfileError || !clientProfile) {
            throw createError({
              statusCode: 400,
              statusMessage: 'No client profile found for this customer'
            })
          }

          finalUpdateData.client_profile_id = clientProfile.id
          finalUpdateData.client_business_id = clientProfile.client_business_id || null
        }

        // If service is being changed, recalculate end time and price
        if (validatedUpdateData.service_id || validatedUpdateData.start_time || validatedUpdateData.booking_date) {
          const currentBookingQuery = await supabase
            .from('booking')
            .select('service_id, booking_date, start_time')
            .eq('id', bookingId)
            .single()

          if (currentBookingQuery.error) {
            throw createError({
              statusCode: 404,
              statusMessage: 'Booking not found'
            })
          }

          const serviceId = validatedUpdateData.service_id || currentBookingQuery.data.service_id
          const bookingDate = validatedUpdateData.booking_date || currentBookingQuery.data.booking_date

          // Handle start_time - it might be a timestamp or just time string
          let startTimeForCalc = validatedUpdateData.start_time
          let startDateTime: Date
          if (validatedUpdateData.start_time) {
            if (/^\d{2}:\d{2}$/.test(validatedUpdateData.start_time)) {
              // HH:MM format - combine with booking date
              startDateTime = new Date(`${bookingDate}T${validatedUpdateData.start_time}:00`)
              startTimeForCalc = validatedUpdateData.start_time
            } else {
              // ISO timestamp format
              startDateTime = new Date(validatedUpdateData.start_time)
              startTimeForCalc = startDateTime.toTimeString().substring(0, 5)
            }
          } else if (currentBookingQuery.data.start_time) {
            // Use existing start_time
            if (currentBookingQuery.data.start_time.includes('T')) {
              const existingDateTime = new Date(currentBookingQuery.data.start_time)
              startTimeForCalc = existingDateTime.toTimeString().substring(0, 5)
              startDateTime = new Date(`${bookingDate}T${startTimeForCalc}:00`)
            } else {
              startTimeForCalc = currentBookingQuery.data.start_time
              startDateTime = new Date(`${bookingDate}T${startTimeForCalc}:00`)
            }
          }

          const { data: updatedService, error: serviceError } = await supabase
            .from('service')
            .select('price, duration_service_in_s')
            .eq('id', serviceId)
            .single()

          if (serviceError || !updatedService) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Invalid service ID'
            })
          }

          console.log('🔧 Update booking calculation debug:')
          console.log('📅 Start time for calc:', startDateTime.toISOString())
          console.log('⏱️  Service duration (seconds):', updatedService.duration_service_in_s)

          const endDateTime = new Date(startDateTime.getTime() + (updatedService.duration_service_in_s * 1000))
          console.log('🏁 End time calculated:', endDateTime.toISOString())

          // Update with full timestamps if start_time changed
          if (validatedUpdateData.start_time) {
            finalUpdateData.start_time = startDateTime.toISOString()
          }
          finalUpdateData.end_time = endDateTime.toISOString()
          finalUpdateData.total_price = updatedService.price
        }

        const { data: updatedBooking, error: updateError } = await supabase
          .from('booking')
          .update(finalUpdateData)
          .eq('id', bookingId)
          .select(`
            *,
            client_profile(*),
            employee(*),
            service(*)
          `)
          .single()

        if (updateError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to update booking: ${updateError.message}`
          })
        }

        return updatedBooking

      case 'DELETE':
        const { id: deleteId } = getQuery(event)

        if (!deleteId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Booking ID is required'
          })
        }

        const { error: deleteError } = await supabase
          .from('booking')
          .delete()
          .eq('id', deleteId)

        if (deleteError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to delete booking: ${deleteError.message}`
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
    console.error('Bookings API error:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
