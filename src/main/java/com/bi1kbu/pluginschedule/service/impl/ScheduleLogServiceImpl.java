package com.bi1kbu.pluginschedule.service.impl;

import com.bi1kbu.pluginschedule.ScheduleLogQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleLog;
import com.bi1kbu.pluginschedule.service.ScheduleLogService;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListResult;
import run.halo.app.extension.PageRequestImpl;
import run.halo.app.extension.ReactiveExtensionClient;

@Component
public class ScheduleLogServiceImpl implements ScheduleLogService {

    private final ReactiveExtensionClient client;

    public ScheduleLogServiceImpl(ReactiveExtensionClient client) {
        this.client = client;
    }

    @Override
    public Mono<ListResult<ScheduleLog>> listLogs(ScheduleLogQuery query) {
        return client.listBy(
            ScheduleLog.class,
            query.toListOptions(),
            PageRequestImpl.of(query.getPage(), query.getSize(), query.getSort())
        );
    }

    @Override
    public Mono<ScheduleLog> recordLog(ScheduleLog log) {
        return client.create(log);
    }
}
