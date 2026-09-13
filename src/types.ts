export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const
export type Rank = (typeof RANKS)[number]

export const SUITS = ['s', 'h', 'd', 'c'] as const
export type Suit = (typeof SUITS)[number]

export interface Card {
  rank: Rank
  suit: Suit
}

// 9-max tournament seating. Only UTG/HJ/CO/BTN/SB/BB have dedicated chart data —
// UTG1/UTG2/MP borrow the nearest chart (see CHART_POSITION_MAP in engine/chart.ts).
export const POSITIONS = ['UTG', 'UTG1', 'UTG2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const
export type Position = (typeof POSITIONS)[number]

export const CHART_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const
export type ChartPosition = (typeof CHART_POSITIONS)[number]

export const STACK_DEPTHS = [10, 20, 30, 50, 100, 200] as const
export type StackDepth = (typeof STACK_DEPTHS)[number]

// fold: give up. call: match current bet. raise: aggressive raise (open/3bet/4bet). allin: shove.
export const ACTIONS = ['fold', 'call', 'raise', 'allin'] as const
export type PokerAction = (typeof ACTIONS)[number]

export type ActionWeights = Partial<Record<PokerAction, number>>

export interface WeightedCell {
  /** 0-100, % of this hand that is played at all (rest is fold) */
  weight: number
  /** distribution of the in-range portion, should sum to 100 */
  actions: ActionWeights
}

/** Cell as authored in raw chart data: single action, 50/50 tuple, or full weighted cell */
export type RawCell = PokerAction | [PokerAction, PokerAction] | WeightedCell

export type Chart = Record<string, RawCell>

export type Scenario = 'RFI' | 'vs-open' | 'vs-3bet' | 'vs-4bet'

export function normalizeCell(cell: RawCell | undefined): WeightedCell {
  if (!cell) return { weight: 100, actions: { fold: 100 } }
  if (typeof cell === 'string') {
    return { weight: 100, actions: { [cell]: 100 } }
  }
  if (Array.isArray(cell)) {
    const [a, b] = cell
    if (a === b) return { weight: 100, actions: { [a]: 100 } }
    return { weight: 100, actions: { [a]: 50, [b]: 50 } }
  }
  return cell
}

export type HandType = 'pair' | 'suited' | 'offsuit'

export interface HandCell {
  name: string
  type: HandType
  row: number
  col: number
}

export function generateHandGrid(): HandCell[][] {
  const grid: HandCell[][] = []
  for (let row = 0; row < 13; row++) {
    const rowCells: HandCell[] = []
    for (let col = 0; col < 13; col++) {
      const r1 = RANKS[row]
      const r2 = RANKS[col]
      let name: string
      let type: HandType
      if (row === col) {
        name = `${r1}${r2}`
        type = 'pair'
      } else if (row < col) {
        name = `${r1}${r2}s`
        type = 'suited'
      } else {
        name = `${r2}${r1}o`
        type = 'offsuit'
      }
      rowCells.push({ name, type, row, col })
    }
    grid.push(rowCells)
  }
  return grid
}

/** number of concrete card combinations for a 169-hand-grid entry */
export function comboCount(hand: HandCell): number {
  if (hand.type === 'pair') return 6
  if (hand.type === 'suited') return 4
  return 12
}
