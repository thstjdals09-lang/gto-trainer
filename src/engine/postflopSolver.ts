import type { EquityMatrix } from './equity'

export type StreetAction = 'check' | 'bet-small' | 'bet-big' | 'fold' | 'call' | 'raise'

interface DecisionNode {
  kind: 'decision'
  id: string
  actor: 'oop' | 'ip'
  actions: StreetAction[]
  children: Partial<Record<StreetAction, TreeNode>>
}
interface TerminalNode {
  kind: 'terminal'
  type: 'fold' | 'showdown'
  foldedPlayer?: 'oop' | 'ip'
  oopInvested: number
  ipInvested: number
}
type TreeNode = DecisionNode | TerminalNode

export interface SolverInput {
  heroCombos: number[][] // OOP
  heroWeights: number[]
  villainCombos: number[][] // IP
  villainWeights: number[]
  potBeforeStreet: number
  effectiveStackBB: number
}

const BET_SMALL_FRAC = 0.33
const BET_BIG_FRAC = 0.75

/**
 * Builds the fixed betting tree for one street: OOP checks or bets (small/big); if checked
 * to, IP checks or bets; a bet can be folded, called, or raised (capped at one all-in raise,
 * matching the same "cap the line" simplification used in the preflop engine) to keep the
 * tree small enough to solve exactly in the browser.
 */
function buildTree(pot: number, effStack: number): TreeNode {
  const showdown = (oopInvested: number, ipInvested: number): TerminalNode => ({
    kind: 'terminal',
    type: 'showdown',
    oopInvested,
    ipInvested,
  })
  const fold = (folder: 'oop' | 'ip', oopInvested: number, ipInvested: number): TerminalNode => ({
    kind: 'terminal',
    type: 'fold',
    foldedPlayer: folder,
    oopInvested,
    ipInvested,
  })

  // `priorInvested`: this player's total street investment so far. `villainInvested`: the bet they're facing.
  function facingBet(id: string, actor: 'oop' | 'ip', priorInvested: number, villainInvested: number): TreeNode {
    const callTotal = villainInvested
    const remainingAfterCall = effStack - callTotal
    const canRaise = remainingAfterCall > 0.01
    const actions: StreetAction[] = ['fold', 'call']
    const children: Partial<Record<StreetAction, TreeNode>> = {}
    children.fold = actor === 'oop' ? fold('oop', priorInvested, villainInvested) : fold('ip', villainInvested, priorInvested)
    children.call =
      actor === 'oop' ? showdown(callTotal, villainInvested) : showdown(villainInvested, callTotal)
    if (canRaise) {
      actions.push('raise')
      const raiseTotal = effStack // all-in raise
      children.raise =
        actor === 'oop'
          ? facingBet(`${id}-r`, 'ip', villainInvested, raiseTotal)
          : facingBet(`${id}-r`, 'oop', villainInvested, raiseTotal)
    }
    return { kind: 'decision', id, actor, actions, children }
  }

  function firstIn(id: string, actor: 'oop' | 'ip', priorInvested: number, potNow: number): TreeNode {
    const small = Math.min(effStack, priorInvested + potNow * BET_SMALL_FRAC)
    const big = Math.min(effStack, priorInvested + potNow * BET_BIG_FRAC)
    const actions: StreetAction[] = ['check']
    const children: Partial<Record<StreetAction, TreeNode>> = {}

    if (actor === 'oop') {
      children.check = { kind: 'decision', id: `${id}-x`, actor: 'ip', actions: ['check'], children: { check: showdown(priorInvested, priorInvested) } }
      // IP's check-back option, or IP bets after OOP checks
      const ipNode = children.check as DecisionNode
      const ipSmall = Math.min(effStack, priorInvested + potNow * BET_SMALL_FRAC)
      const ipBig = Math.min(effStack, priorInvested + potNow * BET_BIG_FRAC)
      if (ipSmall > priorInvested + 0.01) {
        ipNode.actions.push('bet-small')
        ipNode.children['bet-small'] = facingBet(`${id}-x-bs`, 'oop', priorInvested, ipSmall)
      }
      if (ipBig > ipSmall + 0.01) {
        ipNode.actions.push('bet-big')
        ipNode.children['bet-big'] = facingBet(`${id}-x-bb`, 'oop', priorInvested, ipBig)
      }
    } else {
      children.check = showdown(priorInvested, priorInvested)
    }

    if (small > priorInvested + 0.01) {
      actions.push('bet-small')
      children['bet-small'] = facingBet(`${id}-bs`, actor === 'oop' ? 'ip' : 'oop', priorInvested, small)
    }
    if (big > small + 0.01) {
      actions.push('bet-big')
      children['bet-big'] = facingBet(`${id}-bb`, actor === 'oop' ? 'ip' : 'oop', priorInvested, big)
    }
    return { kind: 'decision', id, actor, actions, children }
  }

  return firstIn('root', 'oop', 0, pot)
}

