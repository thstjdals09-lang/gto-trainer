import type { PokerAction } from './types'

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
