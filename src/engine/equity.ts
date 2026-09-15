import { evaluate7, packCard } from './evaluator'

const FULL_DECK: number[] = (() => {
  const deck: number[] = []
  for (let rank = 2; rank <= 14; rank++) for (let suit = 0; suit < 4; suit++) deck.push(packCard(rank, suit))
  return deck
})()

function comboConflicts(combo: number[], cards: number[]): boolean {
  for (const c of combo) if (cards.includes(c)) return true
  return false
}

function combosOverlap(a: number[], b: number[]): boolean {
  return a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]
}

/** All remaining-board runouts (exact enumeration): 1 empty runout on the river, ~44-46 single cards on the turn, ~C(45-47,2) pairs on the flop. */
export function buildRunouts(board: number[]): number[][] {
  const cardsToCome = 5 - board.length
  if (cardsToCome < 0 || cardsToCome > 2) {
    throw new Error(`buildRunouts only supports flop/turn/river boards (3-5 cards), got ${board.length}`)
  }
  const remainingDeck = FULL_DECK.filter((c) => !board.includes(c))
  const runouts: number[][] = []
  if (cardsToCome === 0) runouts.push([])
  else if (cardsToCome === 1) for (const c of remainingDeck) runouts.push([c])
  else {
    for (let i = 0; i < remainingDeck.length; i++)
      for (let j = i + 1; j < remainingDeck.length; j++) runouts.push([remainingDeck[i], remainingDeck[j]])
  }
  return runouts
}

/** Randomly sampled runouts (Monte Carlo) — for preflop (5 cards to come), where exact
 * enumeration (~1.5M boards) is infeasible. Reuses the same accumulateEquity as exact boards. */
export function buildSampledRunouts(board: number[], cardsToCome: number, sampleCount: number): number[][] {
  const remainingDeck = FULL_DECK.filter((c) => !board.includes(c))
  const runouts: number[][] = []
  for (let s = 0; s < sampleCount; s++) {
    // Fisher-Yates partial shuffle to pick `cardsToCome` distinct cards
    const pool = remainingDeck.slice()
    const runout: number[] = []
    for (let k = 0; k < cardsToCome; k++) {
      const idx = Math.floor(Math.random() * (pool.length - k)) + k
      ;[pool[k], pool[idx]] = [pool[idx], pool[k]]
      runout.push(pool[k])
    }
    runouts.push(runout)
  }
  return runouts
}

export interface EquityAccumulators {
  wins: Float64Array
  ties: Float64Array
  total: Float64Array
}

/**
 * Accumulate win/tie/total counts for every hero-combo x villain-combo pair over the given
 * slice of runouts (mutates the passed-in typed arrays so partial results from multiple
 * workers/chunks can simply be summed together). Hero/villain scores are computed once per
 * combo per runout, not once per pair per runout: O((H+V)*R) evaluate7 calls, not O(H*V*R).
 */
export function accumulateEquity(
  heroCombos: number[][],
  villainCombos: number[][],
  board: number[],
  runouts: number[][],
  acc: EquityAccumulators
): void {
  const H = heroCombos.length
  const V = villainCombos.length

  const pairValid = new Uint8Array(H * V)
  for (let h = 0; h < H; h++) {
    for (let v = 0; v < V; v++) pairValid[h * V + v] = combosOverlap(heroCombos[h], villainCombos[v]) ? 0 : 1
  }

  const heroScore = new Float64Array(H)
  const heroOk = new Uint8Array(H)
  const villainScore = new Float64Array(V)
  const villainOk = new Uint8Array(V)
  const { wins, ties, total } = acc

  for (const runout of runouts) {
    const fullBoard = runout.length ? board.concat(runout) : board

    for (let h = 0; h < H; h++) {
      const combo = heroCombos[h]
      if (comboConflicts(combo, runout)) {
        heroOk[h] = 0
        continue
      }
      heroOk[h] = 1
      heroScore[h] = evaluate7([combo[0], combo[1], ...fullBoard])
    }
    for (let v = 0; v < V; v++) {
      const combo = villainCombos[v]
      if (comboConflicts(combo, runout)) {
        villainOk[v] = 0
        continue
      }
      villainOk[v] = 1
      villainScore[v] = evaluate7([combo[0], combo[1], ...fullBoard])
    }

    for (let h = 0; h < H; h++) {
      if (!heroOk[h]) continue
      const hs = heroScore[h]
      const rowBase = h * V
      for (let v = 0; v < V; v++) {
        if (!pairValid[rowBase + v] || !villainOk[v]) continue
        const vs = villainScore[v]
        total[rowBase + v]++
        if (hs > vs) wins[rowBase + v]++
        else if (hs === vs) ties[rowBase + v]++
      }
    }
  }
}

export interface EquityMatrix {
  /** matrix[heroIdx * villainCount + villainIdx] = hero's equity (0..1, tie=0.5) vs that villain combo. NaN if the pair can't coexist (shared card). */
  matrix: Float64Array
  heroCount: number
  villainCount: number
}

export function finalizeMatrix(H: number, V: number, acc: EquityAccumulators): EquityMatrix {
  const matrix = new Float64Array(H * V)
  for (let i = 0; i < H * V; i++) {
    matrix[i] = acc.total[i] > 0 ? (acc.wins[i] + 0.5 * acc.ties[i]) / acc.total[i] : NaN
  }
  return { matrix, heroCount: H, villainCount: V }
}

/** Single-threaded convenience wrapper (used for small turn/river spots and in tests). */
export function computeEquityMatrix(heroCombos: number[][], villainCombos: number[][], board: number[]): EquityMatrix {
  const H = heroCombos.length
  const V = villainCombos.length
  const acc: EquityAccumulators = { wins: new Float64Array(H * V), ties: new Float64Array(H * V), total: new Float64Array(H * V) }
  accumulateEquity(heroCombos, villainCombos, board, buildRunouts(board), acc)
  return finalizeMatrix(H, V, acc)
}
