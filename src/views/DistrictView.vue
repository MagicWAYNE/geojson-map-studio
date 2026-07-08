<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <div style="padding: 200px; font-size: 40px">区县占位：{{ name }}</div>
</template>
