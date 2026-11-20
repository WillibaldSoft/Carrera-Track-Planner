import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, enableFreePlacement, pitBorderSideBlocked, editFreeParts } from '../vendor/racehubos/shared/src/index.js'
import { attachAutomaticBorders } from '../addons/track-planner/src/components/automaticAttachments.js'
const plan = () => enableFreePlacement({
  ...emptyTrackPlan(),
  pieces: Array.from({length:3},()=>({type:'Standardgerade',level:0,jointDegrees:0})),
  pit:{...emptyTrackPlan().pit,enabled:true,native:true,individualParts:true,entry:0,merge:2},
  trackExtras:[{kind:'single',level:0,paintOrder:0,placement:{xMm:172.5,yMm:148.5,headingDegrees:0}}],
})
test('a free rail in the old pit index interval can receive both shoulders away from the pit',()=>{
  const input=plan()
  const added=editFreeParts(input,0,'after',['Standardgerade'],{xMm:2000,yMm:2000,headingDegrees:0})
  assert.equal(added.selected,1)
  for(const side of ['left','right']){
    assert.equal(pitBorderSideBlocked(added.plan,1,side),false)
    assert.ok(attachAutomaticBorders(added.plan,1,side).pieces[1].borders[side])
  }
})
test('only the side physically occupied by pit rail is blocked, independent of entry and merge',()=>{
  const input=plan()
  assert.equal(pitBorderSideBlocked(input,0,'right'),true)
  assert.equal(pitBorderSideBlocked(input,0,'left'),false)
  input.trackExtras[0].placement.yMm=-148.5
  assert.equal(pitBorderSideBlocked(input,0,'right'),false)
  assert.equal(pitBorderSideBlocked(input,0,'left'),true)
})
test('moving the pit lane away, shared boundaries and different levels do not block shoulders',()=>{
  const input=plan()
  input.trackExtras[0].placement.xMm=2500
  assert.equal(pitBorderSideBlocked(input,0,'right'),false)
  input.trackExtras[0].placement.xMm=172.5
  input.trackExtras[0].level=1
  assert.equal(pitBorderSideBlocked(input,0,'right'),false)
  input.trackExtras[0].level=0
  input.trackExtras[0].placement.yMm=247.5
  assert.equal(pitBorderSideBlocked(input,0,'right'),false)
})
