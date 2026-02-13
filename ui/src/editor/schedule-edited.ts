import {
  type Editor,
  isActive,
  mergeAttributes,
  Node,
  nodeInputRule,
  type Range,
  type EditorState,
  VueNodeViewRenderer,
} from '@halo-dev/richtext-editor'
import { markRaw } from 'vue'
import RiCalendarScheduleLine from '~icons/ri/calendar-schedule-line'
import RiDeleteBinLine from '~icons/ri/delete-bin-line?color=red'
import ScheduleView from './ScheduleView.vue'
import ScheduleToolboxItem from './ScheduleToolboxItem.vue'
import { deleteNode } from '@/utils/delete-node'

declare module '@halo-dev/richtext-editor' {
  interface Commands<ReturnType> {
    'schedule-view': {
      setScheduleView: (options: { calendarName?: string; showTitle?: boolean; renderStyle?: string }) => ReturnType
    }
  }
}

const ScheduleExtension = Node.create({
  name: 'schedule-view',
  group: 'block',
  fakeSelection: true,

  addAttributes() {
    return {
      calendarName: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('calendar-name') || '',
        renderHTML: (attributes: { calendarName?: string }) => {
          if (!attributes.calendarName) {
            return {}
          }
          return {
            'calendar-name': attributes.calendarName,
          }
        },
      },
      showTitle: {
        default: true,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('show-title')
          if (raw === null) {
            return true
          }
          return !['false', '0', 'off', 'no'].includes(raw.trim().toLowerCase())
        },
        renderHTML: (attributes: { showTitle?: boolean }) => ({
          'show-title': attributes.showTitle === false ? 'false' : 'true',
        }),
      },
      renderStyle: {
        default: 'default',
        parseHTML: () => 'default',
        renderHTML: (attributes: { renderStyle?: string }) => ({
          'render-style': attributes.renderStyle === 'default' ? 'default' : 'default',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'schedule-view' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ['schedule-view', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      setScheduleView:
        (options: { calendarName?: string; showTitle?: boolean; renderStyle?: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$schedule-view\$$/,
        type: this.type,
      }),
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(ScheduleView)
  },

  addOptions() {
    return {
      getCommandMenuItems() {
        return {
          priority: 220,
          icon: markRaw(RiCalendarScheduleLine),
          title: '日程组件',
          keywords: ['schedule', 'calendar', '日程', '日历'],
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            editor.chain().focus().setScheduleView({ showTitle: true, renderStyle: 'default' }).deleteRange(range).run()
          },
        }
      },
      getToolboxItems({ editor }: { editor: Editor }) {
        return {
          priority: 58,
          component: markRaw(ScheduleToolboxItem),
          props: { editor },
        }
      },
      getBubbleMenu({ editor }: { editor: Editor }) {
        return {
          pluginKey: 'schedule-view-bubble-menu',
          shouldShow: ({ state }: { state: EditorState }) => isActive(state, ScheduleExtension.name),
          items: [
            {
              priority: 45,
              props: {
                icon: markRaw(RiDeleteBinLine),
                title: '删除',
                action: ({ editor }: { editor: Editor }) => {
                  deleteNode(ScheduleExtension.name, editor)
                },
              },
            },
          ],
        }
      },
    }
  },
})

export default ScheduleExtension
