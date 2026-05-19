'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useSettings } from '@/components/SettingsProvider'
import { calcScore, ratingBadge } from '@/lib/utils'

// ─── Success banner (needs Suspense because of useSearchParams) ───────────────

function RatedBanner() {
  const searchParams = useSearchParams()
  if (!searchParams.get('rated')) return null
  return (
    <div className="bg-green-700 text-white text-sm text-center px-4 py-3 font-medium">
      ✓ Ratings submitted — player profiles have been updated.
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
}

type GameSession = {
  id: string
  session_date: string
  notes: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse YYYY-MM-DD as local date to avoid UTC-offset day shifts
function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({ player, weights }: { player: Player; weights: { batting: number; bowling: number; fielding: number } }) {
  const overall = calcScore(player, weights)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-900 text-sm leading-snug break-words min-w-0">
          {player.name}
        </h3>
        <span className={`shrink-0 text-sm font-bold px-2 py-0.5 rounded-lg tabular-nums ${ratingBadge(overall)}`}>
          {overall.toFixed(1)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { label: 'Bat', val: player.batting_rating },
          { label: 'Bowl', val: player.bowling_rating },
          { label: 'Field', val: player.fielding_rating },
        ].map(({ label, val }) => (
          <div key={label} className={`rounded-lg py-1.5 ${ratingBadge(val)}`}>
            <div className="text-xs font-medium opacity-60 leading-none mb-0.5">{label}</div>
            <div className="text-sm font-bold tabular-nums">{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SessionRow ───────────────────────────────────────────────────────────────

function SessionRow({
  session,
  isAdmin,
  onDelete,
}: {
  session: GameSession
  isAdmin: boolean
  onDelete: (id: string) => void
}) {
  return (
    <div className="group bg-white rounded-xl border border-gray-100 px-4 py-3.5 flex items-center justify-between hover:border-green-200 hover:shadow-sm transition-all">
      <Link href={`/session/${session.id}`} className="min-w-0 flex-1">
        <div className="font-semibold text-gray-900 text-sm">{formatDate(session.session_date)}</div>
        {session.notes && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">{session.notes}</div>
        )}
      </Link>
      <div className="shrink-0 flex items-center gap-3 ml-3">
        {isAdmin && (
          <button
            onClick={() => onDelete(session.id)}
            className="text-gray-300 hover:text-red-500 transition-colors p-1 -m-1"
            aria-label="Delete session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
        <Link
          href={`/session/${session.id}`}
          className="text-green-700 text-sm font-semibold group-hover:translate-x-0.5 transition-transform"
        >
          View →
        </Link>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, supabase, isLoading: authLoading } = useAuth()
  const { weights } = useSettings()
  const [players, setPlayers] = useState<Player[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: playerData }, { data: sessionData }] = await Promise.all([
        supabase
          .from('players')
          .select('id, name, batting_rating, bowling_rating, fielding_rating')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('sessions')
          .select('id, session_date, notes, created_at, teams!inner(id)')
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      setPlayers(playerData ?? [])
      setSessions(sessionData ?? [])
      setFetching(false)
    }
    load()
  }, [supabase])

  const showNewSession = !authLoading && user !== null

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return
    await supabase.from('teams').delete().eq('session_id', id)
    await supabase.from('session_players').delete().eq('session_id', id)
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <Suspense>
        <RatedBanner />
      </Suspense>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-green-900 text-white px-4 pt-14 pb-16 text-center relative overflow-hidden">
        {/* subtle pitch-line decoration */}
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, white 39px, white 40px)' }}
        />

        <div className="relative">
          <div className="text-6xl mb-4 select-none drop-shadow-lg">🏏</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Cricket Team Balancer
          </h1>
          <p className="text-green-300 text-lg sm:text-xl font-medium mb-8">
            Fair teams. Every session.
          </p>

          {showNewSession && (
            <Link
              href="/session/new"
              className="inline-flex items-center gap-2 bg-white text-green-900 font-bold px-6 py-3 rounded-xl text-sm hover:bg-green-50 active:scale-95 transition-all shadow-lg"
            >
              <span className="text-base">+</span> Start New Session
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── Current Squad ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Current Squad</h2>
            {!fetching && players.length > 0 && (
              <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
                {players.length} players
              </span>
            )}
          </div>

          {fetching ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-28 animate-pulse" />
              ))}
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="text-4xl mb-2 opacity-40">🏏</div>
              <p className="text-gray-400 text-sm">No players in the squad yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {players.map(p => <PlayerCard key={p.id} player={p} weights={weights} />)}
            </div>
          )}
        </section>

        {/* ── Recent Sessions ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Sessions</h2>
            {!fetching && sessions.length > 0 && (
              <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {fetching ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 h-14 animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">No sessions recorded yet.</p>
              {showNewSession && (
                <Link href="/session/new" className="text-green-700 text-sm font-semibold hover:underline mt-1 inline-block">
                  Start your first session →
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isAdmin={!!user}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Footer nudge ──────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-gray-300 pb-4">
          Cricket Team Balancer · Built for fair play
        </footer>

      </div>
    </div>
  )
}
