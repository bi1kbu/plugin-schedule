<script setup lang="ts">
import { createEvent, deleteEvent, listCalendars, listEvents, listPosts, updateEvent } from '@/api/schedule'
import type { Post, ScheduleCalendar, ScheduleEvent } from '@/types'
import { Dialog, Toast, VButton, VCard } from '@halo-dev/components'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type EditMode = 'create' | 'edit'

const route = useRoute()
const router = useRouter()

const calendars = ref<ScheduleCalendar[]>([])
const events = ref<ScheduleEvent[]>([])
const posts = ref<Post[]>([])
const loading = ref(false)
const searchingPosts = ref(false)
const saving = ref(false)
const postKeyword = ref('')

const mode = ref<EditMode>('create')
const editingName = ref('')

const selectedCalendar = computed(() => (route.query.calendar as string) || '')
const selectedCalendarDisplayName = computed(() => {
  const matched = calendars.value.find((c) => (c.metadata.name || '') === selectedCalendar.value)
  return matched?.spec.displayName || selectedCalendar.value || '未选择日历'
})

const form = reactive({
  calendarName: '',
  title: '',
  startAt: '',
  endAt: '',
  summary: '',
  status: 'published' as 'published' | 'cancelled',
  relatedPostName: '',
  relatedPostTitleSnapshot: '',
  relatedPostPinnedSnapshot: false,
  forceHighlight: false,
  forceHideHighlight: false,
})

const formatDateInput = (iso?: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 16)
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

const toIsoString = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString()
}

const detectPostPinned = (post?: Post) => {
  if (!post) return false
  const specPinned = post.spec?.pinned
  if (typeof specPinned === 'boolean') return specPinned
  const statusPinned = post.status?.pinned
  if (typeof statusPinned === 'boolean') return statusPinned
  if (typeof post.spec?.topPriority === 'number') return post.spec.topPriority > 0
  return false
}

const highlightRuleText = computed(() => {
  if (form.forceHighlight) return '强制突出显示'
  if (form.forceHideHighlight) return '强制不突出显示'
  return `跟随关联文章置顶属性（当前快照：${form.relatedPostPinnedSnapshot ? '置顶' : '非置顶/未知'}）`
})

const fetchCalendars = async () => {
  const data = await listCalendars(1, 200)
  calendars.value = data.items || []
  if (!selectedCalendar.value && calendars.value.length) {
    await router.replace({
      path: route.path,
      query: { ...route.query, calendar: calendars.value[0].metadata.name || '' },
    })
  }
}

const fetchEvents = async () => {
  if (!selectedCalendar.value) {
    events.value = []
    return
  }
  loading.value = true
  try {
    const data = await listEvents({
      calendar: selectedCalendar.value,
      page: 1,
      size: 200,
      sort: ['spec.startAt,asc'],
    })
    events.value = data.items || []
  } catch (e) {
    console.error(e)
    Toast.error('加载事件失败')
  } finally {
    loading.value = false
  }
}

const searchPosts = async () => {
  searchingPosts.value = true
  try {
    posts.value = await listPosts(postKeyword.value)
  } catch (e) {
    console.error(e)
    Toast.error('加载文章失败')
  } finally {
    searchingPosts.value = false
  }
}

const resetForm = () => {
  mode.value = 'create'
  editingName.value = ''
  form.calendarName = selectedCalendar.value || ''
  form.title = ''
  form.startAt = ''
  form.endAt = ''
  form.summary = ''
  form.status = 'published'
  form.relatedPostName = ''
  form.relatedPostTitleSnapshot = ''
  form.relatedPostPinnedSnapshot = false
  form.forceHighlight = false
  form.forceHideHighlight = false
}

const onPostSelect = () => {
  const post = posts.value.find((item) => item.metadata.name === form.relatedPostName)
  form.relatedPostTitleSnapshot = post?.spec?.title || ''
  form.relatedPostPinnedSnapshot = detectPostPinned(post)
}

const clearPostBinding = () => {
  form.relatedPostName = ''
  form.relatedPostTitleSnapshot = ''
  form.relatedPostPinnedSnapshot = false
}

