import {
  prepareGeoJsonMapPackage,
  type MapDocument,
  type PersistedMapPackage,
  type PreparedMapPackage
} from './mapDocument'

export interface MapPackageStore {
  readActive(): Promise<unknown>
  writeActive(value: PersistedMapPackage): Promise<void>
  deleteActive(): Promise<void>
}

export type MapSourceWarningCode =
  | 'storage-read-failed'
  | 'unsupported-record'
  | 'invalid-record'

export interface MapSourceWarning {
  code: MapSourceWarningCode
  message: string
}

export interface ActiveMapLoadResult {
  document: MapDocument
  warnings: MapSourceWarning[]
}

export interface ActiveMapSource {
  load(): Promise<ActiveMapLoadResult>
  activate(prepared: PreparedMapPackage): Promise<MapDocument>
  resetToBuiltin(): Promise<MapDocument>
}

export interface ActiveMapSourceDependencies {
  store: MapPackageStore
  loadBuiltin: () => Promise<MapDocument>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function persistedPackage(value: unknown): PersistedMapPackage | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.geometryText !== 'string' ||
    typeof value.geometryFileName !== 'string' ||
    !value.geometryFileName ||
    typeof value.nameProperty !== 'string' ||
    !value.nameProperty ||
    (value.metricsText !== undefined && typeof value.metricsText !== 'string')
  ) return null
  return {
    version: 1,
    geometryText: value.geometryText,
    geometryFileName: value.geometryFileName,
    nameProperty: value.nameProperty,
    ...(value.metricsText === undefined ? {} : { metricsText: value.metricsText })
  }
}

function failureMessage(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : String(cause)
}

export function createActiveMapSource(
  dependencies: ActiveMapSourceDependencies
): ActiveMapSource {
  const loadBuiltin = async (warnings: MapSourceWarning[]): Promise<ActiveMapLoadResult> => ({
    document: await dependencies.loadBuiltin(),
    warnings
  })

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
      if (stored === null || stored === undefined) return loadBuiltin([])
      const persisted = persistedPackage(stored)
      if (!persisted) {
        return loadBuiltin([{
          code: 'unsupported-record',
          message: '已保存地图版本不受支持，已回退内置地图'
        }])
      }
      try {
        return {
          document: prepareGeoJsonMapPackage({
            geometryText: persisted.geometryText,
            geometryFileName: persisted.geometryFileName,
            nameProperty: persisted.nameProperty,
            ...(persisted.metricsText === undefined ? {} : { metricsText: persisted.metricsText })
          }).document,
          warnings: []
        }
      } catch (cause) {
        return loadBuiltin([{
          code: 'invalid-record',
          message: `已保存地图损坏，已回退内置地图：${failureMessage(cause)}`
        }])
      }
    },

    async activate(prepared: PreparedMapPackage): Promise<MapDocument> {
      await dependencies.store.writeActive(prepared.persisted)
      return prepared.document
    },

    async resetToBuiltin(): Promise<MapDocument> {
      await dependencies.store.deleteActive()
      return dependencies.loadBuiltin()
    }
  }
}
