import { rawCharts } from '../data/chartData'
import { comboCount, generateHandGrid, normalizeCell, type Chart, type Position, type PokerAction, type RawCell, type Scenario, type WeightedCell } from '../types'

function chartKey(hero: Position, scenario: Scenario, villain?: Position): string {
  return villain ? `${hero}-${scenario}-${villain}` : `${hero}-${scenario}`
}

/**
 * Villains ordered "closest position first" for a given scenario, used as a
 * fallback when the exact hero/scenario/villain combo has no chart in the pack
 * (the source data doesn't cover every villain for every hero).
 */
function fallbackVillainOrder(hero: Position, villain: Position): Position[] {
  const order: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
  return [...order].sort((a, b) => {
    const da = Math.abs(order.indexOf(a) - order.indexOf(villain))
    const db = Math.abs(order.indexOf(b) - order.indexOf(villain))
    return da - db
  }).filter((p) => p !== hero)
}

export function getRawChart(hero: Position, scenario: Scenario, villain?: Position): Chart | null {
  const direct = rawCharts[chartKey(hero, scenario, villain)]
  if (direct) return direct

  if (villain) {
    for (const candidate of fallbackVillainOrder(hero, villain)) {
      const found = rawCharts[chartKey(hero, scenario, candidate)]
      if (found) return found
    }
  }
  return null
}

/** Default cell when no chart data exists at all for a hero/scenario: fold everything. */
const EMPTY_CHART: Chart = {}

export function getChart(hero: Position, scenario: Scenario, villain?: Position): Chart {
  return getRawChart(hero, scenario, villain) ?? EMPTY_CHART
}

export function getCell(chart: Chart, hand: string): WeightedCell {
  return normalizeCell(chart[hand])
}

/**
 * Collapse a cell so it only offers fold/call when the hero is facing an all-in
 * (no further raising is possible) — any raise/allin recommendation becomes a call.
 */
export function collapseToCallFold(cell: WeightedCell): WeightedCell {
  const raiseFreq = (cell.actions.raise ?? 0) + (cell.actions.allin ?? 0)
  const callFreq = (cell.actions.call ?? 0) + raiseFreq
  if (callFreq <= 0) return { weight: cell.weight, actions: { fold: 100 } }
  return { weight: cell.weight, actions: { call: callFreq } }
}

/**
 * Merge raise+allin into a single "allin" bucket — used for short-stack (<=20bb)
 * spots where there's no meaningful non-shove raise size.
 */
export function collapseToShoveFold(cell: WeightedCell): WeightedCell {
  const shoveFreq = (cell.actions.raise ?? 0) + (cell.actions.allin ?? 0)
  const callFreq = cell.actions.call ?? 0
  const actions: WeightedCell['actions'] = {}
  if (shoveFreq > 0) actions.allin = shoveFreq
  if (callFreq > 0) actions.call = callFreq
  if (Object.keys(actions).length === 0) actions.fold = 100
  return { weight: cell.weight, actions }
}

export function getDisplayCell(chart: Chart, hand: string, cellMode: 'raw' | 'callfold' | 'shovefold'): WeightedCell {
  const cell = getCell(chart, hand)
  if (cellMode === 'callfold') return collapseToCallFold(cell)
  if (cellMode === 'shovefold') return collapseToShoveFold(cell)
  return cell
}

const grid = generateHandGrid()

export interface ActionTotal {
  combos: number
  pct: number
}

/** Aggregate combo counts / % across all 169 hands for each action in a chart. */
export function computeActionTotals(chart: Chart, cellMode: 'raw' | 'callfold' | 'shovefold'): Record<PokerAction, ActionTotal> {
  const combos: Record<PokerAction, number> = { fold: 0, call: 0, raise: 0, allin: 0 }
  let totalCombos = 0
  for (const row of grid) {
    for (const hand of row) {
      const n = comboCount(hand)
      totalCombos += n
      const cell = getDisplayCell(chart, hand.name, cellMode)
      combos.fold += (n * (100 - cell.weight)) / 100
      for (const action of ['call', 'raise', 'allin'] as PokerAction[]) {
        combos[action] += (n * cell.weight * (cell.actions[action] ?? 0)) / 10000
      }
    }
  }
  const out = {} as Record<PokerAction, ActionTotal>
  for (const action of ['fold', 'call', 'raise', 'allin'] as PokerAction[]) {
    out[action] = { combos: combos[action], pct: totalCombos > 0 ? (combos[action] / totalCombos) * 100 : 0 }
  }
  return out
}

export function aggressiveWeight(rawCell: RawCell | undefined): number {
  const cell = normalizeCell(rawCell)
  const raiseFreq = (cell.actions.raise ?? 0) + (cell.actions.allin ?? 0)
  return (cell.weight * raiseFreq) / 100
}
