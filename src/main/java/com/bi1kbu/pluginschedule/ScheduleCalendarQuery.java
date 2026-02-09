package com.bi1kbu.pluginschedule;

import static run.halo.app.extension.router.QueryParamBuildUtil.sortParameter;

import org.springdoc.core.fn.builders.operation.Builder;
import org.springframework.web.server.ServerWebExchange;
import run.halo.app.extension.router.IListRequest;
import run.halo.app.extension.router.SortableRequest;

public class ScheduleCalendarQuery extends SortableRequest {

    public ScheduleCalendarQuery(ServerWebExchange exchange) {
        super(exchange);
    }

    public static void buildParameters(Builder builder) {
        IListRequest.buildParameters(builder);
        builder.parameter(sortParameter());
    }
}
