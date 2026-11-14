import { trackFootprint } from '@racehubos/shared'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import RoomFootprintDrawing from './RoomFootprintDrawing'
import { anchorRoom, roomAndTrackBounds } from './roomBackground'
import { printDrawingBox } from './printDrawingLayout.js'
export default function PrintTrackDrawing({ plan, room, colors, numbers, level, rotation }) {
  const bounds = room ? roomAndTrackBounds(plan, trackFootprint(plan)) : trackFootprint(plan)
  const { box, center } = printDrawingBox(bounds, rotation)
  return (
    <svg
      data-testid="print-track-drawing"
      role="img"
      aria-label="Carrera"
      viewBox={box.join(' ')}
      className="w-full max-h-96 bg-white"
    >
      <g transform={`rotate(${rotation} ${center[0]} ${center[1]})`}>
        {room && plan.roomPlan && (
          <RoomFootprintDrawing room={plan.roomPlan} origin={anchorRoom(plan.roomPlan, plan).backgroundOrigin} />
        )}
        <TrackPlanPreview
          plan={plan}
          embedded
          colorParts={colors}
          labels={numbers ? 'numbers' : 'none'}
          visibleLevel={level}
          light
          showOrigin={false}
        />
      </g>
    </svg>
  )
}
