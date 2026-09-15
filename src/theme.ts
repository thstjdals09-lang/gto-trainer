import type { StreetAction } from './engine/postflopSolver'
import type { PokerAction, Suit } from './types'

export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
export const SUIT_COLOR: Record<Suit, string> = { s: '#e5e7eb', h: '#f87171', d: '#60a5fa', c: '#4ade80' }

export const POSTFLOP_ACTION_COLOR: Record<'check' | 'bet-small' | 'bet-big', string> = {
  check: '#2b6cb0',
  'bet-small': '#d4a72c',
  'bet-big': '#dc2626',
}

/** All six StreetAction values (first-to-act check/bet-small/bet-big, or facing-a-bet
 * fold/call/raise) — a postflop decision node only ever offers one set or the other, but
 * anything rendering a solved node generically (grid, per-combo panel) needs both covered. */
export const STREET_ACTION_COLOR: Record<StreetAction, string> = {
  check: '#2b6cb0',
  'bet-small': '#d4a72c',
  'bet-big': '#dc2626',
  fold: '#2b6cb0',
  call: '#d4a72c',
  raise: '#7f1d1d',
}

export const STREET_ACTION_LABEL: Record<StreetAction, string> = {
  check: 'Check',
  'bet-small': 'Bet 33%',
  'bet-big': 'Bet 75%+',
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
}

export const ACTION_COLOR: Record<PokerAction, string> = {
  fold: '#2b6cb0',
  call: '#d4a72c',
  raise: '#dc2626',
  allin: '#7f1d1d',
}

export const ACTION_LABEL: Record<PokerAction, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  allin: 'Allin',
}
