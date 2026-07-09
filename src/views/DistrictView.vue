<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import HeaderBar from '@/components/layout/HeaderBar.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import ChongqingMap from '@/components/map/ChongqingMap.vue'
import { useECharts } from '@/composables/useECharts'
import { buildDoubleBarOption, buildMultiLineOption } from '@/utils/chartOptions'
import { getDistrictDetail } from '@/api'
import type { DistrictDetail, DistrictKpi } from '@/types'
import bgMain from '@/assets/images/bg-main.png'

const props = defineProps<{ name: string }>()
const router = useRouter()

const detail = ref<DistrictDetail | null>(null)
const notFound = ref(false)
const error = ref('')

const barEl = ref<HTMLElement | null>(null)
const lineEl = ref<HTMLElement | null>(null)
const { setOption: setBar } = useECharts(barEl)
const { setOption: setLine } = useECharts(lineEl)

const LINE_COLORS: Record<string, string> = { 询问: '#2e82db', 转办: '#edd892', 有责: '#44ffa2' }

interface KpiCard {
  key: keyof DistrictKpi
  title: string
  suffix: string
}
const KPI_CARDS: KpiCard[] = [
  { key: 'tj', title: '累计调解案件', suffix: '万件' },
  { key: 'kl', title: '当事人可联案件', suffix: '万件' },
  { key: 'tc', title: '实际调成案件', suffix: '万件' },
  { key: 'month_tj', title: '当月调解案件', suffix: '万件' },
  { key: 'yx', title: '累计履行金额', suffix: '万元' },
  { key: 'month_yx', title: '及时履行金额', suffix: '万元' }
]

const ORG_COLUMNS: ScrollColumn[] = [
  { key: 'lx', title: '调解组织', width: '40%' },
  { key: 'rs', title: '人员', width: '15%', align: 'center', numeric: true },
  { key: 'dx', title: '电询', width: '15%', align: 'center', color: '#edd892', numeric: true },
  { key: 'bwt', title: '被委托案', width: '30%', align: 'center', numeric: true }
]

async function load() {
  try {
    error.value = ''
    notFound.value = false
    detail.value = await getDistrictDetail(props.name)
    if (!detail.value) {
      notFound.value = true
      return
    }
    setBar(buildDoubleBarOption(detail.value.huankuan), true)
    setLine(buildMultiLineOption(detail.value.trend, LINE_COLORS, { areaSeries: '询问' }), true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
onMounted(load)
watch(() => props.name, load)

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="district">
    <img class="bg" :src="bgMain" alt="" />
    <HeaderBar />
    <div class="back" @click="router.push('/')">‹ 返回总览</div>

    <div v-if="error" class="center-tip">
      <p>{{ error }}</p>
      <button @click="router.push('/')">返回主屏</button>
    </div>
    <div v-else-if="notFound" class="center-tip">
      <p>未找到该区县：{{ name }}</p>
      <button @click="router.push('/')">返回主屏</button>
    </div>
    <template v-else-if="detail">
      <h2 class="district-name">{{ name }} · 调解态势</h2>

      <div class="kpi-grid">
        <div v-for="c in KPI_CARDS" :key="c.key" class="kpi-card">
          <div class="title">{{ c.title }}</div>
          <div class="value">
            <NumberFlop :value="num(detail.kpi[c.key])" :decimals="2" :font-size="30" />
            <span class="suffix">{{ c.suffix }}</span>
          </div>
        </div>
      </div>

      <ChongqingMap class="pos-map" :focus="name" :show-lines="false" />

      <div class="right-col">
        <SubTitle title="还款结构（近6月）" :width="460" />
        <div ref="barEl" class="chart" />
        <SubTitle title="电询转办月度趋势" :width="460" />
        <div ref="lineEl" class="chart" />
        <SubTitle title="调解组织" :width="460" />
        <ScrollTable :columns="ORG_COLUMNS" :rows="(detail.orgs as unknown as Record<string, unknown>[])" :height="200" :row-height="36" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.district { position: absolute; inset: 0; overflow: hidden; }
.bg { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.back {
  position: absolute; left: 36px; top: 110px; z-index: 30; padding: 6px 18px;
  font-family: 'OPPOSans-R'; font-size: 16px; color: #a5bde5; cursor: pointer;
  border: 1px solid rgba(36, 131, 255, 0.5); border-radius: 2px;
  background: linear-gradient(180deg, #1f335e, #111c2e);
}
.back:hover { color: #fff; border-color: #00deff; }
.district-name {
  position: absolute; left: 36px; top: 152px;
  font-family: 'YouSheBiaoTiHei'; font-size: 34px; font-weight: normal; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.kpi-grid {
  position: absolute; left: 36px; top: 220px; width: 400px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px 16px;
}
.kpi-card {
  padding: 14px 16px; border: 1px solid rgba(36, 131, 255, 0.25); border-radius: 2px;
  background: linear-gradient(180deg, rgba(12, 40, 90, 0.5), rgba(5, 20, 50, 0.6));
}
.kpi-card .title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 8px; }
.kpi-card .value { display: flex; align-items: baseline; gap: 6px; }
.kpi-card .suffix { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.pos-map { position: absolute; left: 480px; top: 180px; width: 900px; height: 780px; }
.right-col { position: absolute; left: 1420px; top: 180px; width: 460px; display: flex; flex-direction: column; gap: 10px; }
.right-col .chart { width: 460px; height: 230px; }
.center-tip {
  position: absolute; inset: 0; display: flex; flex-direction: column; gap: 20px;
  align-items: center; justify-content: center; font-size: 24px; color: #a5bde5;
}
.center-tip button {
  padding: 8px 28px; font-size: 16px; color: #fff; cursor: pointer;
  background: linear-gradient(180deg, #2a4a8a, #16233d);
  border: 1px solid #2483ff; border-radius: 2px;
}
</style>
