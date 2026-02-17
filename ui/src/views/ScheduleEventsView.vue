<script setup lang="ts">
import { createEvent, deleteEvent, getPost, listCalendars, listEvents, listPosts, recordScheduleLog, refreshCalendarStats, updateEvent } from '@/api/schedule'
import type { Post, ScheduleCalendar, ScheduleEvent } from '@/types'
import { Dialog, Toast, VButton, VCard } from '@halo-dev/components'
import { utils } from '@halo-dev/ui-shared'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type EditMode = 'create' | 'edit'
type EventsTab = 'list' | 'create'
type HighlightFilter = 'all' | 'highlighted' | 'normal'

interface SessionCreatedEvent {
  calendarDisplayName: string
  title: string
  startAt: string
  endAt?: string
  createdAt: string
  highlightMode: string
}

interface ScheduleLogDetail {
  field: string
  label: string
  oldValue?: string
  newValue?: string
}

interface EventLogSnapshot {
  calendarDisplayName: string
  title: string
  startDate: string
  endDate: string
  relatedPostTitle: string
  relatedPostPermalink: string
  relatedPostPinned: string
  highlightMode: string
  summary: string
}

const route = useRoute()
const router = useRouter()

const calendars = ref<ScheduleCalendar[]>([])
const events = ref<ScheduleEvent[]>([])
const posts = ref<Post[]>([])

const loading = ref(false)
const searchingPosts = ref(false)
const saving = ref(false)

const postKeyword = ref('')
const sessionCreatedEvents = ref<SessionCreatedEvent[]>([])

const mode = ref<EditMode>('create')
const editingName = ref('')
const editingVersion = ref<number | undefined>(undefined)
const editingOriginalCalendarName = ref('')
const editingOriginalSnapshot = ref<EventLogSnapshot | null>(null)

const selectedCalendar = computed(() => (route.query.calendar as string) || '')

const activeTab = computed<EventsTab>(() => {
  const tab = route.query.tab as string
  return tab === 'create' ? 'create' : 'list'
})
const canEdit = computed(() => hasPermission(['plugin:schedule:edit']))
const canWriteLog = computed(() => hasPermission(['plugin:schedule:log-write']))

const filters = reactive({
  keyword: '',
  highlight: 'all' as HighlightFilter,
  fromDate: '',
  toDate: '',
})

const form = reactive({
  title: '',
  startAt: '',
  endAt: '',
  summary: '',
  status: 'published' as 'published' | 'cancelled',
  relatedPostName: '',
  relatedPostTitleSnapshot: '',
  relatedPostPermalinkSnapshot: '',
  relatedPostPinnedSnapshot: false,
  forceHighlight: false,
  forceHideHighlight: false,
})

const pad2 = (value: number) => String(value).padStart(2, '0')

