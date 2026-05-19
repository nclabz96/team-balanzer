import { createServerSupabaseClient } from '@/lib/supabase'
import { calcScore, DEFAULT_WEIGHTS } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
}

type SessionScore = {
  player_id: string
  batting_score: number | null
  bowling_score: number | null
  fielding_score: number | null
}

type TeamRow = {
  team_number: number
  player_id: string
  players: Player
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ratingBadge(val: number) {
  if (val >= 7) return 'bg-green-100 text-green-700'
  if (val >= 4) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

function ratingColor(val: number) {
  if (val >= 7) return 'text-green-600'
  if (val >= 4) return 'text-amber-500'
  return 'text-red-500'
}

function sortByOverallDesc(players: Player[]) {
  return [...players].sort((a, b) => {
    const diff = calcScore(b, DEFAULT_WEIGHTS) - calcScore(a, DEFAULT_WEIGHTS)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })
}

function delta(session: number, current: number) {
  const diff = current - session
  if (Math.abs(diff) < 0.05) return null
  return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  scores,
}: {
  player: Player
  scores: SessionScore | undefined
}) {
  const hasScore =
    scores !== undefined &&
    scores.batting_score !== null &&
    scores.bowling_score !== null &&
    scores.fielding_score !== null

  return (
    <div className="bg-gray-50 rounded-xl p-3 mb-2 last:mb-0">
      <div className="font-semibold text-gray-900 text-sm mb-2.5">{player.name}</div>

      {hasScore ? (
        <div className="space-y-2">
          {[
            { label: 'Batting',  session: scores.batting_score!,  current: player.batting_rating },
            { label: 'Bowling',  session: scores.bowling_score!,  current: player.bowling_rating },
            { label: 'Fielding', session: scores.fielding_score!, current: player.fielding_rating },
          ].map(({ label, session, current }) => {
            const d = delta(session, current)
            return (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-11 shrink-0">{label}</span>
                <span className={`font-bold tabular-nums ${ratingColor(session)}`}>
                  {session.toFixed(1)}
                </span>
                <span className="text-gray-300 text-xs">→</span>
                <span className={`font-bold tabular-nums ${ratingColor(current)}`}>
                  {current.toFixed(1)}
                </span>
                {d && (
                  <span className={`ml-auto text-xs font-medium ${current > session ? 'text-green-500' : 'text-red-400'}`}>
                    {d}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 text-center">
          {[
            { label: 'Bat',   val: player.batting_rating },
            { label: 'Bowl',  val: player.bowling_rating },
            { label: 'Field', val: player.fielding_rating },
          ].map(({ label, val }) => (
            <div key={label} className={`rounded-md py-1 ${ratingBadge(val)}`}>
              <div className="text-xs opacity-60 leading-none mb-0.5">{label}</div>
              <div className="text-xs font-bold tabular-nums">{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TeamColumn ───────────────────────────────────────────────────────────────

function TeamColumn({
  label,
  players,
  scoresMap,
  headerClass,
}: {
  label: string
  players: Player[]
  scoresMap: Map<string, SessionScore>
  headerClass: string
}) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`${headerClass} text-white text-center py-3.5 font-bold tracking-wide`}>
        {label}
      </div>
      <div className="p-3">
        {players.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4">No players</p>
        ) : (
          players.map(p => (
            <PlayerRow key={p.id} player={p} scores={scoresMap.get(p.id)} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('sessions')
    .select('session_date')
    .eq('id', params.id)
    .single()

  if (!data) return { title: 'Session Not Found' }
  return { title: `${formatDateShort(data.session_date)} — Session` }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = createServerSupabaseClient()

  const [
    { data: session },
    { data: rawTeams },
    { data: rawScores },
    { data: { session: authSession } },
  ] = await Promise.all([
    supabase.from('sessions').select('id, session_date, notes').eq('id', id).single(),
    supabase
      .from('teams')
      .select('team_number, player_id, players(id, name, batting_rating, bowling_rating, fielding_rating)')
      .eq('session_id', id),
    supabase
      .from('session_players')
      .select('player_id, batting_score, bowling_score, fielding_score')
      .eq('session_id', id)
      .eq('was_present', true),
    supabase.auth.getSession(),
  ])

  if (!session) notFound()

  const isAdmin = Boolean(authSession?.user)
  const teams = (rawTeams as unknown as TeamRow[]) ?? []
  const scores = (rawScores as SessionScore[]) ?? []

  const scoresMap = new Map<string, SessionScore>()
  scores.forEach(s => scoresMap.set(s.player_id, s))

  const teamA: Player[] = sortByOverallDesc(
    teams
      .filter(t => t.team_number === 1)
      .map(t => t.players)
      .filter((p): p is Player => Boolean(p))
  )

  const teamB: Player[] = sortByOverallDesc(
    teams
      .filter(t => t.team_number === 2)
      .map(t => t.players)
      .filter((p): p is Player => Boolean(p))
  )

  const teamsExist = teams.length > 0
  const hasRatings = scores.some(s => s.batting_score !== null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-5"
      >
        ← Back to Home
      </Link>

      {/* Session header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{formatDate(session.session_date)}</h1>
        {session.notes && (
          <p className="text-gray-500 text-sm mt-1 italic">&ldquo;{session.notes}&rdquo;</p>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          {teamsExist && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
              ✓ Teams generated
            </span>
          )}
          {hasRatings && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
              ✓ Ratings submitted
            </span>
          )}
        </div>
      </div>

      {/* Teams */}
      {teamsExist ? (
        <>
          {hasRatings && (
            <p className="text-xs text-gray-400 text-center mb-3">
              Session score → updated rating (with delta)
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <TeamColumn label="⚡ Team A" players={teamA} scoresMap={scoresMap} headerClass="bg-green-800" />
            <TeamColumn label="🔥 Team B" players={teamB} scoresMap={scoresMap} headerClass="bg-teal-700" />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 items-center justify-center">
            <Link
              href={`/session/${id}/teams`}
              className="text-sm text-green-700 hover:text-green-900 font-medium hover:underline"
            >
              View / manage teams →
            </Link>
            {isAdmin && !hasRatings && (
              <>
                <span className="text-gray-200 hidden sm:inline">·</span>
                <Link
                  href={`/session/${id}/rate`}
                  className="inline-flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors shadow-sm"
                >
                  Rate Players →
                </Link>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-4xl mb-3">🏏</div>
          <p className="text-gray-500 text-sm">Teams haven&apos;t been generated yet.</p>
          {isAdmin && (
            <Link
              href={`/session/${id}/teams`}
              className="text-green-700 text-sm font-semibold hover:underline mt-2 inline-block"
            >
              Generate teams →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
