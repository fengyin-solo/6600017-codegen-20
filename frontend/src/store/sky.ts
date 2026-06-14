import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { STARS, CONSTELLATIONS } from '../data/stars'
import type { Star } from '../types'

export interface ShareState {
  t: string
  lat: number
  z: number
  px: number
  py: number
  sl: boolean
  sln: boolean
  sg: boolean
  s?: string
}

export const useSkyStore = defineStore('sky', () => {
  const viewDate = ref(new Date())
  const zoom = ref(1.0)
  const panX = ref(0)
  const panY = ref(0)
  const showLabels = ref(true)
  const showConstLines = ref(true)
  const showGrid = ref(true)
  const selectedStar = ref<Star | null>(null)
  const searchQuery = ref('')
  const latitude = ref(39.9)
  const isShareMode = ref(false)

  const localSiderealTime = computed(() => {
    const d = viewDate.value
    const jd = d.getTime() / 86400000 + 2440587.5
    const T = (jd - 2451545.0) / 36525.0
    let lst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + T * T * (0.000387933 - T / 38710000)
    lst = ((lst % 360) + 360) % 360
    return lst / 15 // convert to hours
  })

  const filteredStars = computed(() => {
    if (!searchQuery.value) return []
    const q = searchQuery.value.toLowerCase()
    return STARS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
  })

  function projectStar(ra: number, dec: number, cx: number, cy: number, scale: number): [number, number] {
    const ha = (localSiderealTime.value - ra) * 15 * Math.PI / 180
    const decRad = dec * Math.PI / 180
    const latRad = latitude.value * Math.PI / 180

    const alt = Math.asin(Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha))
    const az = Math.atan2(-Math.cos(decRad) * Math.sin(ha), Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(ha))

    if (alt < -0.1) return [-999, -999] // below horizon

    const r = (Math.PI / 2 - alt) * scale * 0.45
    const x = cx + panX.value + r * Math.sin(az)
    const y = cy + panY.value - r * Math.cos(az)
    return [x, y]
  }

  function starRadius(mag: number): number {
    return Math.max(1, 5 - mag) * zoom.value
  }

  function spectralColor(spectral: string): string {
    const colors: Record<string, string> = {
      'O': '#9bb0ff', 'B': '#aabfff', 'A': '#cad7ff',
      'F': '#f8f7ff', 'G': '#fff4ea', 'K': '#ffd2a1', 'M': '#ffcc6f'
    }
    return colors[spectral] || '#ffffff'
  }

  function selectStar(x: number, y: number, cx: number, cy: number, scale: number) {
    let closest: Star | null = null
    let minDist = 20
    for (const star of STARS) {
      const [sx, sy] = projectStar(star.ra, star.dec, cx, cy, scale)
      const dist = Math.hypot(sx - x, sy - y)
      if (dist < minDist) { minDist = dist; closest = star }
    }
    selectedStar.value = closest
  }

  function serializeState(): string {
    const state: ShareState = {
      t: viewDate.value.toISOString(),
      lat: Number(latitude.value.toFixed(2)),
      z: Number(zoom.value.toFixed(2)),
      px: Number(panX.value.toFixed(1)),
      py: Number(panY.value.toFixed(1)),
      sl: showLabels.value,
      sln: showConstLines.value,
      sg: showGrid.value,
    }
    if (selectedStar.value) {
      state.s = selectedStar.value.name
    }
    return btoa(encodeURIComponent(JSON.stringify(state)))
  }

  function deserializeState(encoded: string): ShareState | null {
    try {
      return JSON.parse(decodeURIComponent(atob(encoded))) as ShareState
    } catch {
      return null
    }
  }

  function generateShareUrl(): string {
    const hash = serializeState()
    const url = new URL(window.location.href)
    url.hash = hash
    return url.toString()
  }

  function loadFromUrl(): boolean {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return false
    const state = deserializeState(hash)
    if (!state) return false

    if (state.t) {
      const d = new Date(state.t)
      if (!isNaN(d.getTime())) viewDate.value = d
    }
    if (typeof state.lat === 'number') latitude.value = state.lat
    if (typeof state.z === 'number') zoom.value = state.z
    if (typeof state.px === 'number') panX.value = state.px
    if (typeof state.py === 'number') panY.value = state.py
    if (typeof state.sl === 'boolean') showLabels.value = state.sl
    if (typeof state.sln === 'boolean') showConstLines.value = state.sln
    if (typeof state.sg === 'boolean') showGrid.value = state.sg
    if (state.s) {
      const star = STARS.find(s => s.name === state.s)
      if (star) selectedStar.value = star
    }
    isShareMode.value = true
    return true
  }

  return {
    viewDate, zoom, panX, panY, showLabels, showConstLines, showGrid,
    selectedStar, searchQuery, latitude, localSiderealTime, filteredStars, isShareMode,
    projectStar, starRadius, spectralColor, selectStar,
    serializeState, deserializeState, generateShareUrl, loadFromUrl,
    STARS, CONSTELLATIONS
  }
})
