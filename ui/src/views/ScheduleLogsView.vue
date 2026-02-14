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
        <div class="filters-grid">
          <label class="field">
            <span>操作类型</span>
            <select v-model="filters.actionType">
              <option value="">全部</option>
              <option value="创建日程">创建日程</option>
              <option value="更新日程">更新日程</option>
              <option value="删除日程">删除日程</option>
            </select>
          </label>

          <label class="field">
            <span>操作人</span>
            <input v-model="filters.operator" type="text" placeholder="输入操作人" />
          </label>

          <label class="field">
            <span>标题关键词</span>
            <input v-model="filters.keyword" type="text" placeholder="输入标题关键字" />
          </label>

          <label class="field">
            <span>开始日期</span>
            <input v-model="filters.fromDate" type="date" />
          </label>

          <label class="field">
            <span>结束日期</span>
            <input v-model="filters.toDate" type="date" />
          </label>
        </div>

        <div class="filter-actions">
          <VButton type="primary" :loading="loading" @click="applyFilters">查询</VButton>
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
              <tr class="log-row" @click="toggleExpand(item)">
                <td>{{ item.spec.actionType || '-' }}</td>
                <td>{{ item.spec.eventTitle || item.spec.keyword || '-' }}</td>
                <td>{{ item.spec.operator || '-' }}</td>
                <td>{{ formatDateTime(item.spec.actionAt) }}</td>
                <td>{{ item.spec.summary || '-' }}</td>
              </tr>
              <tr v-if="isExpanded(item)" class="detail-row">
                <td colspan="5">
                  <div v-if="hasDetails(item)" class="detail-table-wrap">
                    <table class="detail-table">
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
                  <div v-else class="no-details">暂无字段级明细</div>
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
.page {
  padding-top: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 4px 2px 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  margin: 2px 0;
  display: inline-flex;
  align-items: center;
}

.filters-wrap {
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  min-height: 40px;
  padding: 8px 10px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.table-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.table th,
.table td {
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  padding: 10px;
  vertical-align: top;
  white-space: nowrap;
}

.table thead th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}

.table tbody tr:hover {
  background: #f8fafc;
}

.log-row {
  cursor: pointer;
}

.detail-row {
  background: #f8fafc;
}

.detail-table-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: auto;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
}

.detail-table th,
.detail-table td {
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  padding: 8px 10px;
  vertical-align: top;
  white-space: normal;
}

.detail-table thead th {
  background: #eef2ff;
  color: #334155;
  font-weight: 600;
}

.no-details {
  color: #64748b;
  padding: 8px 4px;
}

.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  gap: 12px;
}

.pager-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pager-right select {
  min-width: 72px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 4px 8px;
}

@media (max-width: 1280px) {
  .filters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }

  .pager {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
