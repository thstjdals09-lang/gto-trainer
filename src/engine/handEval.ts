import { RANKS, SUITS, type Card, type Rank, type Suit } from '../types'

const RANK_VALUE: Record<Rank, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 }

export const HAND_CATEGORIES = [
  'straight-flush', 'quads', 'full-house', 'flush', 'straight', 'set', 'trips', 'two-pair',
  'overpair', 'top-pair', 'second-pair', 'low-pair', 'underpair',
  'flush-draw', 'oesd', 'gutshot', 'overcards', 'air',
] as const
export type HandCategory = (typeof HAND_CATEGORIES)[number]

/** Pick one concrete combo for a 169-grid hand name (e.g. "AKs", "TT", "76o") avoiding board cards. */
export function representativeCombo(handName: string, board: Card[]): [Card, Card] | null {
  const r1 = handName[0] as Rank
  const r2 = handName[1] as Rank
  const suited = handName.endsWith('s')
  const isPair = r1 === r2
  const used = (r: Rank, s: Suit) => board.some((c) => c.rank === r && c.suit === s)

  if (isPair) {
    const free = SUITS.filter((s) => !used(r1, s))
    if (free.length < 2) return null
    return [{ rank: r1, suit: free[0] }, { rank: r2, suit: free[1] }]
  }
  if (suited) {
    const suit = SUITS.find((s) => !used(r1, s) && !used(r2, s))
    if (!suit) return null
    return [{ rank: r1, suit }, { rank: r2, suit }]
  }
  const s1 = SUITS.find((s) => !used(r1, s))
  if (!s1) return null
  const s2 = SUITS.find((s) => s !== s1 && !used(r2, s))
  if (!s2) return null
  return [{ rank: r1, suit: s1 }, { rank: r2, suit: s2 }]
}

function distinctSortedRanks(cards: Card[]): number[] {
  return [...new Set(cards.map((c) => RANK_VALUE[c.rank]))].sort((a, b) => b - a)
}

function hasStraight(ranks: number[]): boolean {
  const set = new Set(ranks)
  if (set.has(14)) set.add(1) // wheel
  const sorted = [...set].sort((a, b) => a - b)
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++
      if (run >= 5) return true
    } else if (sorted[i] !== sorted[i - 1]) {
      run = 1
    }
  }
  return false
}

function openEndedDraw(ranks: number[]): boolean {
  const set = new Set(ranks)
  const sorted = [...set].sort((a, b) => a - b)
  for (let i = 0; i + 3 < sorted.length; i++) {
    if (sorted[i + 3] - sorted[i] === 3) {
      // 4 consecutive ranks; open-ended if not blocked on both ends (top isn't A used as low, roughly)
      return true
    }
  }
  return false
}

function gutshotDraw(ranks: number[]): boolean {
  const set = new Set(ranks)
  if (set.has(14)) set.add(1)
  const sorted = [...set].sort((a, b) => a - b)
  for (let i = 0; i + 3 < sorted.length; i++) {
    const span = sorted[i + 3] - sorted[i]
    if (span === 4) return true // 4 cards spanning 5 ranks = one gap
  }
  return false
}

export function classifyHand(hole: [Card, Card], board: Card[]): HandCategory {
  const all = [...hole, ...board]
  const rankCounts = new Map<Rank, number>()
  const suitCounts = new Map<Suit, number>()
  for (const c of all) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1)
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1)
  }
  const flushSuit = [...suitCounts.entries()].find(([, n]) => n >= 5)?.[0]
  const straightMade = hasStraight(distinctSortedRanks(all))

  if (flushSuit && straightMade) {
    const flushCards = all.filter((c) => c.suit === flushSuit)
    if (hasStraight(distinctSortedRanks(flushCards))) return 'straight-flush'
  }

  const counts = [...rankCounts.entries()].sort((a, b) => b[1] - a[1] || RANK_VALUE[b[0]] - RANK_VALUE[a[0]])
  const isPocketPair = hole[0].rank === hole[1].rank
  const boardRanks = board.map((c) => RANK_VALUE[c.rank])
  const maxBoardRank = boardRanks.length ? Math.max(...boardRanks) : 0

  if (counts[0][1] === 4) return 'quads'
  if (counts[0][1] === 3 && counts[1]?.[1] >= 2) return 'full-house'
  if (flushSuit) return 'flush'
  if (straightMade) return 'straight'

  if (counts[0][1] === 3) {
    const tripRank = counts[0][0]
    if (isPocketPair && hole[0].rank === tripRank) return 'set'
    return 'trips'
  }

  const pairRanks = counts.filter(([, n]) => n === 2).map(([r]) => r)
  if (isPocketPair && pairRanks.includes(hole[0].rank) && !board.some((c) => c.rank === hole[0].rank)) {
    // pocket pair, not matched by the board (no set) — describe relative to board, not as "two pair"
    return RANK_VALUE[hole[0].rank] > maxBoardRank ? 'overpair' : 'underpair'
  }
  if (pairRanks.length >= 2) return 'two-pair'
  if (pairRanks.length === 1) {
    const pairRank = pairRanks[0]
    if (isPocketPair) return RANK_VALUE[pairRank] > maxBoardRank ? 'overpair' : 'underpair'
    const sortedBoard = [...new Set(boardRanks)].sort((a, b) => b - a)
    const idx = sortedBoard.indexOf(RANK_VALUE[pairRank])
    if (idx === 0) return 'top-pair'
    if (idx === 1) return 'second-pair'
    return 'low-pair'
  }

  // no pair yet — look for draws (only meaningful with 2+ cards still to come)
  if (board.length > 0 && board.length < 5) {
    const heroSuits = new Set(hole.map((c) => c.suit))
    const heroFlushDraw = [...heroSuits].some((s) => (suitCounts.get(s) ?? 0) === 4)
    const ranks = distinctSortedRanks(all)
    if (heroFlushDraw) return 'flush-draw'
    if (openEndedDraw(ranks)) return 'oesd'
    if (gutshotDraw(ranks)) return 'gutshot'
  }

  const holeRanks = hole.map((c) => RANK_VALUE[c.rank])
  if (board.length > 0 && Math.min(...holeRanks) > maxBoardRank) return 'overcards'
  return 'air'
}

export { RANK_VALUE, RANKS }
