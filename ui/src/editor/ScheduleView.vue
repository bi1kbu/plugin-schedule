<script setup lang="ts">
import { NodeViewWrapper, type NodeViewProps } from '@halo-dev/richtext-editor'
import { VEmpty } from '@halo-dev/components'
import { computed, h } from 'vue'
import RiCalendarScheduleLine from '~icons/ri/calendar-schedule-line'

const props = defineProps<NodeViewProps>()

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

const previewComponent = computed(() => {
  if (!calendarName.value) {
    return null
  }
  return h('schedule-view', {
    'calendar-name': calendarName.value,
    'show-title': showTitle.value ? 'true' : 'false',
  })
})

const previewKey = computed(() => `${calendarName.value}-${showTitle.value ? '1' : '0'}`)
</script>

<template>
  <NodeViewWrapper as="div" :class="['schedule-view-container', { 'schedule-view-container--selected': selected }]">
    <div class="schedule-view-nav">
      <div class="schedule-view-nav-start">
        <RiCalendarScheduleLine class="icon" />
        <span>日程组件</span>
      </div>
      <div class="schedule-view-nav-end">
        <FormKit
          v-model="calendarName"
          type="select"
          name="calendarName"
          :multiple="false"
          clearable
          searchable
          placeholder="请选择日历"
          action="/apis/api.schedule.bi1kbu.com/v1alpha1/schedulecalendars"
          :request-option="{
            method: 'GET',
            pageField: 'page',
            sizeField: 'size',
            totalField: 'total',
            itemsField: 'items',
            labelField: 'spec.displayName',
            valueField: 'metadata.name',
          }"
          :classes="{
            wrapper: 'schedule-calendar-select-wrapper',
            input: 'schedule-calendar-select-input',
          }"
        />

        <label class="show-title-switch">
          <input v-model="showTitle" type="checkbox" />
          <span>前台显示日历名称</span>
        </label>
      </div>
    </div>
    <div class="schedule-view-preview">
      <component v-if="calendarName" :is="previewComponent" :key="previewKey" />
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
  padding: 6px 10px;
  align-items: center;
  gap: 8px;
}

.schedule-view-nav-start {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.schedule-view-nav-start .icon {
  width: 16px;
  height: 16px;
}

.schedule-view-nav-end {
  min-width: 260px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.schedule-view-preview {
  padding: 8px 10px;
  background: transparent;
  min-height: 86px;
}

.schedule-view-preview schedule-view {
  display: block;
}

.schedule-calendar-select-wrapper {
  min-width: 220px;
}

.schedule-calendar-select-input {
  font-size: 14px;
}

.show-title-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}
</style>