const parseDateParts = (value: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

const formatDateInput = (iso?: string) => {
  if (!iso) return ''
  const head = iso.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    return head
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

const toStartOfDayIso = (value: string) => {
  const parsed = parseDateParts(value)
  if (!parsed) {
    return ''
  }
  const { year, month, day } = parsed
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString()
}

const toEndOfDayIso = (value: string) => {
  const parsed = parseDateParts(value)
  if (!parsed) {
    return ''
  }
  const { year, month, day } = parsed
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString()
}

const displayDate = (value?: string) => formatDateInput(value) || '-'
const normalizeText = (value?: string) => (value && value.trim() ? value.trim() : '-')

const resolvePostPinnedSnapshot = (post?: Post): boolean | undefined => {
  if (!post) return undefined
  const specPinned = post.spec?.pinned
  if (typeof specPinned === 'boolean') return specPinned
  const statusPinned = post.status?.pinned
  if (typeof statusPinned === 'boolean') return statusPinned
  if (typeof post.spec?.topPriority === 'number') return post.spec.topPriority > 0
  return undefined
}

const upsertPostOption = (post: Post) => {
  const postName = post.metadata.name
  const index = posts.value.findIndex((item) => item.metadata.name === postName)
  if (index === -1) {
    posts.value.unshift(post)
    return
  }
  posts.value[index] = post
}

const syncRelatedPostSnapshot = async (options: { forceRemote?: boolean; silent?: boolean } = {}) => {
  const selectedPostName = form.relatedPostName
  if (!selectedPostName) {
    form.relatedPostTitleSnapshot = ''
    form.relatedPostPermalinkSnapshot = ''
    form.relatedPostPinnedSnapshot = false
    return
  }

  const localPost = postOptions.value.find((item) => item.metadata.name === selectedPostName)
  if (localPost?.spec?.title) {
    form.relatedPostTitleSnapshot = localPost.spec.title
  }
  const localPermalink = localPost?.status?.permalink
  if (typeof localPermalink === 'string' && localPermalink.trim()) {
    form.relatedPostPermalinkSnapshot = localPermalink
  }
  const localPinned = resolvePostPinnedSnapshot(localPost)
  if (typeof localPinned === 'boolean') {
    form.relatedPostPinnedSnapshot = localPinned
  }

  const shouldFetchRemote = options.forceRemote || !localPost || typeof localPinned !== 'boolean'
  if (!shouldFetchRemote) {
    return
  }

  try {
    const remotePost = await getPost(selectedPostName)
    upsertPostOption(remotePost)
    if (form.relatedPostName !== selectedPostName) {
      return
    }
    if (remotePost.spec?.title) {
      form.relatedPostTitleSnapshot = remotePost.spec.title
    }
    form.relatedPostPermalinkSnapshot = remotePost.status?.permalink || form.relatedPostPermalinkSnapshot || ''
    const remotePinned = resolvePostPinnedSnapshot(remotePost)
    form.relatedPostPinnedSnapshot = remotePinned === true
  } catch (e) {
    console.error(e)
    if (!options.silent) {
      Toast.warning('刷新关联文章快照失败，已使用当前缓存数据')
    }
  }
}

const ensureTabQuery = async () => {
  const tab = route.query.tab as string
  if (!canEdit.value && tab === 'create') {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        tab: 'list',
      },
    })
    return
  }
  if (tab === 'list' || tab === 'create') {
    return
  }
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      tab: 'list',
    },
  })
}

const switchTab = async (tab: EventsTab) => {
  if (tab === activeTab.value) {
    return
  }
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      tab,
    },
  })
}

const openListTab = () => {
  void switchTab('list')
}

const openCreateTab = () => {
  if (!canEdit.value) {
    Toast.warning('当前账号没有日程编辑权限')
    return
  }
  if (mode.value === 'edit') {
    resetForm()
  }
  void switchTab('create')
}

const changeSelectedCalendar = async (calendarName: string) => {
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      calendar: calendarName,
    },
  })
}

const onCalendarSelect = async (event: Event) => {
  const value = (event.target as HTMLSelectElement).value || ''
  if (!value || value === selectedCalendar.value) {
    return
  }
  await changeSelectedCalendar(value)
}

const getNewestCalendarName = () => {
  if (calendars.value.length === 0) {
    return ''
  }
  const newestCalendar = [...calendars.value].sort((a, b) => {
    const timeA = Date.parse(a.metadata.creationTimestamp || '')
    const timeB = Date.parse(b.metadata.creationTimestamp || '')
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      return timeB - timeA
    }
    if (!Number.isNaN(timeA)) {
      return -1
    }
    if (!Number.isNaN(timeB)) {
      return 1
    }
    return 0
  })[0]
  return newestCalendar?.metadata.name || ''
}

const ensureSelectedCalendar = async () => {
  const selected = selectedCalendar.value
  const hasSelected = calendars.value.some((item) => (item.metadata.name || '') === selected)
  if (selected && hasSelected) {
    return
  }
  const fallback = getNewestCalendarName()
  if (!fallback) {
    return
  }
  await changeSelectedCalendar(fallback)
}

