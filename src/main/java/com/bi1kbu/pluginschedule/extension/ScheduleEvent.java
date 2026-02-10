package com.bi1kbu.pluginschedule.extension;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import run.halo.app.core.extension.attachment.Constant;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

@GVK(kind = ScheduleEvent.KIND, group = "schedule.bi1kbu.com",
    version = Constant.VERSION, singular = "scheduleevent", plural = "scheduleevents")
public class ScheduleEvent extends AbstractExtension {

    public static final String KIND = "ScheduleEvent";

    @Schema(requiredMode = REQUIRED)
    private Spec spec;

    public Spec getSpec() {
        return spec;
    }

    public void setSpec(Spec spec) {
        this.spec = spec;
    }

    public static class Spec {
        @Schema(requiredMode = REQUIRED, description = "所属日历名称")
        private String calendarName;

        @Schema(requiredMode = REQUIRED, description = "事件标题")
        private String title;

        @Schema(requiredMode = REQUIRED, description = "开始时间，ISO-8601")
        private String startAt;

        @Schema(description = "结束时间，ISO-8601")
        private String endAt;

        @Schema(description = "是否全天")
        private Boolean allDay;

        @Schema(description = "时区")
        private String timezone;

        @Schema(description = "摘要")
        private String summary;

        @Schema(description = "状态: published/cancelled", example = "published")
        private String status;

        @Schema(description = "关联文章 metadata.name")
        private String relatedPostName;

        @Schema(description = "关联文章标题快照")
        private String relatedPostTitleSnapshot;

        @Schema(description = "关联文章链接快照")
        private String relatedPostPermalinkSnapshot;

        @Schema(description = "关联文章置顶快照")
        private Boolean relatedPostPinnedSnapshot;

        @Schema(description = "强制突出显示，和 forceHideHighlight 互斥")
        private Boolean forceHighlight;

        @Schema(description = "强制不突出显示，和 forceHighlight 互斥")
        private Boolean forceHideHighlight;

        public String getCalendarName() {
            return calendarName;
        }

        public void setCalendarName(String calendarName) {
            this.calendarName = calendarName;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getStartAt() {
            return startAt;
        }

        public void setStartAt(String startAt) {
            this.startAt = startAt;
        }

        public String getEndAt() {
            return endAt;
        }

        public void setEndAt(String endAt) {
            this.endAt = endAt;
        }

        public Boolean getAllDay() {
            return allDay;
        }

        public void setAllDay(Boolean allDay) {
            this.allDay = allDay;
        }

        public String getTimezone() {
            return timezone;
        }

        public void setTimezone(String timezone) {
            this.timezone = timezone;
        }

        public String getSummary() {
            return summary;
        }

        public void setSummary(String summary) {
            this.summary = summary;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getRelatedPostName() {
            return relatedPostName;
        }

        public void setRelatedPostName(String relatedPostName) {
            this.relatedPostName = relatedPostName;
        }

        public String getRelatedPostTitleSnapshot() {
            return relatedPostTitleSnapshot;
        }

        public void setRelatedPostTitleSnapshot(String relatedPostTitleSnapshot) {
            this.relatedPostTitleSnapshot = relatedPostTitleSnapshot;
        }

        public String getRelatedPostPermalinkSnapshot() {
            return relatedPostPermalinkSnapshot;
        }

        public void setRelatedPostPermalinkSnapshot(String relatedPostPermalinkSnapshot) {
            this.relatedPostPermalinkSnapshot = relatedPostPermalinkSnapshot;
        }

        public Boolean getRelatedPostPinnedSnapshot() {
            return relatedPostPinnedSnapshot;
        }

        public void setRelatedPostPinnedSnapshot(Boolean relatedPostPinnedSnapshot) {
            this.relatedPostPinnedSnapshot = relatedPostPinnedSnapshot;
        }

        public Boolean getForceHighlight() {
            return forceHighlight;
        }

        public void setForceHighlight(Boolean forceHighlight) {
            this.forceHighlight = forceHighlight;
        }

        public Boolean getForceHideHighlight() {
            return forceHideHighlight;
        }

        public void setForceHideHighlight(Boolean forceHideHighlight) {
            this.forceHideHighlight = forceHideHighlight;
        }
    }
}
