import {
  composeMapVisualization,
  MapImportError,
  type MapDocument,
  type MapMetricDefinition,
  type MapVisualizationDraft,
  type MapVisualizationRegionDraft,
  type PreparedMapPackage
} from './mapDocument'
import type { ActiveMapLoadResult, MapActivationOptions } from './activeMapSource'

export interface MapAuthoringRegionDraft {
  regionKey: string
  displayName: string
  enabled: boolean
  primary: string
  secondary: string
}

export interface MapAuthoringEditableDraft {
  secondaryEnabled: boolean
  labels: MapVisualizationDraft['labels']
  regions: MapAuthoringRegionDraft[]
}

export interface MapAuthoringSnapshot {
  document: MapDocument
  committed: MapVisualizationDraft
  editable: MapAuthoringEditableDraft
  dirtyMetrics: boolean
  dirtyRegionKeys: string[]
  metricError: string
  regionErrors: Readonly<Record<string, string>>
  authoringFocus: string | null
}

export type MapAuthoringCommitResult =
  | { ok: true; document: MapDocument; visualization: MapVisualizationDraft }
  | { ok: false; error: string }

export interface MapAuthoringWorkspace {
  read(): MapAuthoringSnapshot
  prefill(draft: MapVisualizationDraft): void
  setSecondaryEnabled(enabled: boolean): void
  editMetric(metric: keyof MapVisualizationDraft['labels'], patch: Partial<MapMetricDefinition>): void
  editRegion(regionKey: string, patch: Partial<Omit<MapAuthoringRegionDraft, 'regionKey'>>): void
  focusRegion(regionKey: string | null): void
  commitAll(): MapAuthoringCommitResult
  commitMetrics(): MapAuthoringCommitResult
  commitRegion(regionKey: string): MapAuthoringCommitResult
}

export interface MapAuthoringWorkspaceDependencies {
  publishVisualization?: (
    visualization: MapVisualizationDraft,
    document: MapDocument
  ) => MapDocument
}

export interface MapAuthoringGeometryIntent {
  readonly generation: number
  readonly signal: AbortSignal
}

export interface MapAuthoringSessionSnapshot {
  document: MapDocument
  prepared?: PreparedMapPackage
  workspace?: MapAuthoringSnapshot
  authoringFocus: string | null
}

export interface MapAuthoringSessionDependencies {
  activateGeometry(
    prepared: PreparedMapPackage,
    options: MapActivationOptions
  ): Promise<MapDocument>
  publishVisualization(
    prepared: PreparedMapPackage,
    visualization: MapVisualizationDraft,
    document: MapDocument
  ): MapDocument
  resetGeometry(options: MapActivationOptions): Promise<MapDocument>
}

export interface MapAuthoringSession {
  read(): MapAuthoringSessionSnapshot
  beginGeometryLoad(): MapAuthoringGeometryIntent
  loadGeometry(
    prepared: PreparedMapPackage,
    intent: MapAuthoringGeometryIntent
  ): Promise<MapDocument>
  prefill(draft: MapVisualizationDraft): void
  setSecondaryEnabled(enabled: boolean): void
  editMetric(metric: keyof MapVisualizationDraft['labels'], patch: Partial<MapMetricDefinition>): void
  editRegion(regionKey: string, patch: Partial<Omit<MapAuthoringRegionDraft, 'regionKey'>>): void
  focusRegion(regionKey: string | null): void
  commitAll(): MapAuthoringCommitResult
  commitMetrics(): MapAuthoringCommitResult
  commitRegion(regionKey: string): MapAuthoringCommitResult
  reset(): Promise<MapDocument>
}

function cloneVisualization(draft: MapVisualizationDraft): MapVisualizationDraft {
  return {
    secondaryEnabled: draft.secondaryEnabled,
    labels: {
      primary: { ...draft.labels.primary },
      secondary: { ...draft.labels.secondary }
    },
    regions: draft.regions.map((region) => ({ ...region }))
  }
}

