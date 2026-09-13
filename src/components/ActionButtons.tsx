import type { DecisionSlot } from '../engine/preflop'
import { computeActionTotals } from '../engine/chart'
import { ACTION_COLOR, ACTION_LABEL } from '../theme'
import type { PokerAction } from '../types'

interface Props {
  slot: DecisionSlot
  onAction: (action: PokerAction, sizeBB?: number) => void
}

export default function ActionButtons({ slot, onAction }: Props) {
  const totals = computeActionTotals(slot.chart, slot.cellMode)

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        {slot.availableActions.map((action) => {
          let sizeLabel = ''
          let sizeBB: number | undefined
          if (action === 'raise') {
            sizeBB = slot.raiseSizeBB
            sizeLabel = sizeBB ? ` ${sizeBB}` : ''
          } else if (action === 'allin') {
            sizeBB = slot.allinSizeBB
            sizeLabel = ` ${sizeBB}`
          } else if (action === 'call' && slot.callSizeBB) {
            sizeBB = slot.callSizeBB
            sizeLabel = ` ${sizeBB}`
          }
          const total = totals[action]
          return (
            <button
              key={action}
              onClick={() => onAction(action, sizeBB)}
              className="sm:flex-1 sm:min-w-[110px] rounded-lg px-3 py-3 sm:py-4 text-left text-white transition-transform hover:scale-[1.02]"
              style={{ background: ACTION_COLOR[action] }}
            >
              <div className="text-base sm:text-lg font-bold">
                {ACTION_LABEL[action]}
                {sizeLabel}
              </div>
              <div className="mt-3 sm:mt-6 flex items-end justify-between gap-2">
                <span className="text-xl sm:text-2xl font-extrabold">{total.pct.toFixed(1)}%</span>
                <span className="text-[10px] sm:text-xs text-white/70">{total.combos.toFixed(0)} combos</span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {(['allin', 'raise', 'call', 'fold'] as PokerAction[]).map((action) =>
          totals[action].pct > 0.05 ? (
            <div key={action} style={{ width: `${totals[action].pct}%`, background: ACTION_COLOR[action] }} />
          ) : null
        )}
      </div>
    </div>
  )
}
