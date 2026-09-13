import type { PokerAction, Suit } from './types'

export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
export const SUIT_COLOR: Record<Suit, string> = { s: '#e5e7eb', h: '#f87171', d: '#60a5fa', c: '#4ade80' }

export const POSTFLOP_ACTION_COLOR: Record<'check' | 'bet-small' | 'bet-big', string> = {
  check: '#2b6cb0',
  'bet-small': '#d4a72c',
  'bet-big': '#dc2626',
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