function toEditable(draft: MapVisualizationDraft): MapAuthoringEditableDraft {
  return {
    secondaryEnabled: draft.secondaryEnabled,
    labels: {
      primary: { ...draft.labels.primary },
      secondary: { ...draft.labels.secondary }
    },
    regions: draft.regions.map((region) => ({
      regionKey: region.regionKey,
      displayName: region.displayName,
      enabled: region.enabled,
      primary: region.primary === null ? '' : String(region.primary),
      secondary: region.secondary === null ? '' : String(region.secondary)
    }))
  }
}

function fromEditable(row: MapAuthoringRegionDraft): MapVisualizationRegionDraft {
  return {
    regionKey: row.regionKey,
    displayName: row.displayName,
    enabled: row.enabled,
    primary: !row.enabled || row.primary.trim() === '' ? null : Number(row.primary),
    secondary: !row.enabled || row.secondary.trim() === '' ? null : Number(row.secondary)
  }
}

function rowIsDirty(editable: MapAuthoringRegionDraft, committed: MapVisualizationRegionDraft): boolean {
  return editable.displayName !== committed.displayName ||
    editable.enabled !== committed.enabled ||
    editable.primary !== (committed.primary === null ? '' : String(committed.primary)) ||
    editable.secondary !== (committed.secondary === null ? '' : String(committed.secondary))
}

function metricsAreDirty(editable: MapAuthoringEditableDraft, committed: MapVisualizationDraft): boolean {
  return editable.secondaryEnabled !== committed.secondaryEnabled ||
    editable.labels.primary.label !== committed.labels.primary.label ||
    editable.labels.primary.unit !== committed.labels.primary.unit ||
    editable.labels.primary.format !== committed.labels.primary.format ||
    editable.labels.secondary.label !== committed.labels.secondary.label ||
    editable.labels.secondary.unit !== committed.labels.secondary.unit ||
    editable.labels.secondary.format !== committed.labels.secondary.format
}

function errorMessage(cause: unknown): string {
  return cause instanceof MapImportError
    ? `${cause.userMessage}（${cause.path}）`
    : cause instanceof Error && cause.message ? cause.message : String(cause)
}

function allCandidate(editable: MapAuthoringEditableDraft): MapVisualizationDraft {
  return {
    secondaryEnabled: editable.secondaryEnabled,
    labels: {
      primary: { ...editable.labels.primary },
      secondary: { ...editable.labels.secondary }
    },
    regions: editable.regions.map(fromEditable)
  }
}

