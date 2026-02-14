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

public class ScheduleLogQuery extends SortableRequest {

    public ScheduleLogQuery(ServerWebExchange exchange) {
        super(exchange);
    }

    @Nullable
    @Schema(description = "按操作类型过滤")
    public String getActionType() {
        return queryParams.getFirst("actionType");
    }

    @Nullable
    @Schema(description = "按操作人过滤")
    public String getOperator() {
        return queryParams.getFirst("operator");
    }

    @Nullable
    @Schema(description = "按关键字过滤")
    public String getKeyword() {
        return queryParams.getFirst("keyword");
    }

    @Nullable
    @Schema(description = "开始日期（YYYY-MM-DD）")
    public String getFromDate() {
        return queryParams.getFirst("fromDate");
    }

    @Nullable
    @Schema(description = "结束日期（YYYY-MM-DD）")
    public String getToDate() {
        return queryParams.getFirst("toDate");
    }

    @Override
    public ListOptions toListOptions() {
        var builder = ListOptions.builder(super.toListOptions());
        Optional.ofNullable(getActionType())
            .filter(StringUtils::isNotBlank)
            .ifPresent(actionType -> builder.andQuery(equal("spec.actionType", actionType)));
        Optional.ofNullable(getOperator())
            .filter(StringUtils::isNotBlank)
            .ifPresent(operator -> builder.andQuery(equal("spec.operator", operator)));
        return builder.build();
    }

    public static void buildParameters(Builder builder) {
        IListRequest.buildParameters(builder);
        builder.parameter(sortParameter())
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("actionType")
                .description("按操作类型过滤")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("operator")
                .description("按操作人过滤")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("keyword")
                .description("按关键字过滤")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("fromDate")
                .description("开始日期（YYYY-MM-DD）")
                .implementation(String.class)
                .required(false))
            .parameter(parameterBuilder()
                .in(ParameterIn.QUERY)
                .name("toDate")
                .description("结束日期（YYYY-MM-DD）")
                .implementation(String.class)
                .required(false));
    }
}
