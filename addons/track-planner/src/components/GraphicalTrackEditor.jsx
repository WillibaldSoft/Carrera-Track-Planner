import { labelOffsetFromScreen, setHeightLabelOffset, resetHeightLabelOffsets } from './manualHeightLabels.js'
import { layoutTrackHeightLabels } from './heightLabelLayout.js'
import { buildTrackElevationModel } from './trackElevationModel.js'
import TrackHeightLabels from './TrackHeightLabels'
import RailElevationEditor from './RailElevationEditor'
import AutomaticAttachments from './AutomaticAttachments'
import LayerVisibilityControls from './LayerVisibilityControls'
import {
  attachInsertedBorders,
  attachmentOptions,
  attachTrackAccessory,
  attachAutomaticBorders,
  nextAutomaticBorderTarget,
  canAttachAutomaticBorders,
  automaticBorderReversed,
} from './automaticAttachments.js'
import { selectedTrackBounds } from './selectionViewport.js'
import { placementCoordinates } from './placementCoordinates'
import { anchorRoom, withRoomAnchor, roomAndTrackBounds } from './roomBackground'
import RoomFootprintDrawing from './RoomFootprintDrawing'
import { pitShoulderOptions, attachPitShoulder } from './pitShoulders.js'
import { prepareIndividualPitParts, updatePitPartWorld } from './pitPartEditing'
import ParallelDockingPanel from './ParallelDockingPanel'
import { trackSectionJoinOptions, joinTrackSections } from './joinTrackSections'
import { replaceFollowingTrack } from './followingTrackReplacement'
import { repeatedTrackPreview, placeRepeatedTrackPart } from './repeatTrackPlacement'
import { trackViewport } from './trackViewport'
import PlannerTools from './PlannerTools'
import ConnectionHints from './ConnectionHints'
import { pitlaneComponents } from '@core/components/tracks/pitlaneComponents'
import TrackPartsManager from './TrackPartsManager'
import TrackBorders from './TrackBorders'
import { useEffect, useId, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TRACK_PARTS,
  TRACK_ASSEMBLIES,
  CARRERA_MANUFACTURER_ARTICLES,
  SPECIAL_GEOMETRY_AUDIT,
  CARRERA_BORDERS,
  trackArticle,
  trackDrawItems,
  editTrackPieces,
  trackSelection,
  traceTrackPlan,
  borderShapes,
  borderArtwork,
  trackBounds,
  enableFreePlacement,
  freeTrackSelection,
  transformFreeParts,
  snapFreeParts,
  editFreeParts,
  extraWorldPose,
  rotateTrackPlan,
  trackRectangleSelection,
  groupTrackParts,
  ungroupTrackParts,
  changeTrackDrawLayer,
  replacePitlaneSwitch,
  editablePitlane,
  deleteTrackSelection,
  deletePitComponent,
  softyExtraGeometry,
} from '@racehubos/shared'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import { labelTrackPart } from '@core/components/tracks/trackPartLabel'
import { Button } from '@core/components/ui/button'
import TrackImageExport from './PlannerImageExport'
import TrackPlanPrint, { TrackTypeLegend } from './TrackPlanPrint'

const catalogue = [
  ...Object.keys(TRACK_PARTS)
    .filter((type) => type !== 'Startampel_3spur_hinten' && !Object.values(TRACK_ASSEMBLIES).flat().includes(type))
    .map((type) => ({ id: type, types: [type] })),
  ...Object.entries(TRACK_ASSEMBLIES).map(([id, types]) => ({ id, types })),
]
const partCategory = (p) =>
  TRACK_PARTS[p.types[0]].special
    ? 'specials'
    : Object.hasOwn(TRACK_ASSEMBLIES, p.id) || p.id.startsWith('Pit_stop')
      ? 'switches'
      : p.id.startsWith('Steilkurve_')
        ? 'banked'
        : p.id.startsWith('Kurve_')
          ? 'curves'
          : ['Control_unit', 'AdapterUnit', 'Check_lane', 'Multistart', 'Startampel_3spur_hinten'].includes(p.id)
            ? 'units'
            : 'straights'
