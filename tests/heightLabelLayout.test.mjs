import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { emptyTrackPlan, enableFreePlacement } from '../vendor/racehubos/shared/src/index.js'
import { buildTrackElevationModel } from '../addons/track-planner/src/components/trackElevationModel.js'
import { layoutTrackHeightLabels } from '../addons/track-planner/src/components/heightLabelLayout.js'
const p = () => ({
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 6 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
})
function check(layout, viewport) {
  for (const [i, a] of layout.items.entries()) {
    assert.ok(
      a.rect.x >= 0 && a.rect.y >= 0 && a.rect.x + a.width <= viewport.width && a.rect.y + a.height <= viewport.height,
    )
    assert.ok(a.fontSize >= 10 && a.fontSize <= 12)
    for (const b of layout.items.slice(i + 1))
      assert.ok(
        a.rect.x + a.width <= b.rect.x ||
          b.rect.x + b.width <= a.rect.x ||
          a.rect.y + a.height <= b.rect.y ||
          b.rect.y + b.height <= a.rect.y,
      )
  }
}
test('screen-space cards do not overlap or cover a straight rail corridor across zoom levels', () => {
  const plan = p(),
    before = JSON.stringify(plan),
    model = buildTrackElevationModel(plan),
    viewport = { width: 1000, height: 600 }
  for (const box of [
    [-200, -700, 2500, 1500],
    [200, -250, 1000, 600],
    [400, -100, 500, 300],
  ]) {
    const l = layoutTrackHeightLabels({ plan, model, box, viewport, selected: 2 })
    check(l, viewport)
    for (const c of l.items) {
      const top = box[1] + c.rect.y * l.unitY,
        bottom = box[1] + (c.rect.y + c.height) * l.unitY
      assert.ok(bottom < -99 || top > 99, 'card stays outside the physical road surface')
    }
  }
  assert.equal(JSON.stringify(plan), before)
})
test('crowded overviews prioritize selection and expose omitted cards instead of overlap', () => {
  const plan = enableFreePlacement({
    ...p(),
    pieces: Array.from({ length: 200 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
  plan.pieces.forEach((s) => (s.placement = { xMm: 0, yMm: 0, headingDegrees: 0 }))
  const model = buildTrackElevationModel(plan),
    viewport = { width: 360, height: 240 }
  const l = layoutTrackHeightLabels({ plan, model, viewport, box: [-600, -400, 1400, 933.333333], selected: 123 })
  check(l, viewport)
  assert.ok(l.items.some((c) => c.index === 123))
  assert.ok(l.hiddenIndices.length > 0)
  assert.equal(l.items.length + l.hiddenIndices.length, l.visibleCount)
})
test('real curve and bridge labels remain bounded and separate after pan, zoom and resize', async () => {
  const plan = JSON.parse(
    await readFile(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
  )
  plan.pieces[33].elevation = { heightMm: 210, flat: true }
  const model = buildTrackElevationModel(plan)
  for (const viewport of [
    { width: 1100, height: 700 },
    { width: 380, height: 300 },
  ])
    for (const box of [
      [-3500, -3500, 7000, 5000],
      [-1800, -1700, 1800, 1100],
    ]) {
      const l = layoutTrackHeightLabels({ plan, model, box, viewport, selected: 33 })
      check(l, viewport)
    }
})
test('level filters and offscreen rails do not generate stray cards or change values', () => {
  const plan = p()
  plan.pieces[2].level = 1
  const model = buildTrackElevationModel(plan),
    viewport = { width: 800, height: 600 }
  const l = layoutTrackHeightLabels({ plan, model, viewport, box: [-100, -500, 2400, 1800], visibleLevel: 1 })
  assert.ok(l.items.every((c) => c.index === 2))
  assert.equal(l.visibleCount, 1)
  const away = layoutTrackHeightLabels({ plan, model, viewport, box: [100000, 100000, 2400, 1800] })
  assert.equal(away.items.length, 0)
  assert.equal(away.visibleCount, 0)
})
test('drawing-plane isolation hides labels of rails on other planes without mutating their layout',()=>{
 const plan=p();plan.pieces[0].drawLayer=2
 const before=JSON.stringify(plan),model=buildTrackElevationModel(plan)
 const options={plan,model,box:[-300,-800,3000,1600],viewport:{width:1200,height:650}}
 const isolated=layoutTrackHeightLabels({...options,visibleDrawingLevel:2})
 assert.deepEqual(isolated.items.map(item=>item.index),[0])
 const lower=layoutTrackHeightLabels({...options,visibleDrawingLevel:0})
 assert.ok(lower.items.every(item=>item.index!==0))
 assert.equal(JSON.stringify(plan),before)
})
