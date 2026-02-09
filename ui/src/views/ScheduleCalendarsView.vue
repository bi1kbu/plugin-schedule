<script setup lang="ts">
import { createCalendar, deleteCalendar, listCalendars, updateCalendar } from '@/api/schedule'
import type { ScheduleCalendar } from '@/types'
import { Dialog, Toast, VButton, VCard } from '@halo-dev/components'
import { onMounted, reactive, ref } from 'vue'

type EditMode = 'create' | 'edit'

const calendars = ref<ScheduleCalendar[]>([])
const loading = ref(false)
const saving = ref(false)

const mode = ref<EditMode>('create')
const editingName = ref('')

const form = reactive({
  displayName: '',
  slug: '',
  themeColor: '#1d4ed8',
  visible: true,
})

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

const resetForm = () => {
  mode.value = 'create'
  editingName.value = ''
  form.displayName = ''
  form.slug = ''
  form.themeColor = '#1d4ed8'
  form.visible = true
}

const editOne = (calendar: ScheduleCalendar) => {
  mode.value = 'edit'
  editingName.value = calendar.metadata.name || ''
  form.displayName = calendar.spec.displayName || ''
  form.slug = calendar.spec.slug || ''
  form.themeColor = calendar.spec.themeColor || '#1d4ed8'
  form.visible = calendar.spec.visible !== false
}

const submitForm = async () => {
  if (!form.displayName.trim()) {
    Toast.warning('日历名称必填')
    return
  }

  const payload: ScheduleCalendar = {
    apiVersion: 'schedule.bi1kbu.com/v1alpha1',
    kind: 'ScheduleCalendar',
    metadata: mode.value === 'create' ? { generateName: 'schedule-calendar-' } : { name: editingName.value },
    spec: {
      displayName: form.displayName.trim(),
      slug: form.slug.trim() || undefined,
      themeColor: form.themeColor.trim() || '#1d4ed8',
      visible: form.visible,
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
</script>

<template>
  <div class="page">
    <div class="grid">
      <VCard>
        <template #header>
          <div class="header-row">
            <strong>日历列表</strong>
            <div class="actions">
              <VButton @click="fetchCalendars">刷新</VButton>
              <VButton type="primary" @click="resetForm">新建日历</VButton>
            </div>
          </div>
        </template>

        <table class="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>Slug</th>
              <th>事件数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4">加载中...</td>
            </tr>
            <tr v-for="item in calendars" :key="item.metadata.name">
              <td>
                {{ item.spec.displayName }}
                <br />
                <small>{{ item.metadata.name }}</small>
              </td>
              <td>{{ item.spec.slug || '-' }}</td>
              <td>{{ item.status?.eventCount || 0 }}</td>
              <td class="row-actions">
                <VButton size="sm" @click="editOne(item)">编辑</VButton>
                <VButton size="sm" type="danger" @click="removeOne(item)">删除</VButton>
              </td>
            </tr>
          </tbody>
        </table>
      </VCard>

      <VCard>
        <template #header>
          <strong>{{ mode === 'create' ? '新建日历' : '编辑日历' }}</strong>
        </template>

        <div class="form">
          <label class="field">
            <span>日历名称（必填）</span>
            <input v-model="form.displayName" type="text" placeholder="例如：社团活动日历" />
          </label>

          <label class="field">
            <span>Slug（选填）</span>
            <input v-model="form.slug" type="text" placeholder="例如：society-calendar" />
          </label>

          <label class="field">
            <span>主题色</span>
            <input v-model="form.themeColor" type="color" />
          </label>

          <label class="checkbox-field">
            <input v-model="form.visible" type="checkbox" />
            <span>公开展示</span>
          </label>

          <div class="form-actions">
            <VButton :loading="saving" type="primary" @click="submitForm">
              {{ mode === 'create' ? '创建' : '保存' }}
            </VButton>
            <VButton @click="resetForm">重置</VButton>
          </div>
        </div>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding-top: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.actions {
  display: flex;
  gap: 8px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  padding: 10px;
}

.row-actions {
  display: flex;
  gap: 8px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}

.field input,
.field select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
}

.field input[type='color'] {
  padding: 0;
  height: 36px;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
