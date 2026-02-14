package com.bi1kbu.pluginschedule.endpoint;

import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.webflux.core.fn.SpringdocRouteBuilder.route;

import com.bi1kbu.pluginschedule.ScheduleLogQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleLog;
import com.bi1kbu.pluginschedule.extension.ScheduleLog.ChangeDetail;
import com.bi1kbu.pluginschedule.service.ScheduleLogService;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
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
import run.halo.app.extension.Metadata;

@Component
@RequiredArgsConstructor
public class ScheduleLogEndpoint implements CustomEndpoint {

    private static final String DEFAULT_OPERATOR = "unknown";
    private final ScheduleLogService scheduleLogService;

    @Override
    public RouterFunction<ServerResponse> endpoint() {
        final var tag = "api.schedule.bi1kbu.com/v1alpha1/ScheduleLog";
        return route()
            .GET("schedulelogs", this::listLogs, builder -> {
                builder.operationId("ListScheduleLogs")
                    .description("List schedule logs")
                    .tag(tag)
                    .response(responseBuilder().implementation(
                        ListResult.generateGenericClass(ScheduleLog.class)));
                ScheduleLogQuery.buildParameters(builder);
            })
            .POST("schedulelogs", this::recordLog, builder -> builder
                .operationId("CreateScheduleLog")
                .description("Create schedule log")
                .tag(tag)
                .response(responseBuilder().implementation(ScheduleLog.class)))
            .POST("schedulelogs/record", this::recordLog, builder -> builder
                .operationId("RecordScheduleLog")
                .description("Record schedule log")
                .tag(tag)
                .response(responseBuilder().implementation(ScheduleLog.class)))
            .build();
    }

