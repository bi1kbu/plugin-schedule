package com.bi1kbu.pluginschedule.extension;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import run.halo.app.core.extension.attachment.Constant;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

@GVK(kind = ScheduleLog.KIND, group = "schedule.bi1kbu.com",
    version = Constant.VERSION, singular = "schedulelog", plural = "schedulelogs")
public class ScheduleLog extends AbstractExtension {

    public static final String KIND = "ScheduleLog";

    @Schema(requiredMode = REQUIRED)
    private Spec spec;

    public Spec getSpec() {
        return spec;
    }

    public void setSpec(Spec spec) {
        this.spec = spec;
    }

    public static class Spec {
        @Schema(requiredMode = REQUIRED, description = "操作类型")
        private String actionType;

        @Schema(requiredMode = REQUIRED, description = "操作人")
        private String operator;

        @Schema(requiredMode = REQUIRED, description = "操作时间，ISO-8601")
        private String actionAt;

        @Schema(description = "所属日历 metadata.name")
        private String calendarName;

        @Schema(description = "关联事件 metadata.name")
        private String eventName;

        @Schema(description = "事件标题快照")
        private String eventTitle;

        @Schema(description = "关键字快照")
        private String keyword;

        @Schema(description = "操作摘要")
        private String summary;

        @Schema(description = "字段级变更明细")
        private List<ChangeDetail> details;

        public String getActionType() {
            return actionType;
        }

        public void setActionType(String actionType) {
            this.actionType = actionType;
        }

        public String getOperator() {
            return operator;
        }

        public void setOperator(String operator) {
            this.operator = operator;
        }

        public String getActionAt() {
            return actionAt;
        }

        public void setActionAt(String actionAt) {
            this.actionAt = actionAt;
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

        public List<ChangeDetail> getDetails() {
            return details;
        }

        public void setDetails(List<ChangeDetail> details) {
            this.details = details;
        }
    }

    public static class ChangeDetail {
        @Schema(requiredMode = REQUIRED, description = "字段标识")
        private String field;

        @Schema(requiredMode = REQUIRED, description = "字段显示名")
        private String label;

        @Schema(description = "原值")
        private String oldValue;

        @Schema(description = "新值")
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
