// Fast 5/7-card hand evaluator. Cards are packed ints: rank(2-14) in bits 2-5, suit(0-3) in bits 0-1.
// Higher returned score = better hand. Hot path is allocation-free (typed-array scratch buffers,
// no array literals/closures) since the postflop solver's equity engine calls this millions of times.

export function packCard(rank: number, suit: number): number {
  return (rank << 2) | suit
}

export function cardRank(c: number): number {
  return c >> 2
}

export function cardSuit(c: number): number {
  return c & 3
}

const RANK_COUNT = new Int32Array(15) // index 2..14
const SUIT_COUNT = new Int32Array(4)

/** Score one 5-card hand (5 packed-card ints as separate args to avoid array allocation). Higher is better. */
function score5(a: number, b: number, c: number, d: number, e: number): number {
  RANK_COUNT.fill(0)
  SUIT_COUNT[0] = 0
  SUIT_COUNT[1] = 0
  SUIT_COUNT[2] = 0
  SUIT_COUNT[3] = 0

  let rankBits = 0
  RANK_COUNT[a >> 2]++; SUIT_COUNT[a & 3]++; rankBits |= 1 << (a >> 2)
  RANK_COUNT[b >> 2]++; SUIT_COUNT[b & 3]++; rankBits |= 1 << (b >> 2)
  RANK_COUNT[c >> 2]++; SUIT_COUNT[c & 3]++; rankBits |= 1 << (c >> 2)
  RANK_COUNT[d >> 2]++; SUIT_COUNT[d & 3]++; rankBits |= 1 << (d >> 2)
  RANK_COUNT[e >> 2]++; SUIT_COUNT[e & 3]++; rankBits |= 1 << (e >> 2)

  const isFlush = SUIT_COUNT[0] === 5 || SUIT_COUNT[1] === 5 || SUIT_COUNT[2] === 5 || SUIT_COUNT[3] === 5

  const wheelBits = rankBits | ((rankBits >> 14) & 1) << 1
  let straightHigh = 0
  for (let hi = 14; hi >= 5; hi--) {
    const mask = (1 << hi) | (1 << (hi - 1)) | (1 << (hi - 2)) | (1 << (hi - 3)) | (1 << (hi - 4))
    if ((wheelBits & mask) === mask) {
      straightHigh = hi
      break
    }
  }

  if (isFlush && straightHigh) return 8 * 16 ** 5 + straightHigh

  // Walk ranks high->low, classify without allocating.
  let quad = 0
  let trip = 0
  let pairHi = 0
  let pairLo = 0
  let k1 = 0
  let k2 = 0
  let k3 = 0
  let k4 = 0
  let k5 = 0
  for (let r = 14; r >= 2; r--) {
    const n = RANK_COUNT[r]
    if (n === 4) quad = r
    else if (n === 3) trip = r
    else if (n === 2) {
      if (pairHi === 0) pairHi = r
      else pairLo = r
    } else if (n === 1) {
      if (k1 === 0) k1 = r
      else if (k2 === 0) k2 = r
      else if (k3 === 0) k3 = r
      else if (k4 === 0) k4 = r
      else k5 = r
    }
  }

  if (quad) return 7 * 16 ** 5 + quad * 16 + k1
  if (trip && pairHi) return 6 * 16 ** 5 + trip * 16 + pairHi
  // A 5-card flush can't have a paired rank (same rank+suit would be a duplicate card),
  // so k1..k5 are already its 5 ranks in descending order.
  if (isFlush) return 5 * 16 ** 5 + k1 * 16 ** 4 + k2 * 16 ** 3 + k3 * 16 ** 2 + k4 * 16 + k5
  if (straightHigh) return 4 * 16 ** 5 + straightHigh
  if (trip) return 3 * 16 ** 5 + trip * 16 ** 2 + k1 * 16 + k2
  if (pairHi && pairLo) return 2 * 16 ** 5 + pairHi * 16 ** 2 + pairLo * 16 + k1
  if (pairHi) return 1 * 16 ** 5 + pairHi * 16 ** 3 + k1 * 16 ** 2 + k2 * 16 + k3
  return k1 * 16 ** 4 + k2 * 16 ** 3 + k3 * 16 ** 2 + k4 * 16 + k5 // high card
}

// Precomputed index combos for "best 5 of 7" / "best 5 of 6", as flat quintuples to avoid nested arrays.
const IDX7: number[] = []
for (let a = 0; a < 7; a++)
  for (let b = a + 1; b < 7; b++) {
    for (let i = 0; i < 7; i++) if (i !== a && i !== b) IDX7[IDX7.length] = i
  }

/** Best 5-card score across exactly 5, 6, or 7 cards. */
export function evaluate7(cards: number[]): number {
  const n = cards.length
  if (n === 5) return score5(cards[0], cards[1], cards[2], cards[3], cards[4])

  let best = 0
  if (n === 6) {
    // C(6,5) = 6: drop exactly one card each time
    for (let skip = 0; skip < 6; skip++) {
      let i0 = -1, i1 = -1, i2 = -1, i3 = -1, i4 = -1
      let w = 0
      for (let i = 0; i < 6; i++) {
        if (i === skip) continue
        if (w === 0) i0 = i
        else if (w === 1) i1 = i
        else if (w === 2) i2 = i
        else if (w === 3) i3 = i
        else i4 = i
        w++
      }
      const s = score5(cards[i0], cards[i1], cards[i2], cards[i3], cards[i4])
      if (s > best) best = s
    }
    return best
  }

  // n === 7: use precomputed 21 quintuples
  for (let base = 0; base < IDX7.length; base += 5) {
    const s = score5(
      cards[IDX7[base]],
      cards[IDX7[base + 1]],
      cards[IDX7[base + 2]],
      cards[IDX7[base + 3]],
      cards[IDX7[base + 4]]
    )
    if (s > best) best = s
  }
  return best
}
