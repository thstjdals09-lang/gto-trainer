import { accumulateEquity, buildSampledRunouts, finalizeMatrix, type EquityAccumulators } from './equity'
import { getChart, chartActionRange } from './chart'
import { buildConcreteRange, toPackedCard } from './solverBridge'
import { SHOVE_FOLD_THRESHOLD } from './sizing'
import { representativeCombo } from './handEval'
import { generateHandGrid, type Position, type Scenario, type StackDepth } from '../types'

const grid = generateHandGrid()

/**
 * Maps hero's facing-scenario to what the villain actually did to create this decision node,
 * so we can pull villain's real continuing range from the same chart data instead of guessing.
 * No entry for 'RFI': the opener has no specific villain yet (everyone still to act), so a
 * single-opponent equity number isn't well-defined there.
 */
function villainRangeForHeroScenario(
  heroScenario: Scenario,
  heroPos: Position,
  villainPos: Position,
  stack: StackDepth
): Record<string, number> | null {
  const cellMode = stack <= SHOVE_FOLD_THRESHOLD ? 'shovefold' : 'raw'
  if (heroScenario === 'vs-open') {
    const chart = getChart(villainPos, 'RFI')
    const raise = chartActionRange(chart, cellMode, 'raise')
    const allin = chartActionRange(chart, cellMode, 'allin')
    return mergeWeights(raise, allin)
  }
  if (heroScenario === 'vs-3bet') {
    const chart = getChart(villainPos, 'vs-open', heroPos)
    const raise = chartActionRange(chart, cellMode, 'raise')
    const allin = chartActionRange(chart, cellMode, 'allin')
    return mergeWeights(raise, allin)
  }
  if (heroScenario === 'vs-4bet') {
    const chart = getChart(villainPos, 'vs-3bet', heroPos)
    return chartActionRange(chart, 'raw', 'allin')
  }
  return null
}

function mergeWeights(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const [hand, w] of Object.entries(b)) out[hand] = (out[hand] ?? 0) + w
  return out
}

export interface PreflopEquityResult {
  /** hero's all-in equity (0-1) vs the villain's implied range, one value per 169-grid hand. */
  equityByHand: Record<string, number>
  villainCombosCount: number
}

/**
 * Rough preflop EV proxy: Monte Carlo all-in equity (random full-board runouts, since no board
 * exists yet) of hero's range against the specific villain's chart-implied continuing range for
 * this decision. This is NOT a real preflop solve (no fold equity, no postflop play modeled) —
 * just "if this went to showdown", which is the best honestly-computable number without a full
 * multi-street preflop solver.
 */
export function computePreflopEquity(
  heroScenario: Scenario,
  heroPos: Position,
  villainPos: Position | undefined,
  stack: StackDepth,
  sampleCount = 100
): PreflopEquityResult | null {
  if (!villainPos) return null
  const villainWeights = villainRangeForHeroScenario(heroScenario, heroPos, villainPos, stack)
  if (!villainWeights || Object.keys(villainWeights).length === 0) return null

  const villain = buildConcreteRange(villainWeights, [])
  if (villain.combos.length === 0) return null

  const heroCombos: number[][] = []
  const heroHandNames: string[] = []
  for (const row of grid) {
    for (const hand of row) {
      const combo = representativeCombo(hand.name, [])
      if (!combo) continue
      heroCombos.push([toPackedCard(combo[0]), toPackedCard(combo[1])])
      heroHandNames.push(hand.name)
    }
  }

  const runouts = buildSampledRunouts([], 5, sampleCount)
  const H = heroCombos.length
  const V = villain.combos.length
  const acc: EquityAccumulators = { wins: new Float64Array(H * V), ties: new Float64Array(H * V), total: new Float64Array(H * V) }
  accumulateEquity(heroCombos, villain.combos, [], runouts, acc)
  const { matrix } = finalizeMatrix(H, V, acc)

  const equityByHand: Record<string, number> = {}
  for (let h = 0; h < H; h++) {
    let acc2 = 0
    let wsum = 0
    for (let v = 0; v < V; v++) {
      const eq = matrix[h * V + v]
      if (Number.isNaN(eq)) continue
      const w = villain.weights[v]
      acc2 += eq * w
      wsum += w
    }
    if (wsum > 0) equityByHand[heroHandNames[h]] = acc2 / wsum
  }
  return { equityByHand, villainCombosCount: villain.combos.length }
}
