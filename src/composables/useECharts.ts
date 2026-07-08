import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from 'vue'
import type { EChartsOption } from 'echarts'

/**
 * 图表生命周期管理：容器出现时初始化（含 v-if 延迟渲染的容器）、尺寸自适应、卸载销毁。
 * setOption 在图表尚未初始化时暂存 option，容器就绪后自动应用。
 */
export function useECharts(el: Ref<HTMLElement | null>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let ro: ResizeObserver | null = null
  let pending: EChartsOption | null = null
  let pendingNotMerge = false

  function dispose() {
    ro?.disconnect()
    ro = null
    chart.value?.dispose()
    chart.value = null
  }

  function tryInit() {
    if (!el.value) return
    if (chart.value) {
      if (chart.value.getDom() === el.value) return
      dispose() // 容器被 v-if 重建，旧实例挂在游离节点上
    }
    chart.value = echarts.init(el.value)
    if (pending) {
      chart.value.setOption(pending, { notMerge: pendingNotMerge })
      pending = null
    }
    ro = new ResizeObserver(() => chart.value?.resize())
    ro.observe(el.value)
  }

  onMounted(tryInit)
  watch(el, tryInit)
  onBeforeUnmount(dispose)

  function setOption(option: EChartsOption, notMerge = false) {
    if (chart.value) {
      chart.value.setOption(option, { notMerge })
    } else {
      pending = option
      pendingNotMerge = notMerge
    }
  }

  return { chart, setOption }
}
