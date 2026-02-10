<script setup lang="ts">
import type { Editor } from '@halo-dev/richtext-editor'
import { ToolboxItem } from '@halo-dev/richtext-editor'
import { markRaw } from 'vue'
import RiCalendarEventLine from '~icons/ri/calendar-event-line?width=1.2em&height=1.2em'

const props = defineProps<{ editor: Editor }>()

const insertBlock = () => {
  props.editor.chain().focus().setScheduleView({ calendarName: '', showTitle: true }).run()
}
</script>

<template>
  <ToolboxItem :editor="editor" :icon="markRaw(RiCalendarEventLine)" title="日程" @click="insertBlock" />
</template>
