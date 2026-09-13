import type { PokerAction } from './types'
import type { PostflopAction } from './engine/postflop'

export const POSTFLOP_ACTION_COLOR: Record<PostflopAction, string> = {
  check: '#2b6cb0',
  'bet-small': '#d4a72c',
  'bet-big': '#dc2626',
}

export const POSTFLOP_ACTION_LABEL: Record<PostflopAction, string> = {
  check: 'Check',
  'bet-small': 'Bet 33%',
  'bet-big': 'Bet 75%+',
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
