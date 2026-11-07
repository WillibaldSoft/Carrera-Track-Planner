import { useId } from 'react'
import { switchGuidePaths } from '@racehubos/shared'
// Keep lettering readable on screen while the housing and sensors follow the rail.
function UnitText({ headingRadians, x, y, angle = 0, children, ...props }) {
  const heading = ((((headingRadians * 180) / Math.PI + angle) % 360) + 360) % 360
  const correction = heading > 90 && heading <= 270 ? 180 : 0
  return (
    <text {...props} x={x} y={y} transform={`rotate(${angle + correction} ${x} ${y})`}>
      {children}
    </text>
  )
}

// Own SVG artwork derived from the functional layout and the user's photos.
// No manufacturer bitmap, logo, or third-party SVG is embedded.
export function UnitDetails({ segment, realistic = true }) {
  const materialId = 'cu-' + useId().replaceAll(':', '')
  const type = segment.type
  if (!['Control_unit', 'Check_lane', 'Multistart', 'AdapterUnit'].includes(type)) return null
  const transform = `translate(${segment.start.x} ${segment.start.y}) rotate(${(segment.start.h * 180) / Math.PI})`
  const sensor = (x, y, key) => (
    <g key={key}>
      <rect x={x - 12} y={y - 14} width="24" height="28" rx="4" fill="#101113" stroke="#70777c" strokeWidth="2" />
      <circle cx={x} cy={y} r="6" fill="#351d24" stroke="#a55461" strokeWidth="1.5" />
    </g>
  )
  return (
    <g transform={transform} data-testid={`unit-detail-${segment.index}`} data-unit-kind={type}>
      {type === 'Control_unit' && (
        <>
          <defs>
            <linearGradient id={`${materialId}-shell`} x1="0" y1="0" x2="0.18" y2="1">
              <stop offset="0" stopColor="#43484d" />
              <stop offset=".16" stopColor="#24292d" />
              <stop offset=".65" stopColor="#15191c" />
              <stop offset="1" stopColor="#30363b" />
            </linearGradient>
            <linearGradient id={`${materialId}-panel`} x2="0" y2="1">
              <stop stopColor="#0a0c0e" />
              <stop offset="1" stopColor="#22272b" />
            </linearGradient>
          </defs>
          <g data-testid="cu-housing-detail">
            <path
              d="M8 -99 L0 -127 V-215 Q0 -234 19 -234 H326 Q345 -234 345 -215 V-127 L337 -99 Z"
              fill={realistic ? `url(#${materialId}-shell)` : '#475569'}
              stroke="#101315"
              strokeWidth="3"
            />
            <path
              d="M8 -130V-213Q8 -226 22 -226H323Q337 -226 337 -213V-130"
              fill="none"
              stroke="#636a70"
              strokeWidth="1.6"
              opacity=".65"
            />
            <path d="M8 -126Q172 -153 337 -126" fill="none" stroke="#080a0c" strokeWidth="3" />
            <path d="M13 -123Q172 -148 332 -123" fill="none" stroke="#636a70" strokeWidth="1" opacity=".5" />
            {[23, 322].map((x) => (
              <g key={x}>
                <circle cx={x} cy="-216" r="3.4" fill="#080a0c" stroke="#565d63" strokeWidth="1" />
                <path d={`M${x - 1.8} -216h3.6`} stroke="#747c82" strokeWidth=".7" />
              </g>
            ))}
            {[43, 91, 139, 187, 235].map((x, i) => (
              <g key={x} data-testid={`cu-indicator-${i + 1}`}>
                <circle cx={x} cy="-192" r="8" fill="#08090b" stroke="#687078" strokeWidth="1.2" />
                <circle cx={x} cy="-192" r="4.5" fill="#44151b" />
                <circle cx={x - 1.1} cy="-193.1" r="1.3" fill="#d88285" opacity=".6" />
                <UnitText
                  headingRadians={segment.start.h}
                  x={x}
                  y="-207"
                  fontSize="7"
                  fill="#b9c0c5"
                  textAnchor="middle"
                >
                  {i + 1}
                </UnitText>
              </g>
            ))}
            <rect x="92" y="-176" width="235" height="43" rx="10" fill="#5b6165" stroke="#090b0d" strokeWidth="2" />
            <rect
              x="96"
              y="-174"
              width="227"
              height="35"
              rx="8"
              fill={`url(#${materialId}-panel)`}
              stroke="#737a7f"
              strokeWidth=".8"
            />
            {['CODE', 'SPEED', 'BRAKE', 'FUEL', 'START'].map((label, i) => (
              <g key={label} data-testid={`cu-button-${label.toLowerCase()}`}>
                <rect
                  x={103 + i * 43}
                  y="-163"
                  width="34"
                  height="15"
                  rx="4"
                  fill="#080a0b"
                  stroke="#3c444b"
                  strokeWidth="1"
                />
                <path
                  d={`M${108 + i * 43} -150h24`}
                  stroke={label === 'START' ? '#8d3039' : '#41484c'}
                  strokeWidth="1.2"
                />
                <UnitText
                  headingRadians={segment.start.h}
                  x={120 + i * 43}
                  y="-167"
                  fontSize="6.5"
                  fill="#d4d9dc"
                  textAnchor="middle"
                >
                  {label}
                </UnitText>
              </g>
            ))}
            <rect x="22" y="-164" width="53" height="15" rx="2" fill="#9c2631" />
            <UnitText
              headingRadians={segment.start.h}
              x="48.5"
              y="-153"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              fill="#fff"
            >
              DIGITAL
            </UnitText>
            {[50, 89, 128, 167].map((x) => (
              <g key={x}>
                <rect
                  x={x - 14}
                  y="-235"
                  width="28"
                  height="10"
                  rx="1.5"
                  fill="#050608"
                  stroke="#626a70"
                  strokeWidth="1.2"
                />
                <path d={`M${x - 10} -231h20`} stroke="#8d9398" strokeWidth="1" />
                {[-6, -2, 2, 6].map((dx) => (
                  <path key={dx} d={`M${x + dx} -232v3`} stroke="#a58d5f" strokeWidth=".7" />
                ))}
              </g>
            ))}
            <UnitText
              headingRadians={segment.start.h}
              x="172"
              y="-107"
              fontSize="11"
              letterSpacing="1"
              fontWeight="bold"
              textAnchor="middle"
              fill="#dce1e4"
            >
              CONTROL UNIT
            </UnitText>
          </g>
          <g data-testid="cu-start-finish-markings">
            {[-96, 70].map((y) => (
              <g key={y} data-testid="finish-checker-field">
                {Array.from({ length: 8 }, (_, i) => (
                  <rect
                    key={i}
                    x={146 + (i % 4) * 13}
                    y={y + Math.floor(i / 4) * 13}
                    width="13"
                    height="13"
                    fill={((i % 4) + Math.floor(i / 4)) % 2 ? '#171b1e' : '#ecebe4'}
                  />
                ))}
              </g>
            ))}
            <rect x="144" y="-31" width="56" height="62" rx=".8" fill="#ecebe4" stroke="#a6aaab" strokeWidth=".6" />
            <UnitText
              headingRadians={segment.start.h}
              x="164"
              y="0"
              angle={-90}
              fill="#222629"
              fontSize="15"
              fontWeight="800"
              textAnchor="middle"
            >
              START
            </UnitText>
            <UnitText
              headingRadians={segment.start.h}
              x="184"
              y="0"
              angle={-90}
              fill="#222629"
              fontSize="14"
              fontWeight="800"
              textAnchor="middle"
            >
              FINISH
            </UnitText>
            {[-64.5, 34.5].map((y, i) => (
              <g key={i} data-testid={`cu-track-sensor-${i}`}>
                <rect x="215" y={y - 8} width="12" height="16" rx="3" fill="#0a0c0e" stroke="#4c5358" strokeWidth="1" />
                <circle cx="221" cy={y} r="3.5" fill="#421721" stroke="#92646b" strokeWidth=".8" />
              </g>
            ))}
          </g>
        </>
      )}
      {['Check_lane', 'Multistart'].includes(type) && (
        <>
          <path d="M165 -96v192 M180 -96v192" stroke="#eee" strokeWidth="5" />
          {[-49.5, 49.5].map((y, i) => (
            <g key={i}>
              {sensor(200, type === 'Multistart' ? y - 15 : y, i)}
              <path d={`M120 ${y - 22}l27 22 -27 22z`} fill="#e5e7eb" />
            </g>
          ))}
          <rect x="162" y="-33" width="23" height="66" rx="3" fill="#2a3339" />
          <UnitText
            headingRadians={segment.start.h}
            x="176"
            y="0"
            angle={-90}
            fontSize="11"
            fill="#e5e7eb"
            textAnchor="middle"
          >
            {type === 'Multistart' ? 'MULTI' : 'CHECK'}
          </UnitText>
        </>
      )}
      {type === 'AdapterUnit' && (
        <>
          <rect x="75" y="-157" width="195" height="58" rx="7" fill="#191d23" stroke="#747c82" strokeWidth="3" />
          {[110, 172, 234].map((x) => (
            <rect
              key={x}
              x={x - 15}
              y="-156"
              width="30"
              height="17"
              rx="3"
              fill="#07090b"
              stroke="#58616a"
              strokeWidth="2"
            />
          ))}
          <UnitText headingRadians={segment.start.h} x="173" y="-114" fill="#dce1e5" fontSize="12" textAnchor="middle">
            ADAPTER
          </UnitText>
        </>
      )}
    </g>
  )
}
export function FuelDetail({ pose, index, article, worldHeadingDegrees = pose.headingDegrees }) {
  const headingRadians = (worldHeadingDegrees * Math.PI) / 180
  return (
    <g
      data-testid={`fuel-detail-${index}`}
      data-fuel-artwork="striped-sensor"
      transform={`translate(${pose.xMm} ${pose.yMm}) rotate(${pose.headingDegrees})`}
    >
      {/* Sensor, striped printing and FUEL sit left of the slot in driving direction. */}
      <g fill="#e5e4de" data-testid="fuel-printed-markings">
        {[-44, 146].flatMap((x) =>
          [-41, 41].map((y) => (
            <path
              key={`${x}-${y}`}
              d={`M${x + (x < 0 ? 5 : -5)} ${y}h${x < 0 ? -5 : 5}v${y < 0 ? 5 : -5}`}
              fill="none"
              stroke="#e5e4de"
              strokeWidth="2.1"
            />
          )),
        )}
        {[-1, 1].flatMap((side) =>
          Array.from({ length: 12 }, (_, i) => {
            const distance = 9 + i * 5,
              x = 46 + side * distance,
              height = 2 + i * 2.1
            return (
              <path key={`${side}-${i}`} d={`M${x} -8v${-height}`} stroke="#e5e4de" strokeWidth={i < 4 ? 1.1 : 2.3} />
            )
          }),
        )}
      </g>
      <g data-testid="fuel-infrared-sensor">
        <circle cx="46" cy="-11" r="4.8" fill="#e1e2db" />
        <circle cx="46" cy="-11" r="3.2" fill="#0b0d0e" />
        <circle cx="46" cy="-11" r="1.9" fill="#a32936" />
        <circle cx="45.5" cy="-10.4" r=".6" fill="#eea29e" />
      </g>
      <UnitText
        headingRadians={headingRadians}
        x="46"
        y="-29"
        angle={-90}
        fill="#e5e4de"
        fontSize="11"
        fontWeight="800"
        textAnchor="middle"
      >
        FUEL
      </UnitText>
      {article && <title>{article} · FUEL</title>}
    </g>
  )
}

// Only the incoming module has receiving diodes; exit modules/merges are passive.
export function SwitchDiodeDetails({ segment, profile = 'planner2022' }) {
  if (!/^(DigitaleDoppelweiche|Weiche_(links|rechts)|Kurvenweiche_(links|rechts)_(ai|ia))_1$/.test(segment.type))
    return null
  const h = segment.start.h,
    c = Math.cos(h),
    s = Math.sin(h)
  return (
    <g
      transform={`translate(${segment.start.x} ${segment.start.y}) rotate(${(h * 180) / Math.PI})`}
      data-testid="switch-diode-details"
    >
      {switchGuidePaths(segment, profile).map((points, i) => {
        const [x, y] = points[0]
        const lane = -(x - segment.start.x) * s + (y - segment.start.y) * c
        return (
          <g key={i} data-testid="switch-infrared-sensor" data-slot-y={lane}>
            <rect x="74" y={lane - 23} width="12" height="16" rx="3" fill="#0a0c0e" stroke="#4c5358" strokeWidth="1" />
            <circle cx="80" cy={lane - 15} r="3.5" fill="#421721" stroke="#92646b" strokeWidth=".8" />
          </g>
        )
      })}
    </g>
  )
}
