import { useEffect, useMemo, useState } from 'react'
import StackSelector from './components/StackSelector'
import PositionBar from './components/PositionBar'
import ActionButtons from './components/ActionButtons'
import RangeGrid from './components/RangeGrid'
import BoardPicker from './components/BoardPicker'
import SolvedActionGrid from './components/SolvedActionGrid'
import HandDetailPanel from './components/HandDetailPanel'
import SolvedHandDetailPanel from './components/SolvedHandDetailPanel'
import HandSummary, { type PreflopLine, type StreetSection } from './components/HandSummary'
import { computeFlow, type Committed, type DecisionSlot } from './engine/preflop'
import { getDisplayCell } from './engine/chart'
import { preflopEndState, nextStreetState, type StreetState } from './engine/potTracking'
import { computeStreetFlow, traceStreetActions, type StreetCommitted, type StreetFlowResult } from './engine/postflopFlow'
import { solveStreet, type StreetSolve } from './engine/solveOrchestrator'
import { aggregateStrategyToGrid, aggregateGridTotals, aggregateEVTotals } from './engine/solverBridge'
import { computePreflopEquity, type PreflopEquityResult } from './engine/preflopEquity'
import type { SolveProgress } from './engine/equitySolverPool'
import type { StreetAction } from './engine/postflopSolver'
import { generateHandGrid, POSITIONS, type Card, type PokerAction, type StackDepth } from './types'

const SCENARIO_LABEL: Record<string, string> = { RFI: 'RFI (오픈)', 'vs-open': 'vs Open', 'vs-3bet': 'vs 3Bet', 'vs-4bet': 'vs 4Bet' }
const POSTFLOP_LABEL: Record<StreetAction, string> = {
  check: 'Check',
  'bet-small': 'Bet 33%',
  'bet-big': 'Bet 75%+',
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise (All-in)',
}
const POSTFLOP_COLOR: Record<StreetAction, string> = {
  check: 'bg-sky-600 hover:bg-sky-500',
  'bet-small': 'bg-amber-500 hover:bg-amber-400 text-black',
  'bet-big': 'bg-red-600 hover:bg-red-500',
  fold: 'bg-blue-700 hover:bg-blue-600',
  call: 'bg-amber-500 hover:bg-amber-400 text-black',
  raise: 'bg-red-800 hover:bg-red-700',
}
const STREET_LABEL: Record<'flop' | 'turn' | 'river', string> = { flop: '플랍', turn: '턴', river: '리버' }
const SOLVE_ITERATIONS = 300

const allHandNames = generateHandGrid().flatMap((row) => row.map((h) => h.name))

