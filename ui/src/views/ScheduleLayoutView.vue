<script setup lang="ts">
import { listCalendars } from '@/api/schedule'
import type { ScheduleCalendar } from '@/types'
import { Toast, VButton, VCard, VPageHeader } from '@halo-dev/components'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const calendars = ref<ScheduleCalendar[]>([])
const loading = ref(false)

const activePath = computed(() => route.path)
const selectedCalendar = computed(() => (route.query.calendar as string) || '')

const fetchCalendars = async () => {
  loading.value = true
  try {
    const data = await listCalendars(1, 200)
    calendars.value = data.items || []
  } catch (e) {
    console.error(e)
    Toast.error('加载日历失败')
  } finally {
    loading.value = false
  }
}

const ensureCalendarQuery = async () => {
  if (selectedCalendar.value || !calendars.value.length) {
    return
  }
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      calendar: calendars.value[0].metadata.name || '',
    },
  })
}

const switchCalendar = async (calendarName: string) => {
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      calendar: calendarName,
    },
  })
}

const jumpTo = async (subPath: 'calendars' | 'events') => {
  await router.push({
    path: `/schedule/${subPath}`,
    query: {
      ...route.query,
    },
  })
}

onMounted(async () => {
  await fetchCalendars()
  await ensureCalendarQuery()
})

watch(
  () => route.path,
  async () => {
    await ensureCalendarQuery()
  }
)
</script>

<template>
  <VPageHeader title="日程" />
  <div class="layout-page">
    <VCard>
      <div class="layout-toolbar">
        <div class="layout-tabs">
          <VButton :type="activePath.includes('/schedule/calendars') ? 'primary' : 'default'" @click="jumpTo('calendars')">
            日历配置
          </VButton>
          <VButton :type="activePath.includes('/schedule/events') ? 'primary' : 'default'" @click="jumpTo('events')">
            日程事件
          </VButton>
        </div>
        <div class="calendar-switch">
          <span class="label">当前日历：</span>
          <span v-if="loading">加载中...</span>
          <template v-else-if="calendars.length">
            <button
              v-for="calendar in calendars"
              :key="calendar.metadata.name"
              type="button"
              class="calendar-chip"
              :class="{ active: selectedCalendar === (calendar.metadata.name || '') }"
              @click="switchCalendar(calendar.metadata.name || '')"
            >
              {{ calendar.spec.displayName }}
            </button>
          </template>
          <span v-else>暂无日历，请先在“日历配置”中创建</span>
        </div>
      </div>
    </VCard>

    <div class="layout-content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.layout-page {
  padding: 16px;
}

.layout-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.layout-tabs {
  display: flex;
  gap: 8px;
}

.calendar-switch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
}

.label {
  color: #6b7280;
}

.calendar-chip {
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
  background: #fff;
}

.calendar-chip.active {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

.layout-content {
  margin-top: 12px;
}
</style>
