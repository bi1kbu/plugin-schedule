# plugin-schedule

`plugin-schedule` 是一个 Halo 2 插件，用于在文章或页面中插入日程日历组件，并在后台维护日历与事件数据。

## 1. 项目简介

本插件提供以下核心能力：

- 后台管理日历与日程事件（含筛选、关联文章、突出显示规则）。
- 编辑器内插入 `schedule-view` 组件，支持选择目标日历。
- 前台渲染可交互日历（按周滚动、月份跳转、Upcoming 列表、事件高亮）。
- 自动注入前台脚本，无需主题手工引入 JS。

适用场景：

- 社团活动排期
- 发布计划展示
- 多日程日历（含跨天事件）

## 2. 技术实现概览

### 2.1 后端

- 平台：Halo Plugin API（`2.22.x`）
- 语言：Java 21
- 扩展资源：
  - `ScheduleCalendar`
  - `ScheduleEvent`
- 自定义公开端点（`api.schedule.bi1kbu.com/v1alpha1`）：
  - `GET /schedulecalendars`
  - `POST /schedulecalendars/{name}/refresh-stats`
  - `GET /scheduleevents`
  - `GET /scheduleevents/upcoming`

### 2.2 管理端

- 技术栈：Vue 3 + `@halo-dev/components` + `@halo-dev/ui-shared`
- 菜单结构：
  - `日程`
  - `日程 / 日历配置`
  - `日程 / 日程管理`

### 2.3 编辑器扩展

- 富文本节点：`schedule-view`
- 节点属性：
  - `calendar-name`
  - `show-title`
- 支持工具箱插入、命令插入与节点删除。

### 2.4 前台组件

- 文件：`src/main/resources/static/schedule.umd.js`
- Web Component：`<schedule-view />`
- 脚本注入：`ScheduleHeadProcessor` 自动注入
  ` /plugins/plugin-schedule/assets/static/schedule.umd.js?version=...`

## 3. 环境要求

- Java 21+
- Node.js 18+
- pnpm（建议 10+）
- Docker（用于 `haloServer` 开发容器）

## 4. 本地开发与调试

### 4.1 安装依赖并构建

```bash
./gradlew build
```

构建产物位于：`build/libs/`

### 4.2 启动 Halo 开发环境

```bash
./gradlew haloServer
```

默认管理账号：`admin` / `admin`

如果出现容器名冲突（如 `halo-for-plugin-development` 已存在）：

```bash
./gradlew removeHaloContainer
./gradlew haloServer
```

### 4.3 仅重载插件

```bash
./gradlew reloadPlugin
```

### 4.4 单独构建 UI

```bash
./gradlew :ui:pnpmBuild
```

## 5. 使用说明

### 5.1 后台配置流程

1. 进入 `日程 / 日历配置` 创建日历。
2. 进入 `日程 / 日程管理` 新建事件。
3. 可为事件关联文章，并配置开始/结束日期及突出显示策略。

### 5.2 在文章/页面插入组件

在富文本编辑器中通过工具箱插入“日程组件”，并选择日历。

输出节点示例：

```html
<schedule-view calendar-name="schedule-calendar-xxxx" show-title="true"></schedule-view>
```

属性说明：

- `calendar-name`：目标日历 `metadata.name`
- `show-title`：是否显示日历标题（`true/false`）

## 6. 统计与范围说明

插件会维护日历统计信息（状态字段），包含：

- `eventCount`
- `rangeStartMonth`
- `rangeEndMonth`
- `rangeEndDate`

事件新增/编辑/删除后会触发 `refresh-stats`，用于更新范围与计数。

## 7. 明暗主题色适配说明

前台 `schedule-view` 组件已改为“变量驱动样式”，可参考 Halo 应用市场评论组件的自定义样式思路：

- 组件内部使用 `--halo-sw-*` 变量控制颜色与圆角。
- 主题可在“自定义 CSS”中按亮/暗模式覆盖变量。
- 组件内部保留 `prefers-color-scheme: dark` 的默认兜底值。

### 7.1 现状

- 前台日历、Upcoming 卡片、按钮、月份面板均支持变量覆盖。
- 未配置变量时，组件使用内置 light/dark 默认色值。
- 管理端页面仍建议逐步替换为语义色（见 7.4）。

### 7.2 可覆盖变量（前台）

常用变量示例：

- `--halo-sw-primary-1-color`
- `--halo-sw-primary-2-color`
- `--halo-sw-primary-3-color`
- `--halo-sw-primary-contrast-color`
- `--halo-sw-text-1-color`
- `--halo-sw-text-2-color`
- `--halo-sw-text-3-color`
- `--halo-sw-surface-1-color`
- `--halo-sw-surface-2-color`
- `--halo-sw-muted-1-color`
- `--halo-sw-muted-2-color`
- `--halo-sw-muted-3-color`
- `--halo-sw-primary-soft-bg-color`
- `--halo-sw-primary-soft-border-color`
- `--halo-sw-highlight-bg-color`
- `--halo-sw-highlight-border-color`
- `--halo-sw-highlight-marker-color`
- `--halo-sw-card-rounded`
- `--halo-sw-base-rounded`

### 7.3 主题自定义 CSS 示例（推荐）

可将下面样式粘贴到主题“自定义 CSS”（示例选择器与评论组件思路一致）：

```css
.color-scheme-light,
:root[data-color-scheme='light'] {
  --halo-sw-text-1-color: #0f172a;
  --halo-sw-text-3-color: #64748b;
  --halo-sw-surface-1-color: #ffffff;
  --halo-sw-surface-2-color: #f8fafc;
  --halo-sw-primary-1-color: #2563eb;
  --halo-sw-primary-2-color: #1d4ed8;
  --halo-sw-primary-3-color: #60a5fa;
  --halo-sw-highlight-bg-color: #fff7ed;
  --halo-sw-highlight-border-color: #fdba74;
  --halo-sw-highlight-marker-color: #f59e0b;
}

.color-scheme-dark,
:root[data-color-scheme='dark'] {
  --halo-sw-text-1-color: #f9fafb;
  --halo-sw-text-3-color: #9ca3af;
  --halo-sw-surface-1-color: #0f172a;
  --halo-sw-surface-2-color: #111827;
  --halo-sw-primary-1-color: #60a5fa;
  --halo-sw-primary-2-color: #3b82f6;
  --halo-sw-primary-3-color: #93c5fd;
  --halo-sw-highlight-bg-color: #3f2a12;
  --halo-sw-highlight-border-color: #b45309;
  --halo-sw-highlight-marker-color: #fbbf24;
}
```

### 7.4 推荐做法（管理端）

建议逐步将 `ui/src/views/ScheduleCalendarsView.vue`、`ui/src/views/ScheduleEventsView.vue`
中的固定色替换为主题变量（或 Halo 组件提供的语义色）：

- 背景色
- 边框色
- 次级文字色
- hover/active 态色值

### 7.5 适配完成后的验证清单

- 明亮主题：卡片、按钮、日历天格、Upcoming 卡片对比度正常。
- 暗色主题：文字可读、边框可辨识、突出显示颜色不刺眼。
- 移动端：布局不溢出，滚动与点击交互正常。

## 8. 常见问题

### Q1：改了代码但页面没变化？

先执行：

```bash
./gradlew reloadPlugin
```

再强制刷新浏览器（`Ctrl + F5`）。

### Q2：`haloServer` 启动失败，提示容器创建冲突？

执行：

```bash
./gradlew removeHaloContainer
./gradlew haloServer
```

## 9. 许可证

[MIT](./LICENSE) © bi1kbu
