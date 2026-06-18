export type Weights = {
  batting: number
  bowling: number
  fielding: number
}

export const DEFAULT_WEIGHTS: Weights = {
  batting: 0.4,
  bowling: 0.4,
  fielding: 0.2,
}

export const DEFAULT_MAX_SKILL_GAP = 1.5

// Fraction of a player's new profile rating that comes from today's session
// score. The remaining (1 - DEFAULT_RECENT_WEIGHT) is carried from the existing
// profile. Admin-configurable; this is the fallback when unset.
export const DEFAULT_RECENT_WEIGHT = 0.3

// Hybrid loss tunables.
// STYLE_PENALTY weights per-skill spread relative to the overall score gap.
// Higher → more punishment for "batting team vs bowling team" type splits.
const STYLE_PENALTY = 0.3
// CAP_PENALTY is multiplied by the squared overage of any single skill gap
// above the configured maxSkillGap. Large enough to dominate when feasible,
// but never produces NaN/Infinity so the optimiser always returns a result.
const CAP_PENALTY = 100
// RUNNER_PENALTY is multiplied by the squared difference in the number of
// players who need a runner on each team. Strong enough to spread runners
// across both sides, but soft so it never overrides a bad skill split.
const RUNNER_PENALTY = 0.5

// Top-order batting concentration. Averages hide concentration: a team with the
// two best batsmen can have its stars cancelled out (in the average) by a weak
// tail, so two top-heavy and deep teams look "balanced". In cricket that is
// unfair — a couple of strong batsmen can bat through the innings while the tail
// barely matters. To counter this we compare the teams' batting line-ups
// position-by-position (best vs best, 2nd-best vs 2nd-best, …) instead of by
// average, weighting the top of the order most. Stacking the best batsmen on one
// side then costs a lot, so the optimiser splits them across teams.
// TOP_ORDER_PENALTY scales the whole term; TOP_ORDER_DECAY (<1) is how quickly a
// batting position stops mattering as you go down the order.
const TOP_ORDER_PENALTY = 0.6
const TOP_ORDER_DECAY = 0.6

// Brute force becomes expensive past C(20, 10) ≈ 184k; above this we use SA.
const BRUTE_FORCE_LIMIT = 20

export function calcScore(
  p: { batting_rating: number; bowling_rating: number; fielding_rating: number },
  w: Weights = DEFAULT_WEIGHTS
) {
  return p.batting_rating * w.batting + p.bowling_rating * w.bowling + p.fielding_rating * w.fielding
}

type Skillable = {
  batting_rating: number
  bowling_rating: number
  fielding_rating: number
  // Optional team-balancing flags. Absent → treated as a bowler who needs no runner.
  can_bowl?: boolean
  needs_runner?: boolean
}

// A player counts towards the team's bowling rating unless explicitly flagged as a non-bowler.
export const isBowler = (p: { can_bowl?: boolean }) => p.can_bowl !== false

/**
 * Position-by-position batting comparison. Both teams' batting ratings are sorted
 * high → low and compared at each line-up position (best vs best, etc.), with the
 * top of the order weighted most via TOP_ORDER_DECAY. Returns a squared, decayed
 * sum that is large when one team's top order out-guns the other's — i.e. when the
 * strong batsmen are concentrated on one side. Shorter line-ups are padded with 0.
 */
export function topOrderBattingLoss(a: Skillable[], b: Skillable[]) {
  const sa = a.map(p => p.batting_rating).sort((x, y) => y - x)
  const sb = b.map(p => p.batting_rating).sort((x, y) => y - x)
  const n = Math.max(sa.length, sb.length)
  let loss = 0
  for (let i = 0; i < n; i++) {
    const d = (sa[i] ?? 0) - (sb[i] ?? 0)
    loss += Math.pow(TOP_ORDER_DECAY, i) * d * d
  }
  return loss
}

export function skillAverages(team: Skillable[]) {
  const n = team.length || 1
  // Bowling is averaged over bowlers only — non-bowlers are spared from the
  // team's bowling rating. A team with no bowlers reports 0.
  const bowlers = team.filter(isBowler)
  const bn = bowlers.length || 1
  return {
    batting: team.reduce((s, p) => s + p.batting_rating, 0) / n,
    bowling: bowlers.reduce((s, p) => s + p.bowling_rating, 0) / bn,
    fielding: team.reduce((s, p) => s + p.fielding_rating, 0) / n,
  }
}

/**
 * Hybrid balance loss. Combines three signals:
 *   1. Squared overall weighted score gap — lets signed per-skill gaps cancel.
 *   2. Weighted per-skill squared spread — gently discourages style mismatch.
 *   3. Soft cap penalty on any single-skill gap above maxSkillGap.
 */
