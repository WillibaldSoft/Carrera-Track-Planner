import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { emptyTrackPlan, enableFreePlacement } from '../../vendor/racehubos/shared/src/index.js'
for (const language of ['de','en','fr']) test(`1.6.0 mouse placement and shoulder strokes (${language})`, async ({ page }) => {
  await page.setViewportSize({width:1600,height:1000})
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(language)
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  const plan=enableFreePlacement({...emptyTrackPlan(),pieces:Array.from({length:4},()=>({type:'Standardgerade',level:0,jointDegrees:0}))})
  await page.getByTestId('track-plan-import').setInputFiles({name:'Mouse Demo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(plan))})
  const canvas=page.getByTestId('graph-track-canvas')
  const dir=path.resolve('docs/screenshots/v1.6.0',language);await fs.mkdir(dir,{recursive:true})
  const shot=(name)=>page.screenshot({path:path.join(dir,name+'.jpg'),quality:85})
  const move=async(x,y)=>{
    const p=await canvas.evaluate((svg,{x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}},{x,y})
    await page.mouse.move(p.x,p.y)
  }
  await page.getByTestId('palette-Kurve_1_60_rechts').click()
  await move(800,-250)
  await expect(page.getByTestId('repeat-track-preview')).toHaveAttribute('data-action','place');await shot('pointer-placement')
  await move(1385,0)
  await expect(page.getByTestId('repeat-track-preview')).toHaveAttribute('data-action','snap');await shot('endpoint-snap')
  await move(517.5,0)
  await expect(page.getByTestId('repeat-track-preview')).toHaveAttribute('data-action','replace');await shot('centre-replacement')
  await page.keyboard.press('Escape')
  await canvas.getByTestId('rail-0').hover()
  await page.getByTestId('hover-track-left').hover()
  await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-mode','add');await shot('shoulder-add-preview')
  await page.getByTestId('hover-track-left').click()
  await page.getByTestId('hover-track-left').hover()
  await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-mode','remove');await shot('shoulder-remove-preview')
  await page.getByTestId('hover-track-left').click()
  await page.getByTestId('hover-track-left').hover()
  await page.mouse.down()
  for(const index of [1,2,3]){
    const h=page.locator(`[data-handle-key="${index}:left"]`);await expect(h).toBeVisible()
    const b=await h.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12})
    await expect(h).toHaveAttribute('data-mode','remove')
  }
  await expect(page.getByTestId('shoulder-stroke-status')).toBeVisible();await shot('continuous-shoulder-stroke');await page.mouse.up()
  await canvas.focus();await page.keyboard.press('Control+PageUp');await shot('keyboard-zoom')
})
