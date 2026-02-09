export interface Metadata {
  name?: string
  generateName?: string
  deletionTimestamp?: string
}

export interface ScheduleCalendar {
  apiVersion: string
  kind: string
  metadata: Metadata
  spec: {
    displayName: string
    slug?: string
    themeColor?: string
    visible?: boolean
  }
  status?: {
    eventCount?: number
  }
}

export interface ScheduleEvent {
  apiVersion: string
  kind: string
  metadata: Metadata
  spec: {
    calendarName: string
    title: string
    startAt: string
    endAt?: string
    allDay?: boolean
    timezone?: string
    summary?: string
    status?: 'published' | 'cancelled'
    relatedPostName?: string
    relatedPostTitleSnapshot?: string
    relatedPostPinnedSnapshot?: boolean
    forceHighlight?: boolean
    forceHideHighlight?: boolean
  }
}

export interface ListResult<T> {
  total: number
  page: number
  size: number
  items: T[]
}

export interface Post {
  metadata: { name: string }
  spec?: { title?: string; pinned?: boolean; topPriority?: number }
  status?: { permalink?: string; pinned?: boolean }
}
