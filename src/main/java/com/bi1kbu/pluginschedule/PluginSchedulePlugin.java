package com.bi1kbu.pluginschedule;

import com.bi1kbu.pluginschedule.extension.ScheduleCalendar;
import com.bi1kbu.pluginschedule.extension.ScheduleEvent;
import java.util.Optional;
import org.springframework.stereotype.Component;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.extension.index.IndexSpecs;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

@Component
public class PluginSchedulePlugin extends BasePlugin {

    private final SchemeManager schemeManager;

    public PluginSchedulePlugin(PluginContext pluginContext, SchemeManager schemeManager) {
        super(pluginContext);
        this.schemeManager = schemeManager;
    }

    @Override
    public void start() {
        schemeManager.register(ScheduleCalendar.class, indexSpecs -> {
            indexSpecs.add(IndexSpecs.<ScheduleCalendar, String>single("spec.displayName", String.class)
                .indexFunc(calendar -> Optional.ofNullable(calendar.getSpec())
                    .map(ScheduleCalendar.Spec::getDisplayName)
                    .orElse(null)));
            indexSpecs.add(IndexSpecs.<ScheduleCalendar, String>single("spec.slug", String.class)
                .indexFunc(calendar -> Optional.ofNullable(calendar.getSpec())
                    .map(ScheduleCalendar.Spec::getSlug)
                    .orElse(null)));
        });

        schemeManager.register(ScheduleEvent.class, indexSpecs -> {
            indexSpecs.add(IndexSpecs.<ScheduleEvent, String>single("spec.calendarName", String.class)
                .indexFunc(event -> Optional.ofNullable(event.getSpec())
                    .map(ScheduleEvent.Spec::getCalendarName)
                    .orElse(null)));
            indexSpecs.add(IndexSpecs.<ScheduleEvent, String>single("spec.startAt", String.class)
                .indexFunc(event -> Optional.ofNullable(event.getSpec())
                    .map(ScheduleEvent.Spec::getStartAt)
                    .orElse(null)));
            indexSpecs.add(IndexSpecs.<ScheduleEvent, String>single("spec.status", String.class)
                .indexFunc(event -> Optional.ofNullable(event.getSpec())
                    .map(ScheduleEvent.Spec::getStatus)
                    .orElse(null)));
            indexSpecs.add(IndexSpecs.<ScheduleEvent, String>single("spec.relatedPostName", String.class)
                .indexFunc(event -> Optional.ofNullable(event.getSpec())
                    .map(ScheduleEvent.Spec::getRelatedPostName)
                    .orElse(null)));
        });
    }

    @Override
    public void stop() {
        Scheme calendarScheme = schemeManager.get(ScheduleCalendar.class);
        Scheme eventScheme = schemeManager.get(ScheduleEvent.class);
        if (calendarScheme != null) {
            schemeManager.unregister(calendarScheme);
        }
        if (eventScheme != null) {
            schemeManager.unregister(eventScheme);
        }
    }
}
