package com.bi1kbu.pluginschedule.service.impl;

import com.bi1kbu.pluginschedule.ScheduleEventQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleEvent;
import com.bi1kbu.pluginschedule.service.ScheduleEventService;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListResult;
import run.halo.app.extension.PageRequestImpl;
import run.halo.app.extension.ReactiveExtensionClient;

@Component
public class ScheduleEventServiceImpl implements ScheduleEventService {

    private final ReactiveExtensionClient client;

    public ScheduleEventServiceImpl(ReactiveExtensionClient client) {
        this.client = client;
    }

    @Override
    public Mono<ListResult<ScheduleEvent>> listEvents(ScheduleEventQuery query) {
        return client.listBy(
            ScheduleEvent.class,
            query.toListOptions(),
            PageRequestImpl.of(query.getPage(), query.getSize(), query.getSort())
        );
    }
}
