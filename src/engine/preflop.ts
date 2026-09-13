import { POSITIONS, type Chart, type PokerAction, type Position, type Scenario, type StackDepth } from '../types'
import { getChart } from './chart'
import { SHOVE_FOLD_THRESHOLD, fourbetSizeBB, openSizeBB, positionIsInPosition, threebetSizeBB } from './sizing'

export type CellMode = 'raw' | 'callfold' | 'shovefold'

export interface CommittedAction {
  action: PokerAction
  sizeBB?: number
}

export type Committed = Record<string, CommittedAction>

export interface DecisionSlot {
  id: string
  seatIndex: number
  position: Position
  scenario: Scenario
  villain?: Position
  availableActions: PokerAction[]
  chart: Chart
  cellMode: CellMode
  facingAllIn: boolean
  raiseSizeBB?: number
  allinSizeBB: number
  callSizeBB?: number
}

export interface HistoryEntry {
  slotId: string
  seatIndex: number
  position: Position
  action: PokerAction
  sizeBB?: number
  auto?: boolean
}

export type FlowResult =
  | { status: 'awaiting'; slot: DecisionSlot; history: HistoryEntry[] }
  | { status: 'complete'; result: 'walk' | 'flop' | 'raiser-wins' | 'caller-wins'; liveSeats: number[]; history: HistoryEntry[] }

