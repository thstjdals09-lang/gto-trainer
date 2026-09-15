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

/** Pot/stack entering the next street, from the actual amounts both players put in this street
 * (the street's resolved showdown terminal) — not a guess about whether a bet gets called. */
export function nextStreetState(state: StreetState, oopInvested: number, ipInvested: number): StreetState {
  return {
    potBB: state.potBB + oopInvested + ipInvested,
    effStackBB: state.effStackBB - Math.max(oopInvested, ipInvested),
  }
}

/** The bet size (bb) a bet-small/bet-big action represents at a given street state; undefined for check. */
export function streetActionSizeBB(state: StreetState, action: 'check' | 'bet-small' | 'bet-big'): number | undefined {
  if (action === 'check') return undefined
  const frac = action === 'bet-small' ? 0.33 : 0.75
  return Math.min(state.effStackBB, state.potBB * frac)
}
