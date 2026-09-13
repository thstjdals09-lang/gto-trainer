import { solvePostflop, type SolverInput, type SolveResult } from '../engine/postflopSolver'
import type { EquityMatrix } from '../engine/equity'

export interface CfrWorkerRequest {
  input: SolverInput
  equity: EquityMatrix
  iterations: number
}

self.onmessage = (e: MessageEvent<CfrWorkerRequest>) => {
  const { input, equity, iterations } = e.data
  const result: SolveResult = solvePostflop(input, equity, iterations)
  ;(self as unknown as Worker).postMessage(result)
}
