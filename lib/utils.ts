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

// Hybrid loss tunables.
// STYLE_PENALTY weights per-skill spread relative to the overall score gap.
// Higher → more punishment for "batting team vs bowling team" type splits.
const STYLE_PENALTY = 0.3
// CAP_PENALTY is multiplied by the squared overage of any single skill gap
// above the configured maxSkillGap. Large enough to dominate when feasible,
// but never produces NaN/Infinity so the optimiser always returns a result.
const CAP_PENALTY = 100

// Brute force becomes expensive past C(20, 10) ≈ 184k; above this we use SA.
const BRUTE_FORCE_LIMIT = 20

export function calcScore(
  p: { batting_rating: number; bowling_rating: number; fielding_rating: number },
  w: Weights = DEFAULT_WEIGHTS
) {
  return p.batting_rating * w.batting + p.bowling_rating * w.bowling + p.fielding_rating * w.fielding
}

type Skillable = { batting_rating: number; bowling_rating: number; fielding_rating: number }

export function skillAverages(team: Skillable[]) {
  const n = team.length || 1
  return {
    batting: team.reduce((s, p) => s + p.batting_rating, 0) / n,
    bowling: team.reduce((s, p) => s + p.bowling_rating, 0) / n,
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

  return overallGap * overallGap + STYLE_PENALTY * perSkillSpread + capPenalty
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
