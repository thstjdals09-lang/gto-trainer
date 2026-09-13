import { buildTree, type StreetAction, type TreeNode } from './postflopSolver'

/** nodeId -> action chosen at that node, for one street. */
export type StreetCommitted = Partial<Record<string, StreetAction>>

export type StreetFlowResult =
  | { status: 'awaiting'; nodeId: string; actor: 'oop' | 'ip'; actions: StreetAction[] }
  | { status: 'complete'; type: 'fold' | 'showdown'; foldedPlayer?: 'oop' | 'ip'; oopInvested: number; ipInvested: number }

/**
 * Walks the same betting tree the CFR solve was run on (OOP checks/bets; if checked to, IP
 * checks/bets; a bet can be folded/called/raised) using the actions actually chosen so far this
 * street, so both players get asked to act in turn instead of the street ending after a single
 * click. Returns the next awaiting decision, or the terminal both players' actions reached.
 */
export function computeStreetFlow(potBB: number, effStackBB: number, committed: StreetCommitted): StreetFlowResult {
  let node: TreeNode = buildTree(potBB, effStackBB)
  while (node.kind === 'decision') {
    const chosen = committed[node.id]
    if (!chosen) return { status: 'awaiting', nodeId: node.id, actor: node.actor, actions: node.actions }
    const child = node.children[chosen]
    if (!child) return { status: 'awaiting', nodeId: node.id, actor: node.actor, actions: node.actions }
    node = child
  }
  return {
    status: 'complete',
    type: node.type,
    foldedPlayer: node.foldedPlayer,
    oopInvested: node.oopInvested,
    ipInvested: node.ipInvested,
  }
}
