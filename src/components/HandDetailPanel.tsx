import { allCombosForHand } from '../engine/handEval'
import { getDisplayCell } from '../engine/chart'
import { ACTION_COLOR, ACTION_LABEL, SUIT_COLOR, SUIT_SYMBOL } from '../theme'
import type { Chart, PokerAction } from '../types'
import type { CellMode } from '../engine/preflop'

const ACTION_ORDER: PokerAction[] = ['allin', 'raise', 'call', 'fold']

interface Props {
  hand: string | null
  chart: Chart
  cellMode: CellMode
  /** hero's all-in showdown equity (0-1) vs the villain's implied range, if a specific villain exists for this decision. */
  equity?: number
}

export default function HandDetailPanel({ hand, chart, cellMode, equity }: Props) {
  if (!hand) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/30">
        핸드에 커서를 올리면 콤보별 빈도가 여기 표시됩니다
      </div>
    )
  }

  const cell = getDisplayCell(chart, hand, cellMode)
  const foldPct = Math.max(0, 100 - cell.weight)
  const combos = allCombosForHand(hand)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-white/70">{hand}</span>
        {equity !== undefined && <span className="text-xs text-white/50">쇼다운 승률 {(equity * 100).toFixed(0)}%</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {combos.map(([c1, c2], i) => (
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
              {ACTION_ORDER.map((action) => {
                const pct = action === 'fold' ? foldPct : (cell.weight * (cell.actions[action] ?? 0)) / 100
                if (pct <= 0.001) return null
                return (
                  <div key={action} className="flex items-center justify-between gap-2">
                    <span style={{ color: ACTION_COLOR[action] }}>{ACTION_LABEL[action]}</span>
                    <span className="text-white/70">{pct.toFixed(0)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
