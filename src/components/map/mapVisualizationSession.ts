import type {
  MapDocument,
  MapVisualizationDraft
} from './mapDocument'

export interface MapVisualizationSession {
  read(source: MapDocument['source']): MapVisualizationDraft | null
  replace(source: MapDocument['source'], draft: MapVisualizationDraft): void
  clear(): void
}

function sourceKey(source: MapDocument['source']): string | null {
  return source.kind === 'geojson' ? source.identity : null
}

function cloneDraft(draft: MapVisualizationDraft): MapVisualizationDraft {
  return {
    secondaryEnabled: draft.secondaryEnabled,
    labels: {
      primary: { ...draft.labels.primary },
      secondary: { ...draft.labels.secondary }
    },
    regions: draft.regions.map((region) => ({ ...region }))
  }
}

export function createMemoryMapVisualizationSession(): MapVisualizationSession {
  let active: { key: string; draft: MapVisualizationDraft } | null = null
  return {
    read(source) {
      const key = sourceKey(source)
      return key !== null && active?.key === key ? cloneDraft(active.draft) : null
    },
    replace(source, draft) {
      const key = sourceKey(source)
      if (key === null) {
        active = null
        return
      }
      active = { key, draft: cloneDraft(draft) }
    },
    clear() {
      active = null
    }
  }
}
