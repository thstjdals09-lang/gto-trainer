import { fromPackedCard } from '../engine/solverBridge'
import type { InfosetStrategy, StreetAction } from '../engine/postflopSolver'
import { SUIT_COLOR, SUIT_SYMBOL } from '../theme'

const LABEL: Record<StreetAction, string> = { check: 'Check', 'bet-small': 'Bet 33%', 'bet-big': 'Bet 75%+', fold: 'Fold', call: 'Call', raise: 'Raise' }
const COLOR: Record<StreetAction, string> = {
  check: '#2b6cb0',
  'bet-small': '#d4a72c',
  'bet-big': '#dc2626',
  fold: '#2b6cb0',
  call: '#d4a72c',
  raise: '#7f1d1d',
}

interface Props {
  hand: string | null
  combos: number[][]
  handNames: string[]
  strategy: InfosetStrategy | undefined
  /** The hand's original preflop-continuing weight (0-100) — lets us tell "not in this range at
   * all" (e.g. AA went to raise instead of call, so it's absent from a calling range) apart from
   * "genuinely blocked by the board" (every concrete combo shares a card with the board). */
  rangeWeight?: number
  /** Pot (bb) entering this decision, for showing EV as a % of pot alongside the bb figure. */
  potBB?: number
}

export default function SolvedHandDetailPanel({ hand, combos, handNames, strategy, rangeWeight, potBB }: Props) {
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
    const notInRange = !rangeWeight || rangeWeight <= 0
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/30 text-center px-3">
        {notInRange
          ? `${hand}: 이 레인지에 포함되지 않음 (프리플랍에서 다른 액션으로 감)`
          : `${hand}: 이 보드에서 가능한 콤보 없음 (모든 조합이 보드 카드와 겹침)`}
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
            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2">
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
              <div className="mt-1.5 flex flex-col gap-0.5 text-[11px]">
                {strategy.actions.map((a) => {
                  const pct = strategy.strategy[a][i] * 100
                  if (pct <= 0.05) return null
                  const ev = strategy.actionEV[a][i]
                  return (
                    <div key={a} className="flex items-center justify-between gap-2">
                      <span style={{ color: COLOR[a] }}>{LABEL[a]}</span>
                      <span className="text-white/70">
                        {pct.toFixed(0)}%
                        <span className="ml-1.5 text-white/40">
                          {ev.toFixed(1)}bb{potBB ? ` (${((ev / potBB) * 100).toFixed(0)}%)` : ''}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 border-t border-white/10 pt-1 text-[11px] text-white/50">
                EV {strategy.nodeEV[i].toFixed(1)}bb{potBB ? ` (${((strategy.nodeEV[i] / potBB) * 100).toFixed(0)}%)` : ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
