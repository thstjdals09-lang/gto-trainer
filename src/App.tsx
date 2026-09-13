import { useMemo, useState } from 'react'
import StackSelector from './components/StackSelector'
import PositionBar from './components/PositionBar'
import ActionButtons from './components/ActionButtons'
import RangeGrid from './components/RangeGrid'
import BoardPicker from './components/BoardPicker'
import PostflopActionGrid from './components/PostflopActionGrid'
import { computeFlow, type Committed, type DecisionSlot } from './engine/preflop'
import { getDisplayCell } from './engine/chart'
import { buildRangeWithCategories, aggregatePostflopAction, type PostflopAction } from './engine/postflop'
import { generateHandGrid, POSITIONS, type Card, type PokerAction, type StackDepth } from './types'

const SCENARIO_LABEL: Record<string, string> = { RFI: 'RFI (오픈)', 'vs-open': 'vs Open', 'vs-3bet': 'vs 3Bet', 'vs-4bet': 'vs 4Bet' }
const POSTFLOP_LABEL: Record<PostflopAction, string> = { check: 'Check', 'bet-small': 'Bet 33%', 'bet-big': 'Bet 75%+' }
const POSTFLOP_COLOR: Record<PostflopAction, string> = { check: 'bg-sky-600 hover:bg-sky-500', 'bet-small': 'bg-amber-500 hover:bg-amber-400 text-black', 'bet-big': 'bg-red-600 hover:bg-red-500' }

const allHandNames = generateHandGrid().flatMap((row) => row.map((h) => h.name))

