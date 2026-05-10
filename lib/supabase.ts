import { createBrowserClient, createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser (Client Component) — use inside 'use client' components
export const createClient = () => createBrowserClient(url, key)

// Server Component — reads session from request cookies
export const createServerSupabaseClient = () =>
  createServerClient(url, key, {
    cookies: {
      getAll: () => cookies().getAll(),
    },
  })
