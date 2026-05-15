'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/ToastProvider'
import { useSettings } from '@/components/SettingsProvider'
import { calcScore, ratingBadge, skillAverages, balanceLoss, simulatedAnnealing, type Weights } from '@/lib/utils'
import Spinner from '@/components/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoredPlayer = {
  id: string
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
  score: number
}

type Teams = { teamA: ScoredPlayer[]; teamB: ScoredPlayer[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scored(p: Omit<ScoredPlayer, 'score'>, w: Weights): ScoredPlayer {
  return { ...p, score: calcScore(p, w) }
}

// ─── findSubPlayer ────────────────────────────────────────────────────────────

function balanceWithSub(players: ScoredPlayer[], weights: Weights): Teams {
  if (players.length % 2 === 0) return simulatedAnnealing(players, weights)

  const sub = [...players].sort((a, b) => a.score - b.score)[0]
  const rest = players.filter(p => p.id !== sub.id)
  const { teamA, teamB } = simulatedAnnealing(rest, weights)

  const totalA = teamA.reduce((s, p) => s + p.score, 0)
  const totalB = teamB.reduce((s, p) => s + p.score, 0)
  return totalA <= totalB
    ? { teamA: [...teamA, sub], teamB }
    : { teamA, teamB: [...teamB, sub] }
}

// ─── SkillBalance ─────────────────────────────────────────────────────────────

function SkillBalance({ teams, subPlayerId }: { teams: Teams; subPlayerId: string | null }) {
  const coreA = subPlayerId ? teams.teamA.filter(p => p.id !== subPlayerId) : teams.teamA
  const coreB = subPlayerId ? teams.teamB.filter(p => p.id !== subPlayerId) : teams.teamB
  const avgA = skillAverages(coreA)
  const avgB = skillAverages(coreB)
  const isUneven = teams.teamA.length !== teams.teamB.length

  const rows = [
    { label: 'Batting', a: avgA.batting, b: avgB.batting },
    { label: 'Bowling', a: avgA.bowling, b: avgB.bowling },
    { label: 'Fielding', a: avgA.fielding, b: avgB.fielding },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Skill Balance</h3>
        {isUneven && (
          <span className="text-xs text-amber-600 font-medium">core teams only · sub excluded</span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map(({ label, a, b }) => {
          const diff = Math.abs(a - b)
          const gapColor = diff < 0.5 ? 'text-green-600' : diff < 1.5 ? 'text-amber-500' : 'text-red-500'
          const gapLabel = diff < 0.5 ? 'Matched' : diff < 1.5 ? 'Close' : 'Gap'
          return (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-14 text-xs text-gray-500 shrink-0">{label}</span>
              <span className="font-bold tabular-nums text-green-800 w-8 text-right shrink-0">{a.toFixed(1)}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-300 rounded-full"
                  style={{ width: `${100 - Math.min(diff / 5, 1) * 100}%` }}
                />
              </div>
              <span className="font-bold tabular-nums text-teal-700 w-8 shrink-0">{b.toFixed(1)}</span>
              <span className={`text-xs font-semibold w-14 text-right shrink-0 ${gapColor}`}>{gapLabel}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-gray-400 justify-end">
        <span className="font-semibold text-green-800">A</span>
        <span className="font-semibold text-teal-700">B</span>
      </div>
    </div>
  )
}

// ─── TeamColumn ───────────────────────────────────────────────────────────────

function TeamColumn({
  label,
  team,
  headerClass,
  subPlayerId,
}: {
  label: string
  team: ScoredPlayer[]
  headerClass: string
  subPlayerId: string | null
}) {
  const coreTeam = subPlayerId ? team.filter(p => p.id !== subPlayerId) : team
  const avgs = skillAverages(coreTeam)

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className={`${headerClass} text-white text-center py-3.5 font-bold tracking-wide text-base`}>
        {label}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        {team.map(p => (
          <div key={p.id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 text-sm">{p.name}</span>
              {p.id === subPlayerId && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Sub</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { label: 'Bat', val: p.batting_rating },
                { label: 'Bowl', val: p.bowling_rating },
                { label: 'Field', val: p.fielding_rating },
              ].map(({ label, val }) => (
                <div key={label} className={`rounded-md py-1 ${ratingBadge(val)}`}>
                  <div className="text-xs opacity-60 leading-none mb-0.5">{label}</div>
                  <div className="text-xs font-bold tabular-nums">{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
        <div className="grid grid-cols-3 gap-1 text-center">
          {[
            { label: 'Avg Bat', val: avgs.batting },
            { label: 'Avg Bowl', val: avgs.bowling },
            { label: 'Avg Field', val: avgs.fielding },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className="text-xs text-gray-400">{label}</div>
              <div className={`text-xs font-bold tabular-nums ${ratingBadge(val)} rounded px-1 inline-block mt-0.5`}>{val.toFixed(1)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── AddPlayerModal ───────────────────────────────────────────────────────────

function AddPlayerModal({
  available,
  teams,
  weights,
  onAdd,
  onClose,
}: {
  available: ScoredPlayer[]
  teams: Teams
  weights: Weights
  onAdd: (player: ScoredPlayer, team: 'A' | 'B') => void
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? '')
  const [targetTeam, setTargetTeam] = useState<'A' | 'B' | 'auto'>('auto')

  const resolveTeam = (): 'A' | 'B' => {
    if (targetTeam !== 'auto') return targetTeam
    if (teams.teamA.length !== teams.teamB.length) {
      return teams.teamA.length <= teams.teamB.length ? 'A' : 'B'
    }
    // Pick team that results in lower per-skill imbalance after adding the player
    const player = available.find(p => p.id === selectedId)
    if (!player) return 'A'
    const lossIfA = balanceLoss([...teams.teamA, player], teams.teamB, weights)
    const lossIfB = balanceLoss(teams.teamA, [...teams.teamB, player], weights)
    return lossIfA <= lossIfB ? 'A' : 'B'
  }

  const handleAdd = () => {
    const player = available.find(p => p.id === selectedId)
    if (!player) return
    onAdd(player, resolveTeam())
    onClose()
  }

  type Option = { label: string; value: 'auto' | 'A' | 'B' }
  const options: Option[] = [
    { label: 'Auto', value: 'auto' },
    { label: 'Team A', value: 'A' },
    { label: 'Team B', value: 'B' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div className="bg-green-900 text-white px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-base">Add Player to Team</h2>
          <button onClick={onClose} className="text-green-300 hover:text-white text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-white"
            >
              {available.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Overall: {p.score.toFixed(1)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign to</label>
            <div className="grid grid-cols-3 gap-2">
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetTeam(opt.value)}
                  className={`py-3 rounded-xl font-bold text-sm transition-colors border-2 ${
                    targetTeam === opt.value
                      ? opt.value === 'B'
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-green-800 border-green-800 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedId}
              className="flex-1 py-2.5 rounded-lg bg-green-800 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user, supabase, isLoading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { weights } = useSettings()

  const [sessionPlayerIds, setSessionPlayerIds] = useState<Set<string>>(new Set())
  const [allPlayers, setAllPlayers] = useState<ScoredPlayer[]>([])
  const [availablePlayers, setAvailablePlayers] = useState<ScoredPlayer[]>([])
  const [teams, setTeams] = useState<Teams | null>(null)
  const [teamsSaved, setTeamsSaved] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    async function load() {
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

      const [{ data: spData }, { data: savedTeams }, { data: allActive }] = await Promise.all([
        supabase
          .from('session_players')
          .select('player_id, players(id, name, batting_rating, bowling_rating, fielding_rating)')
          .eq('session_id', id)
          .eq('was_present', true),
        supabase
          .from('teams')
          .select('team_number, player_id')
          .eq('session_id', id),
        supabase
          .from('players')
          .select('id, name, batting_rating, bowling_rating, fielding_rating')
          .eq('is_active', true),
      ])

      const sessionPlayers: ScoredPlayer[] = ((spData as unknown as SpRow[]) ?? [])
        .filter(row => row.players !== null)
        .map(row => scored(row.players!, weights))

      const sessionIds = new Set(sessionPlayers.map(p => p.id))
      setSessionPlayerIds(sessionIds)

      if (savedTeams && savedTeams.length > 0) {
        const savedIds = new Set(savedTeams.map(t => t.player_id))
        const extraActive: ScoredPlayer[] = ((allActive ?? []) as {
          id: string; name: string; batting_rating: number; bowling_rating: number; fielding_rating: number
        }[])
          .filter(p => savedIds.has(p.id) && !sessionIds.has(p.id))
          .map(p => scored(p, weights))

        const fullPool = [...sessionPlayers, ...extraActive]
        setAllPlayers(fullPool)

        const teamA = fullPool.filter(p => savedTeams.some(t => t.player_id === p.id && t.team_number === 1))
        const teamB = fullPool.filter(p => savedTeams.some(t => t.player_id === p.id && t.team_number === 2))
        setTeams({ teamA, teamB })
        setTeamsSaved(true)

        const assignedIds = new Set(fullPool.map(p => p.id))
        setAvailablePlayers(
          ((allActive ?? []) as { id: string; name: string; batting_rating: number; bowling_rating: number; fielding_rating: number }[])
            .filter(p => !assignedIds.has(p.id))
            .map(p => scored(p, weights))
        )
      } else if (sessionPlayers.length >= 2) {
        setAllPlayers(sessionPlayers)
        setTeams(balanceWithSub(sessionPlayers, weights))
        setTeamsSaved(false)

        const assignedIds = new Set(sessionPlayers.map(p => p.id))
        setAvailablePlayers(
          ((allActive ?? []) as { id: string; name: string; batting_rating: number; bowling_rating: number; fielding_rating: number }[])
            .filter(p => !assignedIds.has(p.id))
            .map(p => scored(p, weights))
        )
      }

      setFetching(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, supabase])

  const regenerate = () => {
    if (!allPlayers.length) return
    const rescored = allPlayers.map(p => scored(p, weights))
    setTeams(balanceWithSub(rescored, weights))
    setTeamsSaved(false)
  }

  const addPlayerToTeam = (player: ScoredPlayer, team: 'A' | 'B') => {
    setTeams(prev => {
      if (!prev) return prev
      return team === 'A'
        ? { teamA: [...prev.teamA, player], teamB: prev.teamB }
        : { teamA: prev.teamA, teamB: [...prev.teamB, player] }
    })
    setAllPlayers(prev => [...prev, player])
    setAvailablePlayers(prev => prev.filter(p => p.id !== player.id))
    setTeamsSaved(false)
  }

  const saveTeams = async () => {
    if (!teams || saving) return
    setSaving(true)

    const newToSession = [...teams.teamA, ...teams.teamB].filter(p => !sessionPlayerIds.has(p.id))
    if (newToSession.length > 0) {
      await supabase.from('session_players').upsert(
        newToSession.map(p => ({ session_id: id, player_id: p.id, was_present: true })),
        { onConflict: 'session_id,player_id' }
      )
      setSessionPlayerIds(prev => {
        const next = new Set(prev)
        newToSession.forEach(p => next.add(p.id))
        return next
      })
    }

    await supabase.from('teams').delete().eq('session_id', id)
    await supabase.from('teams').insert([
      ...teams.teamA.map(p => ({ session_id: id, team_number: 1, player_id: p.id })),
      ...teams.teamB.map(p => ({ session_id: id, team_number: 2, player_id: p.id })),
    ])

    setTeamsSaved(true)
    setSaving(false)
    showToast('Teams saved!')
  }

  if (fetching) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Spinner />
      </div>
    )
  }

  const subPlayerId: string | null = (() => {
    if (!teams) return null
    if (teams.teamA.length === teams.teamB.length) return null
    const larger = teams.teamA.length > teams.teamB.length ? teams.teamA : teams.teamB
    return larger.reduce((min, p) => p.score < min.score ? p : min).id
  })()

  if (!teams) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 text-sm mb-2">No players found for this session.</p>
        <Link href="/session/new" className="text-green-700 text-sm font-semibold hover:underline">
          Start a new session →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
          <span>›</span>
          <span>Teams</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Generated Teams</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {teamsSaved ? 'Teams saved for this session.' : `${allPlayers.length} players · balanced by skill`}
        </p>
      </div>

      {/* Skill balance summary */}
      <SkillBalance teams={teams} subPlayerId={subPlayerId} />

      {/* Teams side-by-side */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <TeamColumn label="⚡ Team A" team={teams.teamA} headerClass="bg-green-800" subPlayerId={subPlayerId} />
        <TeamColumn label="🔥 Team B" team={teams.teamB} headerClass="bg-teal-700" subPlayerId={subPlayerId} />
      </div>

      {/* Actions — admin only */}
      {!authLoading && (
        user ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={regenerate}
                className="flex-1 py-3 rounded-xl border-2 border-green-800 text-green-800 font-semibold text-sm hover:bg-green-50 active:bg-green-100 transition-colors"
              >
                ↺ Regenerate Teams
              </button>

              {availablePlayers.length > 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex-1 py-3 rounded-xl border-2 border-teal-700 text-teal-700 font-semibold text-sm hover:bg-teal-50 active:bg-teal-100 transition-colors"
                >
                  + Add Player
                </button>
              )}

              <button
                onClick={saveTeams}
                disabled={saving || teamsSaved}
                className="flex-1 py-3 rounded-xl bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
              >
                {saving ? 'Saving…' : teamsSaved ? '✓ Teams Saved' : 'Save Teams'}
              </button>
            </div>

            {teamsSaved && (
              <Link
                href={`/session/${id}/rate`}
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-semibold text-sm text-center transition-colors shadow-sm"
              >
                Rate Players →
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-500">
            <Link href="/login" className="text-green-700 font-semibold hover:underline">
              Sign in
            </Link>{' '}
            to manage teams.
          </div>
        )
      )}

      {showAddModal && (
        <AddPlayerModal
          available={availablePlayers}
          teams={teams}
          weights={weights}
          onAdd={addPlayerToTeam}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
