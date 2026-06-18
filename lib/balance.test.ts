import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  balanceWithSub,
  calcScore,
  DEFAULT_WEIGHTS,
  DEFAULT_MAX_SKILL_GAP,
} from './utils.ts'

// ─── Real roster fixture ────────────────────────────────────────────────────
// Ratings taken from the live squad. Edit here if a player's ratings change.

type P = {
  name: string
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
  can_bowl?: boolean
  needs_runner?: boolean
}

const ROSTER: Record<string, P> = {
  Ashan:    { name: 'Ashan',    batting_rating: 3,   bowling_rating: 3,   fielding_rating: 7 },
  Banu:     { name: 'Banu',     batting_rating: 6,   bowling_rating: 9,   fielding_rating: 7 },
  Boniya:   { name: 'Boniya',   batting_rating: 7.7, bowling_rating: 7.7, fielding_rating: 9 },
  Chamika:  { name: 'Chamika',  batting_rating: 5,   bowling_rating: 7.4, fielding_rating: 7.3 },
  Dhana:    { name: 'Dhana',    batting_rating: 4.7, bowling_rating: 4.2, fielding_rating: 5 },
  Dhananga: { name: 'Dhananga', batting_rating: 5,   bowling_rating: 6,   fielding_rating: 7 },
  Dumindu:  { name: 'Dumindu',  batting_rating: 3,   bowling_rating: 4,   fielding_rating: 4 },
  Gopi:     { name: 'Gopi',     batting_rating: 3,   bowling_rating: 5.7, fielding_rating: 5.7 },
  Hasindu:  { name: 'Hasindu',  batting_rating: 5,   bowling_rating: 6,   fielding_rating: 7 },
  Kaje:     { name: 'Kaje',     batting_rating: 3,   bowling_rating: 4,   fielding_rating: 4 },
  Krishan:  { name: 'Krishan',  batting_rating: 5,   bowling_rating: 5,   fielding_rating: 6 },
  Lahiru:   { name: 'Lahiru',   batting_rating: 8,   bowling_rating: 8,   fielding_rating: 10 },
  Lakindu:  { name: 'Lakindu',  batting_rating: 2,   bowling_rating: 4,   fielding_rating: 6 },
  Lakshan:  { name: 'Lakshan',  batting_rating: 7,   bowling_rating: 7,   fielding_rating: 6 },
  Malitha:  { name: 'Malitha',  batting_rating: 5.5, bowling_rating: 6,   fielding_rating: 7 },
  Nagitha:  { name: 'Nagitha',  batting_rating: 3,   bowling_rating: 3,   fielding_rating: 4 },
  Nuraj:    { name: 'Nuraj',    batting_rating: 6.4, bowling_rating: 4,   fielding_rating: 6, needs_runner: true },
  Pasan:    { name: 'Pasan',    batting_rating: 9,   bowling_rating: 8,   fielding_rating: 9 },
  Prabas:   { name: 'Prabas',   batting_rating: 5,   bowling_rating: 1,   fielding_rating: 7, can_bowl: false, needs_runner: true },
  Prasad:   { name: 'Prasad',   batting_rating: 4,   bowling_rating: 9,   fielding_rating: 6 },
  Randil:   { name: 'Randil',   batting_rating: 3,   bowling_rating: 3,   fielding_rating: 6 },
  Remilton: { name: 'Remilton', batting_rating: 8,   bowling_rating: 9,   fielding_rating: 10 },
  Saliya:   { name: 'Saliya',   batting_rating: 6.4, bowling_rating: 6.4, fielding_rating: 7 },
  Samith:   { name: 'Samith',   batting_rating: 7,   bowling_rating: 6.5, fielding_rating: 6.5 },
  Sandun:   { name: 'Sandun',   batting_rating: 9,   bowling_rating: 9,   fielding_rating: 8 },
  Sangaran: { name: 'Sangaran', batting_rating: 5,   bowling_rating: 8,   fielding_rating: 8 },
  Tharusha: { name: 'Tharusha', batting_rating: 7.5, bowling_rating: 4,   fielding_rating: 8 },
  Vishnu:   { name: 'Vishnu',   batting_rating: 7,   bowling_rating: 8,   fielding_rating: 7.6 },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type Split = { teamA: P[]; teamB: P[] }

// Build a pool for the live balancing path (balanceWithSub): attaches an id, the
// pre-computed overall score, and the optional seeding each player carries.
type Seeding = Record<string, 'A' | 'B'>

function buildPool(names: string[], seeding: Seeding = {}) {
  return names.map(n => {
    const p = ROSTER[n]
    if (!p) throw new Error(`Unknown player: ${n}`)
    return {
      ...p,
      id: n,
      score: calcScore(p, DEFAULT_WEIGHTS),
      preset_team: (seeding[n] ?? null) as 'A' | 'B' | null,
    }
  })
}

// keepPreseeded=true honours the seeding; false ignores it (small unseeded games).
function balanceSeeded(names: string[], seeding: Seeding): Split {
  return balanceWithSub(buildPool(names, seeding), DEFAULT_WEIGHTS, true, DEFAULT_MAX_SKILL_GAP)
}

function balanceUnseeded(names: string[]): Split {
  return balanceWithSub(buildPool(names), DEFAULT_WEIGHTS, false, DEFAULT_MAX_SKILL_GAP)
}

function assertSeedingsRespected(seeding: Seeding, s: Split) {
  for (const [name, team] of Object.entries(seeding)) {
    assert.equal(teamOf(name, s), team, `${name} was seeded to ${team} and must stay there`)
  }
}

function teamOf(name: string, s: Split): 'A' | 'B' {
  if (s.teamA.some(p => p.name === name)) return 'A'
  if (s.teamB.some(p => p.name === name)) return 'B'
  throw new Error(`${name} not in either team`)
}

function avgBat(team: P[]): number {
  return team.reduce((sum, p) => sum + p.batting_rating, 0) / (team.length || 1)
}

// The two highest-batting players in the pool, which we expect to be split.
function topTwoBatsmen(pool: P[]): [string, string] {
  const sorted = [...pool].sort((a, b) => b.batting_rating - a.batting_rating)
  return [sorted[0].name, sorted[1].name]
}

function fmt(team: P[]): string {
  return [...team]
    .sort((a, b) => b.batting_rating - a.batting_rating)
    .map(p => `${p.name}(${p.batting_rating})`)
    .join(', ')
}

function sortedBat(team: P[]): number[] {
  return [...team].map(p => p.batting_rating).sort((a, b) => b - a)
}

// Largest batting-rating gap between the two line-ups over the top `k` positions
// (best vs best, 2nd vs 2nd, …). Small means the top orders are well matched.
function topOrderGap(s: Split, k: number): number {
  const a = sortedBat(s.teamA)
  const b = sortedBat(s.teamB)
  let max = 0
  for (let i = 0; i < k; i++) max = Math.max(max, Math.abs((a[i] ?? 0) - (b[i] ?? 0)))
  return max
}

// Prints the resulting split so divisions can be eyeballed in the test output.
function show(title: string, s: Split) {
  const total = s.teamA.length + s.teamB.length
  const parity = total % 2 === 0 ? 'even' : 'odd'
  console.log(`\n  ── ${title} · ${total} players (${parity}) ──`)
  console.log(`  A (n=${s.teamA.length}, bat avg ${avgBat(s.teamA).toFixed(2)}): ${fmt(s.teamA)}`)
  console.log(`  B (n=${s.teamB.length}, bat avg ${avgBat(s.teamB).toFixed(2)}): ${fmt(s.teamB)}`)
  console.log(`  top-order gap (top 3): ${topOrderGap(s, 3).toFixed(1)} · bat avg gap: ${Math.abs(avgBat(s.teamA) - avgBat(s.teamB)).toFixed(2)}`)
}

function assertSplit(a: string, b: string, s: Split) {
  assert.notEqual(
    teamOf(a, s),
    teamOf(b, s),
    `${a} and ${b} should be on different teams`
  )
}

function assertBalanced(s: Split) {
  assert.ok(
    Math.abs(avgBat(s.teamA) - avgBat(s.teamB)) < 1.0,
    `batting averages should be close (got ${avgBat(s.teamA).toFixed(2)} vs ${avgBat(s.teamB).toFixed(2)})`
  )
  assert.ok(
    topOrderGap(s, 3) <= 2.0,
    `top order should be matched within 2.0 (got ${topOrderGap(s, 3).toFixed(1)})`
  )
}

// Our real seedings.
const SEEDS: Seeding = {
  Sandun: 'A', Prasad: 'A', Saliya: 'A', Dhana: 'A',
  Malitha: 'B', Nuraj: 'B', Tharusha: 'B',
}

// Only the seedings for players actually present in a given scenario.
function seedsFor(names: string[]): Seeding {
  const s: Seeding = {}
  for (const n of names) if (SEEDS[n]) s[n] = SEEDS[n]
  return s
}

// ─── Scenarios ──────────────────────────────────────────────────────────────
// We always play SEEDED at 10+ players, so most scenarios are seeded. A couple
// of small (~8) games are unseeded. Odd totals are included throughout.
// Prasad, Nuraj, Sandun, Dhana, Saliya appear in every scenario except a couple.

// ── Small unseeded games (under 10 players) ──────────────────────────────────

// 8 players, no seeding — the two strongest batsmen must split.
test('unseeded · 8 players: two strongest batsmen split', () => {
  const names = ['Prasad', 'Nuraj', 'Sandun', 'Dhana', 'Saliya', 'Lahiru', 'Ashan', 'Lakindu']
  const s = balanceUnseeded(names)
  show('unseeded 8', s)
  const [a, b] = topTwoBatsmen(buildPool(names))
  assertSplit(a, b, s)
  assertBalanced(s)
})

// 9 players, no seeding (odd total) — two 9-rated batsmen must split.
test('unseeded · 9 players (odd): two strongest batsmen split', () => {
  const names = ['Prasad', 'Nuraj', 'Sandun', 'Dhana', 'Saliya', 'Lahiru', 'Pasan', 'Samith', 'Lakindu']
  const s = balanceUnseeded(names)
  show('unseeded 9', s)
  assertSplit('Sandun', 'Pasan', s)
  assertBalanced(s)
})

// ── Seeded games (10+ players) ───────────────────────────────────────────────

// The reported screenshot line-up, faithfully seeded (Sandun/Prasad → A,
// Malitha/Nuraj → B). Sandun is seeded A; the free Lahiru(8) should counter-
// balance onto B instead of stacking with Sandun like the old algorithm did.
test('seeded · screenshot line-up (10): Lahiru counter-balances seeded Sandun', () => {
  const names = ['Sandun', 'Prasad', 'Malitha', 'Nuraj', 'Lahiru', 'Ashan', 'Lakindu', 'Samith', 'Chamika', 'Hasindu']
  const seeding = seedsFor(names)
  const s = balanceSeeded(names, seeding)
  show('seeded screenshot (10)', s)
  assertSeedingsRespected(seeding, s)
  assertSplit('Sandun', 'Lahiru', s)
  assertBalanced(s)
})

// 11 players, seeded (odd total).
test('seeded · 11 players (odd)', () => {
  const names = [
    'Sandun', 'Prasad', 'Saliya', 'Dhana', 'Nuraj', 'Malitha',
    'Lahiru', 'Pasan', 'Samith', 'Chamika', 'Krishan',
  ]
  const seeding = seedsFor(names)
  const s = balanceSeeded(names, seeding)
  show('seeded 11', s)
  assertSeedingsRespected(seeding, s)
  assertBalanced(s)
})

// 13 players, seeded (odd total).
test('seeded · 13 players (odd)', () => {
  const names = [
    'Sandun', 'Prasad', 'Saliya', 'Dhana', 'Nuraj', 'Malitha', 'Tharusha',
    'Lahiru', 'Pasan', 'Samith', 'Chamika', 'Krishan', 'Hasindu',
  ]
  const seeding = seedsFor(names)
  const s = balanceSeeded(names, seeding)
  show('seeded 13', s)
  assertSeedingsRespected(seeding, s)
  assertBalanced(s)
})

// 15 players, seeded (odd total) — lots of top-end talent.
test('seeded · 15 players (odd)', () => {
  const names = [
    'Sandun', 'Prasad', 'Saliya', 'Dhana', 'Nuraj', 'Malitha', 'Tharusha',
    'Lahiru', 'Pasan', 'Remilton', 'Vishnu', 'Samith', 'Chamika', 'Krishan', 'Hasindu',
  ]
  const seeding = seedsFor(names)
  const s = balanceSeeded(names, seeding)
  show('seeded 15', s)
  assertSeedingsRespected(seeding, s)
  assertBalanced(s)
})

// 16 players, seeded (even total).
test('seeded · 16 players (even)', () => {
  const names = [
    'Sandun', 'Prasad', 'Saliya', 'Dhana', 'Nuraj', 'Malitha', 'Tharusha',
    'Lahiru', 'Pasan', 'Samith', 'Chamika', 'Krishan', 'Hasindu', 'Lakindu', 'Ashan', 'Vishnu',
  ]
  const seeding = seedsFor(names)
  const s = balanceSeeded(names, seeding)
  show('seeded 16', s)
  assertSeedingsRespected(seeding, s)
  assertBalanced(s)
})

// 19 players, seeded (odd total) — near a full turnout.
test('seeded · 19 players (odd)', () => {
  const names = [
    'Sandun', 'Prasad', 'Saliya', 'Dhana', 'Nuraj', 'Malitha', 'Tharusha',
    'Lahiru', 'Pasan', 'Remilton', 'Vishnu', 'Boniya', 'Lakshan', 'Samith',
    'Sangaran', 'Banu', 'Chamika', 'Hasindu', 'Krishan',
  ]
  const seeding = seedsFor(names)
  const s = balanceSeeded(names, seeding)
  show('seeded 19', s)
  assertSeedingsRespected(seeding, s)
  assertBalanced(s)
})

// Admin override: two stars seeded to the SAME team. Seeding must win even
// though the rule would normally split them. (13 players, odd.)
test('seeded · admin forces both stars onto team A (override)', () => {
  const seeding: Seeding = {
    Sandun: 'A', Pasan: 'A', Prasad: 'A', Dhana: 'A', Saliya: 'A',
    Nuraj: 'B', Malitha: 'B',
  }
  const names = [
    'Sandun', 'Pasan', 'Prasad', 'Dhana', 'Saliya', 'Nuraj', 'Malitha',
    'Lahiru', 'Samith', 'Chamika', 'Krishan', 'Hasindu', 'Lakindu',
  ]
  const s = balanceSeeded(names, seeding)
  show('seeded override (13)', s)
  assertSeedingsRespected(seeding, s)
  assert.equal(teamOf('Sandun', s), 'A')
  assert.equal(teamOf('Pasan', s), 'A')
})