export function createMapAuthoringWorkspace(
  baseDocument: MapDocument,
  initialVisualization: MapVisualizationDraft,
  dependencies: MapAuthoringWorkspaceDependencies = {}
): MapAuthoringWorkspace {
  let committed = cloneVisualization(initialVisualization)
  let document = composeMapVisualization(baseDocument, committed)
  const editable = toEditable(committed)
  const regionErrors: Record<string, string> = {}
  const regionErrorPaths: Record<string, string> = {}
  let metricError = ''
  let authoringFocus: string | null = null

  function clearRegionError(regionKey: string): void {
    delete regionErrors[regionKey]
    delete regionErrorPaths[regionKey]
  }

  function clearAllRegionErrors(): void {
    Object.keys(regionErrors).forEach(clearRegionError)
  }

  function publishCandidate(candidate: MapVisualizationDraft): MapAuthoringCommitResult {
    const nextDocument = composeMapVisualization(baseDocument, candidate)
    const publishedDocument = dependencies.publishVisualization?.(
      cloneVisualization(candidate),
      nextDocument
    ) ?? nextDocument
    committed = candidate
    document = publishedDocument
    return { ok: true, document, visualization: cloneVisualization(committed) }
  }

  return {
    read() {
      const committedByKey = new Map(committed.regions.map((region) => [region.regionKey, region]))
      return {
        document,
        committed: cloneVisualization(committed),
        editable: {
          secondaryEnabled: editable.secondaryEnabled,
          labels: {
            primary: { ...editable.labels.primary },
            secondary: { ...editable.labels.secondary }
          },
          regions: editable.regions.map((region) => ({ ...region }))
        },
        dirtyMetrics: metricsAreDirty(editable, committed),
        dirtyRegionKeys: editable.regions
          .filter((region) => {
            const saved = committedByKey.get(region.regionKey)
            return saved ? rowIsDirty(region, saved) : true
          })
          .map((region) => region.regionKey),
        metricError,
        regionErrors: { ...regionErrors },
        authoringFocus
      }
    },

    prefill(draft) {
      composeMapVisualization(baseDocument, draft)
      const next = toEditable(draft)
      editable.secondaryEnabled = next.secondaryEnabled
      editable.labels = next.labels
      editable.regions.splice(0, editable.regions.length, ...next.regions)
      metricError = ''
      clearAllRegionErrors()
    },

    editMetric(metric, patch) {
      Object.assign(editable.labels[metric], patch)
      metricError = ''
    },

    setSecondaryEnabled(enabled) {
      editable.secondaryEnabled = enabled
      metricError = ''
      if (!enabled) {
        Object.entries(regionErrorPaths)
          .filter(([, path]) => path.endsWith('.secondary'))
          .forEach(([regionKey]) => clearRegionError(regionKey))
      }
    },

    editRegion(regionKey, patch) {
      const row = editable.regions.find((candidate) => candidate.regionKey === regionKey)
      if (!row) throw new Error(`未知地图分块：${regionKey}`)
      Object.assign(row, patch)
      clearRegionError(regionKey)
    },

    focusRegion(regionKey) {
      if (regionKey !== null && !editable.regions.some((region) => region.regionKey === regionKey)) {
        throw new Error(`未知地图分块：${regionKey}`)
      }
      authoringFocus = regionKey
    },

    commitAll() {
      const candidate = allCandidate(editable)
      try {
        const result = publishCandidate(candidate)
        metricError = ''
        clearAllRegionErrors()
        const normalized = toEditable(committed)
        editable.secondaryEnabled = normalized.secondaryEnabled
        Object.assign(editable.labels.primary, normalized.labels.primary)
        Object.assign(editable.labels.secondary, normalized.labels.secondary)
        editable.regions.forEach((row, index) => Object.assign(row, normalized.regions[index]))
        return result
      } catch (cause) {
        const message = errorMessage(cause)
        if (cause instanceof MapImportError) {
          const match = /^regions\[(\d+)]/.exec(cause.path)
          const row = match ? editable.regions[Number(match[1])] : undefined
          if (row) {
            const error = `${row.regionKey}：${message}`
            regionErrors[row.regionKey] = error
            regionErrorPaths[row.regionKey] = cause.path
            return { ok: false, error }
          }
        }
        metricError = message
        return { ok: false, error: message }
      }
    },

    commitMetrics() {
      const candidate = cloneVisualization(committed)
      candidate.secondaryEnabled = editable.secondaryEnabled
      candidate.labels = {
        primary: { ...editable.labels.primary },
        secondary: { ...editable.labels.secondary }
      }
      try {
        const result = publishCandidate(candidate)
        metricError = ''
        return result
      } catch (cause) {
        const error = errorMessage(cause)
        metricError = error
        return { ok: false, error }
      }
    },

    commitRegion(regionKey) {
      const editableRow = editable.regions.find((candidate) => candidate.regionKey === regionKey)
      const index = committed.regions.findIndex((candidate) => candidate.regionKey === regionKey)
      if (!editableRow || index < 0) {
        const error = `未知地图分块：${regionKey}`
        regionErrors[regionKey] = error
        return { ok: false, error }
      }
      const candidate = cloneVisualization(committed)
      candidate.regions[index] = fromEditable(editableRow)
      try {
        const result = publishCandidate(candidate)
        Object.assign(editableRow, toEditable(candidate).regions[index])
        clearRegionError(regionKey)
        return result
      } catch (cause) {
        const error = `${regionKey}：${errorMessage(cause)}`
        clearRegionError(regionKey)
        regionErrors[regionKey] = error
        if (cause instanceof MapImportError) regionErrorPaths[regionKey] = cause.path
        return { ok: false, error }
      }
    }
  }
}

