package com.bi1kbu.pluginschedule.extension;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import run.halo.app.core.extension.attachment.Constant;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

@GVK(kind = ScheduleCalendar.KIND, group = "schedule.bi1kbu.com",
    version = Constant.VERSION, singular = "schedulecalendar", plural = "schedulecalendars")
public class ScheduleCalendar extends AbstractExtension {

    public static final String KIND = "ScheduleCalendar";

    @Schema(requiredMode = REQUIRED)
    private Spec spec;

    @Schema
    private Status status;

    public Spec getSpec() {
        return spec;
    }

    public void setSpec(Spec spec) {
        this.spec = spec;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    @JsonIgnore
    public Status getStatusOrDefault() {
        if (status == null) {
            status = new Status();
        }
        return status;
    }

    public static class Spec {
        @Schema(requiredMode = REQUIRED, description = "显示名称")
        private String displayName;

        @Schema(description = "主题色", example = "#1d4ed8")
        private String themeColor;

        @Schema(description = "是否公开", example = "true")
        private Boolean visible;

        @Schema(description = "前台是否显示标题", example = "true")
        private Boolean showCalendarTitle;

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public String getThemeColor() {
            return themeColor;
        }

        public void setThemeColor(String themeColor) {
            this.themeColor = themeColor;
        }

        public Boolean getVisible() {
            return visible;
        }

        public void setVisible(Boolean visible) {
            this.visible = visible;
        }

        public Boolean getShowCalendarTitle() {
            return showCalendarTitle;
        }

        public void setShowCalendarTitle(Boolean showCalendarTitle) {
            this.showCalendarTitle = showCalendarTitle;
        }
    }

    public static class Status {
        @Schema(description = "事件数量")
        private Integer eventCount;
        @Schema(description = "事件范围起始月份（YYYY-MM）")
        private String rangeStartMonth;
        @Schema(description = "事件范围结束月份（YYYY-MM）")
        private String rangeEndMonth;
        @Schema(description = "事件范围结束日期（YYYY-MM-DD）")
        private String rangeEndDate;

        public Integer getEventCount() {
            return eventCount;
        }

        public void setEventCount(Integer eventCount) {
            this.eventCount = eventCount;
        }

        public String getRangeStartMonth() {
            return rangeStartMonth;
        }

        public void setRangeStartMonth(String rangeStartMonth) {
            this.rangeStartMonth = rangeStartMonth;
        }

        public String getRangeEndMonth() {
            return rangeEndMonth;
        }

        public void setRangeEndMonth(String rangeEndMonth) {
            this.rangeEndMonth = rangeEndMonth;
        }

        public String getRangeEndDate() {
            return rangeEndDate;
        }

        public void setRangeEndDate(String rangeEndDate) {
            this.rangeEndDate = rangeEndDate;
        }
    }
}