export default function App() {
  const [stack, setStack] = useState<StackDepth | null>(null)
  const [committed, setCommitted] = useState<Committed>({})
  const [slotLog, setSlotLog] = useState<Record<string, DecisionSlot>>({})
  const [flopPick, setFlopPick] = useState<Card[]>([])
  const [turnPick, setTurnPick] = useState<Card[]>([])
  const [riverPick, setRiverPick] = useState<Card[]>([])
  const [postflopActions, setPostflopActions] = useState<Partial<Record<'flop' | 'turn' | 'river', PostflopAction>>>({})
  const [viewSeat, setViewSeat] = useState<0 | 1>(0)

  const flow = useMemo(() => (stack ? computeFlow(stack, committed) : null), [stack, committed])

  function reset() {
    setStack(null)
    setCommitted({})
    setSlotLog({})
    setFlopPick([])
    setTurnPick([])
    setRiverPick([])
    setPostflopActions({})
    setViewSeat(0)
  }

  function handleAction(slot: DecisionSlot, action: PokerAction, sizeBB?: number) {
    setSlotLog((prev) => ({ ...prev, [slot.id]: slot }))
    setCommitted((prev) => ({ ...prev, [slot.id]: { action, sizeBB } }))
  }

  /** Clicking a position tile jumps straight to it: seats skipped forward auto-fold, seats before it get reopened for editing. */
  function handleSelectSeat(seatIndex: number) {
    if (!flow || flow.status !== 'awaiting' || !flow.slot.id.startsWith('seat-')) return
    const currentIdx = flow.slot.seatIndex
    if (seatIndex === currentIdx) return

    if (seatIndex > currentIdx) {
      setCommitted((prev) => {
        const next = { ...prev }
        for (let k = currentIdx; k < seatIndex; k++) next[`seat-${k}`] = { action: 'fold' }
        return next
      })
      return
    }

    // rewind to an earlier seat: drop its decision and everything after it
    const keep = (key: string) => {
      const m = /^seat-(\d+)$/.exec(key)
      return m ? Number(m[1]) < seatIndex : false
    }
    setCommitted((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => keep(k))))
    setSlotLog((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => keep(k))))
  }

  function continuingRangeForSeat(seatIndex: number): Record<string, number> {
    const relevant = Object.values(slotLog).filter((s) => s.seatIndex === seatIndex)
    if (relevant.length === 0) return {}
    const last = relevant[relevant.length - 1]
    const chosen = committed[last.id]?.action
    if (!chosen || chosen === 'fold') return {}
    const weights: Record<string, number> = {}
    for (const hand of allHandNames) {
      const cell = getDisplayCell(last.chart, hand, last.cellMode)
      const pct = (cell.weight * (cell.actions[chosen] ?? 0)) / 100
      if (pct > 0.001) weights[hand] = pct
    }
    return weights
  }

  if (!stack) {
    return (
      <div className="mx-auto max-w-4xl px-3">
        <StackSelector value={stack} onChange={setStack} />
      </div>
    )
  }

  if (flow && flow.status === 'complete' && flow.result !== 'flop') {
    const label = flow.result === 'walk' ? 'BB가 블라인드만으로 승리 (전원 폴드)' : flow.result === 'raiser-wins' ? '레이저(오프너)가 승리' : '3벳터가 승리'
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 flex flex-col gap-6">
        <PositionBar stack={stack} history={flow.history} activeSeatIndex={null} />
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-lg font-semibold text-white mb-2">핸드 종료</div>
          <div className="text-white/60">{label}</div>
        </div>
        <button onClick={reset} className="self-center rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 font-semibold text-white">
          새 핸드
        </button>
      </div>
    )
  }

  if (flow && flow.status === 'awaiting') {
    const slot = flow.slot
    return (
      <div className="mx-auto max-w-3xl px-3 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/50">유효스택 {stack}bb</div>
          <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 underline">
            초기화
          </button>
        </div>
        <PositionBar
          stack={stack}
          history={flow.history}
          activeSeatIndex={slot.seatIndex}
          clickable={slot.id.startsWith('seat-')}
          onSelectSeat={handleSelectSeat}
        />
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-white">
              {slot.position} · {SCENARIO_LABEL[slot.scenario]}
              {slot.villain ? ` vs ${slot.villain}` : ''}
            </h2>
          </div>
          <ActionButtons slot={slot} onAction={(action, sizeBB) => handleAction(slot, action, sizeBB)} />
          <RangeGrid chart={slot.chart} cellMode={slot.cellMode} />
        </div>
      </div>
    )
  }

  // Postflop
  if (flow && flow.status === 'complete' && flow.result === 'flop') {
    // Postflop action always starts at SB (not whoever acted first preflop).
    const POSTFLOP_ORDER = [7, 8, 0, 1, 2, 3, 4, 5, 6] // SB, BB, UTG, UTG1, UTG2, MP, HJ, CO, BTN
    const sortedLiveSeats = [...flow.liveSeats].sort((a, b) => POSTFLOP_ORDER.indexOf(a) - POSTFLOP_ORDER.indexOf(b))
    const seatA = sortedLiveSeats[0]
    const seatB = sortedLiveSeats[1] ?? sortedLiveSeats[0]
    const rangeA = continuingRangeForSeat(seatA)
    const rangeB = continuingRangeForSeat(seatB)
    const activeSeat = viewSeat === 0 ? seatA : seatB
    const activeRange = viewSeat === 0 ? rangeA : rangeB

    const needFlop = 3 - flopPick.length
    const flopDone = flopPick.length === 3
    const flopActed = !!postflopActions.flop
    const needTurn = flopActed ? 1 - turnPick.length : 0
    const turnDone = turnPick.length === 1
    const turnActed = !!postflopActions.turn
    const needRiver = flopActed && turnActed ? 1 - riverPick.length : 0
    const riverDone = riverPick.length === 1
    const riverActed = !!postflopActions.river

    let street: 'flop' | 'turn' | 'river' | 'done'
    if (!flopDone || !flopActed) street = 'flop'
    else if (!turnDone || !turnActed) street = 'turn'
    else if (!riverDone || !riverActed) street = 'river'
    else street = 'done'

    const usedForFlop: Card[] = []
    const usedForTurn = flopPick
    const usedForRiver = [...flopPick, ...turnPick]

    const currentBoardForDisplay = [...flopPick, ...turnPick, ...riverPick]

    const rangeEntries = buildRangeWithCategories(activeRange, currentBoardForDisplay.length >= 3 ? currentBoardForDisplay : [])
    const actionDist = rangeEntries.length ? aggregatePostflopAction(rangeEntries) : null

    return (
      <div className="mx-auto max-w-3xl px-3 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/50">유효스택 {stack}bb · 플랍으로 진행 ({POSITIONS[seatA]} vs {POSITIONS[seatB]})</div>
          <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 underline">
            초기화
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
            <div className="text-xs text-white/40">보드</div>
            <div className="text-lg font-semibold text-white tracking-wider">
              {currentBoardForDisplay.length ? currentBoardForDisplay.map((c) => `${c.rank}${c.suit}`).join(' ') : '—'}
            </div>
          </div>
        </div>

        {street === 'flop' && !flopDone && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-semibold mb-2">플랍 카드 선택 ({needFlop}장 더)</h3>
            <BoardPicker usedCards={usedForFlop} need={3} picked={flopPick} onChange={setFlopPick} />
          </div>
        )}

        {street === 'turn' && !turnDone && flopActed && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-semibold mb-2">턴 카드 선택 ({needTurn}장 더)</h3>
            <BoardPicker usedCards={usedForTurn} need={1} picked={turnPick} onChange={setTurnPick} />
          </div>
        )}

        {street === 'river' && !riverDone && turnActed && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-semibold mb-2">리버 카드 선택 ({needRiver}장 더)</h3>
            <BoardPicker usedCards={usedForRiver} need={1} picked={riverPick} onChange={setRiverPick} />
          </div>
        )}

        {((street === 'flop' && flopDone) || (street === 'turn' && turnDone) || (street === 'river' && riverDone)) && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-white font-semibold">
                {street === 'flop' ? '플랍' : street === 'turn' ? '턴' : '리버'} 액션 — {POSITIONS[activeSeat]}의 컨티뉴잉 레인지
              </h3>
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setViewSeat(0)}
                  className={`px-2 py-1 rounded ${viewSeat === 0 ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  {POSITIONS[seatA]}
                </button>
                <button
                  onClick={() => setViewSeat(1)}
                  className={`px-2 py-1 rounded ${viewSeat === 1 ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  {POSITIONS[seatB]}
                </button>
              </div>
            </div>

            {actionDist && (
              <div className="flex gap-2 flex-wrap">
                {(['check', 'bet-small', 'bet-big'] as PostflopAction[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setPostflopActions((prev) => ({ ...prev, [street]: a }))}
                    className={`flex-1 min-w-[100px] rounded-lg px-3 py-3 text-sm font-semibold text-white transition-colors ${POSTFLOP_COLOR[a]} ${
                      postflopActions[street] === a ? 'ring-2 ring-white' : ''
                    }`}
                  >
                    {POSTFLOP_LABEL[a]}
                    <div className="text-xs font-normal opacity-80">{actionDist[a].toFixed(0)}% 참고</div>
                  </button>
                ))}
              </div>
            )}

            <PostflopActionGrid entries={rangeEntries} />
          </div>
        )}

        {street === 'done' && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-lg font-semibold text-white mb-2">핸드 완료</div>
            <div className="text-white/60 text-sm">
              보드: {currentBoardForDisplay.map((c) => `${c.rank}${c.suit}`).join(' ')}
            </div>
            <button onClick={reset} className="mt-4 rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 font-semibold text-white">
              새 핸드
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
