import type { DecisionSlot } from '../engine/preflop'
import type { PokerAction } from '../types'

const COLOR: Record<PokerAction, string> = {
  fold: 'bg-sky-600 hover:bg-sky-500',
  call: 'bg-amber-500 hover:bg-amber-400 text-black',
  raise: 'bg-red-600 hover:bg-red-500',
  allin: 'bg-red-900 hover:bg-red-800',
}

const LABEL: Record<PokerAction, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', allin: 'Allin' }

interface Props {
  slot: DecisionSlot
  onAction: (action: PokerAction, sizeBB?: number) => void
}

export default function ActionButtons({ slot, onAction }: Props) {
  return (
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
        return (
          <button
            key={action}
            onClick={() => onAction(action, sizeBB)}
            className={`sm:flex-1 sm:min-w-[90px] rounded-lg px-3 py-3 text-sm sm:text-base font-semibold text-white transition-colors ${COLOR[action]}`}
          >
            {LABEL[action]}
            {sizeLabel}
          </button>
        )
      })}
    </div>
  )
}
