package com.bi1kbu.pluginschedule.service.impl;

import static run.halo.app.extension.index.query.Queries.equal;

import com.bi1kbu.pluginschedule.ScheduleCalendarQuery;
import com.bi1kbu.pluginschedule.extension.ScheduleCalendar;
import com.bi1kbu.pluginschedule.extension.ScheduleEvent;
import com.bi1kbu.pluginschedule.service.ScheduleCalendarService;
import java.time.Duration;
import java.util.List;
import java.util.regex.Pattern;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ListResult;
import run.halo.app.extension.PageRequestImpl;
import run.halo.app.extension.ReactiveExtensionClient;

@Component
public class ScheduleCalendarServiceImpl implements ScheduleCalendarService {

    private static final Pattern MONTH_KEY_PATTERN = Pattern.compile("\\d{4}-\\d{2}");
    private static final Pattern DATE_KEY_PATTERN = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

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
        );
    }

    @Override
    public Mono<ScheduleCalendar> refreshCalendarStats(String calendarName) {
        if (StringUtils.isBlank(calendarName)) {
            return Mono.empty();
        }
        return Mono.defer(() -> refreshCalendarStatsOnce(calendarName))
            .retryWhen(Retry.fixedDelay(2, Duration.ofMillis(100)));
    }

    private Mono<ScheduleCalendar> refreshCalendarStatsOnce(String calendarName) {
        return client.fetch(ScheduleCalendar.class, calendarName)
            .flatMap(calendar -> calculateCalendarStats(calendarName)
                .flatMap(stats -> {
                    var status = calendar.getStatusOrDefault();
                    status.setEventCount(stats.eventCount());
                    status.setRangeStartMonth(stats.rangeStartMonth());
                    status.setRangeEndMonth(stats.rangeEndMonth());
                    status.setRangeEndDate(stats.rangeEndDate());
                    return client.update(calendar);
                }));
    }

    private Mono<CalendarStats> calculateCalendarStats(String calendarName) {
        var listOptions = ListOptions.builder()
            .andQuery(equal("spec.calendarName", calendarName))
            .build();
        return client.listAll(ScheduleEvent.class, listOptions, Sort.unsorted())
            .collectList()
            .map(this::calculateStatsFromEvents);
    }

    private CalendarStats calculateStatsFromEvents(List<ScheduleEvent> events) {
        String minMonth = null;
        String maxMonth = null;
        String maxDate = null;
        for (ScheduleEvent event : events) {
            if (event == null || event.getSpec() == null) {
                continue;
            }
            String startDateKey = extractDateKey(event.getSpec().getStartAt());
            String endDateKey = extractDateKey(event.getSpec().getEndAt());
            String effectiveStartDate = StringUtils.isNotBlank(startDateKey) ? startDateKey : endDateKey;
            String effectiveEndDate = StringUtils.isNotBlank(endDateKey) ? endDateKey : startDateKey;
            String startMonthKey = extractMonthKey(effectiveStartDate);
            String endMonthKey = extractMonthKey(effectiveEndDate);
            if (startMonthKey != null && (minMonth == null || startMonthKey.compareTo(minMonth) < 0)) {
                minMonth = startMonthKey;
            }
            if (endMonthKey != null && (maxMonth == null || endMonthKey.compareTo(maxMonth) > 0)) {
                maxMonth = endMonthKey;
            }
            if (effectiveEndDate != null && (maxDate == null || effectiveEndDate.compareTo(maxDate) > 0)) {
                maxDate = effectiveEndDate;
            }
        }
        return new CalendarStats(events.size(), minMonth, maxMonth, maxDate);
    }

    private String extractDateKey(String dateTimeText) {
        if (StringUtils.isBlank(dateTimeText) || dateTimeText.length() < 10) {
            return null;
        }
        String dateKey = dateTimeText.substring(0, 10);
        if (!DATE_KEY_PATTERN.matcher(dateKey).matches()) {
            return null;
        }
        return dateKey;
    }

    private String extractMonthKey(String startAt) {
        if (StringUtils.isBlank(startAt) || startAt.length() < 7) {
            return null;
        }
        String monthKey = startAt.substring(0, 7);
        if (!MONTH_KEY_PATTERN.matcher(monthKey).matches()) {
            return null;
        }
        return monthKey;
    }

    private record CalendarStats(int eventCount, String rangeStartMonth, String rangeEndMonth,
                                 String rangeEndDate) {
    }
}
