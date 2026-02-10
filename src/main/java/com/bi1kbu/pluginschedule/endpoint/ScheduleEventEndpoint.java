package com.bi1kbu.pluginschedule.endpoint;

import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;
import static org.springdoc.webflux.core.fn.SpringdocRouteBuilder.route;

import com.bi1kbu.pluginschedule.ScheduleEventQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleEvent;
import com.bi1kbu.pluginschedule.service.ScheduleEventService;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ServerWebInputException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;
import run.halo.app.extension.ListResult;

@Component
@RequiredArgsConstructor
public class ScheduleEventEndpoint implements CustomEndpoint {

    private final ScheduleEventService scheduleEventService;

    @Override
    public RouterFunction<ServerResponse> endpoint() {
        final var tag = "api.schedule.bi1kbu.com/v1alpha1/Schedule";
        return route()
            .GET("scheduleevents", this::listEvents, builder -> {
                builder.operationId("ListScheduleEvents")
                    .description("List schedule events")
                    .tag(tag)
                    .response(responseBuilder().implementation(
                        ListResult.generateGenericClass(ScheduleEvent.class)));
                ScheduleEventQuery.buildParameters(builder);
            })
            .GET("scheduleevents/upcoming", this::listUpcoming, builder -> {
                builder.operationId("ListUpcomingEvents")
                    .description("List upcoming events")
                    .tag(tag)
                    .parameter(parameterBuilder()
                        .name("calendar")
                        .in(ParameterIn.QUERY)
                        .description("Calendar metadata name")
                        .required(true)
                        .implementation(String.class))
                    .parameter(parameterBuilder()
                        .name("from")
                        .in(ParameterIn.QUERY)
                        .description("Start date-time in ISO-8601")
                        .required(true)
                        .implementation(String.class))
                    .parameter(parameterBuilder()
                        .name("to")
                        .in(ParameterIn.QUERY)
                        .description("End date-time in ISO-8601")
                        .required(true)
                        .implementation(String.class))
                    .response(responseBuilder().implementation(
                        ListResult.generateGenericClass(ScheduleEvent.class)));
            })
            .build();
    }

    @Override
    public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion("api.schedule.bi1kbu.com/v1alpha1");
    }

    private Mono<ServerResponse> listEvents(ServerRequest request) {
        String from = request.queryParam("from").orElse("");
        String to = request.queryParam("to").orElse("");
        ScheduleEventQuery query = new ScheduleEventQuery(request.exchange());
        return scheduleEventService.listEvents(query)
            .flatMap(events -> Flux.fromStream(events.get())
                .filter(this::notDeleting)
                .filter(event -> inTimeRange(event, from, to))
                .collectList()
                .flatMap(items -> ServerResponse.ok().bodyValue(
                    new ListResult<>(events.getPage(), events.getSize(), (long) items.size(), items)
                )));
    }

    private Mono<ServerResponse> listUpcoming(ServerRequest request) {
        String calendar = request.queryParam("calendar").orElse("");
        String from = request.queryParam("from").orElse("");
        String to = request.queryParam("to").orElse("");

        if (StringUtils.isAnyBlank(calendar, from, to)) {
            throw new ServerWebInputException("calendar/from/to must not be blank");
        }

        ScheduleEventQuery query = new ScheduleEventQuery(request.exchange());
        return scheduleEventService.listEvents(query)
            .flatMap(events -> Flux.fromStream(events.get())
                .filter(this::notDeleting)
                .filter(event -> inTimeRange(event, from, to))
                .collectList()
                .flatMap(items -> ServerResponse.ok().bodyValue(
                    new ListResult<>(events.getPage(), events.getSize(), (long) items.size(), items)
                )));
    }

    private boolean notDeleting(ScheduleEvent event) {
        return event.getMetadata() == null || event.getMetadata().getDeletionTimestamp() == null;
    }

    private boolean inTimeRange(ScheduleEvent event, String from, String to) {
        String startAt = event.getSpec() != null ? event.getSpec().getStartAt() : null;
        if (StringUtils.isBlank(startAt)) {
            return false;
        }

        String endAt = event.getSpec() != null ? event.getSpec().getEndAt() : null;
        String effectiveEndAt = StringUtils.isNotBlank(endAt) ? endAt : startAt;

        if (StringUtils.isNotBlank(from) && effectiveEndAt.compareTo(from) < 0) {
            return false;
        }
        if (StringUtils.isNotBlank(to) && startAt.compareTo(to) > 0) {
            return false;
        }
        return true;
    }
}
