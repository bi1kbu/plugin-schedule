package com.bi1kbu.pluginschedule.endpoint;

import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.webflux.core.fn.SpringdocRouteBuilder.route;

import com.bi1kbu.pluginschedule.ScheduleCalendarQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleCalendar;
import com.bi1kbu.pluginschedule.service.ScheduleCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;
import run.halo.app.extension.ListResult;

@Component
@RequiredArgsConstructor
public class ScheduleCalendarEndpoint implements CustomEndpoint {

    private final ScheduleCalendarService scheduleCalendarService;

    @Override
    public RouterFunction<ServerResponse> endpoint() {
        final var tag = "api.schedule.bi1kbu.com/v1alpha1/Schedule";
        return route()
            .GET("schedulecalendars", this::listCalendars, builder -> {
                builder.operationId("ListScheduleCalendars")
                    .description("List schedule calendars")
                    .tag(tag)
                    .response(responseBuilder().implementation(
                        ListResult.generateGenericClass(ScheduleCalendar.class)));
                ScheduleCalendarQuery.buildParameters(builder);
            })
            .build();
    }

    @Override
    public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion("api.schedule.bi1kbu.com/v1alpha1");
    }

    private Mono<ServerResponse> listCalendars(ServerRequest request) {
        ScheduleCalendarQuery query = new ScheduleCalendarQuery(request.exchange());
        return scheduleCalendarService.listCalendars(query)
            .flatMap(calendars -> ServerResponse.ok().bodyValue(calendars));
    }
}
