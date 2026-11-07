import { useId } from 'react'
import { roomFootprint } from './roomBackground.js'
export default function RoomFootprintDrawing({ room, origin = { xMm: 0, yMm: 0 }, children }) {
  const id = useId().replaceAll(':', ''),
    shape = roomFootprint(room)
  return (
    <g data-testid="room-footprint" transform={`translate(${origin.xMm} ${origin.yMm})`}>
      <defs>
        <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V80" stroke="#e87979" strokeWidth="20" />
        </pattern>
      </defs>
      {shape.cells.map((r, i) => (
        <rect
          key={i}
          x={r.x * 1000}
          y={r.y * 1000}
          width={r.w * 1000}
          height={r.h * 1000}
          fill="#dbeafe"
          fillOpacity=".65"
        />
      ))}
      {(room.features || [])
        .filter((f) => f.kind === 'obstacle')
        .map((f) => (
          <rect
            key={f.id}
            data-testid={`room-obstacle-${f.id}`}
            x={f.xM * 1000}
            y={f.yM * 1000}
            width={f.widthM * 1000}
            height={f.depthM * 1000}
            fill={`url(#${id})`}
            fillOpacity=".7"
            stroke="#b91c1c"
            strokeWidth="10"
          />
        ))}
      <path
        data-testid="room-outline"
        d={shape.outline}
        fill="none"
        stroke="#2563eb"
        strokeWidth="18"
        vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: 2 }}
      />
      {(room.features || []).map((f) => (
        <text
          key={f.id}
          x={(f.xM + f.widthM / 2) * 1000}
          y={(f.yM + f.depthM / 2) * 1000}
          textAnchor="middle"
          fill="#7c2d12"
          fontSize="80"
        >
          {f.name}
        </text>
      ))}
      {children}
    </g>
  )
}
