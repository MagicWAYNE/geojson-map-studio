import { ref } from 'vue'

const enabled = ref(true)

function toggle(): void {
  enabled.value = !enabled.value
}

export function useMapDistrictCarousel() {
  return {
    enabled,
    toggle
  }
}