export default function App() {
  const [stack, setStack] = useState<StackDepth | null>(null)
  const [committed, setCommitted] = useState<Committed>({})
  const [slotLog, setSlotLog] = useState<Record<string, DecisionSlot>>({})
  const [flopPick, setFlopPick] = useState<Card[]>([])
  const [turnPick, setTurnPick] = useState<Card[]>([])
  const [riverPick, setRiverPick] = useState<Card[]>([])
  const [streetCommitted, setStreetCommitted] = useState<Record<'flop' | 'turn' | 'river', StreetCommitted>>({
    flop: {},
    turn: {},
    river: {},
  })
  const [activeHand, setActiveHand] = useState<string | null>(null)
  const [solveResult, setSolveResult] = useState<StreetSolve | null>(null)
  const [solveStatus, setSolveStatus] = useState<'idle' | 'solving' | 'done' | 'error'>('idle')
  const [solveProgress, setSolveProgress] = useState<SolveProgress | null>(null)
  const [solvedKey, setSolvedKey] = useState<string | null>(null)
  const [preflopEquity, setPreflopEquity] = useState<PreflopEquityResult | null>(null)

  const flow = useMemo(() => (stack ? computeFlow(stack, committed) : null), [stack, committed])

  const preflopSlot = flow && flow.status === 'awaiting' ? flow.slot : null
  const preflopEquityKey = preflopSlot ? `${preflopSlot.scenario}|${preflopSlot.position}|${preflopSlot.villain ?? ''}|${stack}` : null

  useEffect(() => {
    if (!preflopSlot || !stack) {
      setPreflopEquity(null)
      return
    }
    const result = computePreflopEquity(preflopSlot.scenario, preflopSlot.position, preflopSlot.villain, stack, 80)
    setPreflopEquity(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preflopEquityKey])

  const reachedFlop = !!(flow && flow.status === 'complete' && flow.result === 'flop')

  // Postflop action always starts at SB (not whoever acted first preflop).
  const POSTFLOP_ORDER = [7, 8, 0, 1, 2, 3, 4, 5, 6] // SB, BB, UTG, UTG1, UTG2, MP, HJ, CO, BTN
  const liveSeats = reachedFlop && flow!.status === 'complete' ? flow!.liveSeats : []
  const sortedLiveSeats = [...liveSeats].sort((a, b) => POSTFLOP_ORDER.indexOf(a) - POSTFLOP_ORDER.indexOf(b))
  const seatA = sortedLiveSeats[0] ?? -1
  const seatB = sortedLiveSeats[1] ?? sortedLiveSeats[0] ?? -1
  const rangeA = reachedFlop ? continuingRangeForSeat(seatA) : {}
  const rangeB = reachedFlop ? continuingRangeForSeat(seatB) : {}

  const flopDone = flopPick.length === 3
  const turnDone = turnPick.length === 1
  const riverDone = riverPick.length === 1
  const currentBoardForDisplay = [...flopPick, ...turnPick, ...riverPick]

  // Each street is walked node-by-node (both OOP and IP act in turn, same tree the CFR solve
  // ran on) instead of ending the street after a single click — see engine/postflopFlow.ts.
  const flopEntry: StreetState =
    reachedFlop && stack ? preflopEndState(seatA, seatB, flow!.status === 'complete' ? flow!.history : [], stack) : { potBB: 0, effStackBB: 0 }
  const flopFlow: StreetFlowResult | null =
    reachedFlop && flopDone ? computeStreetFlow(flopEntry.potBB, flopEntry.effStackBB, streetCommitted.flop) : null

  const flopShowdown = flopFlow?.status === 'complete' && flopFlow.type === 'showdown' ? flopFlow : null
  const turnEntry: StreetState = flopShowdown ? nextStreetState(flopEntry, flopShowdown.oopInvested, flopShowdown.ipInvested) : flopEntry
  const turnFlow: StreetFlowResult | null =
    flopShowdown && turnDone ? computeStreetFlow(turnEntry.potBB, turnEntry.effStackBB, streetCommitted.turn) : null

  const turnShowdown = turnFlow?.status === 'complete' && turnFlow.type === 'showdown' ? turnFlow : null
  const riverEntry: StreetState = turnShowdown ? nextStreetState(turnEntry, turnShowdown.oopInvested, turnShowdown.ipInvested) : turnEntry
  const riverFlow: StreetFlowResult | null =
    turnShowdown && riverDone ? computeStreetFlow(riverEntry.potBB, riverEntry.effStackBB, streetCommitted.river) : null

  let street: 'flop' | 'turn' | 'river' | 'done' = 'flop'
  let postflopFold: { street: 'flop' | 'turn' | 'river'; folder: 'oop' | 'ip' } | null = null

  if (!flopDone || !flopFlow || flopFlow.status === 'awaiting') {
    street = 'flop'
  } else if (flopFlow.type === 'fold') {
    street = 'done'
    postflopFold = { street: 'flop', folder: flopFlow.foldedPlayer! }
  } else if (!turnDone || !turnFlow || turnFlow.status === 'awaiting') {
    street = 'turn'
  } else if (turnFlow.type === 'fold') {
    street = 'done'
    postflopFold = { street: 'turn', folder: turnFlow.foldedPlayer! }
  } else if (!riverDone || !riverFlow || riverFlow.status === 'awaiting') {
    street = 'river'
  } else if (riverFlow.type === 'fold') {
    street = 'done'
    postflopFold = { street: 'river', folder: riverFlow.foldedPlayer! }
  } else {
    street = 'done'
  }

  const streetReady =
    reachedFlop && ((street === 'flop' && flopDone) || (street === 'turn' && turnDone) || (street === 'river' && riverDone))

  const streetState: StreetState = street === 'turn' ? turnEntry : street === 'river' || street === 'done' ? riverEntry : flopEntry
  const currentStreetFlow: StreetFlowResult | null =
    street === 'flop' ? flopFlow : street === 'turn' ? turnFlow : street === 'river' ? riverFlow : null

  const preflopLines: PreflopLine[] = (flow?.history ?? []).map((h) => ({
    position: POSITIONS[h.seatIndex],
    action: h.action,
    sizeBB: h.sizeBB,
    auto: h.auto,
  }))

  const streetSections: StreetSection[] = []
  if (flopDone) {
    const steps = traceStreetActions(flopEntry.potBB, flopEntry.effStackBB, streetCommitted.flop)
    if (steps.length > 0) {
      streetSections.push({
        label: STREET_LABEL.flop,
        board: flopPick,
        actions: steps.map((s) => ({ position: POSITIONS[s.actor === 'oop' ? seatA : seatB], action: s.action, sizeBB: s.sizeBB })),
      })
    }
  }
  if (turnDone && flopShowdown) {
    const steps = traceStreetActions(turnEntry.potBB, turnEntry.effStackBB, streetCommitted.turn)
    if (steps.length > 0) {
      streetSections.push({
        label: STREET_LABEL.turn,
        board: turnPick,
        actions: steps.map((s) => ({ position: POSITIONS[s.actor === 'oop' ? seatA : seatB], action: s.action, sizeBB: s.sizeBB })),
      })
    }
  }
  if (riverDone && turnShowdown) {
    const steps = traceStreetActions(riverEntry.potBB, riverEntry.effStackBB, streetCommitted.river)
    if (steps.length > 0) {
      streetSections.push({
        label: STREET_LABEL.river,
        board: riverPick,
        actions: steps.map((s) => ({ position: POSITIONS[s.actor === 'oop' ? seatA : seatB], action: s.action, sizeBB: s.sizeBB })),
      })
    }
  }

  const boardKey = currentBoardForDisplay.map((c) => c.rank + c.suit).join(',')
  const solveKey =
    streetReady && street !== 'done'
      ? `${street}|${seatA}|${seatB}|${boardKey}|${JSON.stringify(rangeA)}|${JSON.stringify(rangeB)}|${streetState.potBB.toFixed(2)}|${streetState.effStackBB.toFixed(2)}`
      : null

  useEffect(() => {
    if (!solveKey || solveKey === solvedKey) return
    let cancelled = false
    setSolveStatus('solving')
    setSolveProgress(null)
    solveStream()
    async function solveStream() {
      try {
        const result = await solveStreet(rangeA, rangeB, currentBoardForDisplay, streetState.potBB, streetState.effStackBB, SOLVE_ITERATIONS, (p) => {
          if (!cancelled) setSolveProgress(p)
        })
        if (cancelled) return
        setSolveResult(result)
        setSolvedKey(solveKey)
        setSolveStatus('done')
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setSolveStatus('error')
        }
      }
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solveKey])

  function reset() {
    setStack(null)
    setCommitted({})
    setSlotLog({})
    setFlopPick([])
    setTurnPick([])
    setRiverPick([])
    setStreetCommitted({ flop: {}, turn: {}, river: {} })
    setSolveResult(null)
    setSolveStatus('idle')
    setSolveProgress(null)
    setSolvedKey(null)
  }

  function handleAction(slot: DecisionSlot, action: PokerAction, sizeBB?: number) {
    setSlotLog((prev) => ({ ...prev, [slot.id]: slot }))
    setCommitted((prev) => ({ ...prev, [slot.id]: { action, sizeBB } }))
  }

  function handleStreetAction(streetName: 'flop' | 'turn' | 'river', nodeId: string, action: StreetAction) {
    setStreetCommitted((prev) => ({ ...prev, [streetName]: { ...prev[streetName], [nodeId]: action } }))
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
        <HandSummary preflop={preflopLines} streets={[]} />
        <button onClick={reset} className="self-center rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 font-semibold text-white">
          새 핸드
        </button>
      </div>
    )
  }

  if (flow && flow.status === 'awaiting') {
    const slot = flow.slot
    return (
      <div className="mx-auto max-w-5xl px-3 py-6 flex flex-col gap-4">
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
          <ActionButtons slot={slot} onAction={(action, sizeBB) => handleAction(slot, action, sizeBB)} equity={preflopEquity} />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:flex-1 sm:min-w-0">
              <RangeGrid chart={slot.chart} cellMode={slot.cellMode} activeHand={activeHand} onHandActive={setActiveHand} />
            </div>
            <div className="sm:w-64 sm:shrink-0">
              <HandDetailPanel
                hand={activeHand}
                chart={slot.chart}
                cellMode={slot.cellMode}
                equity={activeHand && preflopEquity ? preflopEquity.equityByHand[activeHand] : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Postflop
  if (reachedFlop) {
    const awaitingFlow = currentStreetFlow?.status === 'awaiting' ? currentStreetFlow : null
    const isViewingOOP = awaitingFlow?.actor === 'oop'
    const activeSeat = isViewingOOP ? seatA : seatB

    const needFlop = 3 - flopPick.length
    const needTurn = flopShowdown ? 1 - turnPick.length : 0
    const needRiver = turnShowdown ? 1 - riverPick.length : 0

    const usedForFlop: Card[] = []
    const usedForTurn = flopPick
    const usedForRiver = [...flopPick, ...turnPick]

    const thisSolveIsCurrent = solveResult && solvedKey === solveKey
    const primaryStrategy =
      thisSolveIsCurrent && awaitingFlow
        ? isViewingOOP
          ? solveResult!.result.oopStrategy.get(awaitingFlow.nodeId)
          : solveResult!.result.ipStrategy.get(awaitingFlow.nodeId)
        : undefined
    const primaryCombos = isViewingOOP ? solveResult?.oopCombos : solveResult?.ipCombos
    const primaryWeights = isViewingOOP ? solveResult?.oopWeights : solveResult?.ipWeights
    const primaryHandNames = isViewingOOP ? solveResult?.oopHandNames : solveResult?.ipHandNames
    const solvedGrid =
      thisSolveIsCurrent && primaryStrategy && primaryHandNames && primaryWeights
        ? aggregateStrategyToGrid(primaryHandNames, primaryWeights, primaryStrategy)
        : null
    const solvedTotals = solvedGrid ? aggregateGridTotals(solvedGrid) : null
    const evTotals = thisSolveIsCurrent && primaryStrategy && primaryWeights ? aggregateEVTotals(primaryWeights, primaryStrategy) : null
    const availableActions = awaitingFlow?.actions ?? []

    const finalPot = postflopFold
      ? undefined
      : riverFlow?.status === 'complete' && riverFlow.type === 'showdown'
        ? nextStreetState(riverEntry, riverFlow.oopInvested, riverFlow.ipInvested).potBB
        : riverEntry.potBB

    return (
      <div className="mx-auto max-w-5xl px-3 py-6 flex flex-col gap-4">
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

        {street === 'turn' && !turnDone && flopShowdown && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-semibold mb-2">턴 카드 선택 ({needTurn}장 더)</h3>
            <BoardPicker usedCards={usedForTurn} need={1} picked={turnPick} onChange={setTurnPick} />
          </div>
        )}

        {street === 'river' && !riverDone && turnShowdown && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-semibold mb-2">리버 카드 선택 ({needRiver}장 더)</h3>
            <BoardPicker usedCards={usedForRiver} need={1} picked={riverPick} onChange={setRiverPick} />
          </div>
        )}

        {awaitingFlow && ((street === 'flop' && flopDone) || (street === 'turn' && turnDone) || (street === 'river' && riverDone)) && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-white font-semibold">
                {STREET_LABEL[street]} 액션 — <span className="text-violet-400">{POSITIONS[activeSeat]}</span> 차례 ({isViewingOOP ? 'OOP' : 'IP'})
              </h3>
            </div>

            <div className="text-xs text-white/40">
              팟 {streetState.potBB.toFixed(1)}bb · 유효스택 {streetState.effStackBB.toFixed(1)}bb
              {evTotals && (
                <span className="ml-2 text-white/60">
                  · 레인지 평균 EV {evTotals.rangeEV.toFixed(2)}bb ({((evTotals.rangeEV / streetState.potBB) * 100).toFixed(0)}%)
                </span>
              )}
            </div>

            {solveStatus === 'solving' && (
              <div className="flex flex-col gap-1.5">
                <div className="text-sm text-white/60">
                  솔빙 중{solveProgress ? ` (${solveProgress.done}/${solveProgress.total})` : '…'}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-violet-500 transition-all"
                    style={{ width: `${solveProgress ? (solveProgress.done / solveProgress.total) * 100 : 15}%` }}
                  />
                </div>
              </div>
            )}
            {solveStatus === 'error' && <div className="text-sm text-red-400">솔빙 실패 — 다시 시도해주세요.</div>}

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {availableActions.map((a) => {
                const stat = solvedTotals?.[a]
                const ev = evTotals?.actionEV[a]
                return (
                  <button
                    key={a}
                    disabled={!solvedGrid}
                    onClick={() => handleStreetAction(street, awaitingFlow.nodeId, a)}
                    className={`sm:flex-1 sm:min-w-[110px] rounded-lg px-3 py-3 text-left text-white transition-colors disabled:opacity-40 ${POSTFLOP_COLOR[a]}`}
                  >
                    <div className="text-sm font-bold">{POSTFLOP_LABEL[a]}</div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <span className="text-lg font-extrabold">{stat ? stat.pct.toFixed(1) : '—'}%</span>
                      <span className="text-[10px] text-white/70">{stat ? `${stat.combos.toFixed(0)} combos` : ''}</span>
                    </div>
                    {ev !== undefined && (
                      <div className="mt-1 text-[11px] text-white/70">
                        EV {ev.toFixed(2)}bb ({((ev / streetState.potBB) * 100).toFixed(0)}%)
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {solvedGrid && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:flex-1 sm:min-w-0">
                  <SolvedActionGrid grid={solvedGrid} activeHand={activeHand} onHandActive={setActiveHand} />
                </div>
                <div className="sm:w-64 sm:shrink-0">
                  <SolvedHandDetailPanel
                    hand={activeHand}
                    combos={primaryCombos ?? []}
                    handNames={primaryHandNames ?? []}
                    strategy={primaryStrategy}
                    board={currentBoardForDisplay}
                    potBB={streetState.potBB}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {street === 'done' && postflopFold && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="text-lg font-semibold text-white mb-2">핸드 종료</div>
              <div className="text-white/60 text-sm">
                {STREET_LABEL[postflopFold.street]}에서 {POSITIONS[postflopFold.folder === 'oop' ? seatA : seatB]}가 폴드 —{' '}
                {POSITIONS[postflopFold.folder === 'oop' ? seatB : seatA]} 승리
              </div>
            </div>
            <HandSummary preflop={preflopLines} streets={streetSections} />
            <button onClick={reset} className="self-center rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 font-semibold text-white">
              새 핸드
            </button>
          </div>
        )}

        {street === 'done' && !postflopFold && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="text-lg font-semibold text-white mb-2">핸드 완료 (쇼다운)</div>
              <div className="text-white/60 text-sm">
                보드: {currentBoardForDisplay.map((c) => `${c.rank}${c.suit}`).join(' ')}
              </div>
              {finalPot !== undefined && <div className="text-white/60 text-sm mt-1">최종 팟: {finalPot.toFixed(1)}bb</div>}
            </div>
            <HandSummary preflop={preflopLines} streets={streetSections} />
            <button onClick={reset} className="self-center rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 font-semibold text-white">
              새 핸드
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
