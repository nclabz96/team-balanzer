'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/ToastProvider'
import { useSettings } from '@/components/SettingsProvider'
import { calcScore, ratingBadge, ratingTextColor } from '@/lib/utils'
import Spinner from '@/components/Spinner'

// ─── Types ───────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
  is_active: boolean
  preset_team: 'A' | 'B' | null
}

type PlayerForm = {
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
  preset_team: 'A' | 'B' | null
}

const DEFAULT_FORM: PlayerForm = {
  name: '',
  batting_rating: 5,
  bowling_rating: 5,
  fielding_rating: 5,
  preset_team: null,
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
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className={`text-sm font-bold tabular-nums ${ratingTextColor(value)}`}>
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
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  )
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  weights,
  onEdit,
  onDeactivate,
}: {
  player: Player
  weights: { batting: number; bowling: number; fielding: number }
  onEdit: (p: Player) => void
  onDeactivate: (id: string) => void
}) {
  const overall = calcScore(player, weights)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-snug break-words">{player.name}</h3>
          {player.preset_team && (
            <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
              player.preset_team === 'A' ? 'bg-green-100 text-green-700' : 'bg-teal-100 text-teal-700'
            }`}>
              {player.preset_team === 'A' ? '⚡A' : '🔥B'}
            </span>
          )}
        </div>
        <span className={`shrink-0 text-sm font-bold px-2 py-0.5 rounded-lg ${ratingBadge(overall)}`}>
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

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(player)}
          className="flex-1 text-xs font-semibold bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-800 py-2 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDeactivate(player.id)}
          className="flex-1 text-xs font-semibold bg-gray-50 hover:bg-red-50 active:bg-red-100 text-gray-500 hover:text-red-600 py-2 rounded-lg transition-colors"
        >
          Deactivate
        </button>
      </div>
    </div>
  )
}

// ─── PlayerModal ──────────────────────────────────────────────────────────────

function PlayerModal({
  open,
  editing,
  weights,
  onClose,
  onSave,
}: {
  open: boolean
  editing: Player | null
  weights: { batting: number; bowling: number; fielding: number }
  onClose: () => void
  onSave: (form: PlayerForm) => Promise<void>
}) {
  const [form, setForm] = useState<PlayerForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(
      editing
        ? {
            name: editing.name,
            batting_rating: editing.batting_rating,
            bowling_rating: editing.bowling_rating,
            fielding_rating: editing.fielding_rating,
            preset_team: editing.preset_team,
          }
        : DEFAULT_FORM
    )
  }, [editing, open])

  if (!open) return null

  const set = <K extends keyof PlayerForm>(key: K, val: PlayerForm[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const preview = calcScore(form, weights)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div className="bg-green-900 text-white px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-base">
            {editing ? 'Edit Player' : 'Add New Player'}
          </h2>
          <button
            onClick={onClose}
            className="text-green-300 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Player Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Ravi Kumar"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>

          <RatingSlider label="Batting" value={form.batting_rating} onChange={v => set('batting_rating', v)} />
          <RatingSlider label="Bowling" value={form.bowling_rating} onChange={v => set('bowling_rating', v)} />
          <RatingSlider label="Fielding" value={form.fielding_rating} onChange={v => set('fielding_rating', v)} />

          <div className={`text-center text-sm font-semibold py-2 rounded-lg ${ratingBadge(preview)}`}>
            Overall score: {preview.toFixed(1)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pre-seed to Team</label>
            <div className="grid grid-cols-3 gap-2">
              {(['none', 'A', 'B'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('preset_team', opt === 'none' ? null : opt)}
                  className={`py-2.5 rounded-xl font-bold text-sm transition-colors border-2 ${
                    (opt === 'none' ? form.preset_team === null : form.preset_team === opt)
                      ? opt === 'B'
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : opt === 'A'
                          ? 'bg-green-800 border-green-800 text-white'
                          : 'bg-gray-700 border-gray-700 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {opt === 'none' ? 'None' : opt === 'A' ? '⚡ Team A' : '🔥 Team B'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-green-800 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {saving ? 'Saving…' : 'Save Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, supabase, isLoading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { weights } = useSettings()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [inactive, setInactive] = useState<Player[]>([])
  const [fetching, setFetching] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) fetchPlayers()
  }, [user])

  const fetchPlayers = async () => {
    setFetching(true)
    const [{ data: active }, { data: inactiveData }] = await Promise.all([
      supabase.from('players').select('*').eq('is_active', true).order('name'),
      supabase.from('players').select('*').eq('is_active', false).order('name'),
    ])
    setPlayers(active ?? [])
    setInactive(inactiveData ?? [])
    setFetching(false)
  }

  const handleSave = async (form: PlayerForm) => {
    const trimmedName = form.name.trim()

    if (!trimmedName) {
      showToast('Player name is required', 'error')
      return
    }

    // Duplicate name check (case-insensitive)
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .ilike('name', trimmedName)
      .neq('id', editing?.id ?? '00000000-0000-0000-0000-000000000000')
      .limit(1)

    if (existing && existing.length > 0) {
      showToast('A player with this name already exists', 'error')
      return
    }

    if (editing) {
      await supabase.from('players').update({ ...form, name: trimmedName }).eq('id', editing.id)
      showToast('Player updated')
    } else {
      await supabase.from('players').insert({ ...form, name: trimmedName })
      showToast('Player added to squad')
    }
    await fetchPlayers()
    setModalOpen(false)
    setEditing(null)
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Remove this player from the active roster?')) return
    await supabase.from('players').update({ is_active: false }).eq('id', id)
    await fetchPlayers()
    showToast('Player deactivated', 'info')
  }

  const handleReactivate = async (id: string) => {
    await supabase.from('players').update({ is_active: true }).eq('id', id)
    await fetchPlayers()
    showToast('Player reactivated')
  }

  const openAdd = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (p: Player) => { setEditing(p); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  if (authLoading || !user) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Players</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {fetching ? 'Loading…' : `${players.length} active player${players.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-green-800 hover:bg-green-700 active:bg-green-900 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Add Player
        </button>
      </div>

      {/* Active players */}
      {fetching ? (
        <Spinner />
      ) : players.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-5xl mb-3">🏏</div>
          <p className="text-gray-700 font-semibold mb-1">No players yet</p>
          <p className="text-gray-400 text-sm mb-5">Add your squad to start balancing teams.</p>
          <button
            onClick={openAdd}
            className="bg-green-800 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
          >
            + Add your first player
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {players.map(p => (
            <PlayerCard
              key={p.id}
              player={p}
              weights={weights}
              onEdit={openEdit}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      )}

      {/* Inactive players */}
      {!fetching && inactive.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showInactive ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Inactive Players ({inactive.length})
          </button>

          {showInactive && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {inactive.map(p => {
                const overall = calcScore(p, weights)
                return (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 opacity-60">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug break-words">{p.name}</h3>
                      <span className={`shrink-0 text-sm font-bold px-2 py-0.5 rounded-lg ${ratingBadge(overall)}`}>
                        {overall.toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {[
                        { label: 'Bat', val: p.batting_rating },
                        { label: 'Bowl', val: p.bowling_rating },
                        { label: 'Field', val: p.fielding_rating },
                      ].map(({ label, val }) => (
                        <div key={label} className={`rounded-lg py-1.5 ${ratingBadge(val)}`}>
                          <div className="text-xs font-medium opacity-60 leading-none mb-0.5">{label}</div>
                          <div className="text-sm font-bold tabular-nums">{val}</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleReactivate(p.id)}
                      className="w-full text-xs font-semibold bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-800 py-2 rounded-lg transition-colors"
                    >
                      Reactivate
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <PlayerModal
        open={modalOpen}
        editing={editing}
        weights={weights}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  )
}
