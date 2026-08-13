import {
  composeMapVisualization,
  prepareGeoJsonMapPackage,
  type MapDocument,
  type MapVisualizationDraft,
  type PersistedMapPackage,
  type PreparedMapPackage
} from './mapDocument'
import type { MapVisualizationSession } from './mapVisualizationSession'

export interface MapPackageStore {
  readActive(): Promise<unknown>
  writeActive(value: PersistedMapPackage): Promise<void>
  deleteActive(): Promise<void>
}

export type MapSourceWarningCode =
  | 'storage-read-failed'
  | 'unsupported-record'
  | 'invalid-record'
  | 'legacy-migration-failed'

export interface MapSourceWarning {
  code: MapSourceWarningCode
  message: string
}

export interface ActiveMapLoadResult {
  document: MapDocument
  warnings: MapSourceWarning[]
  custom?: {
    prepared: PreparedMapPackage
    visualization: MapVisualizationDraft
  }
}

export interface ActiveMapSource {
  load(): Promise<ActiveMapLoadResult>
  activate(prepared: PreparedMapPackage, visualization?: MapVisualizationDraft): Promise<MapDocument>
  resetToBuiltin(): Promise<MapDocument>
}

export interface ActiveMapSourceDependencies {
  store: MapPackageStore
  session: MapVisualizationSession
  loadBuiltin: () => Promise<MapDocument>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface StoredMapPackage {
  persisted: PersistedMapPackage
  legacy: boolean
}

function persistedPackage(value: unknown): StoredMapPackage | null {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    typeof value.geometryText !== 'string' ||
    typeof value.geometryFileName !== 'string' ||
    !value.geometryFileName ||
    typeof value.nameProperty !== 'string' ||
    !value.nameProperty ||
    (value.version === 1 && value.metricsText !== undefined && typeof value.metricsText !== 'string') ||
    (value.version === 2 && value.metricsText !== undefined)
  ) return null
  return {
    persisted: {
      version: 2,
      geometryText: value.geometryText,
      geometryFileName: value.geometryFileName,
      nameProperty: value.nameProperty
    },
    legacy: value.version === 1
  }
}

function failureMessage(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : String(cause)
}

export function createActiveMapSource(
  dependencies: ActiveMapSourceDependencies
): ActiveMapSource {
  const loadBuiltin = async (warnings: MapSourceWarning[]): Promise<ActiveMapLoadResult> => {
    dependencies.session.clear()
    return {
      document: await dependencies.loadBuiltin(),
      warnings
    }
  }

  return {
    async load(): Promise<ActiveMapLoadResult> {
      let stored: unknown
      try {
        stored = await dependencies.store.readActive()
      } catch (cause) {
        return loadBuiltin([{
          code: 'storage-read-failed',
          message: `读取已保存地图失败，已回退内置地图：${failureMessage(cause)}`
        }])
      }
      if (stored === null || stored === undefined) {
        dependencies.session.clear()
        return loadBuiltin([])
      }
      const storedPackage = persistedPackage(stored)
      if (!storedPackage) {
        dependencies.session.clear()
        return loadBuiltin([{
          code: 'unsupported-record',
          message: '已保存地图版本不受支持，已回退内置地图'
        }])
      }
      try {
        const prepared = prepareGeoJsonMapPackage({
          geometryText: storedPackage.persisted.geometryText,
          geometryFileName: storedPackage.persisted.geometryFileName,
          nameProperty: storedPackage.persisted.nameProperty
        })
        const visualization = dependencies.session.read(prepared.document.source) ?? prepared.visualization
        const warnings: MapSourceWarning[] = []
        if (storedPackage.legacy) {
          try {
            await dependencies.store.writeActive(prepared.persisted)
          } catch (cause) {
            warnings.push({
              code: 'legacy-migration-failed',
              message: `旧地图记录已忽略业务数据，但迁移 geometry-only 记录失败：${failureMessage(cause)}`
            })
          }
        }
        return {
          document: composeMapVisualization(prepared.document, visualization),
          warnings,
          custom: { prepared, visualization }
        }
      } catch (cause) {
        dependencies.session.clear()
        return loadBuiltin([{
          code: 'invalid-record',
          message: `已保存地图损坏，已回退内置地图：${failureMessage(cause)}`
        }])
      }
    },

    async activate(
      prepared: PreparedMapPackage,
      visualization = prepared.visualization
    ): Promise<MapDocument> {
      const document = composeMapVisualization(prepared.document, visualization)
      await dependencies.store.writeActive(prepared.persisted)
      dependencies.session.replace(prepared.document.source, visualization)
      return document
    },

    async resetToBuiltin(): Promise<MapDocument> {
      await dependencies.store.deleteActive()
      dependencies.session.clear()
      return dependencies.loadBuiltin()
    }
  }
}
