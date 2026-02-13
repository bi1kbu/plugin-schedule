<script setup lang="ts">
import { NodeViewWrapper, type NodeViewProps } from '@halo-dev/richtext-editor'
import { VEmpty } from '@halo-dev/components'
import { computed, onMounted, ref } from 'vue'
import RiCalendarScheduleLine from '~icons/ri/calendar-schedule-line'

const props = defineProps<NodeViewProps>()
type RenderStyle = 'default'

interface CalendarOption {
  value: string
  label: string
}

const calendarOptions = ref<CalendarOption[]>([])
const calendarLoading = ref(false)

const calendarName = computed({
  get: () => (props.node?.attrs.calendarName as string) || '',
  set: (value: string) => {
    props.updateAttributes({ calendarName: value })
  },
})

const showTitle = computed({
  get: () => props.node?.attrs.showTitle !== false,
  set: (value: boolean) => {
    props.updateAttributes({ showTitle: value })
  },
})

const renderStyle = computed({
  get: () => 'default' as RenderStyle,
  set: (_value: RenderStyle) => {
    props.updateAttributes({ renderStyle: 'default' })
  },
})

const selectedCalendarLabel = computed(() => {
  const matched = calendarOptions.value.find((item) => item.value === calendarName.value)
  return matched?.label || calendarName.value || ''
})

const renderStyleOptions: Array<{ value: RenderStyle; label: string }> = [
  { value: 'default', label: '默认样式' },
]

async function loadCalendars() {
  calendarLoading.value = true
  try {
    const resp = await fetch('/apis/api.schedule.bi1kbu.com/v1alpha1/schedulecalendars?page=1&size=500')
    if (!resp.ok) {
      throw new Error(`Load calendars failed: ${resp.status}`)
    }
    const json = await resp.json()
    calendarOptions.value = (json?.items || []).map((item: any) => ({
      value: item?.metadata?.name || '',
      label: item?.spec?.displayName || item?.metadata?.name || '',
    })).filter((item: CalendarOption) => Boolean(item.value))
  } catch (error) {
    console.error(error)
  } finally {
    calendarLoading.value = false
  }
}

onMounted(() => {
  loadCalendars()
})
</script>

<template>
  <NodeViewWrapper as="div" :class="['schedule-view-container', { 'schedule-view-container--selected': selected }]">
    <div class="schedule-view-nav">
      <div class="schedule-view-nav-top">
        <div class="schedule-view-nav-start">
          <RiCalendarScheduleLine class="icon" />
          <span>日程组件</span>
        </div>

        <label class="show-title-switch">
          <input v-model="showTitle" type="checkbox" />
          <span>前台显示日历名称</span>
        </label>
      </div>
      <div class="schedule-view-nav-bottom">
        <label class="field-group">
          <span class="field-label">日历选择</span>
          <select v-model="calendarName" class="field-select">
            <option value="">{{ calendarLoading ? '加载中...' : '请选择日历' }}</option>
            <option v-for="item in calendarOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>

        <label class="field-group">
          <span class="field-label">渲染样式</span>
          <select v-model="renderStyle" class="field-select">
            <option v-for="item in renderStyleOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
      </div>
    </div>
    <div class="schedule-view-preview">
      <div v-if="calendarName" :class="['preview-shell', `preview-shell--${renderStyle}`]">
        <div v-if="showTitle" class="preview-title">{{ selectedCalendarLabel || '日程' }}</div>
        <div class="preview-content">
          <div class="preview-calendar">月历区域预览</div>
          <div class="preview-upcoming">近期日程预览</div>
        </div>
      </div>
      <VEmpty v-else title="未选择日历" message="请在上方选择一个日历" />
    </div>
  </NodeViewWrapper>
</template>

<style>
.schedule-view-container {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(229 231 235 / var(--tw-ring-opacity));
  border-radius: 6px;
  overflow: hidden;
  margin-top: 0.75em;
}

.schedule-view-container--selected {
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  --tw-ring-color: rgb(59 130 246 / 1);
}

.schedule-view-nav {
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  align-items: stretch;
  gap: 8px;
}

.schedule-view-nav-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.schedule-view-nav-start {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.schedule-view-nav-start .icon {
  width: 16px;
  height: 16px;
}

.schedule-view-nav-bottom {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 220px);
  align-items: stretch;
  gap: 10px;
}

.schedule-view-preview {
  padding: 8px 10px;
  background: transparent;
  min-height: 120px;
}

.field-group {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  color: #64748b;
  font-size: 12px;
  line-height: 1;
}

.field-select {
  min-height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  padding: 6px 10px;
  font-size: 13px;
  color: #0f172a;
}

.preview-shell {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
  padding: 10px;
}

.preview-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.preview-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
}

.preview-calendar,
.preview-upcoming {
  min-height: 64px;
  border: 1px dashed #93c5fd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  font-size: 12px;
}

.show-title-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}

@media (max-width: 1000px) {
  .schedule-view-nav {
    flex-direction: column;
    align-items: stretch;
  }

  .schedule-view-nav-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .schedule-view-nav-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
