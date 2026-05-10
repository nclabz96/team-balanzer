'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useSettings } from '@/components/SettingsProvider'
import { calcScore, ratingTextColor } from '@/lib/utils'
import Spinner from '@/components/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewSessionPage() {
  const { user, supabase, isLoading: authLoading } = useAuth()
  const { weights } = useSettings()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [fetching, setFetching] = useState(true)
  const [date, setDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from('players')
      .select('id, name, batting_rating, bowling_rating, fielding_rating')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setPlayers(data ?? [])
        setFetching(false)
      })
  }, [user, supabase])

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleSubmit = async () => {
    if (selected.size < 4 || saving) return
    setSaving(true)

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({ session_date: date, notes: notes.trim() || null })
      .select()
      .single()

    if (error || !session) { setSaving(false); return }

    await supabase.from('session_players').insert(
      Array.from(selected).map(player_id => ({ session_id: session.id, player_id, was_present: true }))
    )

    router.push(`/session/${session.id}/teams`)
  }

  if (authLoading || !user) return null

  const remaining = Math.max(0, 4 - selected.size)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Session</h1>
        <p className="text-sm text-gray-500 mt-0.5">Select who&apos;s playing and generate balanced teams.</p>
      </div>

      {/* Session details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="font-bold text-gray-900 mb-4">Session Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Tuesday evening game"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Player selection */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-gray-900">Who&apos;s Playing?</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {selected.size} of {players.length} selected
            </p>
          </div>
          {!fetching && players.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => setSelected(new Set(players.map(p => p.id)))}
                className="text-xs text-green-700 hover:text-green-900 font-semibold"
              >
                All
              </button>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
              >
                None
              </button>
            </div>
          )}
        </div>

        {fetching ? (
          <Spinner className="py-10" />
        ) : players.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            No active players. Add players first in the Admin Panel.
          </div>
        ) : (
          <div className="flex flex-col">
            {players.map((p, i) => {
              const score = calcScore(p, weights)
              const checked = selected.has(p.id)
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 py-3 px-2 -mx-2 cursor-pointer rounded-lg transition-colors ${i !== 0 ? 'border-t border-gray-50' : ''} ${checked ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    className="w-4 h-4 accent-green-700 shrink-0"
                  />
                  <span className="flex-1 text-sm font-medium text-gray-900">{p.name}</span>
                  <span className={`text-sm font-bold tabular-nums ${ratingTextColor(score)}`}>
                    {score.toFixed(1)}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={selected.size < 4 || saving}
        className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-sm"
      >
        {saving
          ? 'Creating session…'
          : remaining > 0
          ? `Select ${remaining} more player${remaining !== 1 ? 's' : ''} to continue`
          : `Generate Teams (${selected.size} players) →`}
      </button>
    </div>
  )
}
