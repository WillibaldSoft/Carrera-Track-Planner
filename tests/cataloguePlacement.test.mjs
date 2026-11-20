import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, enableFreePlacement } from '../vendor/racehubos/shared/src/index.js'
import { replacementTargetAt } from '../addons/track-planner/src/components/cataloguePlacement.js'
const plan = enableFreePlacement({ ...emptyTrackPlan(), pieces: [0, 1].map(() => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })) })
test('replacement is limited to the rail middle and respects visible rails', () => {
  assert.equal(replacementTargetAt(plan, { x: 172.5, y: 0 }), 0)
  assert.equal(replacementTargetAt(plan, { x: 345, y: 0 }), -1)
  assert.equal(replacementTargetAt(plan, { x: 0, y: 0 }), -1)
  assert.equal(replacementTargetAt(plan, { x: 172.5, y: 90 }), -1)
  assert.equal(replacementTargetAt(plan, { x: 172.5, y: 0 }, [1]), -1)
  assert.equal(replacementTargetAt(plan, null), -1)
})
