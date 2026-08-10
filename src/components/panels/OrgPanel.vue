<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getServiceOrganizationOverview } from '@/api'
import type { ZzglData } from '@/types'
import iconOrg from '@/assets/images/icon-org.png'

const data = ref<ZzglData | null>(null)
const error = ref('')
onMounted(async () => {
  try {
    data.value = await getServiceOrganizationOverview()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="org-panel">
    <SubTitle title="组织架构" />
    <div v-if="error" class="err">{{ error }}</div>
    <div v-else class="body">
      <img :src="iconOrg" alt="" />
      <div class="group">
        <div class="title">合作服务机构</div>
        <div class="value">
          <NumberFlop :value="num(data?.zzgl_zz)" :font-size="28" />
          <span class="unit">家</span>
        </div>
      </div>
      <div class="group" style="left: 240px">
        <div class="title">创业导师</div>
        <div class="value">
          <NumberFlop :value="num(data?.zzgl_ry)" :font-size="28" color="#edd892" />
          <span class="unit">人</span>
        </div>
      </div>
      <div class="mini" style="top: 2px">
        <span>平均年龄</span>
        <NumberFlop :value="num(data?.zzgl_nl)" :decimals="1" :font-size="18" color="#edd892" />
      </div>
      <div class="mini" style="top: 34px">
        <span>大专及以上</span>
        <NumberFlop :value="num(data?.zzgl_xl)" :decimals="0" :font-size="18" color="#edd892" />
        <span class="unit">%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-panel { position: relative; width: 492px; height: 88px; }
.body { position: relative; margin-top: 12px; height: 60px; }
.body > img { position: absolute; left: 20px; top: 2px; width: 48px; height: 48px; }
.group { position: absolute; left: 82px; top: 0; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 4px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.mini { position: absolute; left: 361px; display: flex; align-items: baseline; gap: 6px; }
.mini span { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 20px; }
</style>
