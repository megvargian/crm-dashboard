# Quick Setup Instructions

## What I've Created

✅ **Login Page** (`/login`) - Authentication with email/password
✅ **Signup Page** (`/signup`) - User registration
✅ **Auth Middleware** - Automatic redirect to login if not authenticated
✅ **Logout Function** - Added to user menu dropdown

## Setup Steps (5 minutes)

### 1. Install Supabase Module
```bash
pnpm add @nuxtjs/supabase
```

### 2. Update `nuxt.config.ts`
Add `'@nuxtjs/supabase'` to the modules array:

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@nuxtjs/supabase'  // ← Add this
  ],

  supabase: {
    redirect: false  // We handle redirects in middleware
  },

  // ... rest of config
})
```

### 3. Get Supabase Credentials
1. Go to https://supabase.com/dashboard
2. Create a new project (or use existing)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL**
   - **anon public** key

### 4. Update `.env` File
Edit `.env` in the project root:

```env
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Enable Email Auth in Supabase
1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. (Optional) Disable email confirmation for testing:
   - Go to **Authentication** → **Settings**
   - Disable "Enable email confirmations"

### 6. Run the App
```bash
pnpm install
pnpm dev
```

Visit http://localhost:3000 - you'll be redirected to `/login`

## Testing

1. **Create an account**: Go to `/signup`
2. **Sign in**: Go to `/login`
3. **Access dashboard**: After login, you'll see the dashboard
4. **Logout**: Click user menu (bottom left) → Log out

## Files Created

- `app/pages/login.vue` - Login page
- `app/pages/signup.vue` - Signup page
- `app/middleware/auth.global.ts` - Auth protection
- `.env` - Environment variables (add your credentials)
- `.env.example` - Template for credentials

## Files Modified

- `app/components/UserMenu.vue` - Added logout functionality

## Troubleshooting

**Can't find useSupabaseClient**: Install the module with `pnpm add @nuxtjs/supabase`

**Invalid API key**: Check your `.env` file has correct credentials

**Email not confirmed**: Disable email confirmation in Supabase or check your inbox

**CORS errors**: Add http://localhost:3000 to Site URL in Supabase Authentication settings

## Next Steps

- [ ] Customize login/signup page design
- [ ] Add password reset functionality
- [ ] Create user profiles table
- [ ] Add social auth (Google, GitHub, etc.)
- [ ] Implement role-based access control

See `SUPABASE_SETUP.md` for detailed documentation.