const fetchCalendars = async () => {
  const data = await listCalendars(1, 200)
  calendars.value = data.items || []
  await ensureSelectedCalendar()
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

const postOptions = computed<Post[]>(() => {
  const list = [...posts.value]
  if (form.relatedPostName && !list.some((item) => item.metadata.name === form.relatedPostName)) {
    list.unshift({
      metadata: { name: form.relatedPostName },
      spec: {
        title: form.relatedPostTitleSnapshot || form.relatedPostName,
        pinned: form.relatedPostPinnedSnapshot,
      },
    })
  }
  return list
})

const resetForm = () => {
  mode.value = 'create'
  editingName.value = ''
  editingVersion.value = undefined
  editingOriginalCalendarName.value = ''
  editingOriginalSnapshot.value = null

  form.title = ''
  form.startAt = ''
  form.endAt = ''
  form.summary = ''
  form.status = 'published'
  form.relatedPostName = ''
  form.relatedPostTitleSnapshot = ''
  form.relatedPostPermalinkSnapshot = ''
  form.relatedPostPinnedSnapshot = false
  form.forceHighlight = false
  form.forceHideHighlight = false
}

const clearFilters = () => {
  filters.keyword = ''
  filters.highlight = 'all'
  filters.fromDate = ''
  filters.toDate = ''
}

const onPostSelect = () => {
  void syncRelatedPostSnapshot({ forceRemote: true, silent: true })
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

const refreshCalendarStatsForNames = async (calendarNames: string[]) => {
  const uniqueNames = Array.from(new Set(calendarNames.filter((name) => !!name)))
  if (uniqueNames.length === 0) {
    return true
  }
  const results = await Promise.allSettled(uniqueNames.map((name) => refreshCalendarStats(name)))
  return results.every((item) => item.status === 'fulfilled')
}

const getCalendarDisplayName = (calendarName: string) => {
  const calendar = calendars.value.find((item) => (item.metadata.name || '') === calendarName)
  return calendar?.spec.displayName || calendarName || '-'
}

const isEventHighlighted = (event: ScheduleEvent) => {
  if (event.spec.forceHighlight === true) {
    return true
  }
  if (event.spec.forceHideHighlight === true) {
    return false
  }
  return event.spec.relatedPostPinnedSnapshot === true
}

const renderHighlightMode = (event: ScheduleEvent) => {
  if (event.spec.forceHighlight) return '强制突出'
  if (event.spec.forceHideHighlight) return '强制不突出'
  if (event.spec.relatedPostPinnedSnapshot === true) return '跟随文章置顶(是)'
  return '跟随文章置顶(否/未知)'
}

const renderHighlightModeBySpec = (spec: ScheduleEvent['spec']) => {
  if (spec.forceHighlight === true) return '强制突出'
  if (spec.forceHideHighlight === true) return '强制不突出'
  if (spec.relatedPostPinnedSnapshot === true) return '跟随文章置顶(是)'
  return '跟随文章置顶(否/未知)'
}

const toSnapshotFromEvent = (event: ScheduleEvent): EventLogSnapshot => ({
  calendarDisplayName: getCalendarDisplayName(event.spec.calendarName || ''),
  title: normalizeText(event.spec.title),
  startDate: displayDate(event.spec.startAt),
  endDate: displayDate(event.spec.endAt),
  relatedPostTitle: normalizeText(event.spec.relatedPostTitleSnapshot || event.spec.relatedPostName),
  relatedPostPermalink: normalizeText(event.spec.relatedPostPermalinkSnapshot),
  relatedPostPinned: event.spec.relatedPostPinnedSnapshot === true ? '是' : '否/未知',
  highlightMode: renderHighlightModeBySpec(event.spec),
  summary: normalizeText(event.spec.summary),
})

const toSnapshotFromSpec = (spec: ScheduleEvent['spec'], calendarName: string): EventLogSnapshot => ({
  calendarDisplayName: getCalendarDisplayName(calendarName),
  title: normalizeText(spec.title),
  startDate: displayDate(spec.startAt),
  endDate: displayDate(spec.endAt),
  relatedPostTitle: normalizeText(spec.relatedPostTitleSnapshot || spec.relatedPostName),
  relatedPostPermalink: normalizeText(spec.relatedPostPermalinkSnapshot),
  relatedPostPinned: spec.relatedPostPinnedSnapshot === true ? '是' : '否/未知',
  highlightMode: renderHighlightModeBySpec(spec),
  summary: normalizeText(spec.summary),
})

const emptySnapshot = (): EventLogSnapshot => ({
  calendarDisplayName: '-',
  title: '-',
  startDate: '-',
  endDate: '-',
  relatedPostTitle: '-',
  relatedPostPermalink: '-',
  relatedPostPinned: '-',
  highlightMode: '-',
  summary: '-',
})

const diffSnapshots = (before: EventLogSnapshot, after: EventLogSnapshot): ScheduleLogDetail[] => {
  const fields: Array<{ key: keyof EventLogSnapshot; label: string; field: string }> = [
    { key: 'calendarDisplayName', label: '所属日历', field: 'calendarDisplayName' },
    { key: 'title', label: '事件标题', field: 'title' },
    { key: 'startDate', label: '开始日期', field: 'startAt' },
    { key: 'endDate', label: '结束日期', field: 'endAt' },
    { key: 'relatedPostTitle', label: '关联文章标题', field: 'relatedPostTitle' },
    { key: 'relatedPostPermalink', label: '关联文章链接', field: 'relatedPostPermalink' },
    { key: 'relatedPostPinned', label: '置顶快照', field: 'relatedPostPinnedSnapshot' },
    { key: 'highlightMode', label: '突出显示规则', field: 'highlightMode' },
    { key: 'summary', label: '摘要', field: 'summary' },
  ]
  return fields
    .filter((item) => before[item.key] !== after[item.key])
    .map((item) => ({
      field: item.field,
      label: item.label,
      oldValue: before[item.key],
      newValue: after[item.key],
    }))
}

const getEventStartDateKey = (event: ScheduleEvent) => {
  const dateKey = formatDateInput(event.spec.startAt)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : ''
}

const filteredEvents = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return events.value.filter((item) => {
    if (keyword) {
      const title = (item.spec.title || '').toLowerCase()
      if (!title.includes(keyword)) {
        return false
      }
    }

    if (filters.highlight === 'highlighted' && !isEventHighlighted(item)) {
      return false
    }
    if (filters.highlight === 'normal' && isEventHighlighted(item)) {
      return false
    }

    const startKey = getEventStartDateKey(item)
    if (filters.fromDate && (!startKey || startKey < filters.fromDate)) {
      return false
    }
    if (filters.toDate && (!startKey || startKey > filters.toDate)) {
      return false
    }

    return true
  })
})

