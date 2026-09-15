import { fromPackedCard } from '../engine/solverBridge'
import type { InfosetStrategy, StreetAction } from '../engine/postflopSolver'
import { POSTFLOP_ACTION_COLOR, SUIT_COLOR, SUIT_SYMBOL } from '../theme'

const LABEL: Partial<Record<StreetAction, string>> = { check: 'Check', 'bet-small': 'Bet 33%', 'bet-big': 'Bet 75%+' }

interface Props {
  hand: string | null
  combos: number[][]
  handNames: string[]
  strategy: InfosetStrategy | undefined
}

export default function SolvedHandDetailPanel({ hand, combos, handNames, strategy }: Props) {
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
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/30">
        {hand}: 이 보드에서 가능한 콤보 없음 (보드에 막힘)
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
                      <span style={{ color: POSTFLOP_ACTION_COLOR[a as 'check' | 'bet-small' | 'bet-big'] }}>{LABEL[a]}</span>
                      <span className="text-white/70">
                        {pct.toFixed(0)}%
                        <span className="ml-1.5 text-white/40">{ev.toFixed(1)}bb</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 border-t border-white/10 pt-1 text-[11px] text-white/50">EV {strategy.nodeEV[i].toFixed(1)}bb</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