    @Override
    public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion("api.schedule.bi1kbu.com/v1alpha1");
    }

    private Mono<ServerResponse> listLogs(ServerRequest request) {
        ScheduleLogQuery query = new ScheduleLogQuery(request.exchange());
        return scheduleLogService.listLogs(query)
            .flatMap(logs -> Flux.fromStream(logs.get())
                .filter(this::notDeleting)
                .filter(log -> keywordMatches(log, query.getKeyword()))
                .filter(log -> dateMatches(log, query.getFromDate(), query.getToDate()))
                .collectList()
                .flatMap(items -> ServerResponse.ok().bodyValue(
                    new ListResult<>(logs.getPage(), logs.getSize(), (long) items.size(), items)
                )));
    }

    private Mono<ServerResponse> recordLog(ServerRequest request) {
        return request.bodyToMono(RecordLogRequest.class)
            .switchIfEmpty(Mono.error(new ServerWebInputException("request body is required")))
            .flatMap(body -> validateBody(body)
                .flatMap(validBody -> request.principal()
                    .map(Principal::getName)
                    .defaultIfEmpty(DEFAULT_OPERATOR)
                    .flatMap(operator -> scheduleLogService.recordLog(toLog(validBody, operator)))))
            .flatMap(created -> ServerResponse.ok().bodyValue(created));
    }

    private Mono<RecordLogRequest> validateBody(RecordLogRequest body) {
        if (StringUtils.isBlank(body.actionType)) {
            return Mono.error(new ServerWebInputException("actionType must not be blank"));
        }
        return Mono.just(body);
    }

    private ScheduleLog toLog(RecordLogRequest body, String operator) {
        var log = new ScheduleLog();
        var metadata = new Metadata();
        metadata.setGenerateName("schedule-log-");
        log.setMetadata(metadata);
        var spec = new ScheduleLog.Spec();
        spec.setActionType(StringUtils.trimToEmpty(body.actionType));
        spec.setOperator(StringUtils.defaultIfBlank(operator, DEFAULT_OPERATOR));
        spec.setActionAt(Instant.now().toString());
        spec.setCalendarName(StringUtils.trimToNull(body.calendarName));
        spec.setEventName(StringUtils.trimToNull(body.eventName));
        spec.setEventTitle(StringUtils.trimToNull(body.eventTitle));
        spec.setKeyword(StringUtils.trimToNull(body.keyword));
        spec.setSummary(StringUtils.trimToNull(body.summary));
        spec.setDetails(mapDetails(body.details));
        log.setSpec(spec);
        return log;
    }

    private List<ChangeDetail> mapDetails(List<ChangeDetailRequest> details) {
        if (details == null || details.isEmpty()) {
            return null;
        }
        return details.stream()
            .filter(detail -> StringUtils.isNotBlank(detail.field) || StringUtils.isNotBlank(detail.label))
            .map(detail -> {
                var mapped = new ChangeDetail();
                mapped.setField(StringUtils.trimToEmpty(detail.field));
                mapped.setLabel(StringUtils.trimToEmpty(detail.label));
                mapped.setOldValue(StringUtils.trimToNull(detail.oldValue));
                mapped.setNewValue(StringUtils.trimToNull(detail.newValue));
                return mapped;
            })
            .toList();
    }

    private boolean notDeleting(ScheduleLog log) {
        return log.getMetadata() == null || log.getMetadata().getDeletionTimestamp() == null;
    }

    private boolean keywordMatches(ScheduleLog log, String keyword) {
        if (StringUtils.isBlank(keyword)) {
            return true;
        }
        String lowerKeyword = keyword.trim().toLowerCase();
        String actionType = getValue(log, ValueType.ACTION_TYPE);
        String operator = getValue(log, ValueType.OPERATOR);
        String eventTitle = getValue(log, ValueType.EVENT_TITLE);
        String summary = getValue(log, ValueType.SUMMARY);
        String snapshotKeyword = getValue(log, ValueType.KEYWORD);
        return contains(lowerKeyword, actionType)
            || contains(lowerKeyword, operator)
            || contains(lowerKeyword, eventTitle)
            || contains(lowerKeyword, summary)
            || contains(lowerKeyword, snapshotKeyword);
    }

    private boolean dateMatches(ScheduleLog log, String fromDate, String toDate) {
        String actionAt = getValue(log, ValueType.ACTION_AT);
        if (StringUtils.isBlank(actionAt) || actionAt.length() < 10) {
            return StringUtils.isAllBlank(fromDate, toDate);
        }
        String dateKey = actionAt.substring(0, 10);
        if (StringUtils.isNotBlank(fromDate) && dateKey.compareTo(fromDate) < 0) {
            return false;
        }
        if (StringUtils.isNotBlank(toDate) && dateKey.compareTo(toDate) > 0) {
            return false;
        }
        return true;
    }

    private boolean contains(String keyword, String value) {
        return StringUtils.isNotBlank(value) && value.toLowerCase().contains(keyword);
    }

    private String getValue(ScheduleLog log, ValueType type) {
        if (log == null || log.getSpec() == null) {
            return "";
        }
        var spec = log.getSpec();
        return switch (type) {
            case ACTION_TYPE -> StringUtils.defaultString(spec.getActionType());
            case OPERATOR -> StringUtils.defaultString(spec.getOperator());
            case ACTION_AT -> StringUtils.defaultString(spec.getActionAt());
            case EVENT_TITLE -> StringUtils.defaultString(spec.getEventTitle());
            case SUMMARY -> StringUtils.defaultString(spec.getSummary());
            case KEYWORD -> StringUtils.defaultString(spec.getKeyword());
        };
    }

    private enum ValueType {
        ACTION_TYPE, OPERATOR, ACTION_AT, EVENT_TITLE, SUMMARY, KEYWORD
    }

    private static class RecordLogRequest {
        private String actionType;
        private String calendarName;
        private String eventName;
        private String eventTitle;
        private String keyword;
        private String summary;
        private List<ChangeDetailRequest> details;

        public String getActionType() {
            return actionType;
        }

        public void setActionType(String actionType) {
            this.actionType = actionType;
        }

        public String getCalendarName() {
            return calendarName;
        }

        public void setCalendarName(String calendarName) {
            this.calendarName = calendarName;
        }

        public String getEventName() {
            return eventName;
        }

        public void setEventName(String eventName) {
            this.eventName = eventName;
        }

        public String getEventTitle() {
            return eventTitle;
        }

        public void setEventTitle(String eventTitle) {
            this.eventTitle = eventTitle;
        }

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getSummary() {
            return summary;
        }

        public void setSummary(String summary) {
            this.summary = summary;
        }

        public List<ChangeDetailRequest> getDetails() {
            return details;
        }

        public void setDetails(List<ChangeDetailRequest> details) {
            this.details = details;
        }
    }

    private static class ChangeDetailRequest {
        private String field;
        private String label;
        private String oldValue;
        private String newValue;

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public String getOldValue() {
            return oldValue;
        }

        public void setOldValue(String oldValue) {
            this.oldValue = oldValue;
        }

        public String getNewValue() {
            return newValue;
        }

        public void setNewValue(String newValue) {
            this.newValue = newValue;
        }
    }
}