const highlightRuleText = computed(() => {
  if (form.forceHighlight) return '强制突出显示'
  if (form.forceHideHighlight) return '强制不突出显示'
  return `跟随关联文章置顶属性（当前快照：${form.relatedPostPinnedSnapshot ? '置顶' : '非置顶/未知'}）`
})

const resolveEventTitle = () => {
  const direct = form.title.trim()
  if (direct) {
    return direct
  }
  const snapshotTitle = form.relatedPostTitleSnapshot.trim()
  if (snapshotTitle) {
    return snapshotTitle
  }
  const selectedPost = postOptions.value.find((item) => item.metadata.name === form.relatedPostName)
  return selectedPost?.spec?.title?.trim() || ''
}

const appendSessionCreatedEvent = (event: ScheduleEvent) => {
  const record: SessionCreatedEvent = {
    calendarDisplayName: getCalendarDisplayName(event.spec.calendarName || ''),
    title: event.spec.title || '-',
    startAt: displayDate(event.spec.startAt),
    endAt: displayDate(event.spec.endAt),
    createdAt: new Date().toLocaleString(),
    highlightMode: renderHighlightMode(event),
  }
  sessionCreatedEvents.value.unshift(record)
}

const writeEventLog = async (payload: {
  actionType: string
  eventName?: string
  eventTitle?: string
  calendarName?: string
  keyword?: string
  summary?: string
  details?: ScheduleLogDetail[]
}) => {
  if (!canWriteLog.value) {
    return
  }
  try {
    await recordScheduleLog(payload)
  } catch (e) {
    console.error('record schedule log failed', e)
  }
}