const onForceHighlightChange = () => {
  if (form.forceHighlight) {
    form.forceHideHighlight = false
  }
}

const onForceHideHighlightChange = () => {
  if (form.forceHideHighlight) {
    form.forceHighlight = false
  }
}

const submitForm = async () => {
  if (!form.calendarName) {
    Toast.warning('请选择日历')
    return
  }
  if (!form.title.trim()) {
    Toast.warning('事件标题必填')
    return
  }
  if (!form.startAt) {
    Toast.warning('开始时间必填')
    return
  }
  const startAtIso = toIsoString(form.startAt)
  if (!startAtIso) {
    Toast.warning('开始时间格式不正确')
    return
  }
  const endAtIso = form.endAt ? toIsoString(form.endAt) : ''
  if (form.endAt && !endAtIso) {
    Toast.warning('结束时间格式不正确')
    return
  }

  const payload: ScheduleEvent = {
    apiVersion: 'schedule.bi1kbu.com/v1alpha1',
    kind: 'ScheduleEvent',
    metadata: mode.value === 'create' ? { generateName: 'schedule-event-' } : { name: editingName.value },
    spec: {
      calendarName: form.calendarName,
      title: form.title.trim(),
      startAt: startAtIso,
      endAt: endAtIso || undefined,
      summary: form.summary.trim() || undefined,
      status: form.status,
      relatedPostName: form.relatedPostName || undefined,
      relatedPostTitleSnapshot: form.relatedPostTitleSnapshot || undefined,
      relatedPostPinnedSnapshot: form.relatedPostPinnedSnapshot || undefined,
      forceHighlight: form.forceHighlight || undefined,
      forceHideHighlight: form.forceHideHighlight || undefined,
    },
  }

  saving.value = true
  try {
    if (mode.value === 'create') {
      await createEvent(payload)
      Toast.success('事件创建成功')
    } else {
      await updateEvent(editingName.value, payload)
      Toast.success('事件更新成功')
    }
    await fetchEvents()
    resetForm()
  } catch (e) {
    console.error(e)
    Toast.error('保存失败')
  } finally {
    saving.value = false
  }
}

const editOne = (item: ScheduleEvent) => {
  mode.value = 'edit'
  editingName.value = item.metadata.name || ''
  form.calendarName = item.spec.calendarName || selectedCalendar.value || ''
  form.title = item.spec.title || ''
  form.startAt = formatDateInput(item.spec.startAt)
  form.endAt = formatDateInput(item.spec.endAt)
  form.summary = item.spec.summary || ''
  form.status = item.spec.status || 'published'
  form.relatedPostName = item.spec.relatedPostName || ''
  form.relatedPostTitleSnapshot = item.spec.relatedPostTitleSnapshot || ''
  form.relatedPostPinnedSnapshot = item.spec.relatedPostPinnedSnapshot === true
  form.forceHighlight = item.spec.forceHighlight === true
  form.forceHideHighlight = item.spec.forceHideHighlight === true
}

const removeOne = (event: ScheduleEvent) => {
  Dialog.warning({
    title: '确认删除该事件？',
    description: '删除后无法恢复。',
    confirmType: 'danger',
    onConfirm: async () => {
      try {
        await deleteEvent(event.metadata.name || '')
        Toast.success('删除成功')
        await fetchEvents()
        if (editingName.value === (event.metadata.name || '')) {
          resetForm()
        }
      } catch (e) {
        console.error(e)
        Toast.error('删除失败')
      }
    },
  })
}

const renderHighlightMode = (event: ScheduleEvent) => {
  if (event.spec.forceHighlight) return '强制突出'
  if (event.spec.forceHideHighlight) return '强制不突出'
  if (event.spec.relatedPostPinnedSnapshot === true) return '跟随文章置顶(是)'
  return '跟随文章置顶(否/未知)'
}

watch(
  () => selectedCalendar.value,
  async () => {
    form.calendarName = selectedCalendar.value || ''
    await fetchEvents()
  }
)

