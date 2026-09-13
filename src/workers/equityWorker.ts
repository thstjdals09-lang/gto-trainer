import { accumulateEquity, type EquityAccumulators } from '../engine/equity'

export interface EquityWorkerRequest {
  heroCombos: number[][]
  villainCombos: number[][]
  board: number[]
  runouts: number[][]
}

export interface EquityWorkerResponse {
  wins: Float64Array
  ties: Float64Array
  total: Float64Array
}

self.onmessage = (e: MessageEvent<EquityWorkerRequest>) => {
  const { heroCombos, villainCombos, board, runouts } = e.data
  const H = heroCombos.length
  const V = villainCombos.length
  const acc: EquityAccumulators = {
    wins: new Float64Array(H * V),
    ties: new Float64Array(H * V),
    total: new Float64Array(H * V),
  }
  accumulateEquity(heroCombos, villainCombos, board, runouts, acc)
  const response: EquityWorkerResponse = acc
  ;(self as unknown as Worker).postMessage(response, [acc.wins.buffer, acc.ties.buffer, acc.total.buffer])
}
