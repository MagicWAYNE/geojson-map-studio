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
  writeActive(value: PersistedMapPackage, signal?: AbortSignal): Promise<void>
  deleteActive(signal?: AbortSignal): Promise<void>
}

export interface MapActivationOptions {
  signal?: AbortSignal
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
  activate(
    prepared: PreparedMapPackage,
    visualization?: MapVisualizationDraft,
    options?: MapActivationOptions
  ): Promise<MapDocument>
  updateVisualization(prepared: PreparedMapPackage, visualization: MapVisualizationDraft): MapDocument
  resetToBuiltin(options?: MapActivationOptions): Promise<MapDocument>
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
  let currentCustom: {
    document: MapDocument
    prepared: PreparedMapPackage
    visualization: MapVisualizationDraft
  } | null = null

  const loadBuiltin = async (warnings: MapSourceWarning[]): Promise<ActiveMapLoadResult> => {
    const document = await dependencies.loadBuiltin()
    dependencies.session.clear()
    currentCustom = null
    return {
      document,
      warnings
    }
  }

  const recoverFromFailure = async (
    warnings: MapSourceWarning[]
  ): Promise<ActiveMapLoadResult> => currentCustom
    ? {
        document: currentCustom.document,
        warnings,
        custom: {
          prepared: currentCustom.prepared,
          visualization: currentCustom.visualization
        }
      }
    : loadBuiltin(warnings)

  return {
    async load(): Promise<ActiveMapLoadResult> {
      let stored: unknown
      try {
        stored = await dependencies.store.readActive()
      } catch (cause) {
        return recoverFromFailure([{
          code: 'storage-read-failed',
          message: `读取已保存地图失败，当前可用地图保持不变：${failureMessage(cause)}`
        }])
      }
      if (stored === null || stored === undefined) {
        return loadBuiltin([])
      }
      const storedPackage = persistedPackage(stored)
      if (!storedPackage) {
        return recoverFromFailure([{
          code: 'unsupported-record',
          message: '已保存地图版本不受支持，当前可用地图保持不变'
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
        const document = composeMapVisualization(prepared.document, visualization)
        currentCustom = { document, prepared, visualization }
        return {
          document,
          warnings,
          custom: { prepared, visualization }
        }
      } catch (cause) {
        return recoverFromFailure([{
          code: 'invalid-record',
          message: `已保存地图损坏，当前可用地图保持不变：${failureMessage(cause)}`
        }])
      }
    },

    async activate(
      prepared: PreparedMapPackage,
      visualization = prepared.visualization,
      options: MapActivationOptions = {}
    ): Promise<MapDocument> {
      options.signal?.throwIfAborted()
      const document = composeMapVisualization(prepared.document, visualization)
      await dependencies.store.writeActive(prepared.persisted, options.signal)
      options.signal?.throwIfAborted()
      dependencies.session.replace(prepared.document.source, visualization)
      currentCustom = { document, prepared, visualization }
      return document
    },

    updateVisualization(
      prepared: PreparedMapPackage,
      visualization: MapVisualizationDraft
    ): MapDocument {
      const requestedIdentity = prepared.document.source.kind === 'geojson'
        ? prepared.document.source.identity
        : null
      const activeIdentity = currentCustom?.prepared.document.source.kind === 'geojson'
        ? currentCustom.prepared.document.source.identity
        : null
      if (requestedIdentity === null || requestedIdentity !== activeIdentity || !currentCustom) {
        throw new Error('业务数据只能更新当前激活地图')
      }
      const document = composeMapVisualization(currentCustom.prepared.document, visualization)
      dependencies.session.replace(currentCustom.prepared.document.source, visualization)
      currentCustom = {
        document,
        prepared: currentCustom.prepared,
        visualization
      }
      return document
    },

    async resetToBuiltin(options: MapActivationOptions = {}): Promise<MapDocument> {
      options.signal?.throwIfAborted()
      const document = await dependencies.loadBuiltin()
      options.signal?.throwIfAborted()
      await dependencies.store.deleteActive(options.signal)
      options.signal?.throwIfAborted()
      dependencies.session.clear()
      currentCustom = null
      return document
    }
  }
}
