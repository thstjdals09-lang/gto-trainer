import { packCard } from './evaluator'
import { allCombosForHand } from './handEval'
import type { InfosetStrategy, StreetAction } from './postflopSolver'
import { generateHandGrid, type Card, type Rank, type Suit } from '../types'

const SUIT_INDEX: Record<Suit, number> = { s: 0, h: 1, d: 2, c: 3 }
const RANK_VALUE: Record<Rank, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 }

export function toPackedCard(card: Card): number {
  return packCard(RANK_VALUE[card.rank], SUIT_INDEX[card.suit])
}

export function toPackedBoard(board: Card[]): number[] {
  return board.map(toPackedCard)
}

const grid = generateHandGrid()

/**
 * Expands a 169-abstract-hand weight map (0-100 per hand, from the preflop chart engine) into
 * every concrete card combo still possible given the board, each carrying weight/100 as its
 * mass (uniform across a hand's combos — the source chart data has no per-suit granularity).
 */
export function buildConcreteRange(
  preflopWeights: Record<string, number>,
  board: Card[]
): { combos: number[][]; weights: number[]; handNames: string[] } {
  const combos: number[][] = []
  const weights: number[] = []
  const handNames: string[] = []
  const boardPacked = toPackedBoard(board)
  const boardSet = new Set(boardPacked)

  for (const row of grid) {
    for (const hand of row) {
      const weight = preflopWeights[hand.name] ?? 0
      if (weight <= 0) continue
      for (const [c1, c2] of allCombosForHand(hand.name)) {
        const p1 = toPackedCard(c1)
        const p2 = toPackedCard(c2)
        if (boardSet.has(p1) || boardSet.has(p2)) continue
        combos.push([p1, p2])
        weights.push(weight / 100)
        handNames.push(hand.name)
      }
    }
  }
  return { combos, weights, handNames }
}

export interface GridCellStrategy {
  weight: number // 0-100, this hand's prior (preflop-continuing) weight
  combos: number // surviving concrete combos for this hand on this board (blocked ones excluded)
  actions: Partial<Record<StreetAction, number>> // 0-100 each, solved frequency within this hand
}

/** Averages a solved per-combo strategy up to the 169-grid, weighted by each combo's prior weight. */
export function aggregateStrategyToGrid(
  handNames: string[],
  priorWeights: number[],
  strategy: InfosetStrategy
): Record<string, GridCellStrategy> {
  const sumWeight = new Map<string, number>()
  const comboCounts = new Map<string, number>()
  const sumAction = new Map<string, Partial<Record<StreetAction, number>>>()

  for (let i = 0; i < handNames.length; i++) {
    const hand = handNames[i]
    const w = priorWeights[i]
    sumWeight.set(hand, (sumWeight.get(hand) ?? 0) + w)
    comboCounts.set(hand, (comboCounts.get(hand) ?? 0) + 1)
    let actionMap = sumAction.get(hand)
    if (!actionMap) {
      actionMap = {}
      sumAction.set(hand, actionMap)
    }
    for (const a of strategy.actions) {
      actionMap[a] = (actionMap[a] ?? 0) + w * strategy.strategy[a][i]
    }
  }

  const out: Record<string, GridCellStrategy> = {}
  for (const [hand, totalW] of sumWeight) {
    const actionSums = sumAction.get(hand)!
    const n = comboCounts.get(hand) ?? 1
    const actions: Partial<Record<StreetAction, number>> = {}
    for (const a of strategy.actions) actions[a] = totalW > 0 ? ((actionSums[a] ?? 0) / totalW) * 100 : 0
    out[hand] = { weight: (totalW / n) * 100, combos: n, actions }
  }
  return out
}

export function aggregateGridTotals(grid: Record<string, GridCellStrategy>): Partial<Record<StreetAction, { pct: number; combos: number }>> {
  const totals: Partial<Record<StreetAction, number>> = {}
  let totalCombos = 0
  for (const cell of Object.values(grid)) {
    if (cell.weight <= 0) continue
    totalCombos += cell.combos
    for (const [action, pct] of Object.entries(cell.actions)) {
      totals[action as StreetAction] = (totals[action as StreetAction] ?? 0) + cell.combos * ((pct ?? 0) / 100)
    }
  }
  const out: Partial<Record<StreetAction, { pct: number; combos: number }>> = {}
  for (const [action, combos] of Object.entries(totals)) {
    out[action as StreetAction] = { combos, pct: totalCombos > 0 ? (combos / totalCombos) * 100 : 0 }
  }
  return out
}
