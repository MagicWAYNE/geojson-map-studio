import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue'
import type { EChartsOption } from 'echarts'

/**
 * 图表生命周期管理：挂载初始化、容器尺寸自适应、卸载销毁。
 * setOption 在图表尚未初始化时暂存 option，初始化后自动应用（数据先于挂载到达的场景）。
 */
export function useECharts(el: Ref<HTMLElement | null>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let ro: ResizeObserver | null = null
  let pending: EChartsOption | null = null
  let pendingNotMerge = false

  onMounted(() => {
    if (!el.value) return
    chart.value = echarts.init(el.value)
    if (pending) {
      chart.value.setOption(pending, { notMerge: pendingNotMerge })
      pending = null
    }
    ro = new ResizeObserver(() => chart.value?.resize())
    ro.observe(el.value)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    chart.value?.dispose()
    chart.value = null
  })

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
