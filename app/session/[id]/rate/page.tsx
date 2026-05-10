'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useSettings } from '@/components/SettingsProvider'
import { calcScore } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRating = {
  id: string
  name: string
  // Current stored ratings (for the weighted update formula)
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
  // Today's slider values (initialised from current ratings)
  batting_score: number
  bowling_score: number
  fielding_score: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingTextColor(val: number) {
  if (val >= 7) return 'text-green-600'
  if (val >= 4) return 'text-amber-500'
  return 'text-red-500'
}

function round1dp(n: number) {
  return Math.round(n * 10) / 10
}

// ─── RatingSlider ─────────────────────────────────────────────────────────────

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-bold tabular-nums w-8 text-right ${ratingTextColor(value)}`}>
          {value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 accent-green-700 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RatePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user, supabase, isLoading: authLoading } = useAuth()
  const { weights } = useSettings()
  const router = useRouter()
  const [players, setPlayers] = useState<PlayerRating[]>([])
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return

    type SpRow = {
      player_id: string
      players: {
        id: string
        name: string
        batting_rating: number
        bowling_rating: number
        fielding_rating: number
      } | null
    }

    supabase
      .from('session_players')
      .select('player_id, players(id, name, batting_rating, bowling_rating, fielding_rating)')
      .eq('session_id', id)
      .eq('was_present', true)
      .then(({ data }) => {
        const list: PlayerRating[] = ((data as unknown as SpRow[]) ?? [])
          .filter(row => row.players !== null)
          .map(row => {
            const p = row.players!
            return {
              ...p,
              // Sliders default to current ratings
              batting_score: p.batting_rating,
              bowling_score: p.bowling_rating,
              fielding_score: p.fielding_rating,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))

        setPlayers(list)
        setFetching(false)
      })
  }, [user, id, supabase])

  const updateScore = (
    playerId: string,
    field: 'batting_score' | 'bowling_score' | 'fielding_score',
    val: number
  ) => {
    setPlayers(prev => prev.map(p => (p.id === playerId ? { ...p, [field]: val } : p)))
  }

  const handleSubmit = async () => {
    if (submitting || players.length === 0) return
    setSubmitting(true)

    await Promise.all(
      players.map(async p => {
        // 1. Record today's scores in session_players
        await supabase
          .from('session_players')
          .update({
            batting_score: p.batting_score,
            bowling_score: p.bowling_score,
            fielding_score: p.fielding_score,
          })
          .eq('session_id', id)
          .eq('player_id', p.id)

        // 2. Update aggregate player ratings: 70% existing + 30% today's score
        await supabase
          .from('players')
          .update({
            batting_rating:  round1dp(0.7 * p.batting_rating  + 0.3 * p.batting_score),
            bowling_rating:  round1dp(0.7 * p.bowling_rating  + 0.3 * p.bowling_score),
            fielding_rating: round1dp(0.7 * p.fielding_rating + 0.3 * p.fielding_score),
          })
          .eq('id', p.id)
      })
    )

    router.push('/?rated=1')
  }

  if (authLoading || !user) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
          <span>›</span>
          <Link href={`/session/${id}/teams`} className="hover:text-gray-600 transition-colors">
            Teams
          </Link>
          <span>›</span>
          <span>Rate Players</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Rate Players</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Rate today&apos;s performance. Each player&apos;s profile will update using a weighted average
          (70% existing · 30% today).
        </p>
      </div>

      {fetching ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-40 animate-pulse" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No players found for this session.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {players.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{p.name}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                  Current overall:{' '}
                  <span className="font-semibold text-gray-600">
                    {calcScore(p, weights).toFixed(1)}
                  </span>
                </span>
              </div>
              <div className="space-y-4">
                <RatingSlider
                  label="Batting"
                  value={p.batting_score}
                  onChange={v => updateScore(p.id, 'batting_score', v)}
                />
                <RatingSlider
                  label="Bowling"
                  value={p.bowling_score}
                  onChange={v => updateScore(p.id, 'bowling_score', v)}
                />
                <RatingSlider
                  label="Fielding"
                  value={p.fielding_score}
                  onChange={v => updateScore(p.id, 'fielding_score', v)}
                />
              </div>
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-sm mt-2"
          >
            {submitting ? 'Saving ratings…' : 'Submit Ratings & Update Profiles →'}
          </button>

          <p className="text-center text-xs text-gray-400 -mt-1">
            This will update each player&apos;s batting, bowling, and fielding ratings.
          </p>
        </div>
      )}
    </div>
  )
}
