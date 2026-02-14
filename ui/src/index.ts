import { definePlugin } from '@halo-dev/ui-shared'
import { defineAsyncComponent, markRaw } from 'vue'
import { VLoading } from '@halo-dev/components'
import RiCalendarLine from '~icons/ri/calendar-line'
import RiCalendarTodoLine from '~icons/ri/calendar-todo-line'
import RiCalendarScheduleLine from '~icons/ri/calendar-schedule-line'
import RiFileList3Line from '~icons/ri/file-list-3-line'
import { ScheduleExtension } from '@/editor'

const buildScheduleRoute = (nameSuffix = '') => ({
  parentName: 'Root',
  route: {
    path: '/schedule',
    name: `ScheduleRoot${nameSuffix}`,
    redirect: '/schedule/events',
    component: defineAsyncComponent({
      loader: () => import('@/views/ScheduleLayoutView.vue'),
      loadingComponent: VLoading,
    }),
    meta: {
      title: '日程',
      permissions: ['plugin:schedule:read'],
      menu: {
        name: '日程',
        group: 'content',
        icon: markRaw(RiCalendarScheduleLine),
        priority: 8,
      },
    },
    children: [
      {
        path: 'calendars',
        name: `ScheduleCalendars${nameSuffix}`,
        component: defineAsyncComponent({
          loader: () => import('@/views/ScheduleCalendarsView.vue'),
          loadingComponent: VLoading,
        }),
        meta: {
          title: '日历配置',
          searchable: true,
          permissions: ['plugin:schedule:calendar-manage'],
          menu: {
            name: '日历配置',
            icon: markRaw(RiCalendarLine),
            priority: 10,
          },
        },
      },
      {
        path: 'events',
        name: `ScheduleEvents${nameSuffix}`,
        component: defineAsyncComponent({
          loader: () => import('@/views/ScheduleEventsView.vue'),
          loadingComponent: VLoading,
        }),
        meta: {
          title: '日程管理',
          searchable: true,
          permissions: ['plugin:schedule:read'],
          menu: {
            name: '日程管理',
            icon: markRaw(RiCalendarTodoLine),
            priority: 20,
          },
        },
      },
      {
        path: 'logs',
        name: `ScheduleLogs${nameSuffix}`,
        component: defineAsyncComponent({
          loader: () => import('@/views/ScheduleLogsView.vue'),
          loadingComponent: VLoading,
        }),
        meta: {
          title: '操作日志',
          searchable: true,
          permissions: ['plugin:schedule:read'],
          menu: {
            name: '操作日志',
            icon: markRaw(RiFileList3Line),
            priority: 30,
          },
        },
      },
    ],
  },
})

export default definePlugin({
  routes: [buildScheduleRoute('')],
  ucRoutes: [buildScheduleRoute('UC')],
  extensionPoints: {
    'default:editor:extension:create': () => {
      return [ScheduleExtension]
    },
  },
})
