package com.bi1kbu.pluginschedule;

import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;
import static run.halo.app.extension.index.query.Queries.equal;
import static run.halo.app.extension.router.QueryParamBuildUtil.sortParameter;

import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Optional;
import org.apache.commons.lang3.StringUtils;
import org.springdoc.core.fn.builders.operation.Builder;
import org.springframework.lang.Nullable;
import org.springframework.web.server.ServerWebExchange;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.router.IListRequest;
import run.halo.app.extension.router.SortableRequest;

public class ScheduleEventQuery extends SortableRequest {

    public ScheduleEventQuery(ServerWebExchange exchange) {
        super(exchange);
    }

    @Schema(description = "按日历名称过滤")
    public String getCalendar() {
        return queryParams.getFirst("calendar");
    }

    @Nullable
    @Schema(description = "开始时间（ISO-8601）")
    public String getFrom() {
        return queryParams.getFirst("from");
    }

    @Nullable
    @Schema(description = "结束时间（ISO-8601）")
    public String getTo() {
        return queryParams.getFirst("to");
    }

    @Nullable
    @Schema(description = "按状态过滤")
    public String getStatus() {
        return queryParams.getFirst("status");
    }

    @Override
    public ListOptions toListOptions() {
        var builder = ListOptions.builder(super.toListOptions());

        Optional.ofNullable(getCalendar())
            .filter(StringUtils::isNotBlank)
            .ifPresent(calendar -> builder.andQuery(equal("spec.calendarName", calendar)));

        Optional.ofNullable(getStatus())
            .filter(StringUtils::isNotBlank)
            .ifPresent(status -> builder.andQuery(equal("spec.status", status)));

        return builder.build();
    }

    public static void buildParameters(Builder builder) {
        IListRequest.buildParameters(builder);
        builder.parameter(sortParameter())
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("calendar")
                .description("按日历名称过滤")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("from")
                .description("开始时间（ISO-8601）")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("to")
                .description("结束时间（ISO-8601）")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("status")
                .description("按状态过滤")
                .implementation(String.class)
                .required(false));
    }
}