export interface InfosetStrategy {
  actions: StreetAction[]
  /** strategy[action][comboIndex] = probability, time-averaged over CFR iterations. */
  strategy: Record<StreetAction, Float64Array>
}

export interface SolveResult {
  oopStrategy: Map<string, InfosetStrategy>
  ipStrategy: Map<string, InfosetStrategy>
  iterations: number
}

interface Infoset {
  actions: StreetAction[]
  regretSum: Record<StreetAction, Float64Array>
  strategySum: Record<StreetAction, Float64Array>
}

export function solvePostflop(input: SolverInput, equity: EquityMatrix, iterations: number): SolveResult {
  const H = input.heroCombos.length
  const V = input.villainCombos.length
  const tree = buildTree(input.potBeforeStreet, input.effectiveStackBB)

  const oopInfosets = new Map<string, Infoset>()
  const ipInfosets = new Map<string, Infoset>()

  function getInfoset(node: DecisionNode): Infoset {
    const map = node.actor === 'oop' ? oopInfosets : ipInfosets
    const n = node.actor === 'oop' ? H : V
    let info = map.get(node.id)
    if (!info) {
      const regretSum = {} as Record<StreetAction, Float64Array>
      const strategySum = {} as Record<StreetAction, Float64Array>
      for (const a of node.actions) {
        regretSum[a] = new Float64Array(n)
        strategySum[a] = new Float64Array(n)
      }
      info = { actions: node.actions, regretSum, strategySum }
      map.set(node.id, info)
    }
    return info
  }

  function currentStrategy(node: DecisionNode, reach: Float64Array): Record<StreetAction, Float64Array> {
    const info = getInfoset(node)
    const n = reach.length
    const strat = {} as Record<StreetAction, Float64Array>
    for (const a of node.actions) strat[a] = new Float64Array(n)
    const posSum = new Float64Array(n)
    for (const a of node.actions) {
      const r = info.regretSum[a]
      for (let i = 0; i < n; i++) posSum[i] += Math.max(0, r[i])
    }
    for (let i = 0; i < n; i++) {
      if (posSum[i] > 1e-9) {
        for (const a of node.actions) strat[a][i] = Math.max(0, info.regretSum[a][i]) / posSum[i]
      } else {
        for (const a of node.actions) strat[a][i] = 1 / node.actions.length
      }
    }
    // accumulate time-averaged strategy, weighted by this combo's reach at this node
    for (const a of node.actions) {
      const sSum = info.strategySum[a]
      const s = strat[a]
      for (let i = 0; i < n; i++) sSum[i] += reach[i] * s[i]
    }
    return strat
  }

  function evalNode(node: TreeNode, oopRange: Float64Array, ipRange: Float64Array): { valOOP: Float64Array; valIP: Float64Array } {
    if (node.kind === 'terminal') {
      const valOOP = new Float64Array(H)
      const valIP = new Float64Array(V)
      const finalPot = input.potBeforeStreet + node.oopInvested + node.ipInvested
      if (node.type === 'fold') {
        const oopVal = node.foldedPlayer === 'oop' ? -node.oopInvested : finalPot - node.oopInvested
        const ipVal = node.foldedPlayer === 'ip' ? -node.ipInvested : finalPot - node.ipInvested
        valOOP.fill(oopVal)
        valIP.fill(ipVal)
        return { valOOP, valIP }
      }
      // showdown: weight opponent's range-at-node as a probability distribution
      let ipTotal = 0
      for (let v = 0; v < V; v++) ipTotal += ipRange[v]
      let oopTotal = 0
      for (let h = 0; h < H; h++) oopTotal += oopRange[h]
      const { matrix } = equity
      if (ipTotal > 1e-12) {
        for (let h = 0; h < H; h++) {
          let acc = 0
          let wsum = 0
          for (let v = 0; v < V; v++) {
            const w = ipRange[v]
            if (w <= 0) continue
            const eq = matrix[h * V + v]
            if (Number.isNaN(eq)) continue
            acc += w * eq
            wsum += w
          }
          valOOP[h] = wsum > 1e-12 ? (acc / wsum) * finalPot - node.oopInvested : -node.oopInvested
        }
      }
      if (oopTotal > 1e-12) {
        for (let v = 0; v < V; v++) {
          let acc = 0
          let wsum = 0
          for (let h = 0; h < H; h++) {
            const w = oopRange[h]
            if (w <= 0) continue
            const eq = matrix[h * V + v]
            if (Number.isNaN(eq)) continue
            acc += w * (1 - eq)
            wsum += w
          }
          valIP[v] = wsum > 1e-12 ? (acc / wsum) * finalPot - node.ipInvested : -node.ipInvested
        }
      }
      return { valOOP, valIP }
    }

    const actingRange = node.actor === 'oop' ? oopRange : ipRange
    const strat = currentStrategy(node, actingRange)
    const valOOP = new Float64Array(H)
    const valIP = new Float64Array(V)

    let actingTotal = 0
    for (let i = 0; i < actingRange.length; i++) actingTotal += actingRange[i]

    const childValsByAction: Record<string, { valOOP: Float64Array; valIP: Float64Array }> = {}
    const avgActionProb: Record<string, number> = {}

    for (const a of node.actions) {
      const s = strat[a]
      let childOopRange = oopRange
      let childIpRange = ipRange
      if (node.actor === 'oop') {
        const next = new Float64Array(H)
        for (let h = 0; h < H; h++) next[h] = oopRange[h] * s[h]
        childOopRange = next
      } else {
        const next = new Float64Array(V)
        for (let v = 0; v < V; v++) next[v] = ipRange[v] * s[v]
        childIpRange = next
      }
      const child = evalNode(node.children[a]!, childOopRange, childIpRange)
      childValsByAction[a] = child

      let probSum = 0
      for (let i = 0; i < actingRange.length; i++) probSum += actingRange[i] * s[i]
      avgActionProb[a] = actingTotal > 1e-12 ? probSum / actingTotal : 1 / node.actions.length
    }

    if (node.actor === 'oop') {
      for (const a of node.actions) {
        const s = strat[a]
        const cv = childValsByAction[a].valOOP
        for (let h = 0; h < H; h++) valOOP[h] += s[h] * cv[h]
      }
      for (const a of node.actions) {
        const p = avgActionProb[a]
        const cv = childValsByAction[a].valIP
        for (let v = 0; v < V; v++) valIP[v] += p * cv[v]
      }
    } else {
      for (const a of node.actions) {
        const s = strat[a]
        const cv = childValsByAction[a].valIP
        for (let v = 0; v < V; v++) valIP[v] += s[v] * cv[v]
      }
      for (const a of node.actions) {
        const p = avgActionProb[a]
        const cv = childValsByAction[a].valOOP
        for (let h = 0; h < H; h++) valOOP[h] += p * cv[h]
      }
    }

    // regret update for the acting player
    const info = getInfoset(node)
    if (node.actor === 'oop') {
      for (const a of node.actions) {
        const cv = childValsByAction[a].valOOP
        const r = info.regretSum[a]
        for (let h = 0; h < H; h++) r[h] += cv[h] - valOOP[h]
      }
    } else {
      for (const a of node.actions) {
        const cv = childValsByAction[a].valIP
        const r = info.regretSum[a]
        for (let v = 0; v < V; v++) r[v] += cv[v] - valIP[v]
      }
    }

    return { valOOP, valIP }
  }

  const oopPrior = Float64Array.from(input.heroWeights)
  const ipPrior = Float64Array.from(input.villainWeights)

  for (let iter = 0; iter < iterations; iter++) {
    evalNode(tree, oopPrior, ipPrior)
  }

  function finalizeStrategies(map: Map<string, Infoset>): Map<string, InfosetStrategy> {
    const out = new Map<string, InfosetStrategy>()
    for (const [id, info] of map) {
      const n = info.strategySum[info.actions[0]].length
      const total = new Float64Array(n)
      for (const a of info.actions) {
        const s = info.strategySum[a]
        for (let i = 0; i < n; i++) total[i] += s[i]
      }
      const strategy = {} as Record<StreetAction, Float64Array>
      for (const a of info.actions) {
        const out_a = new Float64Array(n)
        const s = info.strategySum[a]
        for (let i = 0; i < n; i++) out_a[i] = total[i] > 1e-9 ? s[i] / total[i] : 1 / info.actions.length
        strategy[a] = out_a
      }
      out.set(id, { actions: info.actions, strategy })
    }
    return out
  }

  return { oopStrategy: finalizeStrategies(oopInfosets), ipStrategy: finalizeStrategies(ipInfosets), iterations }
}

export { buildTree }