const submitForm = async () => {
  if (!canEdit.value) {
    Toast.warning('当前账号没有日程编辑权限')
    return
  }
  const targetCalendarName = selectedCalendar.value
  if (!targetCalendarName) {
    Toast.warning('请先在右上角选择当前日历')
    return
  }
  if (!form.relatedPostName) {
    Toast.warning('关联文章必填')
    return
  }
  if (!form.startAt) {
    Toast.warning('开始日期必填')
    return
  }

  const startAtIso = toStartOfDayIso(form.startAt)
  if (!startAtIso) {
    Toast.warning('开始日期格式不正确')
    return
  }

  const endAtIso = form.endAt ? toEndOfDayIso(form.endAt) : ''
  if (form.endAt && !endAtIso) {
    Toast.warning('结束日期格式不正确')
    return
  }

  await syncRelatedPostSnapshot({ forceRemote: true, silent: true })

  const resolvedTitle = resolveEventTitle()
  if (!resolvedTitle) {
    Toast.warning('无法从关联文章中确定事件标题，请检查文章数据')
    return
  }

  const payload: ScheduleEvent = {
    apiVersion: 'schedule.bi1kbu.com/v1alpha1',
    kind: 'ScheduleEvent',
    metadata: mode.value === 'create'
      ? { generateName: 'schedule-event-' }
      : { name: editingName.value, version: editingVersion.value },
    spec: {
      calendarName: targetCalendarName,
      title: resolvedTitle,
      startAt: startAtIso,
      endAt: endAtIso || undefined,
      summary: form.summary.trim() || undefined,
      status: form.status,
      relatedPostName: form.relatedPostName,
      relatedPostTitleSnapshot: form.relatedPostTitleSnapshot || undefined,
      relatedPostPermalinkSnapshot: form.relatedPostPermalinkSnapshot || undefined,
      relatedPostPinnedSnapshot: form.relatedPostPinnedSnapshot || undefined,
      forceHighlight: form.forceHighlight || undefined,
      forceHideHighlight: form.forceHideHighlight || undefined,
    },
  }

  saving.value = true
  try {
    let statsRefreshed = true
    if (mode.value === 'create') {
      const created = await createEvent(payload)
      appendSessionCreatedEvent(created)
      const createDetails = diffSnapshots(emptySnapshot(), toSnapshotFromEvent(created))
      await writeEventLog({
        actionType: '创建日程',
        eventName: created.metadata.name || '',
        eventTitle: created.spec.title || '',
        calendarName: created.spec.calendarName || targetCalendarName,
        keyword: created.spec.title || '',
        summary: '创建了新的日程事件',
        details: createDetails,
      })
      statsRefreshed = await refreshCalendarStatsForNames([targetCalendarName])
      Toast.success('事件创建成功')
    } else {
      const previousSnapshot = editingOriginalSnapshot.value || emptySnapshot()
      const currentSnapshot = toSnapshotFromSpec(payload.spec, targetCalendarName)
      await updateEvent(editingName.value, payload)
      await writeEventLog({
        actionType: '更新日程',
        eventName: editingName.value,
        eventTitle: payload.spec.title || '',
        calendarName: targetCalendarName,
        keyword: payload.spec.title || '',
        summary: '更新了日程事件信息',
        details: diffSnapshots(previousSnapshot, currentSnapshot),
      })
      statsRefreshed = await refreshCalendarStatsForNames([
        editingOriginalCalendarName.value,
        targetCalendarName,
      ])
      Toast.success('事件更新成功')
    }

    if (!statsRefreshed) {
      Toast.warning('事件已保存，但日历统计刷新失败，可稍后重试')
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
  if (!canEdit.value) {
    Toast.warning('当前账号没有日程编辑权限')
    return
  }
  mode.value = 'edit'
  editingName.value = item.metadata.name || ''
  editingVersion.value = item.metadata.version
  editingOriginalCalendarName.value = item.spec.calendarName || ''
  editingOriginalSnapshot.value = toSnapshotFromEvent(item)

  form.title = item.spec.title || ''
  form.startAt = formatDateInput(item.spec.startAt)
  form.endAt = formatDateInput(item.spec.endAt)
  form.summary = item.spec.summary || ''
  form.status = item.spec.status || 'published'
  form.relatedPostName = item.spec.relatedPostName || ''
  form.relatedPostTitleSnapshot = item.spec.relatedPostTitleSnapshot || ''
  form.relatedPostPermalinkSnapshot = item.spec.relatedPostPermalinkSnapshot || ''
  form.relatedPostPinnedSnapshot = item.spec.relatedPostPinnedSnapshot === true
  form.forceHighlight = item.spec.forceHighlight === true
  form.forceHideHighlight = item.spec.forceHideHighlight === true

  void syncRelatedPostSnapshot({ forceRemote: true, silent: true })
  void switchTab('create')
}

const removeOne = (event: ScheduleEvent) => {
  if (!canEdit.value) {
    Toast.warning('当前账号没有日程编辑权限')
    return
  }
  Dialog.warning({
    title: '确认删除该事件？',
    description: '删除后无法恢复。',
    confirmType: 'danger',
    onConfirm: async () => {
      try {
        await deleteEvent(event.metadata.name || '')
        const deleteDetails = diffSnapshots(toSnapshotFromEvent(event), emptySnapshot())
        await writeEventLog({
          actionType: '删除日程',
          eventName: event.metadata.name || '',
          eventTitle: event.spec.title || '',
          calendarName: event.spec.calendarName || '',
          keyword: event.spec.title || '',
          summary: '删除了日程事件',
          details: deleteDetails,
        })
        const statsRefreshed = await refreshCalendarStatsForNames([event.spec.calendarName || ''])
        Toast.success('删除成功')
        if (!statsRefreshed) {
          Toast.warning('事件已删除，但日历统计刷新失败，可稍后重试')
        }
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

watch(
  () => selectedCalendar.value,
  async () => {
    if (!selectedCalendar.value) {
      await ensureSelectedCalendar()
      if (!selectedCalendar.value) {
        await fetchEvents()
      }
      return
    }
    await fetchEvents()
  }
)

onMounted(async () => {
  await fetchCalendars()
  await ensureTabQuery()
  await fetchEvents()
  await searchPosts()
  resetForm()
})

function hasPermission(permissions: string[]) {
  try {
    return utils.permission.has(permissions, true)
  } catch {
    return false
  }
}
</script>

<template>
  <div class="page">
    <div class="event-subnav">
      <div class="subnav-left">
        <button
          type="button"
          class="subnav-btn"
          :class="{ active: activeTab === 'list' }"
          @click="openListTab"
        >
          日程清单
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="subnav-btn"
          :class="{ active: activeTab === 'create' }"
          @click="openCreateTab"
        >
          新建日程
        </button>
      </div>

      <div class="subnav-right">
        <span v-if="!canEdit" class="readonly-flag">只读模式</span>
        <div class="calendar-picker">
          <label class="calendar-label" for="eventCalendarSelect">当前日历</label>
          <select
            id="eventCalendarSelect"
            class="calendar-select"
            :value="selectedCalendar"
            :disabled="calendars.length === 0"
            @change="onCalendarSelect"
          >
            <option v-if="calendars.length === 0" value="">暂无日历</option>
            <option v-for="calendar in calendars" :key="calendar.metadata.name" :value="calendar.metadata.name || ''">
              {{ calendar.spec.displayName }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'list'" class="panel-stack">
      <VCard>
        <template #header>
          <div class="header-row">
            <div class="card-title">日程清单</div>
          </div>
        </template>

        <div class="list-filters">
          <label class="field">
            <span>标题</span>
            <input v-model="filters.keyword" type="text" placeholder="按标题关键字筛选" />
          </label>

          <label class="field">
            <span>突出显示</span>
            <select v-model="filters.highlight">
              <option value="all">全部</option>
              <option value="highlighted">仅突出显示</option>
              <option value="normal">仅非突出</option>
            </select>
          </label>

          <label class="field">
            <span>开始日期从</span>
            <input v-model="filters.fromDate" type="date" />
          </label>

          <label class="field">
            <span>开始日期至</span>
            <input v-model="filters.toDate" type="date" />
          </label>

          <div class="filter-actions">
            <VButton size="sm" @click="clearFilters">清空筛选</VButton>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>开始日期</th>
                <th>结束日期</th>
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
              <tr v-else-if="filteredEvents.length === 0">
                <td colspan="6">暂无匹配日程</td>
              </tr>
              <tr v-for="item in filteredEvents" :key="item.metadata.name">
                <td>{{ displayDate(item.spec.startAt) }}</td>
                <td>{{ displayDate(item.spec.endAt) }}</td>
                <td>{{ item.spec.title }}</td>
                <td>{{ item.spec.relatedPostTitleSnapshot || item.spec.relatedPostName || '-' }}</td>
                <td>{{ renderHighlightMode(item) }}</td>
                <td class="row-actions">
                  <template v-if="canEdit">
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
    </div>

    <div v-else-if="canEdit" class="panel-stack create-stack">
      <VCard>
        <template #header>
          <div class="header-row">
            <div class="card-title">{{ mode === 'create' ? '新建日程' : '编辑日程' }}</div>
          </div>
        </template>

        <div class="form">
          <div class="section">
            <div class="section-title">关联文章（必填）</div>
            <div class="post-search">
              <input v-model="postKeyword" type="text" placeholder="输入关键词搜索文章" />
              <VButton :loading="searchingPosts" @click="searchPosts">搜索</VButton>
            </div>
            <select v-model="form.relatedPostName" @change="onPostSelect">
              <option value="">请选择关联文章</option>
              <option v-for="post in postOptions" :key="post.metadata.name" :value="post.metadata.name">
                {{ post.spec?.title || post.metadata.name }}
              </option>
            </select>
            <div class="post-info">
              <span>标题快照：{{ form.relatedPostTitleSnapshot || '-' }}</span>
              <span>链接快照：{{ form.relatedPostPermalinkSnapshot || '-' }}</span>
              <span>置顶快照：{{ form.relatedPostPinnedSnapshot ? '是' : '否/未知' }}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">基础信息</div>
            <div class="form-grid">

              <label class="field field-full">
                <span>事件标题</span>
                <input v-model="form.title" type="text" placeholder="留空时默认使用关联文章标题" />
              </label>

              <label class="field">
                <span>开始日期（必填）</span>
                <input v-model="form.startAt" type="date" />
              </label>

              <label class="field">
                <span>结束日期（选填）</span>
                <input v-model="form.endAt" type="date" />
              </label>

              <label class="field field-full">
                <span>摘要</span>
                <textarea v-model="form.summary" rows="3" placeholder="可选摘要"></textarea>
              </label>
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

      <VCard>
        <template #header>
          <div class="header-row">
            <div>
              <div class="card-title">本次新建日程（临时）</div>
              <div class="card-desc">仅显示当前页面会话中新建成功的记录，刷新页面后自动清空。</div>
            </div>
          </div>
        </template>

        <div class="table-wrap">
          <table class="table temp-table">
            <thead>
              <tr>
                <th>创建时间</th>
                <th>开始日期</th>
                <th>结束日期</th>
                <th>标题</th>
                <th>所属日历</th>
                <th>突出显示</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sessionCreatedEvents.length === 0">
                <td colspan="6">当前会话暂无新建日程</td>
              </tr>
              <tr v-for="(item, index) in sessionCreatedEvents" :key="`${item.createdAt}-${item.title}-${index}`">
                <td>{{ item.createdAt }}</td>
                <td>{{ item.startAt }}</td>
                <td>{{ item.endAt || '-' }}</td>
                <td>{{ item.title }}</td>
                <td>{{ item.calendarDisplayName }}</td>
                <td>{{ item.highlightMode }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </VCard>
    </div>
    <div v-else class="panel-stack">
      <VCard>
        <template #header>
          <div class="header-row">
            <div class="card-title">新建日程</div>
          </div>
        </template>
        <div class="readonly-block">
          当前账号仅有日程只读权限，无法新建或编辑日程。
        </div>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/admin-kit/index.css';

.header-row {
  margin-top: 20px;
  margin-left: 20px;
}
</style>
