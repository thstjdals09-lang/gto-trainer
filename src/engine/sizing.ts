import type { Position, StackDepth } from '../types'

/** Standard open-raise size in bb by position, 100bb reference (matches common 6-max charts). */
const OPEN_SIZE: Record<Position, number> = {
  UTG: 2.5,
  HJ: 2.5,
  CO: 2.5,
  BTN: 2.5,
  SB: 3.5,
  BB: 2.5, // unused (BB never opens preflop)
}

/** Below this effective stack, RFI/vs-open collapse to shove-or-fold (no standalone raise size). */
export const SHOVE_FOLD_THRESHOLD = 20

export function openSizeBB(position: Position, stack: StackDepth): number {
  const base = OPEN_SIZE[position]
  if (stack <= SHOVE_FOLD_THRESHOLD) return stack
  if (stack >= 200) return Math.round(base * 1.1 * 10) / 10 // slightly bigger opens when very deep
  return base
}

export function threebetSizeBB(openBB: number, threebettorInPosition: boolean, stack: StackDepth): number {
  const raw = openBB * (threebettorInPosition ? 3 : 4)
  return Math.min(Math.round(raw * 2) / 2, stack)
}

export function fourbetSizeBB(threebetBB: number, stack: StackDepth): number {
  const raw = threebetBB * 2.3
  return Math.min(Math.round(raw), stack)
}

export function positionIsInPosition(hero: Position, villain: Position): boolean {
  const order: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
  return order.indexOf(hero) > order.indexOf(villain)
}
