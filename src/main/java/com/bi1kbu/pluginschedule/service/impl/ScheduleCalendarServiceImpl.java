package com.bi1kbu.pluginschedule.service.impl;

import static run.halo.app.extension.index.query.Queries.equal;

import com.bi1kbu.pluginschedule.ScheduleCalendarQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleCalendar;
import com.bi1kbu.pluginschedule.extension.ScheduleEvent;
import com.bi1kbu.pluginschedule.service.ScheduleCalendarService;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ListResult;
import run.halo.app.extension.PageRequestImpl;
import run.halo.app.extension.ReactiveExtensionClient;

@Component
public class ScheduleCalendarServiceImpl implements ScheduleCalendarService {

    private final ReactiveExtensionClient client;

    public ScheduleCalendarServiceImpl(ReactiveExtensionClient client) {
        this.client = client;
    }

    @Override
    public Mono<ListResult<ScheduleCalendar>> listCalendars(ScheduleCalendarQuery query) {
        return client.listBy(
                ScheduleCalendar.class,
                query.toListOptions(),
                PageRequestImpl.of(query.getPage(), query.getSize(), query.getSort())
            )
            .flatMap(listResult -> Flux.fromStream(listResult.get())
                .flatMap(this::populateEventCount)
                .collectList()
                .map(items -> new ListResult<>(
                    listResult.getPage(),
                    listResult.getSize(),
                    listResult.getTotal(),
                    items
                )));
    }

    private Mono<ScheduleCalendar> populateEventCount(ScheduleCalendar calendar) {
        var listOptions = ListOptions.builder()
            .andQuery(equal("spec.calendarName", calendar.getMetadata().getName()))
            .build();
        return client.listAll(ScheduleEvent.class, listOptions, Sort.unsorted())
            .count()
            .map(Long::intValue)
            .defaultIfEmpty(0)
            .doOnNext(count -> calendar.getStatusOrDefault().setEventCount(count))
            .thenReturn(calendar);
    }
}
