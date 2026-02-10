export interface Metadata {
  name?: string
  generateName?: string
  version?: number
  creationTimestamp?: string
  deletionTimestamp?: string
}

export interface ScheduleCalendar {
  apiVersion: string
  kind: string
  metadata: Metadata
  spec: {
    displayName: string
    themeColor?: string
    visible?: boolean
    showCalendarTitle?: boolean
  }
  status?: {
    eventCount?: number
    rangeStartMonth?: string
    rangeEndMonth?: string
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
    relatedPostPermalinkSnapshot?: string
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
