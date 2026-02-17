<script setup lang="ts">
import { createCalendar, deleteCalendar, listCalendars, updateCalendar } from '@/api/schedule'
import type { ScheduleCalendar } from '@/types'
import { Dialog, Toast, VButton, VCard } from '@halo-dev/components'
import { utils } from '@halo-dev/ui-shared'
import { computed, onMounted, reactive, ref } from 'vue'

type EditMode = 'create' | 'edit'

const calendars = ref<ScheduleCalendar[]>([])
const loading = ref(false)
const saving = ref(false)
const canCalendarManage = computed(() => hasPermission(['plugin:schedule:calendar-manage']))

const mode = ref<EditMode>('create')
const editingName = ref('')
const editingVersion = ref<number | undefined>(undefined)
const showFormCard = ref(false)

const form = reactive({
  displayName: '',
})

const getRangeText = (calendar: ScheduleCalendar) => {
  const start = calendar.status?.rangeStartMonth || ''
  const end = calendar.status?.rangeEndMonth || ''
  if (!start && !end) {
    return '-'
  }
  if (start && end) {
    return start === end ? start : `${start} ~ ${end}`
  }
  return start || end
}

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

const resetForm = (options?: { keepVisible?: boolean }) => {
  mode.value = 'create'
  editingName.value = ''
  editingVersion.value = undefined
  form.displayName = ''
  showFormCard.value = options?.keepVisible ?? false
}

const openCreateForm = () => {
  resetForm({ keepVisible: true })
}

const editOne = (calendar: ScheduleCalendar) => {
  mode.value = 'edit'
  editingName.value = calendar.metadata.name || ''
  editingVersion.value = calendar.metadata.version
  form.displayName = calendar.spec.displayName || ''
  showFormCard.value = true
}

const submitForm = async () => {
  if (!form.displayName.trim()) {
    Toast.warning('日历名称必填')
    return
  }

  const payload: ScheduleCalendar = {
    apiVersion: 'schedule.bi1kbu.com/v1alpha1',
    kind: 'ScheduleCalendar',
    metadata: mode.value === 'create'
      ? { generateName: 'schedule-calendar-' }
      : { name: editingName.value, version: editingVersion.value },
    spec: {
      displayName: form.displayName.trim(),
    },
  }

  saving.value = true
  try {
    if (mode.value === 'create') {
      await createCalendar(payload)
      Toast.success('日历创建成功')
    } else {
      await updateCalendar(editingName.value, payload)
      Toast.success('日历更新成功')
    }
    await fetchCalendars()
    resetForm()
  } catch (e) {
    console.error(e)
    Toast.error('保存失败')
  } finally {
    saving.value = false
  }
}

const removeOne = (calendar: ScheduleCalendar) => {
  if (!canCalendarManage.value) {
    Toast.warning('当前账号没有日历管理权限')
    return
  }
  Dialog.warning({
    title: '确认删除该日历？',
    description: '删除后无法恢复。',
    confirmType: 'danger',
    onConfirm: async () => {
      try {
        await deleteCalendar(calendar.metadata.name || '')
        Toast.success('删除成功')
        await fetchCalendars()
        if (editingName.value === (calendar.metadata.name || '')) {
          resetForm()
        }
      } catch (e) {
        console.error(e)
        Toast.error('删除失败')
      }
    },
  })
}

onMounted(fetchCalendars)

function hasPermission(permissions: string[]) {
  try {
    return utils.permission.has(permissions, true)
  } catch {
    return true
  }
}
</script>

<template>
  <div class="page">
    <div class="calendar-layout">
      <VCard class="card">
        <template #header>
          <div class="header-row">
            <div>
              <div class="card-title">日历列表</div>
              <div class="card-desc">用于前台展示和事件归属管理</div>
            </div>
            <div class="header-actions">
              <VButton @click="fetchCalendars">刷新</VButton>
              <VButton v-if="canCalendarManage" type="primary" @click="openCreateForm">新建日历</VButton>
            </div>
          </div>
        </template>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>事件数</th>
                <th>事件范围</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="4">加载中...</td>
              </tr>
              <tr v-for="item in calendars" :key="item.metadata.name">
                <td>
                  <div class="calendar-name">{{ item.spec.displayName }}</div>
                  <div class="calendar-meta">{{ item.metadata.name }}</div>
                </td>
                <td>{{ item.status?.eventCount || 0 }}</td>
                <td>{{ getRangeText(item) }}</td>
                <td class="row-actions">
                  <template v-if="canCalendarManage">
                    <VButton size="sm" @click="editOne(item)">编辑</VButton>
                    <VButton size="sm" type="danger" @click="removeOne(item)">删除</VButton>
                  </template>
                  <span v-else class="readonly-tip">只读</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </VCard>

      <VCard v-if="canCalendarManage && showFormCard" class="card">
        <template #header>
          <div class="header-row">
            <div class="card-title">{{ mode === 'create' ? '新建日历' : '编辑日历' }}</div>
          </div>
        </template>

        <div class="form">
          <div class="section">
            <div class="section-title">基础信息</div>
            <label class="field">
              <span>日历名称（必填）</span>
              <input v-model="form.displayName" type="text" placeholder="例如：社团活动日历" />
            </label>
          </div>

          <div class="form-actions">
            <VButton :loading="saving" type="primary" @click="submitForm">
              {{ mode === 'create' ? '创建' : '保存' }}
            </VButton>
            <VButton @click="resetForm({ keepVisible: true })">重置</VButton>
          </div>
        </div>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/admin-kit/index.css';
</style>
