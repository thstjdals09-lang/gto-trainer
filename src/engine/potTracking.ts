import type { HistoryEntry } from './preflop'
import type { StackDepth } from '../types'

/** Each live seat's total preflop investment (their last non-fold committed size), reconstructed from history. */
function seatInvestment(seatIndex: number, history: HistoryEntry[]): number {
  let invested = 0
  for (const h of history) {
    if (h.seatIndex === seatIndex && h.sizeBB !== undefined) invested = h.sizeBB
  }
  return invested
}

export interface StreetState {
  potBB: number
  effStackBB: number
}

/** Pot and effective remaining stack entering the flop, from the preflop action history. */
export function preflopEndState(seatA: number, seatB: number, history: HistoryEntry[], stack: StackDepth): StreetState {
  const investedA = seatInvestment(seatA, history)
  const investedB = seatInvestment(seatB, history)
  return {
    potBB: investedA + investedB,
    effStackBB: stack - Math.max(investedA, investedB),
  }
}

/**
 * Advances pot/stack across a street given the single representative action the user picked
 * (this app shows one action for the whole street rather than simulating both sides' full
 * response) — check assumes the street closes with no more money in; a bet assumes it gets
 * called, matching the "pot after a bet-and-call" pot-fraction convention already used for
 * sizing (33%/75% of pot).
 */
export function advanceStreet(state: StreetState, action: 'check' | 'bet-small' | 'bet-big'): StreetState {
  if (action === 'check') return state
  const frac = action === 'bet-small' ? 0.33 : 0.75
  const invested = Math.min(state.effStackBB, state.potBB * frac)
  return {
    potBB: state.potBB + 2 * invested,
    effStackBB: state.effStackBB - invested,
  }
}
