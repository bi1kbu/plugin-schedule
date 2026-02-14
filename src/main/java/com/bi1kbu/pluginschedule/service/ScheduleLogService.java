package com.bi1kbu.pluginschedule.service;

import com.bi1kbu.pluginschedule.ScheduleLogQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleLog;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListResult;

public interface ScheduleLogService {
    Mono<ListResult<ScheduleLog>> listLogs(ScheduleLogQuery query);

    Mono<ScheduleLog> recordLog(ScheduleLog log);
}