onMounted(async () => {
  await fetchCalendars()
  await fetchEvents()
  await searchPosts()
  resetForm()
})
</script>

<template>
  <div class="page">
    <div class="grid">
      <VCard>
        <template #header>
          <div class="header-row">
            <div>
              <strong>事件列表</strong>
              <div class="calendar-tip">当前日历：{{ selectedCalendarDisplayName }}</div>
            </div>
            <div class="actions">
              <VButton @click="fetchEvents">刷新</VButton>
              <VButton type="primary" @click="resetForm">新建事件</VButton>
            </div>
          </div>
        </template>

        <table class="table">
          <thead>
            <tr>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>标题</th>
              <th>关联文章</th>
              <th>突出显示</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6">加载中...</td>
            </tr>
            <tr v-for="item in events" :key="item.metadata.name">
              <td>{{ item.spec.startAt || '-' }}</td>
              <td>{{ item.spec.endAt || '-' }}</td>
              <td>{{ item.spec.title }}</td>
              <td>{{ item.spec.relatedPostTitleSnapshot || item.spec.relatedPostName || '-' }}</td>
              <td>{{ renderHighlightMode(item) }}</td>
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
          <strong>{{ mode === 'create' ? '新建事件' : '编辑事件' }}</strong>
        </template>

        <div class="form">
          <label class="field">
            <span>所属日历</span>
            <select v-model="form.calendarName">
              <option v-for="calendar in calendars" :key="calendar.metadata.name" :value="calendar.metadata.name || ''">
                {{ calendar.spec.displayName }} ({{ calendar.metadata.name }})
              </option>
            </select>
          </label>

          <label class="field">
            <span>事件标题（必填）</span>
            <input v-model="form.title" type="text" placeholder="请输入事件标题" />
          </label>

          <label class="field">
            <span>开始时间（必填）</span>
            <input v-model="form.startAt" type="datetime-local" />
          </label>

          <label class="field">
            <span>结束时间（选填）</span>
            <input v-model="form.endAt" type="datetime-local" />
          </label>

          <label class="field">
            <span>状态</span>
            <select v-model="form.status">
              <option value="published">published</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>

          <label class="field">
            <span>摘要</span>
            <textarea v-model="form.summary" rows="3" placeholder="可选摘要"></textarea>
          </label>

          <div class="section">
            <div class="section-title">关联文章（手动）</div>
            <div class="post-search">
              <input v-model="postKeyword" type="text" placeholder="输入关键词搜索文章" />
              <VButton :loading="searchingPosts" @click="searchPosts">搜索</VButton>
            </div>
            <select v-model="form.relatedPostName" @change="onPostSelect">
              <option value="">不关联文章</option>
              <option v-for="post in posts" :key="post.metadata.name" :value="post.metadata.name">
                {{ post.spec?.title || post.metadata.name }}
              </option>
            </select>
            <div class="post-info">
              <span>标题快照：{{ form.relatedPostTitleSnapshot || '-' }}</span>
              <span>置顶快照：{{ form.relatedPostPinnedSnapshot ? '是' : '否/未知' }}</span>
              <VButton size="sm" @click="clearPostBinding">清空关联</VButton>
            </div>
          </div>

          <div class="section">
            <div class="section-title">突出显示规则（互斥）</div>
            <label class="checkbox-field">
              <input v-model="form.forceHighlight" type="checkbox" @change="onForceHighlightChange" />
              <span>强制突出显示</span>
            </label>
            <label class="checkbox-field">
              <input v-model="form.forceHideHighlight" type="checkbox" @change="onForceHideHighlightChange" />
              <span>强制不突出显示</span>
            </label>
            <div class="rule-tip">{{ highlightRuleText }}</div>
          </div>

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
  grid-template-columns: 1.5fr 1fr;
  gap: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.calendar-tip {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
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
  vertical-align: top;
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
.field select,
.field textarea,
.section select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
}

.section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-weight: 600;
}

.post-search {
  display: flex;
  gap: 8px;
}

.post-search input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
}

.post-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-tip {
  font-size: 12px;
  color: #6b7280;
}

.form-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 1200px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