export function balanceLoss(
  a: Skillable[],
  b: Skillable[],
  w: Weights,
  maxSkillGap: number = DEFAULT_MAX_SKILL_GAP
) {
  const avgA = skillAverages(a)
  const avgB = skillAverages(b)

  const dBat   = avgA.batting  - avgB.batting
  const dBowl  = avgA.bowling  - avgB.bowling
  const dField = avgA.fielding - avgB.fielding

  const overallGap = w.batting * dBat + w.bowling * dBowl + w.fielding * dField

  const perSkillSpread =
    w.batting  * dBat   * dBat  +
    w.bowling  * dBowl  * dBowl +
    w.fielding * dField * dField

  const overage = (d: number) => Math.max(0, Math.abs(d) - maxSkillGap)
  const oBat   = overage(dBat)
  const oBowl  = overage(dBowl)
  const oField = overage(dField)
  const capPenalty = CAP_PENALTY * (oBat * oBat + oBowl * oBowl + oField * oField)

  // Spread players who need a runner evenly across both teams.
  const runnersA = a.filter(p => p.needs_runner).length
  const runnersB = b.filter(p => p.needs_runner).length
  const dRun = runnersA - runnersB
  const runnerPenalty = RUNNER_PENALTY * dRun * dRun

  // Keep the strongest batsmen split across teams (see TOP_ORDER_PENALTY above).
  const topOrderPenalty = TOP_ORDER_PENALTY * topOrderBattingLoss(a, b)

  return (
    overallGap * overallGap +
    STYLE_PENALTY * perSkillSpread +
    capPenalty +
    runnerPenalty +
    topOrderPenalty
  )
}

/**
 * How many free players belong on team A so both sides have equal headcount
 * (given fixed/seeded players already on each side).
 */
export function freeCountForTeamA(fixedA: number, fixedB: number, freeCount: number): number {
  const total = fixedA + fixedB + freeCount
  const targetA = Math.floor(total / 2)
  return targetA - fixedA
}

/**
 * Enumerate every C(free.length, freeToA) split of `free`, prepending fixed players
 * to each side. Returns the split with minimum balance loss.
 */
function bruteForceSplit<T extends Skillable>(
  free: T[],
  w: Weights,
  maxSkillGap: number,
  fixedA: T[],
  fixedB: T[]
): { teamA: T[]; teamB: T[] } {
  const n = free.length
  const freeToA = Math.max(0, Math.min(n, freeCountForTeamA(fixedA.length, fixedB.length, n)))

  let bestLoss = Infinity
  let bestIndices: number[] = []

  const indices = new Array<number>(freeToA)

  function recurse(start: number, depth: number) {
    if (depth === freeToA) {
      const aPicked: T[] = []
      const bPicked: T[] = []
      const inA = new Set(indices)
      for (let i = 0; i < n; i++) {
        if (inA.has(i)) aPicked.push(free[i])
        else bPicked.push(free[i])
      }
      const loss = balanceLoss(
        [...fixedA, ...aPicked],
        [...fixedB, ...bPicked],
        w,
        maxSkillGap
      )
      if (loss < bestLoss) {
        bestLoss = loss
        bestIndices = [...indices]
      }
      return
    }
    const remaining = freeToA - depth
    for (let i = start; i <= n - remaining; i++) {
      indices[depth] = i
      recurse(i + 1, depth + 1)
    }
  }

  if (n === 0) {
    return { teamA: [...fixedA], teamB: [...fixedB] }
  }

  recurse(0, 0)

  const inA = new Set(bestIndices)
  const teamA: T[] = []
  const teamB: T[] = []
  for (let i = 0; i < n; i++) {
    if (inA.has(i)) teamA.push(free[i])
    else teamB.push(free[i])
  }
  return { teamA: [...fixedA, ...teamA], teamB: [...fixedB, ...teamB] }
}

export function simulatedAnnealing<T extends Skillable>(
  players: T[],
  w: Weights,
  fixedA: T[] = [],
  fixedB: T[] = [],
  maxSkillGap: number = DEFAULT_MAX_SKILL_GAP
): { teamA: T[]; teamB: T[] } {
  if (players.length === 0) return { teamA: [...fixedA], teamB: [...fixedB] }

  const n = players.length
  const freeToA = Math.max(0, Math.min(n, freeCountForTeamA(fixedA.length, fixedB.length, n)))
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  let teamA = shuffled.slice(0, freeToA)
  let teamB = shuffled.slice(freeToA)

  let currentLoss = balanceLoss([...fixedA, ...teamA], [...fixedB, ...teamB], w, maxSkillGap)
  let temp = 3.0

  for (let iter = 0; iter < 5000; iter++) {
    if (teamB.length === 0) break
    const iA = Math.floor(Math.random() * teamA.length)
    const iB = Math.floor(Math.random() * teamB.length)
    const newA = [...teamA]
    const newB = [...teamB]
    ;[newA[iA], newB[iB]] = [newB[iB], newA[iA]]

    const newLoss = balanceLoss([...fixedA, ...newA], [...fixedB, ...newB], w, maxSkillGap)
    const delta = newLoss - currentLoss
    if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
      teamA = newA
      teamB = newB
      currentLoss = newLoss
    }
    temp *= 0.997
  }

  return { teamA: [...fixedA, ...teamA], teamB: [...fixedB, ...teamB] }
}

/**
 * Optimal-or-near-optimal balance: uses exact brute-force search for small
 * free-player counts (deterministic, guaranteed minimum loss), and falls back
 * to simulated annealing for larger pools.
 */
