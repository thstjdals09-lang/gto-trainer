import type { ReactNode } from 'react'
import { allCombosForHand } from '../engine/handEval'
import { fromPackedCard, toPackedCard } from '../engine/solverBridge'
import { getDisplayCell } from '../engine/chart'
import type { InfosetStrategy, StreetAction } from '../engine/postflopSolver'
import type { CellMode } from '../engine/preflop'
import { ACTION_COLOR, ACTION_LABEL, SUIT_COLOR, SUIT_SYMBOL } from '../theme'
import type { Card, Chart, PokerAction } from '../types'

const LABEL: Record<StreetAction, string> = { check: 'Check', 'bet-small': 'Bet 33%', 'bet-big': 'Bet 75%+', fold: 'Fold', call: 'Call', raise: 'Raise' }
const COLOR: Record<StreetAction, string> = {
  check: '#2b6cb0',
  'bet-small': '#d4a72c',
  'bet-big': '#dc2626',
  fold: '#2b6cb0',
  call: '#d4a72c',
  raise: '#7f1d1d',
}
const PREFLOP_ACTION_ORDER: PokerAction[] = ['allin', 'raise', 'call', 'fold']

interface Props {
  hand: string | null
  combos: number[][]
  handNames: string[]
  strategy: InfosetStrategy | undefined
  /** Board cards, so a hand outside this node's range can still show its real board-legal combos. */
  board: Card[]
  potBB?: number
  /** The viewed seat's last preflop decision — lets us show what that hand ACTUALLY did preflop
   * (e.g. "always raises here") instead of guessing "folded" for every hand absent from this
   * postflop range (most are absent because the chart sends them to a different action, not fold). */
  preflopChart?: Chart
  preflopCellMode?: CellMode
}

function ComboCard({ c1, c2, children }: { c1: Card; c2: Card; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="flex items-center gap-1 text-base font-bold">
        <span style={{ color: SUIT_COLOR[c1.suit] }}>
          {c1.rank}
          {SUIT_SYMBOL[c1.suit]}
        </span>
        <span style={{ color: SUIT_COLOR[c2.suit] }}>
          {c2.rank}
          {SUIT_SYMBOL[c2.suit]}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function SolvedHandDetailPanel({ hand, combos, handNames, strategy, board, potBB, preflopChart, preflopCellMode }: Props) {
  if (!hand || !strategy) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/30">
        핸드에 커서를 올리면 콤보별 빈도·EV가 여기 표시됩니다
      </div>
    )
  }

  const indices: number[] = []
  for (let i = 0; i < handNames.length; i++) if (handNames[i] === hand) indices.push(i)

  if (indices.length === 0) {
    // Not part of this node's continuing range. Almost always this means the preflop chart
    // sends this hand to a DIFFERENT action than the one picked for this range (e.g. AKs always
    // raises, so it's absent from a "call" range) — not that it folded. Show the hand's real
    // preflop action split when we have it, so we never assert something untrue like "Fold 100%".
    const boardSet = new Set(board.map(toPackedCard))
    const boardCombos = allCombosForHand(hand).filter(([c1, c2]) => !boardSet.has(toPackedCard(c1)) && !boardSet.has(toPackedCard(c2)))
    if (boardCombos.length === 0) {
      return (
        <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/30 text-center px-3">
          {hand}: 이 보드에서 가능한 콤보 없음 (모든 조합이 보드 카드와 겹침)
        </div>
      )
    }

    const preflopCell = preflopChart && preflopCellMode ? getDisplayCell(preflopChart, hand, preflopCellMode) : null
    const foldPct = preflopCell ? Math.max(0, 100 - preflopCell.weight) : 100

    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-white/70">{hand}</div>
        <div className="grid grid-cols-2 gap-2">
          {boardCombos.map(([c1, c2], i) => (
            <ComboCard key={i} c1={c1} c2={c2}>
              <div className="mt-1.5 flex flex-col gap-0.5 text-[11px]">
                {preflopCell
                  ? PREFLOP_ACTION_ORDER.map((a) => {
                      const pct = a === 'fold' ? foldPct : (preflopCell.weight * (preflopCell.actions[a] ?? 0)) / 100
                      if (pct <= 0.5) return null
                      return (
                        <div key={a} className="flex items-center justify-between gap-2">
                          <span style={{ color: ACTION_COLOR[a] }}>{ACTION_LABEL[a]}</span>
                          <span className="text-white/70">{pct.toFixed(0)}%</span>
                        </div>
                      )
                    })
                  : (
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ color: ACTION_COLOR.fold }}>Fold</span>
                        <span className="text-white/70">100%</span>
                      </div>
                    )}
              </div>
            </ComboCard>
          ))}
        </div>
        <div className="text-[11px] text-white/30">프리플랍 액션 (이 스트리트 레인지에는 포함되지 않음)</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold text-white/70">{hand}</div>
      <div className="grid grid-cols-2 gap-2">
        {indices.map((i) => {
          const [c1, c2] = combos[i].map(fromPackedCard)
          return (
            <ComboCard key={i} c1={c1} c2={c2}>
              <div className="mt-1.5 flex flex-col gap-0.5 text-[11px]">
                {strategy.actions.map((a) => {
                  const pct = strategy.strategy[a][i] * 100
                  if (pct <= 0.05) return null
                  const ev = strategy.actionEV[a][i]
                  return (
                    <div key={a} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2">
                      <span style={{ color: COLOR[a] }}>{LABEL[a]}</span>
                      <span className="text-right text-white/80 tabular-nums">{pct.toFixed(0)}%</span>
                      <span className="text-right text-white/40 tabular-nums">{ev.toFixed(1)}bb</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1 text-[11px] text-white/50">
                <span>EV</span>
                <span className="tabular-nums">
                  {strategy.nodeEV[i].toFixed(1)}bb{potBB ? ` (${((strategy.nodeEV[i] / potBB) * 100).toFixed(0)}%)` : ''}
                </span>
              </div>
            </ComboCard>
          )
        })}
      </div>
    </div>
  )
}
