import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, enableFreePlacement, traceTrackPlan } from '../vendor/racehubos/shared/src/index.js'
import { trackExtensionOptions, extendHoveredTrack } from '../addons/track-planner/src/components/hoverTrackActions.js'
const plan = (type) => enableFreePlacement({ ...emptyTrackPlan(), pieces: [{ type, level: 1, jointDegrees: 0 }] })
for (const type of ['Standardgerade', 'Kurve_1_60_rechts', 'Kurve_2_30_links']) {
  for (const direction of ['forward', 'backward']) test(`${type} extends ${direction} with aligned joints and unchanged original`, () => {
    const input = plan(type), before = traceTrackPlan(input).segments[0]
    const result = extendHoveredTrack(input, 0, direction)
    assert.ok(result)
    const segments = traceTrackPlan(result.plan).segments
    const [a, b] = [segments[0].end, segments[1].start]
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-7)
    assert.ok(Math.abs(a.h - b.h) < 1e-7)
    const original = segments[direction === 'forward' ? 0 : 1]
    assert.deepEqual(original.start, before.start)
    assert.deepEqual(original.end, before.end)
    assert.equal(result.plan.pieces[result.selected].level, 1)
    assert.equal(traceTrackPlan(result.plan).connectivity.openPorts.length, 2)
  })
}
test('connected end refuses duplicate extension while the other end remains open', () => {
  const first = extendHoveredTrack(plan('Standardgerade'), 0, 'forward')
  assert.equal(trackExtensionOptions(first.plan, 0).forward.available, false)
  assert.equal(extendHoveredTrack(first.plan, 0, 'forward'), null)
  assert.equal(trackExtensionOptions(first.plan, 0).backward.available, true)
})
test('CU direction controls extension of a rail traversed in reverse', () => {
  const input = enableFreePlacement({
    ...emptyTrackPlan(), freePlacement: true,
    pieces: [
      { type: 'Control_unit', level: 0, jointDegrees: 0, placement: { xMm: 0, yMm: 0, headingDegrees: 0 } },
      { type: 'Standardgerade', level: 0, jointDegrees: 0, placement: { xMm: 690, yMm: 0, headingDegrees: 180 } },
    ],
  })
  const options = trackExtensionOptions(input, 1)
  assert.equal(options.reverse, true)
  assert.equal(options.forward.action, 'before')
  assert.equal(options.forward.available, true)
  assert.equal(options.backward.available, false)
  const result = extendHoveredTrack(input, 1, 'forward')
  assert.deepEqual(result.plan.pieces[0].placement, input.pieces[0].placement)
  assert.equal(traceTrackPlan(result.plan).connectivity.openPorts.length, 2)
})
test('hover previews are pure and match the later extension', async () => {
  const { previewHoveredTrackAction } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  const input = plan('Kurve_1_60_rechts'), before = JSON.stringify(input)
  for (const direction of ['forward', 'backward']) {
    assert.deepEqual(previewHoveredTrackAction(input, 0, direction), extendHoveredTrack(input, 0, direction))
  }
  const shoulder = previewHoveredTrackAction(input, 0, 'left')
  assert.ok(shoulder.plan.pieces[0].borders.left)
  assert.equal(JSON.stringify(input), before)
})
test('shoulder blocking explains occupied and unit sides, and maps reversed sides', async () => {
  const { hoveredShoulderStatus, previewHoveredTrackAction } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  const input = plan('Standardgerade')
  const before = JSON.stringify(input)
  const next = previewHoveredTrackAction(input, 0, 'left').plan
  assert.equal(JSON.stringify(input), before)
  assert.equal(hoveredShoulderStatus(next, 0, 'left').mode, 'remove')
  assert.equal(hoveredShoulderStatus(next, 0, 'right', true).mode, 'remove')
  assert.equal(hoveredShoulderStatus(plan('Control_unit'), 0, 'left').reason, 'unit')
  assert.equal(hoveredShoulderStatus(plan('Control_unit'), 0, 'right').available, true)
})
test('movement groups block extension but still allow individual shoulders', async () => {
  const { groupTrackParts } = await import('../vendor/racehubos/shared/src/index.js')
  const { previewHoveredTrackAction } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  let input = extendHoveredTrack(plan('Standardgerade'), 0, 'forward').plan
  input = groupTrackParts(input, [0, 1])
  assert.equal(trackExtensionOptions(input, 0).backward.reason, 'grouped')
  assert.ok(previewHoveredTrackAction(input, 0, 'left').plan.pieces[0].borders.left)
})
test('shoulder toggle removes only the chosen physical side including caps and retains the input', async () => {
  const { previewHoveredTrackAction } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  const input = plan('Standardgerade')
  input.pieces[0].borders = { left: { startCap: true, endCap: true, drawLayer: 2 }, right: { startCap: false, endCap: true } }
  const before = JSON.stringify(input)
  const removed = previewHoveredTrackAction(input, 0, 'left')
  assert.equal(removed.mode, 'remove')
  assert.equal(removed.plan.pieces[0].borders.left, undefined)
  assert.deepEqual(removed.plan.pieces[0].borders.right, input.pieces[0].borders.right)
  assert.equal(JSON.stringify(input), before)
  const added = previewHoveredTrackAction(removed.plan, 0, 'left')
  assert.equal(added.mode, 'add')
  assert.ok(added.plan.pieces[0].borders.left)
})
test('flow follows connected visible rails and ignores unrelated array neighbours', async () => {
  const { shoulderFlowNeighbours, hoverActionHandles } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  const input = enableFreePlacement({ ...emptyTrackPlan(), pieces: [0,1,2].map(() => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })) })
  assert.deepEqual(shoulderFlowNeighbours(input, 1), [0,2])
  assert.deepEqual(shoulderFlowNeighbours(input, 1, [1,2]), [2])
  const handles = hoverActionHandles(input, 1, 1000, 1000, 'left', [1,2])
  assert.deepEqual(handles.filter(h => h.index !== 1).map(h => [h.index,h.action]), [[2,'left']])
  input.pieces[2].placement.yMm = 2000
  assert.deepEqual(shoulderFlowNeighbours(input, 1), [0])
})
test('a shoulder stroke keeps its initial add/remove mode across mixed rails and repeated visits', async () => {
  const { applyShoulderStrokeStep } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  let input = enableFreePlacement({ ...emptyTrackPlan(), pieces: [0,1,2].map(() => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })) })
  input.pieces[1].borders = { left: { startCap: false, endCap: false, drawLayer: 2 } }
  const existing = JSON.stringify(input.pieces[1])
  for (const index of [0,1,2,1,0]) input = applyShoulderStrokeStep(input, index, 'left', 'add')
  assert.ok(input.pieces.every(p => p.borders.left))
  assert.deepEqual(input.pieces[1], JSON.parse(existing))
  for (const index of [0,1,2,1,0]) input = applyShoulderStrokeStep(input, index, 'left', 'remove')
  assert.ok(input.pieces.every(p => !p.borders?.left))
})
test('a fast pointer path hits intervening arrows in order without touching off-path targets', async () => {
  const { crossedShoulderTargets } = await import('../addons/track-planner/src/components/hoverTrackActions.js')
  const targets = [{x:200,y:0,radius:20,index:2},{x:100,y:0,radius:20,index:1},{x:150,y:60,radius:20,index:3}]
  assert.deepEqual(crossedShoulderTargets(targets,{x:0,y:0},{x:300,y:0}).map(t=>t.index),[1,2])
})
