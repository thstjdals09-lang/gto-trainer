import { comboCount, generateHandGrid, type Card } from '../types'
import { classifyHand, representativeCombo, type HandCategory } from './handEval'

export type PostflopAction = 'check' | 'bet-small' | 'bet-big'

const HEURISTIC: Record<HandCategory, Record<PostflopAction, number>> = {
  'straight-flush': { check: 5, 'bet-small': 15, 'bet-big': 80 },
  quads: { check: 5, 'bet-small': 15, 'bet-big': 80 },
  'full-house': { check: 5, 'bet-small': 15, 'bet-big': 80 },
  flush: { check: 8, 'bet-small': 22, 'bet-big': 70 },
  straight: { check: 8, 'bet-small': 22, 'bet-big': 70 },
  set: { check: 5, 'bet-small': 20, 'bet-big': 75 },
  trips: { check: 10, 'bet-small': 25, 'bet-big': 65 },
  'two-pair': { check: 20, 'bet-small': 35, 'bet-big': 45 },
  overpair: { check: 20, 'bet-small': 35, 'bet-big': 45 },
  'top-pair': { check: 40, 'bet-small': 45, 'bet-big': 15 },
  'second-pair': { check: 65, 'bet-small': 25, 'bet-big': 10 },
  'low-pair': { check: 65, 'bet-small': 25, 'bet-big': 10 },
  underpair: { check: 70, 'bet-small': 22, 'bet-big': 8 },
  'flush-draw': { check: 45, 'bet-small': 40, 'bet-big': 15 },
  oesd: { check: 45, 'bet-small': 40, 'bet-big': 15 },
  gutshot: { check: 60, 'bet-small': 30, 'bet-big': 10 },
  overcards: { check: 70, 'bet-small': 25, 'bet-big': 5 },
  air: { check: 75, 'bet-small': 20, 'bet-big': 5 },
}

export interface HandRangeEntry {
  hand: string
  combos: number
  weight: number // 0-100, preflop-continuing weight
  category: HandCategory | null // null if no valid combo left (blocked by board)
}

const grid = generateHandGrid()

export function buildRangeWithCategories(preflopWeights: Record<string, number>, board: Card[]): HandRangeEntry[] {
  const entries: HandRangeEntry[] = []
  for (const row of grid) {
    for (const hand of row) {
      const weight = preflopWeights[hand.name] ?? 0
      if (weight <= 0) continue
      const combo = representativeCombo(hand.name, board)
      const category = combo ? classifyHand(combo, board) : null
      entries.push({ hand: hand.name, combos: comboCount(hand), weight, category })
    }
  }
  return entries
}

/** Per-hand action-frequency split (0-100 each, sums to 100) for rendering an action-colored grid cell. */
export function handActionDistribution(entry: HandRangeEntry): Record<PostflopAction, number> {
  if (!entry.category) return { check: 0, 'bet-small': 0, 'bet-big': 0 }
  return HEURISTIC[entry.category]
}

export function aggregatePostflopAction(entries: HandRangeEntry[]): Record<PostflopAction, number> {
  const totals: Record<PostflopAction, number> = { check: 0, 'bet-small': 0, 'bet-big': 0 }
  let totalCombos = 0
  for (const e of entries) {
    if (!e.category) continue
    const combos = (e.combos * e.weight) / 100
    const dist = HEURISTIC[e.category]
    totals.check += (combos * dist.check) / 100
    totals['bet-small'] += (combos * dist['bet-small']) / 100
    totals['bet-big'] += (combos * dist['bet-big']) / 100
    totalCombos += combos
  }
  if (totalCombos <= 0) return totals
  return {
    check: (totals.check / totalCombos) * 100,
    'bet-small': (totals['bet-small'] / totalCombos) * 100,
    'bet-big': (totals['bet-big'] / totalCombos) * 100,
  }
}
