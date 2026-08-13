import { createActiveMapSource } from './activeMapSource'
import { loadBuiltinMapDocument } from './builtinMapDocument'
import { createIndexedDbMapPackageStore } from './indexedDbMapPackageStore'
import { createMemoryMapVisualizationSession } from './mapVisualizationSession'

export const activeMapSource = createActiveMapSource({
  store: createIndexedDbMapPackageStore(),
  session: createMemoryMapVisualizationSession(),
  loadBuiltin: loadBuiltinMapDocument
})
