import { definePlugin } from '@halo-dev/ui-shared'
import { defineAsyncComponent, markRaw } from 'vue'
import { VLoading } from '@halo-dev/components'
import RiCalendarLine from '~icons/ri/calendar-line'
import RiCalendarTodoLine from '~icons/ri/calendar-todo-line'
import RiCalendarScheduleLine from '~icons/ri/calendar-schedule-line'
import { ScheduleExtension } from '@/editor'

export default definePlugin({
  routes: [
    {
      parentName: 'Root',
      route: {
        path: '/schedule',
        name: 'ScheduleRoot',
        redirect: '/schedule/events',
        component: defineAsyncComponent({
          loader: () => import('@/views/ScheduleLayoutView.vue'),
          loadingComponent: VLoading,
        }),
        meta: {
          title: '日程',
          permissions: ['plugin:schedule:view'],
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
            name: 'ScheduleCalendars',
            component: defineAsyncComponent({
              loader: () => import('@/views/ScheduleCalendarsView.vue'),
              loadingComponent: VLoading,
            }),
            meta: {
              title: '日历配置',
              searchable: true,
              permissions: ['plugin:schedule:view'],
              menu: {
                name: '日历配置',
                icon: markRaw(RiCalendarLine),
                priority: 10,
              },
            },
          },
          {
            path: 'events',
            name: 'ScheduleEvents',
            component: defineAsyncComponent({
              loader: () => import('@/views/ScheduleEventsView.vue'),
              loadingComponent: VLoading,
            }),
            meta: {
              title: '日程事件',
              searchable: true,
              permissions: ['plugin:schedule:view'],
              menu: {
                name: '日程事件',
                icon: markRaw(RiCalendarTodoLine),
                priority: 20,
              },
            },
          },
        ],
      },
    },
  ],
  extensionPoints: {
    'default:editor:extension:create': () => {
      return [ScheduleExtension]
    },
  },
})
