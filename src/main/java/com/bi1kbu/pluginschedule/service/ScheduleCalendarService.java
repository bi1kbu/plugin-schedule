package com.bi1kbu.pluginschedule.service;

import com.bi1kbu.pluginschedule.ScheduleCalendarQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleCalendar;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListResult;

public interface ScheduleCalendarService {
    Mono<ListResult<ScheduleCalendar>> listCalendars(ScheduleCalendarQuery query);
}
