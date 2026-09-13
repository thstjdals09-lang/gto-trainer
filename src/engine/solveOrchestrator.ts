import { computeEquityMatrixParallel } from './equitySolverPool'
import type { SolveProgress } from './equitySolverPool'
import type { SolveResult } from './postflopSolver'
import { buildConcreteRange, toPackedBoard } from './solverBridge'
import type { CfrWorkerRequest } from '../workers/cfrWorker'
import type { Card } from '../types'

export interface StreetSolve {
  oopCombos: number[][]
  oopWeights: number[]
  oopHandNames: string[]
  ipCombos: number[][]
  ipWeights: number[]
  ipHandNames: string[]
  result: SolveResult
}

function runCfrInWorker(req: CfrWorkerRequest): Promise<SolveResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/cfrWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<SolveResult>) => {
      worker.terminate()
      resolve(e.data)
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }
    // Zero-copy transfer of the (potentially large) equity matrix instead of structured-cloning it.
    worker.postMessage(req, [req.equity.matrix.buffer])
  })
}

/** OOP = first to act postflop (out of position), IP = second (in position). */
export async function solveStreet(
  oopPreflopWeights: Record<string, number>,
  ipPreflopWeights: Record<string, number>,
  board: Card[],
  potBB: number,
  effStackBB: number,
  iterations: number,
  onProgress?: (p: SolveProgress) => void
): Promise<StreetSolve> {
  const oop = buildConcreteRange(oopPreflopWeights, board)
  const ip = buildConcreteRange(ipPreflopWeights, board)
  const packedBoard = toPackedBoard(board)

  const equity = await computeEquityMatrixParallel(oop.combos, ip.combos, packedBoard, onProgress)

  const result = await runCfrInWorker({
    input: {
      heroCombos: oop.combos,
      heroWeights: oop.weights,
      villainCombos: ip.combos,
      villainWeights: ip.weights,
      potBeforeStreet: potBB,
      effectiveStackBB: effStackBB,
    },
    equity,
    iterations,
  })

  return {
    oopCombos: oop.combos,
    oopWeights: oop.weights,
    oopHandNames: oop.handNames,
    ipCombos: ip.combos,
    ipWeights: ip.weights,
    ipHandNames: ip.handNames,
    result,
  }
}
