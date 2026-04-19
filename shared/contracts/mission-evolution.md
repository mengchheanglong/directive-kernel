# Mission Evolution

Mission evolution records capture approved changes to the active engine mission.

## Rule

- keep the engine mission shape canonical
- keep one active mission evolution version at a time
- require explicit operator rationale for every evolution
- preview mission impact before approval
- keep cascade rerouting bounded and opt-in
- keep historical engine runs unchanged; mission cascade only records projected reroute outcomes

## Legal States

- `active`
- `superseded`
- `reverted`

## Legal Transitions

- `active -> superseded` when a newer approved mission evolution is written
- `active -> reverted` when an operator explicitly reverts the active mission
- revert writes a new `active` version using the previous mission snapshot

## Required Proof

- operator approval
- preview acknowledgment
- operator rationale
- bounded cascade scope if any cascade runs are approved

## Stop-Line

Do not mutate historical engine run records when mission context changes. Record projected reroute outcomes separately and move forward with a new mission version.
