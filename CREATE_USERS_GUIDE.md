# Creating Users for Your CRM Dashboard

Since the API endpoints have Windows/ESM compatibility issues, here are alternative ways to create users:

## Option 1: Create Users Directly in Supabase Dashboard

### For Clients:
1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - Email: `client@example.com`
   - Password: `SecurePassword123!`
   - Auto Confirm User: ✅ Yes
4. Click **Create user**
5. Copy the user ID
6. Go to **Table Editor** → **client_profile**
7. Insert new row:
   - `id`: (paste the user ID from step 5)
   - `email`: `client@example.com`
   - `first_name`: `John`
   - `last_name`: `Doe`
   - Other fields as needed

### For Employees:
Same process but use the **employee** table instead.

## Option 2: Use Supabase SQL Editor

Run this SQL to create a client with auth user:

```sql
-- This will give you the user's credentials
-- Email: test@client.com
-- Password: YourPassword123!

-- First, you need to create the user via Supabase Dashboard Auth section
-- Then run this with the user ID:

INSERT INTO client_profile (id, email, first_name, last_name, role)
VALUES (
  'USER_ID_FROM_AUTH_DASHBOARD',
  'test@client.com',
  'Test',
  'Client',
  'client'
);
```

## Option 3: Simple Node Script (Run Once)

Create `scripts/create-user.mjs`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const serviceKey = 'YOUR_SERVICE_ROLE_KEY'

const supabase = createClient(supabaseUrl, serviceKey)

async function createClient(email, password, firstName, lastName) {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: 'client'
    }
  })

  if (authError) {
    console.error('Auth error:', authError)
    return
  }

  const { error: profileError } = await supabase
    .from('client_profile')
    .insert({
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'client'
    })

  if (profileError) {
    console.error('Profile error:', profileError)
    return
  }

  console.log('✅ User created successfully!')
  console.log('Email:', email)
  console.log('Password:', password)
}

// Run it
createClient('test@client.com', 'SecurePass123!', 'Test', 'Client')
```

Run with: `node scripts/create-user.mjs`

## Testing Login

After creating a user with any method above, test login at:
`http://localhost:3001/login`

Use the email and password you set.
