<script setup lang="ts">
import { listScheduleLogs } from '@/api/schedule'
import type { ScheduleLog } from '@/types'
import { Toast, VButton, VCard } from '@halo-dev/components'
import { computed, onMounted, reactive, ref } from 'vue'

const loading = ref(false)
const logs = ref<ScheduleLog[]>([])

const page = ref(1)
const size = ref(20)
const total = ref(0)
const expandedLogNames = ref<string[]>([])

const filters = reactive({
  actionType: '',
  operator: '',
  keyword: '',
  fromDate: '',
  toDate: '',
})

const pageCount = computed(() => {
  const count = Math.ceil((total.value || 0) / (size.value || 20))
  return count > 0 ? count : 1
})

const actionTypeOptions = computed(() => {
  const fromLogs = logs.value
    .map((item) => item.spec.actionType || '')
    .filter((item) => !!item)
  const set = new Set(fromLogs)
  if (filters.actionType) {
    set.add(filters.actionType)
  }
  return Array.from(set)
})

const operatorOptions = computed(() => {
  const fromLogs = logs.value
    .map((item) => item.spec.operator || '')
    .filter((item) => !!item)
  const set = new Set(fromLogs)
  if (filters.operator) {
    set.add(filters.operator)
  }
  return Array.from(set)
})

const fetchLogs = async () => {
  loading.value = true
  try {
    const data = await listScheduleLogs({
      page: page.value,
      size: size.value,
      sort: ['spec.actionAt,desc'],
      actionType: filters.actionType || undefined,
      operator: filters.operator || undefined,
      keyword: filters.keyword.trim() || undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
    })
    logs.value = data.items || []
    total.value = data.total || 0
    expandedLogNames.value = expandedLogNames.value.filter((name) =>
      logs.value.some((log) => (log.metadata.name || '') === name)
    )
  } catch (e) {
    console.error(e)
    Toast.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  page.value = 1
  await fetchLogs()
}

const resetFilters = async () => {
  filters.actionType = ''
  filters.operator = ''
  filters.keyword = ''
  filters.fromDate = ''
  filters.toDate = ''
  page.value = 1
  await fetchLogs()
}

const setActionType = async (value: string) => {
  if (filters.actionType === value) {
    return
  }
  filters.actionType = value
  await applyFilters()
}

const setOperator = async (value: string) => {
  if (filters.operator === value) {
    return
  }
  filters.operator = value
  await applyFilters()
}

const prevPage = async () => {
  if (page.value <= 1) return
  page.value -= 1
  await fetchLogs()
}

const nextPage = async () => {
  if (page.value >= pageCount.value) return
  page.value += 1
  await fetchLogs()
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`
}

const getLogName = (item: ScheduleLog) => item.metadata.name || ''

const isExpanded = (item: ScheduleLog) => expandedLogNames.value.includes(getLogName(item))

const toggleExpand = (item: ScheduleLog) => {
  const name = getLogName(item)
  if (!name) {
    return
  }
  if (expandedLogNames.value.includes(name)) {
    expandedLogNames.value = expandedLogNames.value.filter((itemName) => itemName !== name)
    return
  }
  expandedLogNames.value = [...expandedLogNames.value, name]
}

const hasDetails = (item: ScheduleLog) => (item.spec.details || []).length > 0

onMounted(async () => {
  await fetchLogs()
})
</script>

<template>
  <div class="page">
    <VCard>
      <template #header>
        <div class="header-row">
          <div class="card-title">操作日志</div>
        </div>
      </template>

      <div class="filters-wrap">
        <div class="filter-panel">
          <div class="filter-row">
            <div class="filter-title">操作类型</div>
            <div class="filter-values">
              <button class="filter-pill" :class="{ active: !filters.actionType }" type="button" @click="setActionType('')">
                全部
              </button>
              <button
                v-for="item in actionTypeOptions"
                :key="`action-${item}`"
                class="filter-pill"
                :class="{ active: filters.actionType === item }"
                type="button"
                @click="setActionType(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <div class="filter-row">
            <div class="filter-title">操作人</div>
            <div class="filter-values">
              <button class="filter-pill" :class="{ active: !filters.operator }" type="button" @click="setOperator('')">
                全部
              </button>
              <button
                v-for="item in operatorOptions"
                :key="`operator-${item}`"
                class="filter-pill"
                :class="{ active: filters.operator === item }"
                type="button"
                @click="setOperator(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>
        </div>

        <div class="logs-input-grid">
          <label class="field">
            <span>关键词</span>
            <input v-model="filters.keyword" type="text" placeholder="输入编号关键字" @keyup.enter="applyFilters" />
          </label>

          <label class="field">
            <span>开始日期</span>
            <input v-model="filters.fromDate" type="date" @change="applyFilters" />
          </label>

          <label class="field">
            <span>结束日期</span>
            <input v-model="filters.toDate" type="date" @change="applyFilters" />
          </label>
        </div>

        <div class="filter-actions logs-filter-actions">
          <VButton @click="resetFilters">重置筛选</VButton>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>操作</th>
              <th>标题</th>
              <th>操作人</th>
              <th>时间</th>
              <th>摘要</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5">加载中...</td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td colspan="5">暂无日志</td>
            </tr>
            <template v-for="item in logs" :key="item.metadata.name">
              <tr class="log-main-row" :class="{ expanded: isExpanded(item) }" @click="toggleExpand(item)">
                <td>{{ item.spec.actionType || '-' }}</td>
                <td>{{ item.spec.eventTitle || item.spec.keyword || '-' }}</td>
                <td>{{ item.spec.operator || '-' }}</td>
                <td>{{ formatDateTime(item.spec.actionAt) }}</td>
                <td>{{ item.spec.summary || '-' }}</td>
              </tr>
              <tr v-if="isExpanded(item)" class="log-detail-row">
                <td colspan="5">
                  <div v-if="hasDetails(item)" class="log-detail-wrap">
                    <table class="log-detail-table">
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>原值</th>
                          <th>新值</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(detail, index) in item.spec.details || []" :key="`${item.metadata.name}-${index}`">
                          <td>{{ detail.label || detail.field || '-' }}</td>
                          <td>{{ detail.oldValue || '-' }}</td>
                          <td>{{ detail.newValue || '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="log-detail-empty">暂无字段级明细</div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="pager">
        <div>共 {{ total }} 条</div>
        <div class="pager-right">
          <span>每页</span>
          <select v-model.number="size" @change="applyFilters">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span>条</span>
          <VButton size="sm" :disabled="page <= 1" @click="prevPage">上一页</VButton>
          <span>{{ page }} / {{ pageCount }}</span>
          <VButton size="sm" :disabled="page >= pageCount" @click="nextPage">下一页</VButton>
        </div>
      </div>
    </VCard>
  </div>
</template>

<style scoped>
@import '../styles/admin-kit/index.css';

.header-row {
  margin-top: 20px;
  margin-left: 20px;
}
</style>
