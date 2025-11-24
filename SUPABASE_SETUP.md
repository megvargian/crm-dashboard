# Supabase Setup Guide for Dashboard

## Prerequisites
- A Supabase account (sign up at https://supabase.com)
- Node.js and pnpm installed

## Step 1: Install Supabase Module

Run this command in your terminal:

```bash
pnpm add @nuxtjs/supabase
```

## Step 2: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - Project name: `crm-dashboard` (or your preferred name)
   - Database password: (create a strong password)
   - Region: Choose closest to your users
4. Wait for the project to be created (~2 minutes)

## Step 3: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

## Step 4: Configure Environment Variables

1. Create a `.env` file in the root of your project:

```bash
# Copy the example file
cp .env.example .env
```

2. Edit `.env` and add your credentials:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-anon-key-here
```

**Important:** Add `.env` to your `.gitignore` to keep credentials secure!

## Step 5: Update nuxt.config.ts

Add the Supabase module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@nuxtjs/supabase'  // Add this line
  ],

  supabase: {
    redirect: false  // We handle redirects in middleware
  },

  // ... rest of your config
})
```

## Step 6: Enable Email Authentication in Supabase

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Make sure **Email** provider is enabled
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize confirmation and password reset emails

## Step 7: Optional - Set Up Email Confirmation

By default, Supabase requires email confirmation. You can:

**Option A: Keep email confirmation** (recommended for production)
- Users must verify email before logging in
- More secure

**Option B: Disable email confirmation** (for development)
1. Go to **Authentication** → **Settings**
2. Under "Email Auth", disable "Enable email confirmations"

## Step 8: Create a Test User (Optional)

You can create a test user directly in Supabase:

1. Go to **Authentication** → **Users**
2. Click "Add user"
3. Select "Create new user"
4. Enter email and password
5. Click "Create user"

## Step 9: Install Dependencies & Run

```bash
# Install the new Supabase module
pnpm install

# Run the development server
pnpm dev
```

Visit `http://localhost:3000/login` to test your login page!

## Troubleshooting

### Issue: "Invalid API key"
- Double-check your `SUPABASE_KEY` in `.env`
- Make sure you're using the **anon** key, not the **service_role** key
- Restart your dev server after changing `.env`

### Issue: "Email not confirmed"
- Check your email for confirmation link
- Or disable email confirmation in Supabase settings (see Step 7)

### Issue: Module not found
- Run `pnpm install` again
- Clear Nuxt cache: `rm -rf .nuxt` then `pnpm dev`

### Issue: CORS errors
- Make sure your `SUPABASE_URL` is correct
- Check that your site URL is configured in Supabase:
  - Go to **Authentication** → **URL Configuration**
  - Add `http://localhost:3000` to Site URL for development

## Additional Features to Add

### Row Level Security (RLS)
To secure your database tables:

1. Go to **Database** → **Tables**
2. Click on a table (e.g., create a `profiles` table)
3. Enable RLS
4. Add policies for read/write access

Example policy for profiles table:
```sql
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);
```

### Add User Profile
Create a `profiles` table to store additional user data:

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Next Steps

1. ✅ Test login/signup functionality
2. Add logout functionality to your dashboard
3. Create a profile page for users
4. Add password reset functionality
5. Implement role-based access control (RBAC)
6. Set up Row Level Security (RLS) for your database tables

## Support

- Supabase Documentation: https://supabase.com/docs
- Nuxt Supabase Module: https://supabase.nuxtjs.org/
- GitHub Issues: Report problems in your repository
