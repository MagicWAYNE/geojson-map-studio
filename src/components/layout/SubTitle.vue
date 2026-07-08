<script setup lang="ts">
withDefaults(defineProps<{ title: string; extra?: string; width?: number }>(), { extra: '', width: 492 })
</script>

<template>
  <div class="sub-title" :style="{ width: width + 'px' }">
    <i />
    <span>{{ title }}</span>
    <em v-if="extra">{{ extra }}</em>
    <div class="line" />
  </div>
</template>

<style scoped>
.sub-title { display: flex; align-items: center; height: 20px; gap: 8px; }
.sub-title i { width: 8px; height: 8px; background: #2483ff; transform: skewX(-12deg); flex: none; }
.sub-title span { font-family: 'OPPOSans-R'; font-size: 14px; color: #fff; flex: none; }
.sub-title em { font-style: normal; font-size: 12px; color: rgba(165, 189, 229, 0.6); flex: none; }
.sub-title .line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(36, 131, 255, 0.6), transparent); }
</style>