export function createMapAuthoringSession(
  initialLoad: ActiveMapLoadResult,
  dependencies: MapAuthoringSessionDependencies
): MapAuthoringSession {
  let document = initialLoad.document
  let prepared = initialLoad.custom?.prepared
  let workspace: MapAuthoringWorkspace | undefined
  let geometryGeneration = 0
  let geometryController: AbortController | undefined

  function installWorkspace(
    nextPrepared: PreparedMapPackage,
    visualization: MapVisualizationDraft
  ): void {
    prepared = nextPrepared
    workspace = createMapAuthoringWorkspace(
      nextPrepared.document,
      visualization,
      {
        publishVisualization(nextVisualization, nextDocument) {
          document = dependencies.publishVisualization(
            nextPrepared,
            nextVisualization,
            nextDocument
          )
          return document
        }
      }
    )
  }

  if (prepared && initialLoad.custom) {
    installWorkspace(prepared, initialLoad.custom.visualization)
  }

  function requireWorkspace(): MapAuthoringWorkspace {
    if (!workspace) throw new Error('请先上传并校验 GeoJSON 边界文件')
    return workspace
  }

  function beginGeometryLoad(): MapAuthoringGeometryIntent {
    geometryController?.abort(new DOMException('stale geometry activation', 'AbortError'))
    geometryController = new AbortController()
    geometryGeneration += 1
    return {
      generation: geometryGeneration,
      signal: geometryController.signal
    }
  }

  function assertCurrent(intent: MapAuthoringGeometryIntent): void {
    intent.signal.throwIfAborted()
    if (intent.generation !== geometryGeneration) {
      throw new DOMException('stale geometry activation', 'AbortError')
    }
  }

  function publish(result: MapAuthoringCommitResult): MapAuthoringCommitResult {
    if (result.ok) document = result.document
    return result
  }

  return {
    read() {
      const workspaceSnapshot = workspace?.read()
      return {
        document,
        prepared,
        workspace: workspaceSnapshot,
        authoringFocus: workspaceSnapshot?.authoringFocus ?? null
      }
    },

    beginGeometryLoad,

    async loadGeometry(nextPrepared, intent) {
      assertCurrent(intent)
      const nextDocument = await dependencies.activateGeometry(nextPrepared, {
        signal: intent.signal
      })
      assertCurrent(intent)
      document = nextDocument
      installWorkspace(nextPrepared, nextPrepared.visualization)
      return document
    },

    prefill(draft) {
      requireWorkspace().prefill(draft)
    },

    editMetric(metric, patch) {
      requireWorkspace().editMetric(metric, patch)
    },

    setSecondaryEnabled(enabled) {
      requireWorkspace().setSecondaryEnabled(enabled)
    },

    editRegion(regionKey, patch) {
      requireWorkspace().editRegion(regionKey, patch)
    },

    focusRegion(regionKey) {
      if (!workspace && regionKey === null) return
      requireWorkspace().focusRegion(regionKey)
    },

    commitAll() {
      return publish(requireWorkspace().commitAll())
    },

    commitMetrics() {
      return publish(requireWorkspace().commitMetrics())
    },

    commitRegion(regionKey) {
      return publish(requireWorkspace().commitRegion(regionKey))
    },

    async reset() {
      const intent = beginGeometryLoad()
      const nextDocument = await dependencies.resetGeometry({ signal: intent.signal })
      assertCurrent(intent)
      document = nextDocument
      prepared = undefined
      workspace = undefined
      return document
    }
  }
}
