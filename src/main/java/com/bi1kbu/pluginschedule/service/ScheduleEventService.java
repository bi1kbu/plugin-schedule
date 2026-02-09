package com.bi1kbu.pluginschedule.service;

import com.bi1kbu.pluginschedule.ScheduleEventQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleEvent;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListResult;

public interface ScheduleEventService {
    Mono<ListResult<ScheduleEvent>> listEvents(ScheduleEventQuery query);
}
