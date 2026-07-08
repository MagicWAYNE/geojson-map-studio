<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{ value: number; decimals?: number; duration?: number; fontSize?: number; color?: string }>(),
  { decimals: 0, duration: 1000, fontSize: 36, color: '#fff' }
)

const display = ref('0')
let raf = 0

function animate(to: number) {
  cancelAnimationFrame(raf)
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min((now - start) / props.duration, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    display.value = (to * eased).toFixed(props.decimals)
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

watch(() => props.value, (v) => animate(v), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <span class="flop" :style="{ fontSize: fontSize + 'px', color }">{{ display }}</span>
</template>

<style scoped>
.flop {
  font-family: Bebas, 'Microsoft Yahei', sans-serif;
  line-height: 1;
  letter-spacing: 1px;
}
</style>
