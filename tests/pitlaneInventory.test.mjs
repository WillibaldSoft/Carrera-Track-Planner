import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, traceTrackPlan } from '../vendor/racehubos/shared/src/trackPlan.js'
import {
  railRequirements,
  inventoryComparison,
  emptyRailInventory,
  pitTurnoutHasNativeExtra,
} from '../vendor/racehubos/shared/src/railInventory.js'
const native = () => {
  const p = emptyTrackPlan()
  return {
    ...p,
    pit: { ...p.pit, enabled: true, native: true, entry: 0, merge: 1 },
    pieces: [
      { type: 'Pit_stop_weiche_anfang', level: 0 },
      { type: 'Pit_stop_weiche_ende', level: 0 },
    ],
    trackExtras: [
      {
        kind: 'pitEntry',
        level: 0,
        paintOrder: 1,
        anchor: 0,
        placement: { xMm: 517.5, yMm: 198, headingDegrees: 180 },
      },
      { kind: 'pitExit', level: 0, paintOrder: 3, anchor: 1, placement: { xMm: 517.5, yMm: 198, headingDegrees: 180 } },
    ],
  }
}
test('carrier pair plus a separately placed pair requires two pairs, even with shared anchors', () => {
  const p = native(),
    before = JSON.stringify(p)
  assert.equal(pitTurnoutHasNativeExtra(p, traceTrackPlan(p).segments, 0), false)
  assert.equal(railRequirements(p).counts['30356'], 2)
  const stock = emptyRailInventory()
  stock.counts['30356'] = 1
  const row = inventoryComparison(p, stock).rows.find((r) => r.article === '30356')
  assert.equal(row.required, 2)
  assert.equal(row.remaining, -1)
  assert.equal(JSON.stringify(p), before)
})
test('extras representing the carrier itself are counted only once', () => {
  const p = native()
  for (const e of p.trackExtras) e.placement = { xMm: 172.5, yMm: 99, headingDegrees: 180 }
  assert.equal(railRequirements(p).counts['30356'], 1)
  assert.equal(pitTurnoutHasNativeExtra(p, traceTrackPlan(p).segments, 0), true)
  assert.equal(pitTurnoutHasNativeExtra(p, traceTrackPlan(p).segments, 1), true)
})
test('two explicit pairs and their carrier representations require two pairs', () => {
  const p = native()
  p.trackExtras.push(...p.trackExtras.map((e) => ({ ...e, placement: { xMm: 172.5, yMm: 99, headingDegrees: 180 } })))
  assert.equal(railRequirements(p).counts['30356'], 2)
})