export function optimalBalance<T extends Skillable>(
  players: T[],
  w: Weights,
  fixedA: T[] = [],
  fixedB: T[] = [],
  maxSkillGap: number = DEFAULT_MAX_SKILL_GAP
): { teamA: T[]; teamB: T[] } {
  if (players.length <= BRUTE_FORCE_LIMIT) {
    return bruteForceSplit(players, w, maxSkillGap, fixedA, fixedB)
  }
  return simulatedAnnealing(players, w, fixedA, fixedB, maxSkillGap)
}

// ─── Full team balancing (seeding + non-bowlers + odd-man sub) ────────────────

// A player the team builder can balance: a skill profile plus the identity,
// pre-computed overall score, and seeding needed by balanceWithSub.
export type BalanceablePlayer = Skillable & {
  id: string
  score: number
  preset_team: 'A' | 'B' | null
}

export type BalancedTeams<T> = { teamA: T[]; teamB: T[] }

/**
 * Place "floater" players (non-bowlers + an optional odd-man sub) onto two
 * already-balanced teams. Each floater goes to the smaller side, or — when the
 * sides are level — to whichever side yields the lower balance loss. Floaters
 * are placed strongest-first so the most impactful picks settle the balance.
 */
export function placeFloaters<T extends BalanceablePlayer>(
  teamA: T[],
  teamB: T[],
  floaters: T[],
  weights: Weights,
  maxSkillGap: number
): BalancedTeams<T> {
  let a = [...teamA]
  let b = [...teamB]
  const ordered = [...floaters].sort((x, y) => y.score - x.score)

  for (const f of ordered) {
    if (a.length < b.length) {
      a = [...a, f]
    } else if (b.length < a.length) {
      b = [...b, f]
    } else {
      const lossOnA = balanceLoss([...a, f], b, weights, maxSkillGap)
      const lossOnB = balanceLoss(a, [...b, f], weights, maxSkillGap)
      if (lossOnA <= lossOnB) a = [...a, f]
      else b = [...b, f]
    }
  }

  return { teamA: a, teamB: b }
}

/**
 * Balance present players into two teams with these priorities:
 *   1. Equal bowler counts — only the bowlers are balanced (seeded bowlers fixed
 *      to their side, free bowlers distributed). Because every player fed to the
 *      optimiser is a bowler, equal headcount means equal bowler count. Both
 *      teams end up with the same number of bowlers (±1 only when the total
 *      bowler count is genuinely odd, in which case the weakest bowler subs out).
 *   2. Equal team sizes (±1) — seeded non-bowlers are re-attached and free
 *      non-bowlers are placed as floaters to even out headcount.
 *   3. Skill balance + runner spread + top-order batting split (handled inside
 *      optimalBalance / balanceLoss).
 */
export function balanceWithSub<T extends BalanceablePlayer>(
  players: T[],
  weights: Weights,
  keepPreseeded: boolean,
  maxSkillGap: number
): BalancedTeams<T> {
  const seededA = keepPreseeded ? players.filter(p => p.preset_team === 'A') : []
  const seededB = keepPreseeded ? players.filter(p => p.preset_team === 'B') : []
  const free = keepPreseeded ? players.filter(p => !p.preset_team) : players

  // Bowler count is balanced via optimalBalance; non-bowlers are placed after
  // as floaters so they never distort the bowling split.
  const seededBowlersA = seededA.filter(isBowler)
  const seededBowlersB = seededB.filter(isBowler)
  const seededNonBowlersA = seededA.filter(p => !isBowler(p))
  const seededNonBowlersB = seededB.filter(p => !isBowler(p))
  const freeBowlers = free.filter(isBowler)
  const freeNonBowlers = free.filter(p => !isBowler(p))

  // Floaters: every free non-bowler, plus the weakest free bowler as the sub
  // when the total bowler count is odd (so the balanced core stays even).
  const floaters: T[] = [...freeNonBowlers]
  let coreFreeBowlers = freeBowlers
  const totalBowlers = seededBowlersA.length + seededBowlersB.length + freeBowlers.length
  if (totalBowlers % 2 !== 0 && freeBowlers.length > 0) {
    const sub = [...freeBowlers].sort((a, b) => a.score - b.score)[0]
    coreFreeBowlers = freeBowlers.filter(p => p.id !== sub.id)
    floaters.push(sub)
  }

  const balanced = optimalBalance(coreFreeBowlers, weights, seededBowlersA, seededBowlersB, maxSkillGap)
  const teamA = [...balanced.teamA, ...seededNonBowlersA]
  const teamB = [...balanced.teamB, ...seededNonBowlersB]

  if (floaters.length === 0) {
    return { teamA, teamB }
  }
  return placeFloaters(teamA, teamB, floaters, weights, maxSkillGap)
}

export function ratingBadge(val: number) {
  if (val >= 7) return 'bg-green-100 text-green-700'
  if (val >= 4) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

export function ratingTextColor(val: number) {
  if (val >= 7) return 'text-green-600'
  if (val >= 4) return 'text-amber-500'
  return 'text-red-500'
}
