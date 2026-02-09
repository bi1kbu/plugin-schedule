(function () {
  class ScheduleView extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        events: [],
        upcomingEvents: [],
        panelEvents: [],
        panelLoading: false,
        current: new Date(),
        selectedDay: null,
        calendarTitle: '日程',
        wheelLockedUntil: 0,
        upcomingRangeText: '',
        loadedCalendarName: '',
        loadToken: 0,
        panelLoadToken: 0,
      };
      this.onWheel = this.onWheel.bind(this);
    }

    static get observedAttributes() {
      return ['calendar-name'];
    }

    connectedCallback() {
      this.render();
      this.loadData();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'calendar-name' && oldValue !== newValue) {
        this.state.selectedDay = null;
        this.state.panelEvents = [];
        this.state.panelLoading = false;
        this.loadData();
      }
    }

    formatDateKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    toMonthInputValue(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    addDays(date, days) {
      const next = new Date(date.getTime());
      next.setDate(next.getDate() + days);
      return next;
    }

    getWeekStart(date) {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    mapEvent(item) {
      const spec = item.spec || {};
      const forceHighlight = spec.forceHighlight === true;
      const forceHideHighlight = spec.forceHideHighlight === true;
      const relatedPostPinnedSnapshot = spec.relatedPostPinnedSnapshot === true;
      const highlighted = forceHighlight ? true : (forceHideHighlight ? false : relatedPostPinnedSnapshot);
      return {
        title: spec.title || '',
        startAt: spec.startAt || '',
        endAt: spec.endAt || '',
        relatedPostTitleSnapshot: spec.relatedPostTitleSnapshot || '',
        summary: spec.summary || '',
        highlighted,
      };
    }

    async fetchEvents(calendarName, from, to, size) {
      const eventsUrl =
        `/apis/api.schedule.bi1kbu.com/v1alpha1/scheduleevents` +
        `?calendar=${encodeURIComponent(calendarName)}` +
        `&from=${encodeURIComponent(from)}` +
        `&to=${encodeURIComponent(to)}` +
        `&size=${size}`;
      const resp = await fetch(eventsUrl);
      if (!resp.ok) {
        throw new Error(`加载事件失败: ${resp.status}`);
      }
      const json = await resp.json();
      return (json.items || []).map((item) => this.mapEvent(item));
    }

    sortEvents(events) {
      return events.slice().sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''));
    }

    async loadData() {
      const calendarName = this.getAttribute('calendar-name');
      if (!calendarName) {
        this.state.events = [];
        this.state.upcomingEvents = [];
        this.state.panelEvents = [];
        this.state.panelLoading = false;
        this.state.calendarTitle = '日程';
        this.state.upcomingRangeText = '';
        this.state.loadedCalendarName = '';
        this.render();
        return;
      }

      const loadToken = this.state.loadToken + 1;
      this.state.loadToken = loadToken;

      const windowStart = this.getWeekStart(this.state.current);
      const windowEnd = this.addDays(windowStart, 41);
      windowEnd.setHours(23, 59, 59, 999);
      const from = windowStart.toISOString();
      const to = windowEnd.toISOString();

      this.render();

      try {
        const visibleEventsTask = this.fetchEvents(calendarName, from, to, 600);
        const tasks = [visibleEventsTask];
        let shouldReloadCalendarMeta = false;
        if (this.state.loadedCalendarName !== calendarName) {
          shouldReloadCalendarMeta = true;
          const upcomingStart = new Date();
          upcomingStart.setHours(0, 0, 0, 0);
          const upcomingEnd = new Date(upcomingStart.getTime());
          upcomingEnd.setFullYear(upcomingEnd.getFullYear() + 1);
          upcomingEnd.setHours(23, 59, 59, 999);
          const upcomingEventsUrl =
            `/apis/api.schedule.bi1kbu.com/v1alpha1/scheduleevents` +
            `?calendar=${encodeURIComponent(calendarName)}` +
            `&from=${encodeURIComponent(upcomingStart.toISOString())}` +
            `&to=${encodeURIComponent(upcomingEnd.toISOString())}` +
            `&size=1200`;
          const calendarsUrl = `/apis/api.schedule.bi1kbu.com/v1alpha1/schedulecalendars?page=1&size=300`;
          tasks.push(fetch(upcomingEventsUrl), fetch(calendarsUrl));
          this.state.upcomingRangeText = `${this.formatDateKey(upcomingStart)} 至 ${this.formatDateKey(upcomingEnd)}`;
        }

        const responses = await Promise.all(tasks);
        if (loadToken !== this.state.loadToken) {
          return;
        }

        this.state.events = responses[0];

        if (shouldReloadCalendarMeta) {
          const upcomingResp = responses[1];
          const calendarsResp = responses[2];
          if (!upcomingResp.ok) {
            throw new Error(`加载 Upcoming 失败: ${upcomingResp.status}`);
          }
          if (!calendarsResp.ok) {
            throw new Error(`加载日历失败: ${calendarsResp.status}`);
          }
          const [upcomingJson, calendarsJson] = await Promise.all([upcomingResp.json(), calendarsResp.json()]);
          this.state.upcomingEvents = this.sortEvents((upcomingJson.items || [])
            .map((item) => this.mapEvent(item)));

          const calendars = calendarsJson.items || [];
          const matched = calendars.find((c) => c?.metadata?.name === calendarName);
          this.state.calendarTitle = matched?.spec?.displayName || calendarName;
          this.state.loadedCalendarName = calendarName;
          this.state.selectedDay = null;
          this.state.panelEvents = this.state.upcomingEvents;
        }
      } catch (e) {
        console.error(e);
        this.state.events = [];
        if (this.state.loadedCalendarName !== calendarName) {
          this.state.upcomingEvents = [];
          this.state.panelEvents = [];
          this.state.upcomingRangeText = '';
        }
        this.state.calendarTitle = calendarName;
      } finally {
        if (loadToken === this.state.loadToken) {
          this.render();
        }
      }
    }

    shiftWeek(step) {
      this.state.current = this.addDays(this.state.current, step * 7);
      this.loadData();
    }

    shiftMonth(step) {
      this.state.current = new Date(this.state.current.getFullYear(), this.state.current.getMonth() + step, 1);
      this.loadData();
    }

    async jumpToMonth(monthValue) {
      if (!monthValue) {
        return;
      }
      const parts = monthValue.split('-');
      if (parts.length !== 2) {
        return;
      }
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return;
      }
      this.state.current = new Date(year, month - 1, 1);
      await this.loadData();
    }

    async jumpToDate(dateString) {
      if (!dateString) {
        return;
      }
      const target = new Date(dateString);
      if (Number.isNaN(target.getTime())) {
        return;
      }
      const dayKey = this.formatDateKey(target);
      this.state.current = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      await this.loadData();
      this.refreshPanelByDay(dayKey);
    }

    openMonthPicker(monthPicker) {
      if (!monthPicker) {
        return;
      }
      try {
        if (typeof monthPicker.showPicker === 'function') {
          monthPicker.showPicker();
          return;
        }
      } catch (e) {
        console.debug(e);
      }
      monthPicker.focus();
      monthPicker.click();
    }

    getEventsByDay() {
      const map = new Map();
      for (const ev of this.state.events) {
        if (!ev.startAt) {
          continue;
        }
        const key = ev.startAt.slice(0, 10);
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(ev);
      }
      return map;
    }

    async refreshPanelByDay(dayKey) {
      const calendarName = this.getAttribute('calendar-name');
      if (!calendarName || !dayKey) {
        return;
      }
      const dayStart = new Date(`${dayKey}T00:00:00`);
      if (Number.isNaN(dayStart.getTime())) {
        return;
      }
      const dayEnd = new Date(`${dayKey}T23:59:59.999`);
      const panelLoadToken = this.state.panelLoadToken + 1;
      this.state.panelLoadToken = panelLoadToken;
      this.state.selectedDay = dayKey;
      this.state.panelLoading = true;
      this.render();
      try {
        const events = await this.fetchEvents(calendarName, dayStart.toISOString(), dayEnd.toISOString(), 200);
        if (panelLoadToken !== this.state.panelLoadToken) {
          return;
        }
        this.state.panelEvents = this.sortEvents(events);
      } catch (e) {
        console.error(e);
        if (panelLoadToken !== this.state.panelLoadToken) {
          return;
        }
        this.state.panelEvents = [];
      } finally {
        if (panelLoadToken === this.state.panelLoadToken) {
          this.state.panelLoading = false;
          this.render();
        }
      }
    }

    restoreUpcomingList() {
      this.state.panelLoadToken += 1;
      this.state.selectedDay = null;
      this.state.panelLoading = false;
      this.state.panelEvents = this.state.upcomingEvents;
      this.render();
    }

    onWheel(event) {
      event.preventDefault();
      const now = Date.now();
      if (now < this.state.wheelLockedUntil) {
        return;
      }
      this.state.wheelLockedUntil = now + 220;
      if (event.deltaY > 0) {
        this.shiftWeek(1);
      } else if (event.deltaY < 0) {
        this.shiftWeek(-1);
      }
    }

    render() {
      const year = this.state.current.getFullYear();
      const month = this.state.current.getMonth();
      const weekStart = this.getWeekStart(this.state.current);
      const eventsByDay = this.getEventsByDay();
      const selectedDay = this.state.selectedDay;

      const list = selectedDay
        ? this.state.panelEvents
        : this.state.upcomingEvents;

      const cells = [];
      for (let i = 0; i < 42; i += 1) {
        const cellDate = this.addDays(weekStart, i);
        const key = this.formatDateKey(cellDate);
        const dayEvents = eventsByDay.get(key) || [];
        const hasEvent = dayEvents.length > 0;
        const hasHighlight = dayEvents.some((ev) => ev.highlighted);
        const classes = ['cell'];
        if (hasEvent) {
          classes.push('has-event');
        }
        if (hasHighlight) {
          classes.push('has-highlight-event');
        }
        if (selectedDay === key) {
          classes.push('selected');
        }
        let marker = '';
        if (hasEvent) {
          marker = `<span class="marker${hasHighlight ? ' marker-highlight' : ''}"></span>`;
        }
        cells.push(`<button class="${classes.join(' ')}" data-day="${key}">${cellDate.getDate()}${marker}</button>`);
      }

      const monthText = `${year}-${String(month + 1).padStart(2, '0')}`;
      const todayKey = this.formatDateKey(new Date());

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #0f172a;
          }
          .title {
            font-weight: 700;
            font-size: 30px;
            line-height: 1.2;
            margin: 0 0 14px;
          }
          .wrap {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 18px;
          }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            background: #ffffff;
          }
          .head {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
          }
          .month-text {
            text-align: center;
            font-weight: 600;
          }
          .month-trigger {
            border: none;
            background: transparent;
            padding: 0;
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
            cursor: pointer;
          }
          .month-trigger:hover {
            color: #1d4ed8;
          }
          .month-picker {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
            border: 0;
            padding: 0;
          }
          .tools {
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: flex-end;
            flex-wrap: wrap;
          }
          .btn {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            border-radius: 999px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
          }
          .btn:hover {
            background: #f8fafc;
          }
          .week {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 6px;
          }
          .week span {
            text-align: center;
            font-size: 12px;
            color: #64748b;
          }
          .calendar-panel {
            max-height: 540px;
            overflow-y: auto;
            overscroll-behavior: contain;
            padding-right: 2px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 8px;
          }
          .cell {
            position: relative;
            min-height: 54px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #ffffff;
            cursor: pointer;
            font-size: 15px;
          }
          .cell.has-event {
            background: #eff6ff;
            border-color: #93c5fd;
            color: #0f172a;
          }
          .cell.has-highlight-event {
            background: #fff7ed;
            border-color: #fdba74;
            color: #0f172a;
          }
          .cell.selected {
            outline: 2px solid #1d4ed8;
            outline-offset: -2px;
          }
          .marker {
            position: absolute;
            right: 8px;
            top: 8px;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #2563eb;
          }
          .marker.marker-highlight {
            background: #f59e0b;
          }
          .list-title-btn {
            border: none;
            background: transparent;
            padding: 0;
            margin: 0 0 10px;
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            cursor: pointer;
          }
          .list-title-btn:hover {
            color: #1d4ed8;
          }
          .list-sub {
            color: #64748b;
            font-size: 12px;
            margin-bottom: 8px;
          }
          .item {
            border: 1px solid #bfdbfe;
            background: #eff6ff;
            border-radius: 10px;
            padding: 12px;
            margin-top: 10px;
          }
          .item.highlight {
            border-color: #fdba74;
            background: #fff7ed;
          }
          .date {
            color: #64748b;
            font-size: 13px;
          }
          .name {
            margin-top: 4px;
            font-weight: 600;
          }
          .time {
            color: #6b7280;
            font-size: 12px;
            margin-top: 4px;
          }
          .post {
            color: #475569;
            font-size: 12px;
            margin-top: 4px;
          }
          .empty {
            color: #64748b;
            margin-top: 8px;
            font-size: 13px;
          }
          @media (max-width: 960px) {
            .wrap {
              grid-template-columns: 1fr;
            }
            .head {
              grid-template-columns: 1fr;
              gap: 8px;
            }
            .month-text {
              text-align: left;
            }
            .tools {
              justify-content: flex-start;
            }
          }
        </style>
        <h2 class="title">${this.state.calendarTitle || '日程'}</h2>
        <div class="wrap">
          <div class="card">
            <div class="head">
              <div>
                <button class="btn" id="prev">上一月</button>
                <button class="btn" id="next" style="margin-left: 8px;">下一月</button>
              </div>
              <div class="month-text">
                <button id="monthTrigger" class="month-trigger" type="button">${monthText}</button>
                <input id="monthPicker" class="month-picker" type="month" value="${this.toMonthInputValue(this.state.current)}" />
              </div>
              <div class="tools">
                <button class="btn" id="today">今天</button>
              </div>
            </div>
            <div class="week">
              <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
            </div>
            <div class="calendar-panel" id="calendarPanel" title="可滚轮按周滚动">
              <div class="grid">
                ${cells.join('')}
              </div>
            </div>
          </div>
          <div class="card">
            <button class="list-title-btn" id="upcomingReset" type="button">Upcoming</button>
            <div class="list-sub">${selectedDay ? `当前筛选：${selectedDay}` : `固定范围：${this.state.upcomingRangeText || '-'}`}</div>
            ${this.state.panelLoading ? '<div class="empty">加载中...</div>' : ''}
            ${!this.state.panelLoading && list.length === 0 ? '<div class="empty">暂无日程</div>' : ''}
            ${list.map((it) => `
              <div class="item${it.highlighted ? ' highlight' : ''}">
                <div class="date">${it.startAt ? it.startAt.slice(0, 10) : ''}</div>
                <div class="name">${it.title || '-'}</div>
                <div class="time">
                  ${it.startAt ? it.startAt.replace('T', ' ').slice(0, 16) : ''}
                  ${it.endAt ? ` ~ ${it.endAt.replace('T', ' ').slice(0, 16)}` : ''}
                </div>
                <div class="post">${it.relatedPostTitleSnapshot || ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      const prev = this.shadowRoot.getElementById('prev');
      const next = this.shadowRoot.getElementById('next');
      const today = this.shadowRoot.getElementById('today');
      const monthTrigger = this.shadowRoot.getElementById('monthTrigger');
      const monthPicker = this.shadowRoot.getElementById('monthPicker');
      const upcomingReset = this.shadowRoot.getElementById('upcomingReset');
      const calendarPanel = this.shadowRoot.getElementById('calendarPanel');

      if (prev) {
        prev.onclick = () => this.shiftMonth(-1);
      }
      if (next) {
        next.onclick = () => this.shiftMonth(1);
      }
      if (today) {
        today.onclick = () => this.jumpToDate(todayKey);
      }
      if (monthTrigger && monthPicker) {
        monthTrigger.onclick = () => this.openMonthPicker(monthPicker);
        monthPicker.onchange = () => this.jumpToMonth(monthPicker.value);
      }
      if (upcomingReset) {
        upcomingReset.onclick = () => this.restoreUpcomingList();
      }
      if (calendarPanel) {
        calendarPanel.removeEventListener('wheel', this.onWheel);
        calendarPanel.addEventListener('wheel', this.onWheel, { passive: false });
      }

      this.shadowRoot.querySelectorAll('[data-day]').forEach((el) => {
        el.addEventListener('click', () => {
          const dayKey = el.getAttribute('data-day');
          this.refreshPanelByDay(dayKey);
        });
      });
    }
  }

  if (!customElements.get('schedule-view')) {
    customElements.define('schedule-view', ScheduleView);
  }
})();
