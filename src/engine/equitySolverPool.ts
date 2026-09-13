import { buildRunouts, finalizeMatrix, type EquityMatrix } from './equity'
import type { EquityWorkerRequest, EquityWorkerResponse } from '../workers/equityWorker'

export interface SolveProgress {
  done: number
  total: number
}

/**
 * Splits the exact runout enumeration across several Web Workers (one per CPU core, capped)
 * so the equity matrix for a flop/turn/river spot computes without freezing the UI and scales
 * with available cores. Each worker returns partial win/tie/total counts; we just sum them.
 */
export function computeEquityMatrixParallel(
  heroCombos: number[][],
  villainCombos: number[][],
  board: number[],
  onProgress?: (p: SolveProgress) => void
): Promise<EquityMatrix> {
  const H = heroCombos.length
  const V = villainCombos.length
  const runouts = buildRunouts(board)

  const workerCount = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8, runouts.length))
  const chunkSize = Math.ceil(runouts.length / workerCount)
  const chunks: number[][][] = []
  for (let w = 0; w < workerCount; w++) {
    const chunk = runouts.slice(w * chunkSize, (w + 1) * chunkSize)
    if (chunk.length > 0) chunks.push(chunk)
  }

  return new Promise((resolve, reject) => {
    const totalWins = new Float64Array(H * V)
    const totalTies = new Float64Array(H * V)
    const totalCount = new Float64Array(H * V)
    let doneChunks = 0

    if (chunks.length === 0) {
      resolve(finalizeMatrix(H, V, { wins: totalWins, ties: totalTies, total: totalCount }))
      return
    }

    for (const chunk of chunks) {
      const worker = new Worker(new URL('../workers/equityWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<EquityWorkerResponse>) => {
        const { wins, ties, total } = e.data
        for (let i = 0; i < H * V; i++) {
          totalWins[i] += wins[i]
          totalTies[i] += ties[i]
          totalCount[i] += total[i]
        }
        doneChunks++
        onProgress?.({ done: doneChunks, total: chunks.length })
        worker.terminate()
        if (doneChunks === chunks.length) {
          resolve(finalizeMatrix(H, V, { wins: totalWins, ties: totalTies, total: totalCount }))
        }
      }
      worker.onerror = (err) => {
        worker.terminate()
        reject(err)
      }
      const req: EquityWorkerRequest = { heroCombos, villainCombos, board, runouts: chunk }
      worker.postMessage(req)
    }
  })
}