const supportedArticles = new Set([
  ...Object.keys(TRACK_PARTS).map(trackArticle),
  ...CARRERA_BORDERS.map((p) => p.article),
])
function PartIcon({ types }) {
  const p = {
    kind: 'racehubos.track-plan',
    version: 1,
    pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
    pit: {
      enabled: false,
      entry: 0,
      merge: 0,
      spacingMm: 345,
      bayLengthMm: 1035,
    },
  }
  if (types.length === 1 && types[0].startsWith('Pit_stop_weiche_')) {
    const entry = types[0].endsWith('anfang')
    return (
      <svg
        aria-hidden="true"
        className="w-20 h-12 shrink-0"
        viewBox="-353 -206 361 313"
        data-pit-preview-heading="180"
        data-testid={entry ? 'pit-entry-symbol' : 'pit-exit-symbol'}
        data-switch-kind={entry ? 'active-entry' : 'passive-merge'}
      >
        <g transform="rotate(180)" data-testid={entry ? 'pit-symbol-actuator' : undefined}>
          <TrackPlanPreview plan={p} embedded />
        </g>
      </svg>
    )
  }
  const bounds = trackBounds(p)
  return (
    <svg
      aria-hidden="true"
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.depth}`}
      className="w-20 h-12 shrink-0"
    >
      <TrackPlanPreview plan={p} embedded colorParts />
    </svg>
  )
}
export default function GraphicalTrackEditor({
  plan: inputPlan,
  selected,
  onSelect: onPrimarySelect,
  onChange: onPlanChange,
  undo,
  redo,
  canUndo,
  canRedo,
  name,
  expanded = false,
  planDetails,
  onOpenFiles,
  onOpen3D,
  onOpenPit,
  saving = false,
}) {
  const { t } = useTranslation('tracks')
  const { t: ui } = useTranslation('plannerInterface')
  const { t: rt } = useTranslation('plannerRoom')
  const [showRoom, setShowRoom] = useState(true)
  const [heightEditorOpen, setHeightEditorOpen] = useState(false)
  const [heightLabelPreview, setHeightLabelPreview] = useState(null)
  useEffect(() => setHeightLabelPreview(null), [inputPlan])
  const { t: te } = useTranslation('plannerEditing')
  const { t: ta } = useTranslation('plannerActions')
  const { t: t3 } = useTranslation('planner3D')
  const [autoAttachments, setAutoAttachments] = useState(false)
  const [autoTarget, setAutoTarget] = useState(-1)
  const autoHoverLock = useRef(-1)
  const autoHoverDirection = useRef(false)
  const [autoSide, setAutoSide] = useState('both')
  const [layBorders, setLayBorders] = useState(false)
  const newBorderSide = layBorders ? autoSide : 'none'
  function decorateInsertion(result, count) {
    const layered =
      level === 'all'
        ? result.plan
        : {
            ...result.plan,
            pieces: result.plan.pieces.map((p, i) =>
              i >= result.selected && i < result.selected + count
                ? {
                    ...p,
                    level: Math.max(0, Math.min(2, Number(level))),
                    drawLayer: Number(level) - Math.max(0, Math.min(2, Number(level))),
                  }
                : p,
            ),
          }
    return attachInsertedBorders(layered, result.selected, count, newBorderSide)
  }
  const [autoReverse, setAutoReverse] = useState(false)
  const [autoOption, setAutoOption] = useState(null)
  useEffect(() => {
    setAutoTarget((current) => (inputPlan.pieces[current] ? current : -1))
    setAutoOption(null)
  }, [inputPlan])
  const storedPlan = useMemo(() => withRoomAnchor(prepareIndividualPitParts(inputPlan)), [inputPlan])
  const [dockPreview, setDockPreview] = useState(null)
  const [dockingSelection, setDockingSelection] = useState([])
  const [editNotice, setEditNotice] = useState('')
  function onChange(next) {
    onPlanChange(prepareIndividualPitParts(next))
  }
  const [joinKey, setJoinKey] = useState('')
  const [joinedPlan, setJoinedPlan] = useState(null)
  const [replacement, setReplacement] = useState(null)
  const currentReplacement = replacement?.result.plan === storedPlan ? replacement : null
  const [repeatPlacement, setRepeatPlacement] = useState(false)
  const [placementPoint, setPlacementPoint] = useState(null)
  const [placementHeading, setPlacementHeading] = useState(0)
  const [panel, setPanel] = useState('none')
  const [viewport, setViewport] = useState({ width: 1200, height: 800 })
  const [endpointKey, setEndpointKey] = useState('')
  const [showConnections, setShowConnections] = useState(true)
  const [context, setContext] = useState(null)
  const [auditMarks, setAuditMarks] = useState(null)
  const [draft, setDraft] = useState(null),
    [snapEnabled, setSnapEnabled] = useState(true),
    [snapHint, setSnapHint] = useState(null),
    [realistic, setRealistic] = useState(true),
    [frame, setFrame] = useState(null)
  const plan = draft ?? storedPlan
  const [part, setPart] = useState('Standardgerade'),
    [search, setSearch] = useState(''),
    [side, setSide] = useState('after'),
    [category, setCategory] = useState('all')
  const [colors, setColors] = useState(false),
    [labels, setLabels] = useState('none'),
    [visibleLevels, setVisibleLevels] = useState(null),
    [insertionPlane, setInsertionPlane] = useState(0),
    [background, setBackground] = useState('paper')
  const [layerWarning, setLayerWarning] = useState(false)
  const visibleLevel =
    visibleLevels === null ? null : visibleLevels.includes(insertionPlane) ? insertionPlane : (visibleLevels[0] ?? null)
  const level = visibleLevels === null ? 'all' : String(visibleLevel ?? 0)
  const noVisibleLayers = visibleLevels !== null && !visibleLevels.length
  const planeVisible = (plane) => visibleLevels === null || visibleLevels.includes(plane)
  const railVisible = (index) =>
    !!plan.pieces[index] && planeVisible(plan.pieces[index].level + (plan.pieces[index].drawLayer ?? 0))
  const borderVisible = (index, side) => {
    const p = plan.pieces[index]
    return !!p?.borders?.[side] && planeVisible(p.level + (p.borders[side].drawLayer ?? p.drawLayer ?? 0))
  }
  const editableRail = (index) => railVisible(index) && freeTrackSelection(plan, index).every(railVisible)
  function changeVisibleLevels(values) {
    const next = values === null ? null : [...new Set(values)].sort((a, b) => a - b)
    setVisibleLevels(next)
    const allowed = (i) =>
      !!plan.pieces[i] && (next === null || next.includes(plan.pieces[i].level + (plan.pieces[i].drawLayer ?? 0)))
    const remaining = pickedIndices.filter((i) => allowed(i) && freeTrackSelection(plan, i).every(allowed))
    const border = plan.pieces[selected]?.borders?.[layerTarget]
    const keepBorder =
      (!allowed(selected) || freeTrackSelection(plan, selected).every(allowed)) &&
      border &&
      (next === null ||
        next.includes(plan.pieces[selected].level + (border.drawLayer ?? plan.pieces[selected].drawLayer ?? 0)))
    if (!keepBorder) setLayerTarget('rails')
    setPicked(keepBorder ? [selected] : remaining)
    onPrimarySelect(keepBorder || remaining.includes(selected) ? selected : (remaining.at(-1) ?? -1))
    const extra = selectedPitPart?.startsWith('extra-') ? plan.trackExtras?.[Number(selectedPitPart.slice(6))] : null
    const extraPlane = extra
      ? (plan.pieces[extra.anchor]?.level ?? extra.level) +
        (extra.drawLayer ?? plan.pieces[extra.anchor]?.drawLayer ?? 0)
      : (plan.pit.drawLayer ?? 0)
    if (selectedPitPart && next !== null && !next.includes(extraPlane)) setSelectedPitPart(null)
    setDockingSelection([])
    setJoinKey('')
    setEndpointKey('')
    setAutoTarget(-1)
    setAutoOption(null)
    setContext(null)
    setSnapHint(null)
    setLayerWarning(false)
    dragging.current = null
    autoHoverLock.current = -1
    setDraft(null)
    setMarquee(null)
    setDockPreview(null)
    setReplacement(null)
  }
  useEffect(() => {
    if (selected >= 0 && !railVisible(selected) && !borderVisible(selected, layerTarget)) {
      setPicked([])
      onPrimarySelect(-1)
      setDockingSelection([])
      setContext(null)
    }
  }, [selected, visibleLevels, inputPlan])
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null),
    wheelHandler = useRef(null)
  useEffect(() => {
    const svg = canvasRef.current,
      listener = (e) => wheelHandler.current?.(e)
    svg.addEventListener('wheel', listener, { passive: false })
    return () => svg.removeEventListener('wheel', listener)
  }, [])
  useEffect(() => {
    const element = canvasRef.current
    const update = () => {
      const { width, height } = element.getBoundingClientRect()
      setViewport((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const dragging = useRef(null),
    suppressClick = useRef(false),
    gridId = useId().replaceAll(':', '')
  const [picked, setPicked] = useState([]),
    [selectedPitPart, setSelectedPitPart] = useState(null),
    [layerTarget, setLayerTarget] = useState('rails')
  const [pointerMode, setPointerMode] = useState('box'),
    [marquee, setMarquee] = useState(null)
  useEffect(() => {
    if (!context) return
    const close = (e) => {
      if (!e.target.closest('.planner-context-menu')) setContext(null)
    }
    document.querySelector('[data-testid=track-context-menu] button:not(:disabled)')?.focus()
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [context])
  function selectIndices(indices) {
    indices = indices.filter(editableRail)
    setDockingSelection(indices.map((index) => ({ kind: 'rail', index })))
    setSelectedPitPart(null)
    setLayerTarget('rails')
    setPicked(indices)
    onPrimarySelect(indices.at(-1) ?? -1)
  }
  function selectAll() {
    selectIndices(storedPlan.pieces.map((_, i) => i))
  }
  const pickedIndices =
    selected < 0
      ? []
      : picked.includes(selected)
        ? picked.filter((i) => plan.pieces[i])
        : plan.pieces[selected]
          ? [selected]
          : []
  const joinOptions = useMemo(() => trackSectionJoinOptions(storedPlan, pickedIndices), [storedPlan, selected, picked])
  const joinPair = joinOptions.pairs.find((p) => p.key === joinKey) ?? joinOptions.pairs[0]
  function joinSelectedSections() {
    if (!joinPair) return
    const result = joinTrackSections(storedPlan, pickedIndices, joinPair.key)
    onChange(result.plan)
    setJoinedPlan(result.plan)
    setJoinKey('')
    if (zoom === 1) setFrame(null)
  }
  function onSelect(index, event) {
    if (index >= 0 && !editableRail(index)) {
      setLayerWarning(railVisible(index))
      return
    }
    setLayerWarning(false)
    if (index >= 0) setInsertionPlane(plan.pieces[index].level + (plan.pieces[index].drawLayer ?? 0))
    if (event?.type === 'click' && suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSelectedPitPart(null)
    setLayerTarget('rails')
    const toggle = event?.ctrlKey || event?.metaKey
    const ref = { kind: 'rail', index }
    setDockingSelection((previous) =>
      index < 0
        ? []
        : toggle
          ? previous.some((p) => p.kind === 'rail' && p.index === index)
            ? previous.filter((p) => p.kind !== 'rail' || p.index !== index)
            : [...previous, ref]
          : [ref],
    )
    const next =
      index < 0
        ? []
        : toggle
          ? pickedIndices.includes(index)
            ? pickedIndices.filter((i) => i !== index)
            : [...pickedIndices, index]
          : [index]
    setPicked(next)
    onPrimarySelect(next.at(-1) ?? -1)
  }
  const selection = trackSelection(plan, selected),
    motion =
      selectedPitPart || (!railVisible(selected) && borderVisible(selected, layerTarget))
        ? []
        : [...new Set(pickedIndices.flatMap((i) => freeTrackSelection(plan, i)))],
    active = selectedPitPart || !railVisible(selected) ? null : plan.pieces[selected],
    chosen = catalogue.find((p) => p.id === part)
  const bounds =
    frame ??
    (showRoom && storedPlan.roomPlan
      ? roomAndTrackBounds(
          storedPlan,
          storedPlan.pieces.length ? trackBounds(storedPlan) : { x: 0, y: 0, width: 0, depth: 0 },
        )
      : storedPlan.pieces.length
        ? trackBounds(storedPlan)
        : { x: -800, y: -600, width: 1600, depth: 1200 })
  const calculatedBox = trackViewport(bounds, viewport, zoom, pan)
  const [, , w, h] = calculatedBox
  const box = dragging.current?.kind === 'pan' ? calculatedBox : (dragging.current?.box ?? calculatedBox)
  const availableDrawingLevels = [
    ...new Set([
      0,
      1,
      2,
      ...trackDrawItems(plan, traceTrackPlan(plan).segments, borderShapes(plan)).map(
        (item) => item.level + item.drawLayer,
      ),
      ...(visibleLevels ?? []),
    ]),
  ].sort((a, b) => a - b)
  const trace = traceTrackPlan(plan),
    activeSegment = trace.segments[selected],
    join = side === 'before' ? trace.segments[selection[0]]?.start : trace.segments[selection.at(-1)]?.end
  const elevationModel = useMemo(
    () =>
      plan.showElevationLabels || (heightEditorOpen && selected >= 0)
        ? buildTrackElevationModel(plan, {}, trace.segments)
        : null,
    [plan, heightEditorOpen, selected],
  )
  const heightLabelLayout = useMemo(
    () =>
      plan.showElevationLabels && elevationModel
        ? layoutTrackHeightLabels({
            model: elevationModel,
            plan,
            box,
            viewport,
            selected,
            visibleDrawingLevels: visibleLevels,
            preview: heightLabelPreview,
          })
        : null,
    [
      elevationModel,
      plan,
      box[0],
      box[1],
      box[2],
      box[3],
      viewport.width,
      viewport.height,
      selected,
      visibleLevels,
      heightLabelPreview,
    ],
  )
  function commitHeightLabelMove(index, offset) {
    const original = heightLabelLayout?.items.find((c) => c.index === index)
    const resolved = layoutTrackHeightLabels({
      model: elevationModel,
      plan,
      box,
      viewport,
      selected,
      visibleDrawingLevels: visibleLevels,
      preview: { index, offset, fallbackRect: original?.rect },
    })
    const card = resolved.items.find((c) => c.index === index)
    setHeightLabelPreview(null)
    if (card)
      onChange(
        setHeightLabelOffset(
          plan,
          index,
          labelOffsetFromScreen(elevationModel, resolved, index, {
            x: card.rect.x + card.width / 2,
            y: card.rect.y + card.height / 2,
          }),
        ),
      )
  }
  const pitParts = pitlaneComponents(plan, trace.segments),
    pitPart = pitParts.find((p) => p.id === selectedPitPart)
  const selectedBounds = useMemo(
    () =>
      selectedTrackBounds(
        storedPlan,
        selectedPitPart ? [] : motion,
        pitPart?.extraIndex !== undefined ? [pitPart.extraIndex] : [],
      ),
    [storedPlan, selectedPitPart, selected, motion.join(','), pitPart?.extraIndex],
  )
  const automaticPlan = useMemo(
    () =>
      autoAttachments && storedPlan.pieces[autoTarget]
        ? autoOption
          ? attachTrackAccessory(storedPlan, autoTarget, autoOption)
          : attachAutomaticBorders(storedPlan, autoTarget, autoSide, autoReverse)
        : null,
    [storedPlan, autoAttachments, autoOption, autoTarget, autoSide, autoReverse],
  )
  const autoShapes = useMemo(() => {
    if (!automaticPlan) return []
    const oldShapes = borderShapes(storedPlan)
    return borderShapes(automaticPlan).filter(
      (p) =>
        p.index === autoTarget &&
        !oldShapes.some((old) => old.index === p.index && old.side === p.side && old.kind === p.kind),
    )
  }, [automaticPlan, storedPlan, autoTarget])
  function automaticReverse(index) {
    return automaticBorderReversed(storedPlan, index, trace.connectivity)
  }
  function addAutomatic(index = autoTarget, id = autoSide, fromCanvas = false) {
    if (!railVisible(index)) return
    const strip = ['left', 'right', 'both'].includes(id)
    const backwards =
      index === autoTarget
        ? autoReverse
        : index === autoHoverLock.current
          ? autoHoverDirection.current
          : automaticReverse(index)
    const next = strip
      ? attachAutomaticBorders(storedPlan, index, id, backwards)
      : attachTrackAccessory(storedPlan, index, id)
    if (strip) setAutoSide(id)
    if (next !== storedPlan) {
      setFrame(bounds)
      onChange(next)
    }
    const following = strip ? nextAutomaticBorderTarget(next, index, id, backwards) : null
    autoHoverLock.current = fromCanvas && following ? index : -1
    autoHoverDirection.current = backwards
    setAutoTarget(following && railVisible(following.index) ? following.index : index)
    setAutoReverse(following?.reverse ?? backwards)
    setAutoOption(null)
  }
  const nativePitSwitch = !!pitPart && ['entry', 'exit'].includes(pitPart.kind)
  const pitSwitchLocked = nativePitSwitch && plan.partGroups?.groups.some((g) => g.includes(pitPart.anchor))
  const pitReplacement =
    nativePitSwitch && !pitSwitchLocked && ['Pit_stop_weiche_anfang', 'Pit_stop_weiche_ende'].includes(part)
  const stamp =
    repeatPlacement && !noVisibleLayers
      ? repeatedTrackPreview(plan, chosen.types, placementPoint, {
          headingDegrees: placementHeading,
          level: active?.level ?? Math.max(0, Math.min(2, visibleLevel ?? 0)),
          snap: snapEnabled,
          distanceMm: Math.max(20, w / 25),
          borderSide: newBorderSide,
        })
      : null
  function placeAt(point) {
    if (noVisibleLayers) return
    const preview = repeatedTrackPreview(storedPlan, chosen.types, point, {
      headingDegrees: placementHeading,
      level: active?.level ?? Math.max(0, Math.min(2, visibleLevel ?? 0)),
      snap: snapEnabled,
      distanceMm: Math.max(20, w / 25),
    })
    const result = placeRepeatedTrackPart(storedPlan, chosen.types, preview, newBorderSide)
    if (!result.placed) return
    setFrame(zoom === 1 ? null : bounds)
    onChange(decorateInsertion(result, chosen.types.length))
    onSelect(result.selected)
    setPlacementPoint(null)
  }
  function selectPitPart(id, event) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const p = pitParts.find((p) => p.id === id)
    if (!p) return
    const eligible = p.extraIndex !== undefined && ['single', 'fuel', 'entry', 'exit'].includes(p.kind)
    const ref = eligible ? { kind: 'extra', index: p.extraIndex } : null
    if ((event?.ctrlKey || event?.metaKey) && ref) {
      const next = dockingSelection.some((r) => r.kind === ref.kind && r.index === ref.index)
        ? dockingSelection.filter((r) => r.kind !== ref.kind || r.index !== ref.index)
        : [...dockingSelection, ref]
      setDockingSelection(next)
      const last = next.at(-1)
      setPicked(next.filter((r) => r.kind === 'rail').map((r) => r.index))
      onPrimarySelect(last?.kind === 'rail' ? last.index : -1)
      setSelectedPitPart(last?.kind === 'extra' ? `extra-${last.index}` : null)
      return
    }
    setDockingSelection(ref ? [ref] : [])
    setPicked([])
    onPrimarySelect(-1)
    setSelectedPitPart(id)
  }
  const drawTarget = pitPart ? (pitPart.extraIndex !== undefined ? 'extra' : 'pit') : layerTarget
  const drawObjects = pitPart
    ? [pitPart.extraIndex !== undefined ? plan.trackExtras[pitPart.extraIndex] : plan.pit]
    : pickedIndices.flatMap((i) =>
        layerTarget === 'rails'
          ? [plan.pieces[i]]
          : layerTarget === 'borders'
            ? Object.values(plan.pieces[i].borders || {})
            : plan.pieces[i].borders?.[layerTarget]
              ? [plan.pieces[i].borders[layerTarget]]
              : [],
      )
  const drawValues = pitPart
    ? [
        pitPart.extraIndex !== undefined
          ? (plan.pieces[plan.trackExtras[pitPart.extraIndex].anchor]?.level ??
              plan.trackExtras[pitPart.extraIndex].level) +
            (plan.trackExtras[pitPart.extraIndex].drawLayer ??
              plan.pieces[plan.trackExtras[pitPart.extraIndex].anchor]?.drawLayer ??
              0)
          : (plan.pit.drawLayer ?? 0),
      ]
    : pickedIndices.flatMap((i) => {
        const p = plan.pieces[i]
        if (layerTarget === 'rails') return [p.level + (p.drawLayer ?? 0)]
        return ['left', 'right']
          .filter((side) => (layerTarget === 'borders' || layerTarget === side) && p.borders?.[side])
          .map((side) => p.level + (p.borders[side].drawLayer ?? p.drawLayer ?? 0))
      })
  function drawStep(delta) {
    onChange(
      changeTrackDrawLayer(
        plan,
        {
          indices: pickedIndices,
          target: drawTarget,
          extraIndex: pitPart?.extraIndex,
        },
        delta,
      ),
    )
  }
  function selectBorder(index, side, event) {
    if (!borderVisible(index, side)) return
    if (railVisible(index)) onSelect(index, event)
    else {
      setPicked([index])
      onPrimarySelect(index)
      setSelectedPitPart(null)
      setDockingSelection([])
    }
    setLayerTarget(side)
  }
  const activeHeading = activeSegment
    ? (((((activeSegment.start.h * 180) / Math.PI + 180) % 360) + 360) % 360) - 180
    : 0
  const visibleSegments = trace.segments.filter((s) => railVisible(s.index))
  const connector = join ?? visibleSegments.at(-1)?.end ?? { x: 0, y: 0 }
  function setAntiCollision(antiCollision) {
    if (nativePitSwitch) {
      const prepared = editablePitlane(plan)
      const index = pitPart.extraIndex ?? prepared.ids[pitPart.id]
      onChange({
        ...prepared.plan,
        trackExtras: prepared.plan.trackExtras.map((part, i) => (i === index ? { ...part, antiCollision } : part)),
      })
      setSelectedPitPart(`extra-${index}`)
    } else {
      onChange({
        ...plan,
        pieces: plan.pieces.map((part, i) => (i === selected ? { ...part, antiCollision } : part)),
      })
    }
  }
  function replaceAndFollow(types) {
    if (!active || pickedIndices.length !== 1 || pitPart) return false
    if (plan.partGroups?.groups.some((g) => g.includes(selected))) {
      setEditNotice(te('replacement.blocked'))
      return true
    }
    if (plan.pieces.length - selection.length + types.length > 2000) return false
    if (selection.length === types.length && selection.every((i, n) => plan.pieces[i].type === types[n])) return true
    try {
      setEditNotice('')
      const result = replaceFollowingTrack(storedPlan, selected, types)
      setReplacement({ base: storedPlan, index: selected, types, result })
      onChange(result.plan)
      onSelect(result.selected)
      if (zoom === 1) setFrame(null)
      return true
    } catch (e) {
      setEditNotice(te(e.message === 'cuProtected' ? 'replacement.cuProtected' : 'replacement.blocked'))
      return true
    }
  }
  function changeReplacementCut(count) {
    if (!currentReplacement) return
    const { base, index, types } = currentReplacement
    const result = replaceFollowingTrack(base, index, types, count)
    setReplacement({ base, index, types, result })
    onChange(result.plan)
    if (zoom === 1) setFrame(null)
  }
  function edit(action) {
    if (noVisibleLayers) return
    if (action === 'replace' && pitReplacement) {
      const prepared = editablePitlane(plan),
        index = pitPart.extraIndex ?? prepared.ids[pitPart.id]
      onChange(replacePitlaneSwitch(prepared.plan, index, part))
      setSelectedPitPart(`extra-${index}`)
      return
    }
    if (action === 'replace' && replaceAndFollow(chosen.types)) return
    const insertAt = selected < 0 && visibleLevel !== null ? (visibleSegments.at(-1)?.index ?? -1) : selected
    const result = (plan.freePlacement ? editFreeParts : editTrackPieces)(plan, insertAt, action, chosen.types)
    onChange(['before', 'after'].includes(action) ? decorateInsertion(result, chosen.types.length) : result.plan)
    onSelect(result.selected)
    if (zoom === 1) setFrame(null)
  }
  function patch(patch) {
    if (patch.type && active && /^Kurve_/.test(active.type)) {
      replaceAndFollow([patch.type])
      return
    }
    onChange({
      ...plan,
      ...(patch.level !== undefined && plan.softyImport
        ? { softyImport: { ...plan.softyImport, paintOrder: false } }
        : {}),
      measuredLaneLengthsM: null,
      pieces: plan.pieces.map((p, i) =>
        (patch.level !== undefined ? motion : selection).includes(i) &&
        (!('jointDegrees' in patch) || i === selection[0])
          ? { ...p, ...patch }
          : p,
      ),
    })
  }
  function centerMarked() {
    if (!selectedBounds) return
    setFrame(selectedBounds)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  function fit() {
    setFrame(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  function keyboard(e) {
    if (e.key === 'Escape' && repeatPlacement) {
      e.preventDefault()
      setRepeatPlacement(false)
      setPlacementPoint(null)
      suppressClick.current = false
      return
    }
    if (e.key.toLowerCase() === 'r' && repeatPlacement && !e.target.closest('input,select,textarea')) {
      e.preventDefault()
      setPlacementHeading((h) => h + (e.shiftKey ? -15 : 15))
      return
    }
    if (e.target.closest('input,select,textarea,[contenteditable=true]')) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selectAll()
      return
    }
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      if (e.key.toLowerCase() === 'y' || e.shiftKey) redo()
      else undo()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (
      ['Delete', 'Backspace'].includes(e.key) &&
      active &&
      pickedIndices.length === 1 &&
      !plan.partGroups?.groups.some((g) => g.includes(selected))
    ) {
      e.preventDefault()
      edit('delete')
    }
    if (e.key === 'Escape') {
      setContext(null)
      dragging.current = null
      setDraft(null)
      setMarquee(null)
      setSnapHint(null)
      onSelect(-1)
    }
    if (e.key.toLowerCase() === 'r' && active) rotate(e.shiftKey ? -15 : 15)
    if (e.key.toLowerCase() === 'c') setColors((v) => !v)
    if (e.key.toLowerCase() === 'l') setLabels((v) => (v === 'none' ? 'both' : 'none'))
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault()
      centerMarked()
    }
    if (e.key.toLowerCase() === 'a') fit()
    if (e.key === '+') setZoom((v) => Math.min(8, v * 1.25))
    if (e.key === '-') setZoom((v) => Math.max(0.4, v / 1.25))
  }
  const points = motion.flatMap((i) => trace.segments[i]?.points[0] ?? [])
  const center = points.length
    ? {
        x: (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2,
        y: (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2,
      }
    : null
  const pivot = dragging.current?.kind === 'rotate' ? dragging.current.pivot : center
  const handle =
    pivot && activeSegment
      ? {
          x: pivot.x + Math.cos(activeSegment.start.h - Math.PI / 2) * 270,
          y: pivot.y + Math.sin(activeSegment.start.h - Math.PI / 2) * 270,
        }
      : null
  function rotate(delta) {
    if (!pivot) return
    onChange(
      transformFreeParts(plan, motion, {
        degrees: delta,
        pivotX: pivot.x,
        pivotY: pivot.y,
      }),
    )
  }
  wheelHandler.current = (e) => {
    if (dragging.current || !e.deltaY) return
    e.preventDefault()
    const next = Math.max(0.4, Math.min(8, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    if (next === zoom) return
    const a = world(e),
      ratio = zoom / next,
      cx = box[0] + box[2] / 2,
      cy = box[1] + box[3] / 2
    setZoom(next)
    setPan({
      x: a.x + (cx - a.x) * ratio - (bounds.x + bounds.width / 2),
      y: a.y + (cy - a.y) * ratio - (bounds.y + bounds.depth / 2),
    })
  }
  function world(e, inverse = e.currentTarget.getScreenCTM().inverse()) {
    const svg = e.currentTarget,
      p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(inverse)
  }
  return (
    <section
      data-testid="graphical-track-editor"
      tabIndex="0"
      onKeyDown={keyboard}
      className={`planner-graphical ${expanded ? 'is-expanded' : ''}`}
    >
      {context && (
        <div
          className="planner-context-menu"
          role="menu"
          aria-label={t('tools.context')}
          data-testid="track-context-menu"
          style={{ left: context.x, top: context.y }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setContext(null)
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="context-rotate"
            disabled={(!active && !nativePitSwitch) || (nativePitSwitch && pitSwitchLocked)}
            onClick={() => {
              if (nativePitSwitch) {
                const prepared = editablePitlane(plan),
                  i = pitPart.extraIndex ?? prepared.ids[pitPart.id]
                onChange(
                  updatePitPartWorld(prepared.plan, i, {
                    headingDegrees:
                      extraWorldPose(prepared.plan.trackExtras[i], traceTrackPlan(prepared.plan).segments)
                        .headingDegrees + 180,
                  }),
                )
                setSelectedPitPart(`extra-${i}`)
              } else rotate(15)
              setContext(null)
            }}
          >
            {t(nativePitSwitch ? 'pitParts.rotate' : 'tools.rotate')}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="context-replace"
            disabled={(!active && !pitReplacement) || (!!active && motion.length > 1)}
            onClick={() => {
              edit('replace')
              setContext(null)
            }}
          >
            {t('tools.replaceChosen', { part: labelTrackPart(chosen.types[0]) })}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="context-ungroup"
            disabled={pitPart ? freeTrackSelection(plan, pitPart.anchor).length < 2 : !active || motion.length < 2}
            onClick={() => {
              onChange(ungroupTrackParts(plan, pitPart ? freeTrackSelection(plan, pitPart.anchor) : motion))
              setContext(null)
            }}
          >
            {t('tools.ungroup')}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={
              !!(nativePitSwitch
                ? pitPart.extraIndex !== undefined
                  ? plan.trackExtras[pitPart.extraIndex]?.antiCollision
                  : plan.pieces[pitPart.anchor]?.antiCollision
                : active?.antiCollision)
            }
            data-testid="context-aks"
            disabled={!nativePitSwitch && !/weiche/i.test(active?.type || '')}
            onClick={() => {
              const value = nativePitSwitch
                ? pitPart.extraIndex !== undefined
                  ? plan.trackExtras[pitPart.extraIndex]?.antiCollision
                  : plan.pieces[pitPart.anchor]?.antiCollision
                : active?.antiCollision
              setAntiCollision(!value)
              setContext(null)
            }}
          >
            {t('antiCollision.installed')}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="context-delete"
            disabled={!active && (!pitPart || plan.partGroups?.groups.some((g) => g.includes(pitPart.anchor)))}
            onClick={() => {
              if (pitPart) {
                const prepared = editablePitlane(plan),
                  index = pitPart.extraIndex ?? prepared.ids[pitPart.id]
                onChange(deletePitComponent(prepared.plan, index))
              } else onChange(deleteTrackSelection(plan, motion))
              onSelect(-1)
              setContext(null)
            }}
          >
            {t('tools.deleteSelection', { count: pitPart ? 1 : motion.length })}
          </button>
          <button type="button" role="menuitem" onClick={() => setContext(null)}>
            {t('tools.close')}
          </button>
        </div>
      )}
      <div className="planner-toolbar" role="toolbar" aria-label={ta('toolbar')}>
        <Button
          type="submit"
          data-testid="toolbar-save-track"
          hidden={expanded}
          disabled={saving || !storedPlan.pieces.length || !name?.trim()}
        >
          {ta('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="toolbar-files"
          hidden={expanded}
          disabled={!onOpenFiles}
          onClick={onOpenFiles}
        >
          {ta('files')}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="toolbar-open-3d"
          hidden={expanded}
          disabled={!onOpen3D}
          onClick={onOpen3D}
        >
          {t3('title')}
        </Button>
        <label>
          <input
            data-testid="show-track-elevations"
            type="checkbox"
            checked={!!plan.showElevationLabels}
            onChange={(e) => onChange({ ...plan, showElevationLabels: e.target.checked })}
          />
          {t3('showHeights2D')}
        </label>
        {plan.showElevationLabels && (
          <Button
            type="button"
            variant="outline"
            data-testid="arrange-height-labels"
            disabled={!plan.pieces.some((p) => p.heightLabelOffset)}
            onClick={() => {
              setHeightLabelPreview(null)
              onChange(resetHeightLabelOffsets(plan))
            }}
          >
            {t3('arrangeLabels')}
          </Button>
        )}

        <details className="planner-tool-group">
          <summary>{ui('tools')}</summary>
          <div className="planner-tool-group-content">
            <TrackPlanPrint plan={plan} name={name} drawingRef={canvasRef} />
            <PlannerTools
              onOpenPit={onOpenPit}
              plan={storedPlan}
              selected={selected}
              indices={motion}
              onChange={onChange}
              onSelect={onSelect}
              onSelectIndices={selectIndices}
              fit={fit}
              endpointKey={endpointKey}
              onEndpoint={setEndpointKey}
              onInspect={(indices, auxiliary) => {
                setAuditMarks({ plan: storedPlan, indices, auxiliary })
                setShowConnections(true)
              }}
            />
          </div>
        </details>
        <Button type="button" variant="outline" data-testid="track-undo" disabled={!canUndo} onClick={undo}>
          {t('graph.undo')}
        </Button>
        <Button type="button" variant="outline" data-testid="track-redo" disabled={!canRedo} onClick={redo}>
          {t('graph.redo')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setZoom((v) => Math.max(0.4, v / 1.25))}
          aria-label={t('graph.zoomOut')}
        >
          −
        </Button>
        <span data-testid="track-zoom-percent">{Math.round(zoom * 100)}%</span>
        <input
          data-testid="track-zoom-slider"
          type="range"
          min="40"
          max="800"
          step="5"
          aria-label={t('graph.zoom')}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setZoom((v) => Math.min(8, v * 1.25))}
          aria-label={t('graph.zoomIn')}
        >
          +
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="track-center-selection"
          disabled={!selectedBounds}
          onClick={centerMarked}
          title={`${ta('center')} (F)`}
        >
          {ta('center')}
        </Button>
        <details className="planner-tool-group">
          <summary>{ui('edit')}</summary>
          <div className="planner-tool-group-content">
            <Button
              type="button"
              variant={autoAttachments ? 'default' : 'outline'}
              data-testid="track-auto-attachments"
              aria-pressed={autoAttachments}
              onClick={() => {
                setAutoAttachments(!autoAttachments)
                if (!autoAttachments) setPanel('inspector')
                setAutoReverse(automaticReverse(selected))
                autoHoverLock.current = -1
                setAutoTarget(!autoAttachments && storedPlan.pieces[selected] ? selected : -1)
                setAutoOption(null)
                setRepeatPlacement(false)
              }}
            >
              {ta('automatic')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="toolbar-repeat-placement"
              aria-pressed={repeatPlacement}
              onClick={() => {
                setRepeatPlacement(!repeatPlacement)
                setAutoAttachments(false)
                setAutoTarget(-1)
                setPlacementPoint(null)
              }}
            >
              {ta('repeat')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="toolbar-rotate-selection"
              disabled={!active && pitPart?.extraIndex === undefined}
              onClick={() => {
                if (pitPart?.extraIndex !== undefined)
                  onChange(
                    updatePitPartWorld(storedPlan, pitPart.extraIndex, {
                      headingDegrees: pitPart.pose.headingDegrees + 15,
                    }),
                  )
                else rotate(15)
              }}
            >
              {ta('rotate')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="toolbar-delete-selection"
              disabled={!active && pitPart?.extraIndex === undefined}
              onClick={() => {
                if (pitPart?.extraIndex !== undefined) {
                  const prepared = editablePitlane(plan)
                  onChange(deletePitComponent(prepared.plan, pitPart.extraIndex))
                } else onChange(deleteTrackSelection(plan, motion))
                onSelect(-1)
              }}
            >
              {ta('delete')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="toolbar-join"
              disabled={!joinPair}
              onClick={joinSelectedSections}
            >
              {ta('join')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="toolbar-parallel"
              onClick={() => {
                const panel = canvasRef.current
                  ?.closest('.planner-graphical')
                  ?.querySelector('[data-testid="parallel-docking-controls"]')
                if (panel) {
                  panel.open = true
                  panel.scrollIntoView({ block: 'nearest' })
                }
                setPanel('inspector')
              }}
            >
              {ta('parallel')}
            </Button>
          </div>
        </details>
        <select
          data-testid="toolbar-pointer-mode"
          aria-label={ta('pointer')}
          value={pointerMode}
          onChange={(e) => setPointerMode(e.target.value)}
        >
          <option value="box">{ta('box')}</option>
          <option value="pan">{ta('pan')}</option>
        </select>
        <LayerVisibilityControls
          levels={availableDrawingLevels}
          visible={visibleLevels}
          onChange={changeVisibleLevels}
          insertion={visibleLevel ?? 0}
          onInsertion={setInsertionPlane}
        />
        {noVisibleLayers && (
          <span role="status" data-testid="no-visible-layers" className="text-xs">
            {ta('layers.empty')}
          </span>
        )}
        {layerWarning && (
          <span role="alert" data-testid="layer-group-warning">
            {ta('layers.group')}
          </span>
        )}
        <Button type="button" variant="outline" data-testid="track-fit" onClick={fit}>
          {t('graph.fit')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="planner-panel-toggle"
          data-testid="toggle-track-catalogue"
          aria-expanded={panel === 'catalogue'}
          onClick={() => setPanel(panel === 'catalogue' ? 'none' : 'catalogue')}
        >
          {t('layout.catalogue')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="planner-panel-toggle"
          data-testid="toggle-track-inspector"
          aria-expanded={panel === 'inspector'}
          onClick={() => setPanel(panel === 'inspector' ? 'none' : 'inspector')}
        >
          {t('layout.selection')}
        </Button>
        <details className="planner-view-options" data-testid="track-view-options">
          <summary>{t('layout.viewOptions')}</summary>
          <div className="planner-view-options-content">
            <Button
              type="button"
              variant={pointerMode === 'box' ? 'secondary' : 'outline'}
              data-testid="track-box-mode"
              aria-pressed={pointerMode === 'box'}
              onClick={() => setPointerMode('box')}
            >
              {t('graph.boxSelect')}
            </Button>
            <Button
              type="button"
              variant={pointerMode === 'pan' ? 'secondary' : 'outline'}
              data-testid="track-pan-mode"
              aria-pressed={pointerMode === 'pan'}
              onClick={() => setPointerMode('pan')}
            >
              {t('graph.panMode')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="track-select-all"
              disabled={!plan.pieces.length}
              onClick={selectAll}
            >
              {t('graph.selectAll')}
            </Button>
            <label>
              <input
                data-testid="free-track-snap"
                type="checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
              />{' '}
              {t('free.snap')}
            </label>
            <label>
              <input
                data-testid="realistic-track"
                type="checkbox"
                checked={realistic}
                onChange={(e) => setRealistic(e.target.checked)}
              />{' '}
              {t('free.realistic')}
            </label>

            <label>
              {t('graph.background')}{' '}
              <select value={background} onChange={(e) => setBackground(e.target.value)}>
                {['paper', 'dark', 'green'].map((k) => (
                  <option key={k} value={k}>
                    {t(`graph.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                data-testid="track-type-colors"
                type="checkbox"
                checked={colors}
                onChange={(e) => setColors(e.target.checked)}
              />{' '}
              {t('graph.colors')}
            </label>
            <label>
              {t('graph.labels')}{' '}
              <select data-testid="track-labels" value={labels} onChange={(e) => setLabels(e.target.value)}>
                {['none', 'types', 'numbers', 'both'].map((k) => (
                  <option key={k} value={k}>
                    {t(`graph.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                data-testid="show-connections"
                checked={showConnections}
                onChange={(e) => setShowConnections(e.target.checked)}
              />{' '}
              {t('tools.connections')}
            </label>

            {!expanded && <TrackPartsManager plan={plan} name={name} />}
            <p className="planner-hint">{t('graph.help')}</p>

            {plan.pieces.some((p) => TRACK_PARTS[p.type].approximateSlots) && (
              <p role="note" data-testid="special-geometry-warning" className="border rounded p-2 text-sm">
                {t('catalogue.approximateSlots')}
              </p>
            )}
            <p data-testid="catalogue-geometry-note" className="text-xs text-muted-foreground">
              {t('catalogue.geometryNote')}
            </p>
          </div>
        </details>
      </div>
      <div className="planner-layout" data-panel={panel}>
        <aside className="planner-catalogue" data-testid="planner-catalogue-sidebar">
          <h3 className="font-semibold">{t('graph.catalogue')}</h3>
          <details className="planner-placement-options">
            <summary>{ui('placement')}</summary>
            <label className="planner-repeat-option">
              <input
                type="checkbox"
                data-testid="repeat-track-part"
                checked={repeatPlacement}
                onChange={(e) => {
                  setRepeatPlacement(e.target.checked)
                  if (e.target.checked) {
                    setAutoAttachments(false)
                    setAutoTarget(-1)
                    setAutoOption(null)
                  }
                  setPlacementPoint(null)
                  setPlacementHeading((((join ?? trace.segments.at(-1)?.end)?.h ?? 0) * 180) / Math.PI)
                  suppressClick.current = false
                }}
              />{' '}
              {t('layout.repeatPlace')}
            </label>
            <label className="planner-repeat-option">
              <input
                type="checkbox"
                data-testid="lay-borders"
                checked={layBorders}
                onChange={(e) => setLayBorders(e.target.checked)}
              />{' '}
              {ta('newBorders.label')}
            </label>
            <label>
              {ta('newBorders.side')}{' '}
              <select data-testid="lay-borders-side" value={autoSide} onChange={(e) => setAutoSide(e.target.value)}>
                {['left', 'right', 'both'].map((value) => (
                  <option key={value} value={value}>
                    {ta(`newBorders.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            {!repeatPlacement && <p className="planner-replacement-hint">{t('replacement.catalogueHint')}</p>}
            {repeatPlacement && (
              <p className="planner-repeat-hint" role="status" data-testid="repeat-placement-hint">
                {t('layout.repeatHint')}
              </p>
            )}
          </details>
          <div className="planner-catalogue-tabs" role="tablist" aria-label={t('graph.catalogue')}>
            {['all', 'straights', 'curves', 'banked', 'specials', 'switches', 'units', 'borders', 'manufacturer'].map(
              (key) => (
                <button
                  type="button"
                  role="tab"
                  key={key}
                  id={`${gridId}-tab-${key}`}
                  data-testid={`catalogue-tab-${key}`}
                  aria-selected={category === key}
                  aria-controls={`${gridId}-catalogue-panel`}
                  onClick={() => setCategory(key)}
                >
                  {t(`graph.categories.${key}`)}
                </button>
              ),
            )}
          </div>
          <div role="tabpanel" id={`${gridId}-catalogue-panel`} aria-labelledby={`${gridId}-tab-${category}`}>
            <div hidden={category === 'borders' || category === 'manufacturer'}>
              <input
                data-testid="track-catalogue-search"
                className="border rounded p-2 w-full"
                aria-label={t('graph.search')}
                placeholder={t('graph.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="planner-parts" data-testid="track-catalogue">
                {catalogue
                  .filter(
                    (p) =>
                      (category === 'all' || partCategory(p) === category) &&
                      (
                        labelTrackPart(p.types[0]) +
                        ' ' +
                        p.id +
                        ' ' +
                        trackArticle(p.types[0]) +
                        ' ' +
                        (Object.hasOwn(TRACK_ASSEMBLIES, p.id) ? t(`graph.${p.id}`) : '')
                      )
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <button
                      type="button"
                      data-testid={`palette-${p.id}`}
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-racehub-track-part', p.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      aria-pressed={p.id === part}
                      className={`planner-part ${p.id === part ? 'is-selected' : ''}`}
                      onClick={() => {
                        setPart(p.id)
                        if (!repeatPlacement) replaceAndFollow(p.types)
                        if (panel === 'catalogue') setPanel(repeatPlacement ? 'none' : 'inspector')
                        setPlacementPoint(null)
                      }}
                      onDoubleClick={() => {
                        if (noVisibleLayers || repeatPlacement || active || pitPart) return
                        if (plan.pieces.length + p.types.length > 2000) return
                        const result = (plan.freePlacement ? editFreeParts : editTrackPieces)(
                          plan,
                          selected,
                          side,
                          p.types,
                        )
                        onChange(decorateInsertion(result, p.types.length))
                        onSelect(result.selected)
                      }}
                    >
                      <PartIcon types={p.types} />
                      <span>
                        {p.types.length > 1 ? t(`graph.${p.id}`) : labelTrackPart(p.types[0])}
                        <small className="block text-muted-foreground">
                          {trackArticle(p.types[0])}
                          {TRACK_PARTS[p.types[0]].banked ? ' · 2D' : ''}
                          {TRACK_PARTS[p.types[0]].approximateSlots ? ` · ${t('catalogue.approximateShort')}` : ''}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
            <div hidden={category !== 'manufacturer'} data-testid="manufacturer-catalogue" className="space-y-3">
              <p className="text-xs">{t('catalogue.referenceNote')}</p>
              <input
                data-testid="manufacturer-search"
                className="border rounded p-2 w-full"
                aria-label={t('graph.search')}
                placeholder={t('graph.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {CARRERA_MANUFACTURER_ARTICLES.filter((p) =>
                (p.article + ' ' + p.name).toLowerCase().includes(search.toLowerCase()),
              ).map((p) => (
                <article
                  key={p.article}
                  data-testid={`manufacturer-${p.article}`}
                  className="border rounded p-2 text-sm"
                >
                  <strong>{p.article}</strong>
                  <p>{p.name}</p>
                  {SPECIAL_GEOMETRY_AUDIT[p.article] && (
                    <p data-testid={`geometry-audit-${p.article}`} className="text-xs my-2">
                      {t(`catalogue.audit.${SPECIAL_GEOMETRY_AUDIT[p.article].note}`)}
                    </p>
                  )}
                  <small className="block">
                    {t(supportedArticles.has(p.article) ? 'catalogue.supported' : 'catalogue.referenceOnly')}
                  </small>
                  <a href={p.source} target="_blank" rel="noopener noreferrer" className="underline">
                    {t('catalogue.source')}
                  </a>
                </article>
              ))}
            </div>
            <div hidden={category !== 'borders'} className="planner-border-submenu">
              <p data-testid="catalogue-border-selection">{t('graph.multiple', { count: pickedIndices.length })}</p>
              <p className="text-sm" data-testid="pit-shoulder-catalogue">
                {ta('newBorders.pitHint')}
              </p>
              {pitPart?.extraIndex !== undefined &&
                pitShoulderOptions(plan, pitPart.extraIndex).map((option) => (
                  <button
                    type="button"
                    key={option.side}
                    data-testid={`pit-shoulder-${option.side}`}
                    className="border rounded p-2"
                    onClick={() => onChange(attachPitShoulder(plan, pitPart.extraIndex, option.side))}
                  >
                    {ta('newBorders.pit')} · {option.article} · {ta(`newBorders.${option.side}`)}
                  </button>
                ))}
              <TrackBorders
                plan={plan}
                selected={selected}
                onChange={(next) => {
                  onChange(next)
                  setFrame(null)
                }}
                selectedIndices={pickedIndices}
              />
            </div>
          </div>
        </aside>
        <div className="planner-stage">
          <TrackImageExport name={name} className="planner-image-export">
            <svg
              ref={canvasRef}
              data-testid="graph-track-canvas"
              data-piece-count={plan.pieces.length}
              data-selected-count={pickedIndices.length}
              viewBox={box.join(' ')}
              role="img"
              tabIndex="0"
              aria-label={t('graph.canvas')}
              className="planner-canvas touch-none"
              style={{
                cursor: repeatPlacement ? 'crosshair' : undefined,
                background: background === 'paper' ? '#f8fafc' : background === 'green' ? '#14532d' : '#0f172a',
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-racehub-track-part')) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDrop={(e) => {
                if (noVisibleLayers) {
                  e.preventDefault()
                  return
                }
                const item = catalogue.find((p) => p.id === e.dataTransfer.getData('application/x-racehub-track-part'))
                if (!item || plan.pieces.length + item.types.length > 2000) return
                e.preventDefault()
                const point = placementCoordinates(world(e))
                if (!point) return
                setFrame(bounds)
                const result = editFreeParts(plan, -1, 'after', item.types, {
                  xMm: point.x,
                  yMm: point.y,
                  headingDegrees: 0,
                })
                result.plan = decorateInsertion(result, item.types.length)
                const indices = trackSelection(result.plan, result.selected),
                  snapped = snapEnabled
                    ? snapFreeParts(result.plan, indices, {
                        distanceMm: Math.max(20, w / 25),
                      })
                    : { plan: result.plan, snap: null }
                onChange(snapped.plan)
                onSelect(result.selected)
                setPart(item.id)
                setSnapHint(snapped.snap)
              }}
              onContextMenu={(e) => {
                const rail = e.target.closest('[data-rail-index]'),
                  pit = e.target.closest('[data-pit-part-id]')
                if (!rail && !pit) return
                e.preventDefault()
                suppressClick.current = false
                if (pit) selectPitPart(pit.dataset.pitPartId)
                else onSelect(Number(rail.dataset.railIndex))
                setContext({
                  x: Math.max(8, Math.min(e.clientX, window.innerWidth - 245)),
                  y: Math.max(8, Math.min(e.clientY, window.innerHeight - 340)),
                })
              }}
              onPointerLeave={() => {
                autoHoverLock.current = -1
                if (!dragging.current) setPlacementPoint(null)
              }}
              onClickCapture={(e) => {
                if (
                  !autoAttachments ||
                  repeatPlacement ||
                  e.button !== 0 ||
                  e.ctrlKey ||
                  e.metaKey ||
                  e.shiftKey ||
                  e.target.closest('[data-pit-part-id]')
                )
                  return
                const rail = e.target.closest('[data-rail-index]')
                if (!rail) return
                e.preventDefault()
                e.stopPropagation()
                addAutomatic(Number(rail.dataset.railIndex), autoSide, true)
              }}
              onPointerDown={(e) => {
                if (autoAttachments && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) return
                if (repeatPlacement && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.focus({ preventScroll: true })
                  suppressClick.current = true
                  placeAt(world(e))
                  return
                }
                if (e.target.closest('[data-connection-port]')) return
                suppressClick.current = false
                if (![0, 1].includes(e.button) || ((e.ctrlKey || e.metaKey) && !e.shiftKey)) return
                const borderHit = e.target.closest('[data-border-side]')
                if (borderHit && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  selectBorder(Number(borderHit.dataset.railIndex), borderHit.dataset.borderSide, e)
                  suppressClick.current = true
                  return
                }
                const pitHit = e.target.closest('[data-pit-part-id]')
                if (pitHit && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  e.currentTarget.focus({ preventScroll: true })
                  const id = pitHit.dataset.pitPartId
                  const part = pitParts.find((p) => p.id === id)
                  selectPitPart(id, e)
                  if (part?.extraIndex !== undefined && ['single', 'fuel', 'entry', 'exit'].includes(part.kind)) {
                    const point = world(e),
                      matrix = e.currentTarget.getScreenCTM()
                    dragging.current = {
                      kind: 'pit-move',
                      id: e.pointerId,
                      x: e.clientX,
                      y: e.clientY,
                      point,
                      inverse: matrix.inverse(),
                      base: storedPlan,
                      extraIndex: part.extraIndex,
                      pose: part.pose,
                    }
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }
                  suppressClick.current = true
                  return
                }
                const rail = e.target.closest('[data-rail-index]'),
                  rotation = e.target.closest('[data-rotation-handle]')
                if (e.target.closest('[data-testid=track-connector]') && !e.shiftKey) return
                e.preventDefault()
                e.currentTarget.focus({ preventScroll: true })
                const index = rail ? Number(rail.dataset.railIndex) : selected,
                  point = world(e),
                  matrix = e.currentTarget.getScreenCTM()
                const kind =
                  e.button === 1 ? 'pan' : e.shiftKey ? 'box' : rotation ? 'rotate' : rail ? 'move' : pointerMode
                if (['move', 'rotate'].includes(kind) && !editableRail(index)) {
                  setLayerWarning(true)
                  return
                }
                const indices = pickedIndices.includes(index) ? motion : freeTrackSelection(storedPlan, index)
                setFrame(bounds)
                dragging.current = {
                  kind,
                  index,
                  id: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                  point,
                  pan,
                  sx: 1 / matrix.a,
                  sy: 1 / matrix.d,
                  box: [...box],
                  inverse: matrix.inverse(), // Selection controls can move the canvas during a drag.
                  base: enableFreePlacement(storedPlan),
                  indices,
                  pivot: center,
                  additive: e.ctrlKey || e.metaKey,
                  previous: pickedIndices,
                }
                if (kind === 'box') setMarquee({ a: point, b: point })
                if (['move', 'rotate'].includes(kind) && !pickedIndices.includes(index)) onSelect(index)
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (autoAttachments && !dragging.current && !repeatPlacement) {
                  if (e.target.closest('[data-pit-part-id]')) {
                    setAutoTarget(-1)
                    setAutoOption(null)
                  }
                  const rail = e.target.closest('[data-rail-index]')
                  if (rail && !e.target.closest('[data-pit-part-id]')) {
                    const index = Number(rail.dataset.railIndex)
                    if (
                      Number.isInteger(index) &&
                      plan.pieces[index] &&
                      index !== autoTarget &&
                      index !== autoHoverLock.current
                    ) {
                      autoHoverLock.current = -1
                      setAutoTarget(index)
                      setAutoReverse(automaticReverse(index))
                      setAutoOption(null)
                    }
                  }
                }
                if (repeatPlacement && !dragging.current) setPlacementPoint(world(e))
                const d = dragging.current
                if (!d) return
                if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3 && !d.moved) return
                d.moved = true
                if (d.kind === 'pan') {
                  setPan({
                    x: d.pan.x - (e.clientX - d.x) * d.sx,
                    y: d.pan.y - (e.clientY - d.y) * d.sy,
                  })
                  return
                }
                const point = world(e, d.inverse)
                if (d.kind === 'box') {
                  setMarquee({ a: d.point, b: point })
                  return
                }
                if (d.kind === 'pit-move') {
                  const changed = updatePitPartWorld(d.base, d.extraIndex, {
                    xMm: d.pose.xMm + point.x - d.point.x,
                    yMm: d.pose.yMm + point.y - d.point.y,
                  })
                  d.result = changed
                  setDraft(changed)
                  return
                }
                let changed
                if (d.kind === 'rotate') {
                  let delta =
                    ((Math.atan2(point.y - d.pivot.y, point.x - d.pivot.x) -
                      Math.atan2(d.point.y - d.pivot.y, d.point.x - d.pivot.x)) *
                      180) /
                    Math.PI
                  if (e.shiftKey) delta = Math.round(delta / 5) * 5
                  changed = transformFreeParts(d.base, d.indices, {
                    degrees: delta,
                    pivotX: d.pivot.x,
                    pivotY: d.pivot.y,
                  })
                } else
                  changed = transformFreeParts(d.base, d.indices, {
                    dx: point.x - d.point.x,
                    dy: point.y - d.point.y,
                  })
                const snapped = snapEnabled
                  ? snapFreeParts(changed, d.indices, {
                      distanceMm: Math.max(20, d.box[2] / 25),
                    })
                  : { plan: changed, snap: null }
                d.result = snapped.plan
                setDraft(snapped.plan)
                setSnapHint(snapped.snap)
              }}
              onPointerUp={(e) => {
                const d = dragging.current
                if (d?.kind === 'box' && d.moved) {
                  const indices = trackRectangleSelection(d.base, d.point, world(e, d.inverse), null).filter(
                    editableRail,
                  )
                  selectIndices([...new Set([...(d.additive ? d.previous : []), ...indices])])
                  suppressClick.current = true
                } else if (d?.moved && d.result) {
                  suppressClick.current = true
                  onChange(d.result)
                } else if (d?.kind === 'move') onSelect(d.index)
                else if (d && !d.moved && ['box', 'pan'].includes(d.kind)) {
                  if (!storedPlan.pieces.length && !noVisibleLayers) {
                    const p = world(e),
                      result = editFreeParts(storedPlan, -1, 'after', chosen.types, {
                        xMm: p.x,
                        yMm: p.y,
                        headingDegrees: 0,
                      })
                    onChange(decorateInsertion(result, chosen.types.length))
                    onSelect(result.selected)
                  } else onSelect(-1)
                }
                dragging.current = null
                setDraft(null)
                setMarquee(null)
                if (d?.kind === 'pan') setPan((p) => ({ ...p }))
              }}
              onPointerCancel={() => {
                dragging.current = null
                setDraft(null)
                setMarquee(null)
                setSnapHint(null)
              }}
            >
              <defs>
                <pattern id={gridId} width="100" height="100" patternUnits="userSpaceOnUse">
                  <path
                    d="M100 0H0V100"
                    fill="none"
                    stroke={background === 'paper' ? '#cbd5e1' : '#64748b'}
                    strokeWidth="2"
                  />
                </pattern>
              </defs>
              {showRoom && plan.roomPlan && (
                <g pointerEvents="none" data-testid="track-room-background">
                  <RoomFootprintDrawing
                    room={plan.roomPlan}
                    origin={anchorRoom(plan.roomPlan, plan).backgroundOrigin}
                  />
                </g>
              )}
              <rect x={box[0]} y={box[1]} width={w} height={h} fill={`url(#${gridId})`} />
              {autoAttachments && railVisible(autoTarget) && trace.segments[autoTarget] && (
                <path
                  data-testid="automatic-attachment-target"
                  d={trace.segments[autoTarget].points[0].map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="220"
                  strokeOpacity=".2"
                  pointerEvents="none"
                />
              )}
              <TrackPlanPreview
                plan={plan}
                embedded
                selected={pitPart ? -1 : selected}
                selectedIndices={motion}
                selectedPitPart={selectedPitPart}
                onSelectPitPart={selectPitPart}
                onSelectBorder={selectBorder}
                realistic={realistic}
                onSelect={onSelect}
                colorParts={colors}
                labels={labels}
                visibleDrawingLevels={visibleLevels}
                connector={
                  !repeatPlacement &&
                  !autoAttachments &&
                  !dockPreview &&
                  (visibleLevels === null || !!active) &&
                  plan.pieces.length + chosen.types.length <= 2000
                    ? connector
                    : null
                }
                connectorRadius={
                  activeSegment
                    ? Math.max(
                        24,
                        Math.min(
                          75,
                          Math.hypot(
                            activeSegment.end.x - activeSegment.start.x,
                            activeSegment.end.y - activeSegment.start.y,
                          ) / 4,
                        ),
                      )
                    : 75
                }
                onConnect={() => edit(side)}
              />
              {plan.showElevationLabels && elevationModel && (
                <TrackHeightLabels
                  model={elevationModel}
                  selected={selected}
                  layout={heightLabelLayout}
                  onPreview={setHeightLabelPreview}
                  onCommit={commitHeightLabelMove}
                  onReset={(i) => {
                    setHeightLabelPreview(null)
                    onChange(resetHeightLabelOffsets(plan, i))
                  }}
                  onPick={(i) => {
                    onSelect(i)
                    setHeightEditorOpen(true)
                    setPanel('inspector')
                  }}
                />
              )}
              {dockPreview && (
                <g data-testid="parallel-docking-preview" pointerEvents="none" opacity="0.55">
                  {traceTrackPlan(dockPreview.plan)
                    .segments.filter((s) => dockPreview.movingIndices.includes(s.index))
                    .map((s) => (
                      <path
                        key={s.index}
                        d={s.points[0].map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="190"
                      />
                    ))}
                  {dockPreview.extraIndices.map((i) => (
                    <polygon
                      key={`extra-${i}`}
                      points={softyExtraGeometry(
                        dockPreview.plan.trackExtras[i],
                        traceTrackPlan(dockPreview.plan).segments,
                      )
                        .polygon.map((p) => p.join(','))
                        .join(' ')}
                      fill="#2563eb"
                    />
                  ))}
                  <line
                    x1={dockPreview.fixed.x}
                    y1={dockPreview.fixed.y}
                    x2={dockPreview.target.x}
                    y2={dockPreview.target.y}
                    stroke="#ea580c"
                    strokeWidth="8"
                  />
                </g>
              )}
              {joinPair && !dockPreview && (
                <g data-testid="join-sections-preview" pointerEvents="none">
                  <line
                    x1={joinPair.fixed.x}
                    y1={joinPair.fixed.y}
                    x2={joinPair.moving.x}
                    y2={joinPair.moving.y}
                    stroke="#2563eb"
                    strokeWidth={Math.max(5, w / 300)}
                    strokeDasharray="18 12"
                  />
                  {[joinPair.fixed, joinPair.moving].map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={Math.max(24, w / 65)}
                      fill="none"
                      stroke={i ? '#ea580c' : '#16a34a'}
                      strokeWidth={Math.max(6, w / 250)}
                    />
                  ))}
                </g>
              )}
              {currentReplacement && (
                <g data-testid="replacement-cut-marker" pointerEvents="none">
                  {currentReplacement.result.hasFixedNeighbour && (
                    <line
                      x1={currentReplacement.result.boundary.x}
                      y1={currentReplacement.result.boundary.y}
                      x2={currentReplacement.result.fixed.x}
                      y2={currentReplacement.result.fixed.y}
                      stroke="#ea580c"
                      strokeWidth={Math.max(5, w / 300)}
                      strokeDasharray="18 12"
                    />
                  )}
                  <circle
                    cx={currentReplacement.result.boundary.x}
                    cy={currentReplacement.result.boundary.y}
                    r={Math.max(20, w / 65)}
                    fill="white"
                    stroke="#ea580c"
                    strokeWidth={Math.max(5, w / 300)}
                  />
                </g>
              )}
              {stamp && (
                <g
                  data-testid="repeat-track-preview"
                  data-part-type={part}
                  data-occupied={stamp.occupied}
                  opacity={stamp.occupied ? 0.3 : 0.55}
                  pointerEvents="none"
                >
                  <TrackPlanPreview
                    plan={decorateInsertion({ plan: stamp.plan, selected: 0 }, chosen.types.length)}
                    embedded
                    realistic={realistic}
                    showOrigin={false}
                  />
                  <circle
                    cx={stamp.pose.xMm}
                    cy={stamp.pose.yMm}
                    r="20"
                    fill={stamp.occupied ? '#dc2626' : '#0d9488'}
                  />
                </g>
              )}
              {autoShapes.length > 0 && (
                <g data-testid="automatic-attachment-preview" pointerEvents="none">
                  {autoShapes.map((p, i) => (
                    <g key={i} opacity=".7">
                      <path
                        d={p.points.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join(' ') + 'Z'}
                        fill="#292b2e"
                        stroke="#2563eb"
                        strokeWidth="4"
                      />
                      {borderArtwork(p).map((patch, j) => (
                        <path
                          key={j}
                          d={patch.points.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join(' ') + 'Z'}
                          fill={patch.color}
                        />
                      ))}
                    </g>
                  ))}
                </g>
              )}
              {showConnections && !autoAttachments && (
                <g pointerEvents={repeatPlacement ? 'none' : undefined}>
                  <ConnectionHints
                    plan={plan}
                    visibleDrawingLevels={visibleLevels}
                    indices={joinPair ? [] : motion}
                    endpointKey={endpointKey}
                    width={w}
                    onPort={(p, event) => {
                      if ((event?.ctrlKey || event?.metaKey) && endpointKey) {
                        const [first] = endpointKey.split(':').map(Number)
                        if (first === pickedIndices[0]) setJoinKey(`${endpointKey}/${p.index}:${p.end}`)
                      } else setJoinKey('')
                      setEndpointKey(`${p.index}:${p.end}`)
                      setSide(p.end ? 'after' : 'before')
                      onSelect(p.index, event)
                    }}
                  />
                </g>
              )}
              {auditMarks?.plan === storedPlan &&
                trace.segments
                  .filter((s) => railVisible(s.index) && auditMarks.indices.includes(s.index))
                  .map((s) => (
                    <path
                      key={s.index}
                      data-testid={`audit-mark-${s.index}`}
                      d={s.points[0].map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')}
                      fill="none"
                      stroke="#dc2626"
                      strokeOpacity=".5"
                      strokeWidth="170"
                      pointerEvents="none"
                    />
                  ))}
              {visibleLevels === null &&
                auditMarks?.plan === storedPlan &&
                auditMarks.auxiliary?.map((p, i) => (
                  <circle
                    key={i}
                    data-testid={`audit-auxiliary-mark-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="24"
                    stroke="#dc2626"
                    strokeWidth="6"
                    fill="none"
                    pointerEvents="none"
                  />
                ))}
              {marquee && (
                <rect
                  data-testid="track-selection-rectangle"
                  x={Math.min(marquee.a.x, marquee.b.x)}
                  y={Math.min(marquee.a.y, marquee.b.y)}
                  width={Math.abs(marquee.b.x - marquee.a.x)}
                  height={Math.abs(marquee.b.y - marquee.a.y)}
                  fill="#0d948833"
                  stroke="#0f766e"
                  strokeWidth={(3 * w) / 1200}
                  strokeDasharray={`${(12 * w) / 1200} ${(6 * w) / 1200}`}
                  pointerEvents="none"
                />
              )}
              {snapHint && (
                <circle
                  data-testid="free-snap-indicator"
                  cx={snapHint.x}
                  cy={snapHint.y}
                  r="65"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  pointerEvents="none"
                />
              )}
              {handle && pivot && !repeatPlacement && !autoAttachments && (
                <g>
                  <line
                    x1={pivot.x}
                    y1={pivot.y}
                    x2={handle.x}
                    y2={handle.y}
                    stroke="#dc2626"
                    strokeWidth="6"
                    pointerEvents="none"
                  />
                  <circle
                    data-testid="free-rotation-handle"
                    data-rotation-handle="true"
                    cx={handle.x}
                    cy={handle.y}
                    r="55"
                    fill="#dc2626"
                    stroke="white"
                    strokeWidth="8"
                    style={{ cursor: 'grab' }}
                  >
                    <title>{t('free.rotate')}</title>
                  </circle>
                </g>
              )}
              {!plan.pieces.length && (
                <text
                  x="0"
                  y="-180"
                  textAnchor="middle"
                  fontSize="50"
                  fill={background === 'paper' ? '#334155' : '#fff'}
                  pointerEvents="none"
                >
                  {t('graph.start')}
                </text>
              )}
            </svg>
          </TrackImageExport>
          {plan.freePlacement && (
            <p role="status" data-testid="free-track-status">
              {t(trace.connectivity.closed ? 'free.closed' : 'free.open', {
                count: trace.connectivity.openPorts.length,
                ambiguous: trace.connectivity.ambiguousPorts,
                components: trace.connectivity.components,
              })}
            </p>
          )}
          {heightLabelLayout && (
            <p data-testid="height-label-density-status" role="status" className="height-label-layout-status">
              {t3('labelDensity', { shown: heightLabelLayout.items.length, total: heightLabelLayout.visibleCount })}
            </p>
          )}
          <p data-testid="graphic-track-status" className="text-sm">
            {t(plan.freePlacement && !trace.connectivity.closed ? 'free.material' : 'editor.lanes')}:{' '}
            {trace.laneLengthsM.map((n) => n.toFixed(3)).join(' / ')} m ·{' '}
            {plan.freePlacement
              ? t('free.connections', {
                  count: trace.connectivity.openPorts.length,
                })
              : `${t('editor.gap')}: ${trace.gapMm.toFixed(2)} mm`}
          </p>
        </div>
        <aside className="planner-inspector" data-testid="planner-selection-sidebar" aria-label={t('layout.selection')}>
          {autoAttachments && (
            <AutomaticAttachments
              index={autoTarget}
              options={attachmentOptions(storedPlan, autoTarget)}
              side={autoSide}
              reverse={autoReverse}
              onSideChange={(value) => {
                setAutoSide(value)
                setAutoOption(null)
                autoHoverLock.current = -1
              }}
              canApply={
                !!storedPlan.pieces[autoTarget] &&
                canAttachAutomaticBorders(storedPlan, autoTarget, autoSide, autoReverse)
              }
              onApply={() => addAutomatic()}
              onPreview={setAutoOption}
              onClose={() => {
                setAutoAttachments(false)
                setAutoTarget(-1)
                setAutoOption(null)
              }}
              onAdd={(id) =>
                addAutomatic(
                  autoTarget,
                  autoReverse && ['left', 'right'].includes(id) ? (id === 'left' ? 'right' : 'left') : id,
                )
              }
            />
          )}
          <div className="planner-selection-toolbar" style={{ display: autoAttachments ? 'none' : undefined }}>
            <strong className="text-sm" data-testid="selected-track-piece">
              {pitPart
                ? `${pitPart.short} · ${t(`pitParts.${pitPart.kind}`)} · ${pitPart.article}`
                : active
                  ? `${selected + 1}. ${labelTrackPart(active.type)}${['Standardgerade', 'Startampel_3spur_hinten'].includes(active.type) ? ` · ${t('pitParts.twoLane')}` : ''}`
                  : t('graph.noSelection')}
            </strong>
            {active && !pitPart && (
              <>
                {!heightEditorOpen && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="two-open-height-editor"
                    onClick={() => setHeightEditorOpen(true)}
                  >
                    {t3('heightEdit2D')}
                  </Button>
                )}
                {elevationModel && (
                  <RailElevationEditor
                    key={selected}
                    plan={plan}
                    index={selected}
                    model={elevationModel}
                    onChange={onChange}
                    open={heightEditorOpen}
                    onOpen={setHeightEditorOpen}
                  />
                )}
              </>
            )}
            {(nativePitSwitch || (active && /weiche/i.test(active.type))) && (
              <label className="text-sm">
                <input
                  type="checkbox"
                  data-testid="switch-anti-collision"
                  checked={
                    !!(nativePitSwitch
                      ? pitPart.extraIndex !== undefined
                        ? plan.trackExtras[pitPart.extraIndex]?.antiCollision
                        : plan.pieces[pitPart.anchor]?.antiCollision
                      : active.antiCollision)
                  }
                  onChange={(e) => setAntiCollision(e.target.checked)}
                />{' '}
                {t('antiCollision.installed')}
              </label>
            )}
            <label className="text-sm">
              <input
                type="checkbox"
                data-testid="show-anti-collision"
                checked={!!plan.showAntiCollision}
                onChange={(e) => onChange({ ...plan, showAntiCollision: e.target.checked })}
              />{' '}
              {t('antiCollision.show')}
            </label>
            {editNotice && (
              <p role="alert" data-testid="track-edit-notice">
                {editNotice}
              </p>
            )}
            <div className="planner-join-sections" data-testid="join-sections-controls">
              <Button
                type="button"
                data-testid="join-track-sections"
                disabled={!joinPair}
                onClick={joinSelectedSections}
              >
                {t('joinSections.action')}
              </Button>
              {joinPair && !dockPreview && (
                <label>
                  {t('joinSections.ports')}
                  <select
                    data-testid="join-sections-pair"
                    value={joinPair.key}
                    onChange={(e) => setJoinKey(e.target.value)}
                  >
                    {joinOptions.pairs.map((p) => (
                      <option key={p.key} value={p.key}>
                        {t('joinSections.pair', {
                          fixed: p.fixed.index + 1,
                          fixedEnd: t(p.fixed.end ? 'tools.end' : 'tools.start'),
                          moving: p.moving.index + 1,
                          movingEnd: t(p.moving.end ? 'tools.end' : 'tools.start'),
                        })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p role="status" data-testid="join-sections-status">
                {t(
                  joinedPlan === storedPlan
                    ? 'joinSections.joined'
                    : joinPair
                      ? 'joinSections.ready'
                      : `joinSections.${joinOptions.reason}`,
                )}
              </p>
            </div>
            {currentReplacement && (
              <div className="planner-replacement-cut" data-testid="replacement-cut-controls">
                <label>
                  {t('replacement.cut')}
                  <select
                    data-testid="replacement-cut-select"
                    value={currentReplacement.result.count}
                    onChange={(e) => changeReplacementCut(Number(e.target.value))}
                  >
                    {currentReplacement.result.choices.map((c) => (
                      <option key={c.count} value={c.count}>
                        {c.count === 0
                          ? t('replacement.afterNew')
                          : t('replacement.afterPart', {
                              number: c.index + 1,
                              part: labelTrackPart(plan.pieces[c.index].type),
                            })}
                      </option>
                    ))}
                  </select>
                </label>
                <p>{currentReplacement.result.stoppedAtCU ? te('replacement.cuFixed') : t('replacement.hint')}</p>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="replacement-cut-done"
                  onClick={() => setReplacement(null)}
                >
                  {t('replacement.done')}
                </Button>
              </div>
            )}
            <select
              data-testid="track-insert-side"
              aria-label={t('graph.insertSide')}
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              <option value="after">{t('graph.after')}</option>
              <option value="before">{t('graph.before')}</option>
            </select>
            <Button
              type="button"
              data-testid="add-track-piece"
              disabled={noVisibleLayers || !!pitPart || plan.pieces.length + chosen.types.length > 2000}
              onClick={() => edit(side)}
            >
              {t('graph.place')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="replace-track-piece"
              disabled={
                !pitReplacement &&
                (!active ||
                  pickedIndices.length > 1 ||
                  plan.partGroups?.groups.some((g) => g.includes(selected)) ||
                  plan.pieces.length - selection.length + chosen.types.length > 2000)
              }
              onClick={() => edit('replace')}
            >
              {t('editor.replace')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="delete-track-piece"
              disabled={
                !active || pickedIndices.length > 1 || plan.partGroups?.groups.some((g) => g.includes(selected))
              }
              onClick={() => edit('delete')}
            >
              {t('editor.remove')}
            </Button>
            {nativePitSwitch && (
              <Button
                type="button"
                variant="outline"
                data-testid="rotate-pit-component"
                disabled={pitSwitchLocked}
                onClick={() => {
                  const prepared = editablePitlane(plan),
                    index = pitPart.extraIndex ?? prepared.ids[pitPart.id]
                  onChange(
                    updatePitPartWorld(prepared.plan, index, {
                      headingDegrees:
                        extraWorldPose(prepared.plan.trackExtras[index], traceTrackPlan(prepared.plan).segments)
                          .headingDegrees + 180,
                    }),
                  )
                  setSelectedPitPart(`extra-${index}`)
                }}
              >
                {t('pitParts.rotate')}
              </Button>
            )}
            {active && (
              <>
                <label>
                  {t('editor.level')}{' '}
                  <select
                    data-testid="selected-track-level"
                    value={active.level}
                    onChange={(e) => patch({ level: Number(e.target.value) })}
                  >
                    {[0, 1, 2].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                {active.type.startsWith('Kurve_') && pickedIndices.length === 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      patch({
                        type: active.type.endsWith('links')
                          ? active.type.replace('links', 'rechts')
                          : active.type.replace('rechts', 'links'),
                      })
                    }
                  >
                    {t('graph.flip')}
                  </Button>
                )}
                {pickedIndices.length === 1 && (
                  <>
                    <Button type="button" variant="outline" onClick={() => onSelect(Math.max(0, selected - 1))}>
                      ←
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSelect(Math.min(plan.pieces.length - 1, selected + 1))}
                    >
                      →
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="planner-inspector-body" data-testid="planner-inspector-body">
            <section
              className="planner-transform-panel"
              data-testid="track-transform-controls"
              aria-label={t('graph.transformControls')}
            >
              <p data-testid="track-selection-count" className="text-sm">
                {t('graph.multiple', { count: pickedIndices.length })}
              </p>
              <div className="planner-pose">
                <label>
                  {t('graph.rotation')}{' '}
                  <input
                    data-testid="track-rotation"
                    type="number"
                    className="border rounded w-20"
                    min="-360"
                    max="360"
                    step="any"
                    value={plan.startHeadingDegrees}
                    onChange={(e) => onChange(rotateTrackPlan(plan, Number(e.target.value) - plan.startHeadingDegrees))}
                  />{' '}
                  °
                </label>
                {active && activeSegment && (
                  <>
                    <label>
                      X (mm){' '}
                      <input
                        data-testid="free-part-x"
                        type="number"
                        step="any"
                        className="border rounded w-24"
                        value={Number(activeSegment.start.x.toFixed(2))}
                        onChange={(e) =>
                          onChange(
                            transformFreeParts(plan, motion, {
                              dx: Math.max(-1000000, Math.min(1000000, Number(e.target.value))) - activeSegment.start.x,
                            }),
                          )
                        }
                      />
                    </label>
                    <label>
                      Y (mm){' '}
                      <input
                        data-testid="free-part-y"
                        type="number"
                        step="any"
                        className="border rounded w-24"
                        value={Number(activeSegment.start.y.toFixed(2))}
                        onChange={(e) =>
                          onChange(
                            transformFreeParts(plan, motion, {
                              dy: Math.max(-1000000, Math.min(1000000, Number(e.target.value))) - activeSegment.start.y,
                            }),
                          )
                        }
                      />
                    </label>
                    <label>
                      {t('free.angle')}{' '}
                      <input
                        data-testid="free-part-angle"
                        type="number"
                        min="-360"
                        max="360"
                        step="any"
                        className="border rounded w-20"
                        value={Number(activeHeading.toFixed(2))}
                        onChange={(e) => rotate(Number(e.target.value) - activeHeading)}
                      />
                    </label>
                    <Button
                      type="button"
                      data-testid="free-snap-now"
                      variant="outline"
                      onClick={() => {
                        const result = snapFreeParts(plan, motion, {
                          distanceMm: Math.max(20, w / 25),
                        })
                        onChange(result.plan)
                        setSnapHint(result.snap)
                      }}
                    >
                      {t('free.snapNow')}
                    </Button>
                  </>
                )}
                {active && !plan.freePlacement && (
                  <label>
                    {t('editor.joint')}{' '}
                    <input
                      type="number"
                      className="border rounded w-20"
                      min="-5"
                      max="5"
                      step="any"
                      value={active.jointDegrees}
                      onChange={(e) =>
                        patch({
                          jointDegrees: Math.max(-5, Math.min(5, Number(e.target.value))),
                        })
                      }
                    />
                  </label>
                )}
              </div>
            </section>{' '}
            <div
              className="planner-group-controls border rounded-lg p-2 flex flex-wrap items-center gap-2"
              data-testid="track-group-controls"
            >
              <strong>{t('group.title')}</strong>
              <span className="text-xs" data-testid="combination-status">
                {pitPart ? t('group.singlePart') : t('group.members', { count: motion.length })}
                {motion.length > 0 && pitParts.some((p) => motion.includes(p.anchor))
                  ? ` · ${t('group.boxMembers', { count: pitParts.filter((p) => motion.includes(p.anchor)).length })}`
                  : ''}
              </span>
              <Button
                type="button"
                variant={pickedIndices.length >= 2 ? 'default' : 'outline'}
                data-testid="group-track-parts"
                disabled={pickedIndices.length < 2}
                title={t('group.note')}
                onClick={() => {
                  const next = groupTrackParts(plan, motion)
                  onChange(next)
                  selectIndices(motion)
                }}
              >
                <span aria-hidden="true">▦</span> {t('group.combine')}
              </Button>
              <Button
                type="button"
                variant={motion.length >= 2 ? 'secondary' : 'outline'}
                data-testid="ungroup-track-parts"
                disabled={motion.length < 2}
                onClick={() => {
                  const next = ungroupTrackParts(plan, motion)
                  onChange(next)
                  selectIndices(selected < 0 ? [] : [selected])
                }}
              >
                <span aria-hidden="true">⤢</span> {t('group.release')}
              </Button>
              {pitParts.length > 0 && (
                <Button
                  type="button"
                  data-testid="select-pit-carrier"
                  disabled={pitPart?.anchor === undefined}
                  onClick={() => {
                    if (pitPart?.anchor !== undefined) selectIndices(freeTrackSelection(plan, pitPart.anchor))
                  }}
                >
                  {te('pit.selectCarrier')}
                </Button>
              )}
            </div>
            {plan.roomPlan && (
              <details className="border rounded p-2" data-testid="room-background-controls" open>
                <summary>{rt('room')}</summary>
                <label>
                  <input
                    data-testid="room-background-visible"
                    type="checkbox"
                    checked={showRoom}
                    onChange={(e) => {
                      setShowRoom(e.target.checked)
                      setFrame(null)
                    }}
                  />{' '}
                  {rt('background')}
                </label>
                <p className="text-xs">{rt('backgroundNote')}</p>
                {['xMm', 'yMm'].map((key, i) => (
                  <label key={key}>
                    {rt(i ? 'originY' : 'originX')}
                    <input
                      data-testid={`room-origin-${key}`}
                      type="number"
                      step="any"
                      value={Number(anchorRoom(plan.roomPlan, plan).backgroundOrigin[key].toFixed(3))}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n) && Math.abs(n) <= 1e7) {
                          onChange({
                            ...storedPlan,
                            roomPlan: {
                              ...storedPlan.roomPlan,
                              backgroundOrigin: { ...anchorRoom(plan.roomPlan, plan).backgroundOrigin, [key]: n },
                            },
                          })
                          setFrame(null)
                        }
                      }}
                    />
                  </label>
                ))}
              </details>
            )}
            <ParallelDockingPanel
              plan={storedPlan}
              selectionRefs={selected < 0 && !selectedPitPart ? [] : dockingSelection}
              currentRef={
                pitPart?.extraIndex !== undefined && ['single', 'fuel', 'entry', 'exit'].includes(pitPart.kind)
                  ? { kind: 'extra', index: pitPart.extraIndex }
                  : active
                    ? { kind: 'rail', index: selected }
                    : null
              }
              onPreview={setDockPreview}
              onApply={(next) => {
                onChange(next)
                if (!pitPart) selectIndices(selected >= 0 ? [selected] : [])
                if (zoom === 1) setFrame(null)
              }}
            />
            {pitPart?.extraIndex !== undefined && ['single', 'fuel', 'entry', 'exit'].includes(pitPart.kind) && (
              <section data-testid="pit-individual-controls" className="border rounded-lg p-2 space-y-2">
                <strong>{te('pit.individual')}</strong>
                {['xMm', 'yMm', 'headingDegrees'].map((field) => (
                  <label key={field} className="block">
                    {te(`pit.${field}`)}
                    <input
                      type="number"
                      step="any"
                      data-testid={`pit-part-${field}`}
                      value={Number(pitPart.pose[field].toFixed(2))}
                      onChange={(e) =>
                        onChange(
                          updatePitPartWorld(storedPlan, pitPart.extraIndex, { [field]: Number(e.target.value) }),
                        )
                      }
                    />
                  </label>
                ))}
                <label className="block">
                  {te('pit.carrier')}
                  <select
                    data-testid="pit-part-carrier"
                    value={plan.trackExtras[pitPart.extraIndex].anchor ?? 'free'}
                    onChange={(e) =>
                      onChange(
                        updatePitPartWorld(storedPlan, pitPart.extraIndex, {
                          anchor: e.target.value === 'free' ? undefined : Number(e.target.value),
                        }),
                      )
                    }
                  >
                    <option value="free">{te('pit.free')}</option>
                    {plan.pieces.map((p, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {labelTrackPart(p.type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  {te('pit.level')}
                  <select
                    data-testid="pit-part-level"
                    value={
                      plan.trackExtras[pitPart.extraIndex].anchor === undefined
                        ? plan.trackExtras[pitPart.extraIndex].level
                        : plan.pieces[plan.trackExtras[pitPart.extraIndex].anchor].level
                    }
                    onChange={(e) =>
                      onChange(updatePitPartWorld(storedPlan, pitPart.extraIndex, { level: Number(e.target.value) }))
                    }
                  >
                    {[0, 1, 2].map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}
            {(active || pitPart || borderVisible(selected, layerTarget)) && (
              <details
                data-testid="drawing-layer-controls"
                className="flex flex-wrap items-center gap-2 border rounded-lg p-2 text-sm"
              >
                <summary>{t('drawLayers.title')}</summary>
                {!pitPart && (
                  <select
                    data-testid="drawing-layer-target"
                    value={layerTarget}
                    onChange={(e) => setLayerTarget(e.target.value)}
                  >
                    {['rails', 'left', 'right', 'borders'].map((v) => (
                      <option key={v} value={v} disabled={!railVisible(selected) && !borderVisible(selected, v)}>
                        {t(`drawLayers.${v}`)}
                      </option>
                    ))}
                  </select>
                )}
                {pitPart && (
                  <span>{t(pitPart.extraIndex === undefined ? 'drawLayers.pit' : 'drawLayers.component')}</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  data-testid="drawing-layer-down"
                  disabled={!drawObjects.length}
                  onClick={() => drawStep(-1)}
                >
                  {t('drawLayers.down')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="drawing-layer-up"
                  disabled={!drawObjects.length}
                  onClick={() => drawStep(1)}
                >
                  {t('drawLayers.up')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="drawing-layer-reset"
                  disabled={!drawObjects.length}
                  onClick={() => drawStep(null)}
                >
                  {t('drawLayers.reset')}
                </Button>
                <span data-testid="drawing-layer-value">
                  {drawValues.filter((n, i, a) => a.indexOf(n) === i).join(' / ')}
                </span>
                <small>{t('drawLayers.note')}</small>
              </details>
            )}
            <p className="text-xs text-muted-foreground">{t('graph.gridNote')}</p>
            {colors && <TrackTypeLegend plan={plan} />}
            {pitParts.length > 0 && (
              <details
                open={!!pitPart}
                data-testid="pitlane-component-selection"
                className="border rounded p-2 text-sm space-y-2"
              >
                <summary>{t('pitParts.combination')}</summary>
                <p>{t('pitParts.combinationNote')}</p>
                <div className="flex flex-wrap gap-2">
                  {pitParts.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      data-testid={`select-pit-component-${p.id}`}
                      aria-pressed={selectedPitPart === p.id}
                      className={`border rounded px-2 py-1 ${selectedPitPart === p.id ? 'bg-teal-100 text-teal-950' : ''}`}
                      onClick={() => selectPitPart(p.id)}
                    >
                      {p.short} · {p.article}
                    </button>
                  ))}
                </div>
                {pitPart && (
                  <p data-testid="selected-pit-component">
                    {t(`pitParts.${pitPart.kind}`)} · {pitPart.article} · {t('pitParts.componentSelection')}
                    {pitPart.anchor !== undefined && (
                      <Button
                        type="button"
                        variant="outline"
                        data-testid="select-pit-carrier"
                        onClick={() => onSelect(pitPart.anchor)}
                      >
                        {t('pitParts.carrier')}
                      </Button>
                    )}
                  </p>
                )}
              </details>
            )}
            {planDetails}
          </div>
        </aside>
      </div>
    </section>
  )
}
