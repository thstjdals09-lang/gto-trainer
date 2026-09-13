import { RANKS, SUITS, type Card, type Suit } from '../types'

const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLOR: Record<Suit, string> = { s: '#e5e7eb', h: '#f87171', d: '#60a5fa', c: '#4ade80' }

interface Props {
  usedCards: Card[]
  need: number
  picked: Card[]
  onChange: (cards: Card[]) => void
}

export default function BoardPicker({ usedCards, need, picked, onChange }: Props) {
  const isUsed = (r: Card['rank'], s: Suit) => usedCards.some((c) => c.rank === r && c.suit === s) || picked.some((c) => c.rank === r && c.suit === s)

  function toggle(card: Card) {
    const already = picked.findIndex((c) => c.rank === card.rank && c.suit === card.suit)
    if (already >= 0) {
      onChange(picked.filter((_, i) => i !== already))
      return
    }
    if (picked.length >= need) return
    onChange([...picked, card])
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        {SUITS.flatMap((suit) =>
          RANKS.map((rank) => {
            const used = isUsed(rank, suit)
            const isPicked = picked.some((c) => c.rank === rank && c.suit === suit)
            return (
              <button
                key={`${rank}${suit}`}
                disabled={used && !isPicked}
                onClick={() => toggle({ rank, suit })}
                className="aspect-[3/4] rounded border text-[10px] sm:text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                style={{
                  borderColor: isPicked ? '#fff' : 'rgba(255,255,255,0.15)',
                  background: isPicked ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: SUIT_COLOR[suit],
                }}
              >
                {rank}{SUIT_SYMBOL[suit]}
              </button>
            )
          })
        )}
      </div>
      <div className="text-xs text-white/50">{picked.length}/{need} 장 선택됨</div>
    </div>
  )
}
