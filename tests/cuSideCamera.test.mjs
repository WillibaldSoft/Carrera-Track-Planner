import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, enableFreePlacement, transformFreeParts } from '../vendor/racehubos/shared/src/index.js'
import { cuSideCamera } from '../addons/track-planner/src/components/cuSideCamera.js'
test('CU-side view follows the position of the CU when the layout rotates', () => {
  const plan = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: [
      { type: 'Control_unit', level: 0, jointDegrees: 0 },
      { type: 'Standardgerade', level: 0, jointDegrees: 0 },
    ],
  })
  const view = cuSideCamera(plan),
    rotated = cuSideCamera(transformFreeParts(plan, [0, 1], { degrees: 90 }))
  assert.equal(view.available, true)
  assert.equal(view.pitch, 35)
  const diff = ((rotated.yaw - view.yaw + 540) % 360) - 180
  assert.ok(Math.abs(Math.abs(diff) - 90) < 1e-6)
  assert.equal(cuSideCamera(emptyTrackPlan()).available, false)
})
