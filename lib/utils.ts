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
