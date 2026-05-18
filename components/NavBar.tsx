'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

export default function NavBar() {
  const { user, supabase } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-green-900 text-white px-4 py-3 flex items-center justify-between shadow-md">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
        🏏 <span>Cricket Team Balancer</span>
      </Link>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link
              href="/"
              className="text-sm font-medium text-green-100 hover:text-white transition-colors hidden sm:inline"
            >
              Home
            </Link>
            <Link
              href="/admin"
              className="text-sm font-medium text-green-100 hover:text-white transition-colors hidden sm:inline"
            >
              Players
            </Link>
            <Link
              href="/admin/settings"
              className="text-sm font-medium text-green-100 hover:text-white transition-colors hidden sm:inline"
            >
              ⚙ Settings
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm bg-green-700 hover:bg-green-600 active:bg-green-800 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm text-green-400 hover:text-green-200 transition-colors"
          >
            Admin Login
          </Link>
        )}
      </div>
    </nav>
  )
}
