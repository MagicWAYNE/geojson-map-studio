import { computed, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import {
  createLocalImageryLibrary,
  type LocalImageryAppearance,
  type LocalImageryLibrary,
  type LocalImageryUnavailableEntry
} from '@/components/map/localImageryLibrary'
import type { MapDocument } from '@/components/map/mapDocument'

export type LocalImageryRuntimeState = 'idle' | 'unsupported' | 'loading' | 'ready' | 'unavailable' | 'error'

export interface LocalImageryRuntime {
  enabled: Ref<boolean>
  targetId: Ref<string | null>
  state: Ref<LocalImageryRuntimeState>
  message: Ref<string>
  appearance: ShallowRef<LocalImageryAppearance | null>
  available: Readonly<Ref<boolean>>
  setDocument(document: MapDocument | null): void
  refresh(): Promise<void>
  reset(): void
}

function targetForDocument(document: MapDocument | null): string | null {
  return document?.source.kind === 'geojson' ? document.source.imageryTargetId ?? null : null
}

export function createLocalImageryRuntime(library: LocalImageryLibrary): LocalImageryRuntime {
  const enabled = ref(false)
  const targetId = ref<string | null>(null)
  const state = ref<LocalImageryRuntimeState>('idle')
  const message = ref('')
  const appearance = shallowRef<LocalImageryAppearance | null>(null)
  const available = computed(() => targetId.value !== null)
  let generation = 0
  let controller: AbortController | null = null
  let releaseAppearance: () => void = () => undefined

  function clearAppearance(): void {
    appearance.value = null
    releaseAppearance()
    releaseAppearance = () => undefined
  }

  async function refresh(): Promise<void> {
    const requestGeneration = ++generation
    controller?.abort(new DOMException('stale local imagery request', 'AbortError'))
    controller = null
    message.value = ''
    if (!enabled.value) {
      clearAppearance()
      state.value = 'idle'
      return
    }
    const requestedTarget = targetId.value
    if (!requestedTarget) {
      state.value = 'unsupported'
      message.value = '当前地图不是区域库目标，无法匹配本地影像。'
      return
    }
    const requestController = new AbortController()
    controller = requestController
    state.value = 'loading'
    try {
      const result = await library.resolve(requestedTarget, requestController.signal)
      if (requestGeneration !== generation || requestController.signal.aborted) {
        result.release()
        return
      }
      if (!result.appearance) {
        const entry = result.entry as LocalImageryUnavailableEntry
        state.value = 'unavailable'
        message.value = `该区域没有通过质量阈值的本地影像（最优无数据 ${(entry.noDataRatio * 100).toFixed(2)}%），已保留科技蓝外观。`
        return
      }
      clearAppearance()
      appearance.value = result.appearance
      releaseAppearance = result.release
      state.value = 'ready'
      message.value = `${result.appearance.sourceQuarter} · 本地静态影像`
    } catch (cause) {
      if (requestGeneration !== generation || requestController.signal.aborted) return
      state.value = 'error'
      message.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (controller === requestController) controller = null
    }
  }

  watch(enabled, () => { void refresh() })

  return {
    enabled,
    targetId,
    state,
    message,
    appearance,
    available,
    setDocument(document) {
      const nextTarget = targetForDocument(document)
      if (nextTarget === targetId.value) return
      targetId.value = nextTarget
      clearAppearance()
      if (!nextTarget) {
        generation += 1
        controller?.abort(new DOMException('local imagery target cleared', 'AbortError'))
        controller = null
        state.value = 'idle'
        message.value = ''
        enabled.value = false
      }
      else void refresh()
    },
    refresh,
    reset() {
      generation += 1
      controller?.abort(new DOMException('local imagery session reset', 'AbortError'))
      controller = null
      enabled.value = false
      targetId.value = null
      clearAppearance()
      state.value = 'idle'
      message.value = ''
    }
  }
}

const runtime = createLocalImageryRuntime(createLocalImageryLibrary())

export function useLocalImagery(): LocalImageryRuntime {
  return runtime
}
