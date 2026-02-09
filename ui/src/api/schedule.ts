import { axiosInstance } from '@halo-dev/api-client'
import type { ListResult, Post, ScheduleCalendar, ScheduleEvent } from '@/types'

const CALENDAR_API = '/apis/schedule.bi1kbu.com/v1alpha1/schedulecalendars'
const EVENT_API = '/apis/schedule.bi1kbu.com/v1alpha1/scheduleevents'
const PUBLIC_API = '/apis/api.schedule.bi1kbu.com/v1alpha1'

export async function listCalendars(page = 1, size = 50) {
  const { data } = await axiosInstance.get<ListResult<ScheduleCalendar>>(`${PUBLIC_API}/schedulecalendars`, {
    params: { page, size },
  })
  return data
}

export async function createCalendar(payload: Partial<ScheduleCalendar>) {
  const { data } = await axiosInstance.post<ScheduleCalendar>(CALENDAR_API, payload)
  return data
}

export async function updateCalendar(name: string, payload: ScheduleCalendar) {
  const { data } = await axiosInstance.put<ScheduleCalendar>(`${CALENDAR_API}/${name}`, payload)
  return data
}

export async function deleteCalendar(name: string) {
  await axiosInstance.delete(`${CALENDAR_API}/${name}`)
}

export async function listEvents(params: Record<string, any>) {
  const { data } = await axiosInstance.get<ListResult<ScheduleEvent>>(`${PUBLIC_API}/scheduleevents`, { params })
  return data
}

export async function createEvent(payload: Partial<ScheduleEvent>) {
  const { data } = await axiosInstance.post<ScheduleEvent>(EVENT_API, payload)
  return data
}

export async function updateEvent(name: string, payload: ScheduleEvent) {
  const { data } = await axiosInstance.put<ScheduleEvent>(`${EVENT_API}/${name}`, payload)
  return data
}

export async function deleteEvent(name: string) {
  await axiosInstance.delete(`${EVENT_API}/${name}`)
}

export async function listPosts(keyword = '') {
  const { data } = await axiosInstance.get<ListResult<Post>>('/apis/content.halo.run/v1alpha1/posts', {
    params: {
      page: 1,
      size: 50,
      keyword,
      sort: ['spec.publishTime,desc'],
    },
  })
  return data.items || []
}
