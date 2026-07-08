import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { XYItem } from '@/types'

const AXIS_LABEL = { color: '#90a3c8', fontSize: 12, fontFamily: 'OPPOSans-R' }
const SPLIT_LINE = { lineStyle: { color: 'rgba(144,163,200,0.15)' } }

/** colorField 去重（保留首次出现顺序）作为系列名 */
function seriesNames(list: XYItem[]): string[] {
  return [...new Set(list.map((i) => i.colorField))]
}

function categories(list: XYItem[]): string[] {
  return [...new Set(list.map((i) => i.x))]
}

function seriesData(list: XYItem[], name: string, cats: string[]): number[] {
  return cats.map((c) => list.find((i) => i.x === c && i.colorField === name)?.y ?? 0)
}

/** 蓝/金双系列柱状图（质效分析·还款结构） */
export function buildDoubleBarOption(list: XYItem[], opts: { xLabelInterval?: number } = {}): EChartsOption {
  const cats = categories(list)
  const names = seriesNames(list)
  const gradients: [string, string][] = [
    ['#75a4ff', 'rgba(25,82,191,0.05)'],
    ['#ffc65e', 'rgba(255,198,94,0.05)']
  ]
  return {
    legend: {
      top: 0, right: 8, itemWidth: 10, itemHeight: 10, itemGap: 18,
      textStyle: { color: '#a5bde5', fontSize: 12, fontFamily: 'OPPOSans-R' }
    },
    grid: { left: 8, right: 8, top: 30, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,18,40,0.92)', borderColor: '#2483FF',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    xAxis: {
      type: 'category', data: cats,
      axisLabel: { ...AXIS_LABEL, interval: opts.xLabelInterval ?? 0 },
      axisLine: { lineStyle: { color: 'rgba(144,163,200,0.3)' } },
      axisTick: { show: false }
    },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: names.map((nm, idx) => ({
      name: nm, type: 'bar' as const, barWidth: 5, barGap: '60%',
      data: seriesData(list, nm, cats),
      itemStyle: {
        borderRadius: [2, 2, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: gradients[idx % 2][0] },
          { offset: 1, color: gradients[idx % 2][1] }
        ])
      }
    }))
  }
}

/** 多折线图（电询转办·月度趋势），areaSeries 指定的系列带渐变面积 */
export function buildMultiLineOption(
  list: XYItem[],
  seriesColors: Record<string, string>,
  opts: { areaSeries?: string } = {}
): EChartsOption {
  const cats = categories(list)
  const names = seriesNames(list)
  return {
    legend: {
      top: 0, right: 8, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 18,
      textStyle: { color: '#a5bde5', fontSize: 12, fontFamily: 'OPPOSans-R' }
    },
    grid: { left: 8, right: 12, top: 30, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,18,40,0.92)', borderColor: '#2483FF',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    xAxis: {
      type: 'category', data: cats, boundaryGap: false,
      axisLabel: AXIS_LABEL,
      axisLine: { lineStyle: { color: 'rgba(144,163,200,0.3)' } },
      axisTick: { show: false }
    },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: names.map((nm) => {
      const color = seriesColors[nm] ?? '#2e82db'
      return {
        name: nm, type: 'line' as const, smooth: true, symbol: 'circle', symbolSize: 5,
        data: seriesData(list, nm, cats),
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle:
          opts.areaSeries === nm
            ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(94,146,255,0.45)' },
                  { offset: 1, color: 'rgba(9,82,171,0)' }
                ])
              }
            : undefined
      }
    })
  }
}
