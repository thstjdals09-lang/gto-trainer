import { rawCharts } from '../data/chartData'
import {
  CHART_POSITIONS,
  comboCount,
  generateHandGrid,
  normalizeCell,
  type Chart,
  type ChartPosition,
  type Position,
  type PokerAction,
  type RawCell,
  type Scenario,
  type WeightedCell,
} from '../types'

/**
 * 9-max seats map onto the 6-max chart pack by counting seats back from the
 * button — CO/HJ/BTN/SB/BB line up directly; UTG/UTG1/UTG2/MP (no dedicated
 * data) all clamp to the pack's tightest reference, "UTG".
 */
export const CHART_POSITION_MAP: Record<Position, ChartPosition> = {
  UTG: 'UTG',
  UTG1: 'UTG',
  UTG2: 'UTG',
  MP: 'UTG',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
}

function chartKey(hero: ChartPosition, scenario: Scenario, villain?: ChartPosition): string {
  return villain ? `${hero}-${scenario}-${villain}` : `${hero}-${scenario}`
}

/**
 * Villains ordered "closest position first" for a given scenario, used as a
 * fallback when the exact hero/scenario/villain combo has no chart in the pack
 * (the source data doesn't cover every villain for every hero).
 */
function fallbackVillainOrder(hero: ChartPosition, villain: ChartPosition): ChartPosition[] {
  const order = CHART_POSITIONS
  return [...order].sort((a, b) => {
    const da = Math.abs(order.indexOf(a) - order.indexOf(villain))
    const db = Math.abs(order.indexOf(b) - order.indexOf(villain))
    return da - db
  }).filter((p) => p !== hero)
}

export function getRawChart(hero: Position, scenario: Scenario, villain?: Position): Chart | null {
  let chartHero = CHART_POSITION_MAP[hero]
  const chartVillain = villain ? CHART_POSITION_MAP[villain] : undefined
  // UTG/UTG1/UTG2/MP all clamp to the same "UTG" reference, so a later one of
  // them facing an earlier one's open collides onto "UTG vs UTG" — a spot
  // that can't exist in the source data (real UTG never faces an open at
  // all). Nudge hero one seat later so it's asking a real, answerable
  // question ("HJ facing UTG's open" instead of "UTG facing UTG's open").
  if (chartVillain && chartHero === chartVillain) {
    chartHero = CHART_POSITIONS[Math.min(CHART_POSITIONS.indexOf(chartHero) + 1, CHART_POSITIONS.length - 1)]
  }
  const direct = rawCharts[chartKey(chartHero, scenario, chartVillain)]
  if (direct) return direct

  if (chartVillain) {
    for (const candidate of fallbackVillainOrder(chartHero, chartVillain)) {
      const found = rawCharts[chartKey(chartHero, scenario, candidate)]
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

/** The portion of a chart's range that takes one specific action, as a 169-hand weight map (0-100). */
export function chartActionRange(chart: Chart, cellMode: 'raw' | 'callfold' | 'shovefold', action: PokerAction): Record<string, number> {
  const weights: Record<string, number> = {}
  for (const row of grid) {
    for (const hand of row) {
      const cell = getDisplayCell(chart, hand.name, cellMode)
      const pct = (cell.weight * (cell.actions[action] ?? 0)) / 100
      if (pct > 0.001) weights[hand.name] = pct
    }
  }
  return weights
}

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
      // hands not in the range at all (weight<100) are fold, PLUS any explicit
      // fold share within the weighted portion (unlisted hands default to
      // weight:100/actions:{fold:100}; mixed cells like ['raise','fold'] too).
      combos.fold += (n * (100 - cell.weight)) / 100
      for (const action of ['fold', 'call', 'raise', 'allin'] as PokerAction[]) {
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
