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

export function balanceLoss(a: Skillable[], b: Skillable[], w: Weights) {
  const avgA = skillAverages(a)
  const avgB = skillAverages(b)
  return (
    w.batting  * Math.abs(avgA.batting  - avgB.batting)  +
    w.bowling  * Math.abs(avgA.bowling  - avgB.bowling)  +
    w.fielding * Math.abs(avgA.fielding - avgB.fielding)
  )
}

export function simulatedAnnealing<T extends Skillable>(
  players: T[],
  w: Weights
): { teamA: T[]; teamB: T[] } {
  const halfA = Math.ceil(players.length / 2)
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  let teamA = shuffled.slice(0, halfA)
  let teamB = shuffled.slice(halfA)

  let currentLoss = balanceLoss(teamA, teamB, w)
  let temp = 3.0

  for (let iter = 0; iter < 5000; iter++) {
    const iA = Math.floor(Math.random() * teamA.length)
    const iB = Math.floor(Math.random() * teamB.length)
    const newA = [...teamA]
    const newB = [...teamB]
    ;[newA[iA], newB[iB]] = [newB[iB], newA[iA]]

    const newLoss = balanceLoss(newA, newB, w)
    const delta = newLoss - currentLoss
    if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
      teamA = newA
      teamB = newB
      currentLoss = newLoss
    }
    temp *= 0.997
  }

  return { teamA, teamB }
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