export function computeFlow(stack: StackDepth, committed: Committed): FlowResult {
  const positions = POSITIONS
  const history: HistoryEntry[] = []
  const shoveFoldMode = stack <= SHOVE_FOLD_THRESHOLD

  // Phase A: RFI pass, seats 0..4 (UTG..SB). BB never RFIs.
  let openerIdx = -1
  let openerAction: PokerAction | null = null
  let openerSizeBB = 0

  for (let i = 0; i < 5; i++) {
    const slotId = `seat-${i}`
    const position = positions[i]
    const c = committed[slotId]
    if (!c) {
      const actions: PokerAction[] = shoveFoldMode ? ['fold', 'allin'] : ['fold', 'raise', 'allin']
      const raiseSizeBB = shoveFoldMode ? undefined : openSizeBB(position, stack)
      return {
        status: 'awaiting',
        slot: {
          id: slotId,
          seatIndex: i,
          position,
          scenario: 'RFI',
          availableActions: actions,
          chart: getChart(position, 'RFI'),
          cellMode: shoveFoldMode ? 'shovefold' : 'raw',
          facingAllIn: false,
          raiseSizeBB,
          allinSizeBB: stack,
        },
        history,
      }
    }
    history.push({ slotId, seatIndex: i, position, action: c.action, sizeBB: c.sizeBB })
    if (c.action === 'fold') continue
    // raise or allin opens the pot
    openerIdx = i
    openerAction = c.action
    openerSizeBB = c.sizeBB ?? (c.action === 'allin' ? stack : openSizeBB(position, stack))
    break
  }

  if (openerIdx === -1) {
    // everyone folded to the blinds
    return { status: 'complete', result: 'walk', liveSeats: [5], history }
  }

  // Phase B: vs-open pass for seats after the opener
  const openerFacingAllIn = openerAction === 'allin'
  const callers: number[] = []
  let threebettorIdx = -1
  let threebettorAction: PokerAction | null = null
  let threebettorSizeBB = 0

  for (let j = openerIdx + 1; j < 6; j++) {
    const slotId = `seat-${j}`
    const position = positions[j]
    const c = committed[slotId]
    if (!c) {
      const inPosition = positionIsInPosition(position, positions[openerIdx])
      const threebetSize = threebetSizeBB(openerSizeBB, inPosition, stack)
      let actions: PokerAction[]
      if (openerFacingAllIn) actions = ['fold', 'call']
      else if (shoveFoldMode) actions = ['fold', 'call', 'allin']
      else actions = ['fold', 'call', 'raise', 'allin']
      return {
        status: 'awaiting',
        slot: {
          id: slotId,
          seatIndex: j,
          position,
          scenario: 'vs-open',
          villain: positions[openerIdx],
          availableActions: actions,
          chart: getChart(position, 'vs-open', positions[openerIdx]),
          cellMode: openerFacingAllIn ? 'callfold' : shoveFoldMode ? 'shovefold' : 'raw',
          facingAllIn: openerFacingAllIn,
          raiseSizeBB: openerFacingAllIn || shoveFoldMode ? undefined : threebetSize,
          allinSizeBB: stack,
          callSizeBB: openerSizeBB,
        },
        history,
      }
    }
    history.push({ slotId, seatIndex: j, position, action: c.action, sizeBB: c.sizeBB })
    if (c.action === 'fold') continue
    if (c.action === 'call') {
      callers.push(j)
      continue
    }
    // raise (3bet) or allin over the open — narrows the hand to opener vs this seat
    threebettorIdx = j
    threebettorAction = c.action
    threebettorSizeBB = c.sizeBB ?? (c.action === 'allin' ? stack : threebetSizeBB(openerSizeBB, positionIsInPosition(position, positions[openerIdx]), stack))
    for (let k = j + 1; k < 6; k++) {
      if (!committed[`seat-${k}`]) {
        history.push({ slotId: `seat-${k}`, seatIndex: k, position: positions[k], action: 'fold', auto: true })
      }
    }
    break
  }

  if (threebettorIdx === -1) {
    return { status: 'complete', result: 'flop', liveSeats: [openerIdx, ...callers], history }
  }

  // Phase C: original opener responds to the 3bet
  const threebettorFacingAllIn = threebettorAction === 'allin'
  {
    const slotId = 'opener-vs3bet'
    const c = committed[slotId]
    const position = positions[openerIdx]
    const villain = positions[threebettorIdx]
    if (!c) {
      return {
        status: 'awaiting',
        slot: {
          id: slotId,
          seatIndex: openerIdx,
          position,
          scenario: 'vs-3bet',
          villain,
          availableActions: threebettorFacingAllIn ? ['fold', 'call'] : ['fold', 'call', 'allin'],
          chart: getChart(position, 'vs-3bet', villain),
          cellMode: threebettorFacingAllIn ? 'callfold' : 'raw',
          facingAllIn: threebettorFacingAllIn,
          allinSizeBB: stack,
          callSizeBB: threebettorSizeBB,
        },
        history,
      }
    }
    history.push({ slotId, seatIndex: openerIdx, position, action: c.action, sizeBB: c.sizeBB })
    if (c.action === 'fold') return { status: 'complete', result: 'caller-wins', liveSeats: [threebettorIdx], history }
    if (c.action === 'call') return { status: 'complete', result: 'flop', liveSeats: [openerIdx, threebettorIdx], history }
    // opener shoves (4bet-allin) — fall through to phase D
  }

  // Phase D: 3bettor responds to the opener's 4bet-shove (opener is already all-in, so fold/call only)
  {
    const slotId = 'threebettor-vs4bet'
    const c = committed[slotId]
    const position = positions[threebettorIdx]
    const villain = positions[openerIdx]
    if (!c) {
      return {
        status: 'awaiting',
        slot: {
          id: slotId,
          seatIndex: threebettorIdx,
          position,
          scenario: 'vs-4bet',
          villain,
          availableActions: ['fold', 'call'],
          chart: getChart(position, 'vs-4bet', villain),
          cellMode: 'callfold',
          facingAllIn: true,
          allinSizeBB: stack,
          callSizeBB: fourbetSizeBB(threebettorSizeBB, stack),
        },
        history,
      }
    }
    history.push({ slotId, seatIndex: threebettorIdx, position, action: c.action, sizeBB: c.sizeBB })
    if (c.action === 'fold') return { status: 'complete', result: 'raiser-wins', liveSeats: [openerIdx], history }
    return { status: 'complete', result: 'flop', liveSeats: [openerIdx, threebettorIdx], history }
  }
}

