import { createActiveMapSource } from './activeMapSource'
import { loadBuiltinMapDocument } from './builtinMapDocument'
import { createIndexedDbMapPackageStore } from './indexedDbMapPackageStore'

export const activeMapSource = createActiveMapSource({
  store: createIndexedDbMapPackageStore(),
  loadBuiltin: loadBuiltinMapDocument
})
