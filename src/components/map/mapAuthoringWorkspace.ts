import {
  composeMapVisualization,
  MapImportError,
  type MapDocument,
  type MapVisualizationDraft,
  type MapVisualizationRegionDraft
} from './mapDocument'

export interface MapAuthoringRegionDraft {
  regionKey: string
  displayName: string
  enabled: boolean
  primary: string
  secondary: string
}

export interface MapAuthoringEditableDraft {
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
}

export type MapAuthoringCommitResult =
  | { ok: true; document: MapDocument; visualization: MapVisualizationDraft }
  | { ok: false; error: string }

export interface MapAuthoringWorkspace {
  read(): MapAuthoringSnapshot
  prefill(draft: MapVisualizationDraft): void
  editMetric(metric: keyof MapVisualizationDraft['labels'], patch: Partial<{ label: string; unit: string }>): void
  editRegion(regionKey: string, patch: Partial<Omit<MapAuthoringRegionDraft, 'regionKey'>>): void
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

function cloneVisualization(draft: MapVisualizationDraft): MapVisualizationDraft {
  return {
    labels: {
      primary: { ...draft.labels.primary },
      secondary: { ...draft.labels.secondary }
    },
    regions: draft.regions.map((region) => ({ ...region }))
  }
}

function toEditable(draft: MapVisualizationDraft): MapAuthoringEditableDraft {
  return {
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
  return editable.labels.primary.label !== committed.labels.primary.label ||
    editable.labels.primary.unit !== committed.labels.primary.unit ||
    editable.labels.secondary.label !== committed.labels.secondary.label ||
    editable.labels.secondary.unit !== committed.labels.secondary.unit
}

function errorMessage(cause: unknown): string {
  return cause instanceof MapImportError
    ? `${cause.userMessage}（${cause.path}）`
    : cause instanceof Error && cause.message ? cause.message : String(cause)
}

function allCandidate(editable: MapAuthoringEditableDraft): MapVisualizationDraft {
  return {
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
  let metricError = ''

  return {
    read() {
      const committedByKey = new Map(committed.regions.map((region) => [region.regionKey, region]))
      return {
        document,
        committed: cloneVisualization(committed),
        editable: {
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
        regionErrors: { ...regionErrors }
      }
    },

    prefill(draft) {
      composeMapVisualization(baseDocument, draft)
      const next = toEditable(draft)
      editable.labels = next.labels
      editable.regions.splice(0, editable.regions.length, ...next.regions)
      metricError = ''
      Object.keys(regionErrors).forEach((key) => delete regionErrors[key])
    },

    editMetric(metric, patch) {
      Object.assign(editable.labels[metric], patch)
      metricError = ''
    },

    editRegion(regionKey, patch) {
      const row = editable.regions.find((candidate) => candidate.regionKey === regionKey)
      if (!row) throw new Error(`未知地图分块：${regionKey}`)
      Object.assign(row, patch)
      delete regionErrors[regionKey]
    },

    commitAll() {
      const candidate = allCandidate(editable)
      try {
        const nextDocument = composeMapVisualization(baseDocument, candidate)
        const publishedDocument = dependencies.publishVisualization?.(
          cloneVisualization(candidate),
          nextDocument
        ) ?? nextDocument
        committed = candidate
        document = publishedDocument
        metricError = ''
        Object.keys(regionErrors).forEach((key) => delete regionErrors[key])
        const normalized = toEditable(committed)
        Object.assign(editable.labels.primary, normalized.labels.primary)
        Object.assign(editable.labels.secondary, normalized.labels.secondary)
        editable.regions.forEach((row, index) => Object.assign(row, normalized.regions[index]))
        return { ok: true, document, visualization: cloneVisualization(committed) }
      } catch (cause) {
        const message = errorMessage(cause)
        if (cause instanceof MapImportError) {
          const match = /^regions\[(\d+)]/.exec(cause.path)
          const row = match ? editable.regions[Number(match[1])] : undefined
          if (row) {
            const error = `${row.regionKey}：${message}`
            regionErrors[row.regionKey] = error
            return { ok: false, error }
          }
        }
        metricError = message
        return { ok: false, error: message }
      }
    },

    commitMetrics() {
      const candidate = cloneVisualization(committed)
      candidate.labels = {
        primary: { ...editable.labels.primary },
        secondary: { ...editable.labels.secondary }
      }
      try {
        const nextDocument = composeMapVisualization(baseDocument, candidate)
        const publishedDocument = dependencies.publishVisualization?.(
          cloneVisualization(candidate),
          nextDocument
        ) ?? nextDocument
        committed = candidate
        document = publishedDocument
        metricError = ''
        return { ok: true, document, visualization: cloneVisualization(committed) }
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
        const nextDocument = composeMapVisualization(baseDocument, candidate)
        const publishedDocument = dependencies.publishVisualization?.(
          cloneVisualization(candidate),
          nextDocument
        ) ?? nextDocument
        committed = candidate
        document = publishedDocument
        Object.assign(editableRow, toEditable(candidate).regions[index])
        delete regionErrors[regionKey]
        return { ok: true, document, visualization: cloneVisualization(committed) }
      } catch (cause) {
        const error = `${regionKey}：${errorMessage(cause)}`
        regionErrors[regionKey] = error
        return { ok: false, error }
      }
    }
  }
}
