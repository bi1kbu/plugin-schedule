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
        showCalendarTitle: true,
        renderStyle: 'default',
        upcomingRangeText: '',
        loadedCalendarName: '',
        loadToken: 0,
        panelLoadToken: 0,
        monthPanelOpen: false,
        monthRangeMin: '',
        monthRangeMax: '',
        postPermalinkCache: {},
      };
      this.onWheel = this.onWheel.bind(this);
      this.onDocumentClick = this.onDocumentClick.bind(this);
      this.onDocumentKeydown = this.onDocumentKeydown.bind(this);
    }

    static get observedAttributes() {
      return ['calendar-name', 'show-title', 'render-style'];
    }

    connectedCallback() {
      this.render();
      this.loadData();
    }

    disconnectedCallback() {
      document.removeEventListener('click', this.onDocumentClick, true);
      document.removeEventListener('keydown', this.onDocumentKeydown, true);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'show-title' && oldValue !== newValue) {
        this.state.showCalendarTitle = this.resolveShowTitleFromAttr();
        this.render();
        return;
      }
      if (name === 'render-style' && oldValue !== newValue) {
        this.state.renderStyle = this.resolveRenderStyleFromAttr();
        this.render();
        return;
      }
      if (name === 'calendar-name' && oldValue !== newValue) {
        this.state.selectedDay = null;
        this.state.panelEvents = [];
        this.state.panelLoading = false;
        this.loadData();
      }
    }

    resolveShowTitleFromAttr() {
      const raw = this.getAttribute('show-title');
      if (raw === null) {
        return true;
      }
      const normalized = String(raw).trim().toLowerCase();
      return !['false', '0', 'off', 'no'].includes(normalized);
    }

    resolveRenderStyleFromAttr() {
      return 'default';
    }

    formatDateKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    formatDateKeyUtc(date) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }

    extractDateKeyFromIso(isoString) {
      if (typeof isoString !== 'string') {
        return '';
      }
      const head = isoString.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
        return head;
      }
      const date = new Date(isoString);
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      return this.formatDateKeyUtc(date);
    }

    parseDateKeyAsUtc(dateKey) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return null;
      }
      const [y, m, d] = dateKey.split('-').map((part) => Number(part));
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
        return null;
      }
      const date = new Date(Date.UTC(y, m - 1, d));
      if (
        date.getUTCFullYear() !== y
        || date.getUTCMonth() !== m - 1
        || date.getUTCDate() !== d
      ) {
        return null;
      }
      return date;
    }

    getEventDateKeys(event) {
      const startKey = this.extractDateKeyFromIso(event?.startAt);
      if (!startKey) {
        return [];
      }

      const endKeyRaw = this.extractDateKeyFromIso(event?.endAt);
      const endKey = endKeyRaw || startKey;

      const startDate = this.parseDateKeyAsUtc(startKey);
      const endDate = this.parseDateKeyAsUtc(endKey);
      if (!startDate || !endDate) {
        return [startKey];
      }

      let rangeStart = startDate;
      let rangeEnd = endDate;
      if (rangeEnd.getTime() < rangeStart.getTime()) {
        rangeEnd = rangeStart;
      }

      const keys = [];
      const cursor = new Date(rangeStart.getTime());
      let guard = 0;
      while (cursor.getTime() <= rangeEnd.getTime() && guard < 740) {
        keys.push(this.formatDateKeyUtc(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        guard += 1;
      }

      return keys.length > 0 ? keys : [startKey];
    }

    formatMonthKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    normalizePermalink(value) {
      const raw = String(value || '').trim();
      if (!raw) {
        return '';
      }
      if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) {
        return raw;
      }
      return raw.startsWith('/') ? raw : `/${raw}`;
    }

    hasPermalinkCache(name) {
      return Object.prototype.hasOwnProperty.call(this.state.postPermalinkCache, name);
    }

    parseMonthKey(monthKey) {
      if (typeof monthKey !== 'string') {
        return null;
      }
      const parts = monthKey.split('-');
      if (parts.length !== 2) {
        return null;
      }
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
      }
      return { year, month };
    }

    toMonthKey(year, month) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }

    resolveUpcomingRange(calendar, upcomingStart) {
      const startText = this.formatDateKey(upcomingStart);
      const fallbackEnd = new Date(upcomingStart.getTime());
      fallbackEnd.setFullYear(fallbackEnd.getFullYear() + 1);
      fallbackEnd.setHours(23, 59, 59, 999);

      const rawRangeEndDate = typeof calendar?.status?.rangeEndDate === 'string'
        ? calendar.status.rangeEndDate.trim()
        : '';
      if (!rawRangeEndDate) {
        return {
          endDate: fallbackEnd,
          endText: this.formatDateKey(fallbackEnd),
        };
      }

      const parsedEndDate = this.parseDateKeyAsUtc(rawRangeEndDate);
      if (!parsedEndDate) {
        return {
          endDate: fallbackEnd,
          endText: this.formatDateKey(fallbackEnd),
        };
      }

      parsedEndDate.setUTCHours(23, 59, 59, 999);
      if (parsedEndDate.getTime() < upcomingStart.getTime()) {
        const clampedEnd = new Date(upcomingStart.getTime());
        clampedEnd.setHours(23, 59, 59, 999);
        return {
          endDate: clampedEnd,
          endText: startText,
        };
      }

      return {
        endDate: parsedEndDate,
        endText: rawRangeEndDate,
      };
    }

    resolveMonthRangeFromCalendar(calendar) {
      const fallback = this.formatMonthKey(this.state.current);
      const parsedMin = this.parseMonthKey(calendar?.status?.rangeStartMonth);
      const parsedMax = this.parseMonthKey(calendar?.status?.rangeEndMonth);
      if (parsedMin && parsedMax) {
        if (
          parsedMin.year < parsedMax.year
          || (parsedMin.year === parsedMax.year && parsedMin.month <= parsedMax.month)
        ) {
          return {
            min: this.toMonthKey(parsedMin.year, parsedMin.month),
            max: this.toMonthKey(parsedMax.year, parsedMax.month),
          };
        }
        return {
          min: this.toMonthKey(parsedMax.year, parsedMax.month),
          max: this.toMonthKey(parsedMin.year, parsedMin.month),
        };
      }
      if (parsedMin) {
        const monthKey = this.toMonthKey(parsedMin.year, parsedMin.month);
        return { min: monthKey, max: monthKey };
      }
      if (parsedMax) {
        const monthKey = this.toMonthKey(parsedMax.year, parsedMax.month);
        return { min: monthKey, max: monthKey };
      }
      return { min: fallback, max: fallback };
    }

    getMonthRangeBounds() {
      const fallback = this.parseMonthKey(this.formatMonthKey(this.state.current));
      const parsedMin = this.parseMonthKey(this.state.monthRangeMin) || fallback;
      const parsedMax = this.parseMonthKey(this.state.monthRangeMax) || fallback;
      if (
        parsedMin.year < parsedMax.year
        || (parsedMin.year === parsedMax.year && parsedMin.month <= parsedMax.month)
      ) {
        return {
          minYear: parsedMin.year,
          minMonth: parsedMin.month,
          maxYear: parsedMax.year,
          maxMonth: parsedMax.month,
        };
      }
      return {
        minYear: parsedMax.year,
        minMonth: parsedMax.month,
        maxYear: parsedMin.year,
        maxMonth: parsedMin.month,
      };
    }

    clampYearMonthToRange(year, month, bounds) {
      let nextYear = year;
      let nextMonth = month;
      if (nextYear < bounds.minYear) {
        nextYear = bounds.minYear;
        nextMonth = bounds.minMonth;
      } else if (nextYear > bounds.maxYear) {
        nextYear = bounds.maxYear;
        nextMonth = bounds.maxMonth;
      }
      if (nextYear === bounds.minYear && nextMonth < bounds.minMonth) {
        nextMonth = bounds.minMonth;
      }
      if (nextYear === bounds.maxYear && nextMonth > bounds.maxMonth) {
        nextMonth = bounds.maxMonth;
      }
      return { year: nextYear, month: nextMonth };
    }

    getMonthRangeForYear(year, bounds) {
      let start = 1;
      let end = 12;
      if (year === bounds.minYear) {
        start = bounds.minMonth;
      }
      if (year === bounds.maxYear) {
        end = bounds.maxMonth;
      }
      if (start > end) {
        return { start: bounds.minMonth, end: bounds.minMonth };
      }
      return { start, end };
    }

    clampCurrentToMonthRange() {
      const bounds = this.getMonthRangeBounds();
      const currentYear = this.state.current.getFullYear();
      const currentMonth = this.state.current.getMonth() + 1;
      const clamped = this.clampYearMonthToRange(currentYear, currentMonth, bounds);
      this.state.current = new Date(clamped.year, clamped.month - 1, 1);
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
        relatedPostName: spec.relatedPostName || '',
        relatedPostTitleSnapshot: spec.relatedPostTitleSnapshot || '',
        relatedPostPermalinkSnapshot: this.normalizePermalink(spec.relatedPostPermalinkSnapshot || ''),
        summary: spec.summary || '',
        highlighted,
      };
    }

    async fetchEvents(calendarName, from, to, size, page = 1) {
      const eventsUrl =
        `/apis/api.schedule.bi1kbu.com/v1alpha1/scheduleevents` +
        `?page=${page}` +
        `&size=${size}` +
        `&calendar=${encodeURIComponent(calendarName)}` +
        `&from=${encodeURIComponent(from)}` +
        `&to=${encodeURIComponent(to)}`;
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

    async hydrateEventPermalinks(events) {
      if (!Array.isArray(events) || events.length === 0) {
        return;
      }

      const missingNames = [];
      for (const ev of events) {
        if (!ev || !ev.relatedPostName || ev.relatedPostPermalinkSnapshot) {
          continue;
        }
        const cached = this.state.postPermalinkCache[ev.relatedPostName];
        if (this.hasPermalinkCache(ev.relatedPostName)) {
          ev.relatedPostPermalinkSnapshot = this.normalizePermalink(cached);
          continue;
        }
        if (!missingNames.includes(ev.relatedPostName)) {
          missingNames.push(ev.relatedPostName);
        }
      }

      if (missingNames.length > 0) {
        await Promise.all(missingNames.map(async (postName) => {
          try {
            const resp = await fetch(`/apis/content.halo.run/v1alpha1/posts/${encodeURIComponent(postName)}`);
            if (!resp.ok) {
              this.state.postPermalinkCache[postName] = '';
              return;
            }
            const post = await resp.json();
            this.state.postPermalinkCache[postName] = this.normalizePermalink(post?.status?.permalink || '');
          } catch (e) {
            console.error(e);
            this.state.postPermalinkCache[postName] = '';
          }
        }));
      }

      for (const ev of events) {
        if (!ev || ev.relatedPostPermalinkSnapshot || !ev.relatedPostName) {
          continue;
        }
        ev.relatedPostPermalinkSnapshot = this.normalizePermalink(this.state.postPermalinkCache[ev.relatedPostName] || '');
      }
    }

    async loadData() {
      const calendarName = this.getAttribute('calendar-name');
      this.state.showCalendarTitle = this.resolveShowTitleFromAttr();
      this.state.renderStyle = this.resolveRenderStyleFromAttr();
      if (!calendarName) {
        const currentMonth = this.formatMonthKey(this.state.current);
        this.state.events = [];
        this.state.upcomingEvents = [];
        this.state.panelEvents = [];
        this.state.panelLoading = false;
        this.state.calendarTitle = '日程';
        this.state.showCalendarTitle = this.resolveShowTitleFromAttr();
        this.state.upcomingRangeText = '';
        this.state.loadedCalendarName = '';
        this.state.monthRangeMin = currentMonth;
        this.state.monthRangeMax = currentMonth;
        this.state.monthPanelOpen = false;
        this.render();
        return;
      }

      const loadToken = this.state.loadToken + 1;
      this.state.loadToken = loadToken;

      this.render();

      try {
        const shouldReloadCalendarMeta = this.state.loadedCalendarName !== calendarName;
        if (shouldReloadCalendarMeta) {
          const calendarsUrl = `/apis/api.schedule.bi1kbu.com/v1alpha1/schedulecalendars?page=1&size=300`;
          const calendarsResp = await fetch(calendarsUrl);
          if (loadToken !== this.state.loadToken) {
            return;
          }
          if (!calendarsResp.ok) {
            throw new Error(`加载日历失败: ${calendarsResp.status}`);
          }
          const calendarsJson = await calendarsResp.json();
          if (loadToken !== this.state.loadToken) {
            return;
          }

          const calendars = calendarsJson.items || [];
          const matched = calendars.find((c) => c?.metadata?.name === calendarName);
          this.state.calendarTitle = matched?.spec?.displayName || calendarName;
          const monthRange = this.resolveMonthRangeFromCalendar(matched);
          this.state.monthRangeMin = monthRange.min;
          this.state.monthRangeMax = monthRange.max;
          this.clampCurrentToMonthRange();

          const upcomingStart = new Date();
          upcomingStart.setHours(0, 0, 0, 0);
          const upcomingRange = this.resolveUpcomingRange(matched, upcomingStart);
          const upcomingEnd = upcomingRange.endDate;
          const upcomingEventsUrl =
            `/apis/api.schedule.bi1kbu.com/v1alpha1/scheduleevents` +
            `?calendar=${encodeURIComponent(calendarName)}` +
            `&from=${encodeURIComponent(upcomingStart.toISOString())}` +
            `&to=${encodeURIComponent(upcomingEnd.toISOString())}` +
            `&size=1200`;
          const upcomingResp = await fetch(upcomingEventsUrl);
          if (loadToken !== this.state.loadToken) {
            return;
          }
          if (!upcomingResp.ok) {
            throw new Error(`加载 Upcoming 失败: ${upcomingResp.status}`);
          }
          const upcomingJson = await upcomingResp.json();
          if (loadToken !== this.state.loadToken) {
            return;
          }
          const mappedUpcoming = (upcomingJson.items || [])
            .map((item) => this.mapEvent(item));
          await this.hydrateEventPermalinks(mappedUpcoming);
          if (loadToken !== this.state.loadToken) {
            return;
          }
          this.state.upcomingEvents = this.sortEvents(mappedUpcoming);
          this.state.loadedCalendarName = calendarName;
          this.state.selectedDay = null;
          this.state.panelEvents = this.state.upcomingEvents;
          this.state.upcomingRangeText = `${this.formatDateKey(upcomingStart)} 至 ${upcomingRange.endText}`;
        } else if (!this.state.monthRangeMin || !this.state.monthRangeMax) {
          const currentMonth = this.formatMonthKey(this.state.current);
          this.state.monthRangeMin = currentMonth;
          this.state.monthRangeMax = currentMonth;
        }

        const windowStart = this.getWeekStart(this.state.current);
        const windowEnd = this.addDays(windowStart, 41);
        windowEnd.setHours(23, 59, 59, 999);
        const from = windowStart.toISOString();
        const to = windowEnd.toISOString();
        const rangeEvents = await this.fetchEvents(calendarName, from, to, 600);
        await this.hydrateEventPermalinks(rangeEvents);
        this.state.events = rangeEvents;
        if (loadToken !== this.state.loadToken) {
          return;
        }
      } catch (e) {
        console.error(e);
        this.state.events = [];
        if (this.state.loadedCalendarName !== calendarName) {
          this.state.upcomingEvents = [];
          this.state.panelEvents = [];
          this.state.upcomingRangeText = '';
        }
        const currentMonth = this.formatMonthKey(this.state.current);
        this.state.monthRangeMin = currentMonth;
        this.state.monthRangeMax = currentMonth;
        this.state.calendarTitle = calendarName;
        this.state.showCalendarTitle = this.resolveShowTitleFromAttr();
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

    setMonthPanelOpen(open) {
      if (this.state.monthPanelOpen === open) {
        return;
      }
      this.state.monthPanelOpen = open;
      if (open) {
        document.addEventListener('click', this.onDocumentClick, true);
        document.addEventListener('keydown', this.onDocumentKeydown, true);
      } else {
        document.removeEventListener('click', this.onDocumentClick, true);
        document.removeEventListener('keydown', this.onDocumentKeydown, true);
      }
      this.render();
    }

    toggleMonthPanel() {
      this.setMonthPanelOpen(!this.state.monthPanelOpen);
    }

    onDocumentClick(event) {
      if (!this.state.monthPanelOpen || !this.shadowRoot) {
        return;
      }
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (path.includes(this)) {
        return;
      }
      if (event.target instanceof Node && this.shadowRoot.contains(event.target)) {
        return;
      }
      this.setMonthPanelOpen(false);
    }

    onDocumentKeydown(event) {
      if (event.key === 'Escape') {
        this.setMonthPanelOpen(false);
      }
    }

    applyMonthSelection(yearValue, monthValue) {
      const y = Number(yearValue);
      const m = Number(monthValue);
      if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
        this.setMonthPanelOpen(false);
        return;
      }
      const bounds = this.getMonthRangeBounds();
      const clamped = this.clampYearMonthToRange(y, m, bounds);
      this.setMonthPanelOpen(false);
      this.jumpToMonth(`${clamped.year}-${String(clamped.month).padStart(2, '0')}`);
    }

    getEventsByDay() {
      const map = new Map();
      for (const ev of this.state.events) {
        const dateKeys = this.getEventDateKeys(ev);
        if (dateKeys.length === 0) {
          continue;
        }
        for (const key of dateKeys) {
          if (!map.has(key)) {
            map.set(key, []);
          }
          map.get(key).push(ev);
        }
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
        await this.hydrateEventPermalinks(events);
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
      const wrapClass = 'wrap';
      const monthValue = month + 1;
      const todayKey = this.formatDateKey(new Date());
      const monthRangeBounds = this.getMonthRangeBounds();
      const pickerValue = this.clampYearMonthToRange(year, monthValue, monthRangeBounds);
      const monthRangeForPickerYear = this.getMonthRangeForYear(pickerValue.year, monthRangeBounds);
      const yearOptions = [];
      for (let y = monthRangeBounds.minYear; y <= monthRangeBounds.maxYear; y += 1) {
        yearOptions.push(`<option value="${y}"${y === pickerValue.year ? ' selected' : ''}>${y}年</option>`);
      }
      const monthOptions = [];
      for (let m = monthRangeForPickerYear.start; m <= monthRangeForPickerYear.end; m += 1) {
        monthOptions.push(`<option value="${m}"${m === pickerValue.month ? ' selected' : ''}>${String(m).padStart(2, '0')}月</option>`);
      }

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color-scheme: light dark;
            color: var(--sw-text-1);
            --sw-primary-1: var(--halo-sw-primary-1-color, #2563eb);
            --sw-primary-2: var(--halo-sw-primary-2-color, #1d4ed8);
            --sw-primary-3: var(--halo-sw-primary-3-color, #60a5fa);
            --sw-primary-contrast: var(--halo-sw-primary-contrast-color, #ffffff);
            --sw-primary-soft-bg: var(--halo-sw-primary-soft-bg-color, #eff6ff);
            --sw-primary-soft-border: var(--halo-sw-primary-soft-border-color, #93c5fd);
            --sw-primary-soft-border-2: var(--halo-sw-primary-soft-border-2-color, #bfdbfe);
            --sw-text-1: var(--halo-sw-text-1-color, #0f172a);
            --sw-text-2: var(--halo-sw-text-2-color, #334155);
            --sw-text-3: var(--halo-sw-text-3-color, #64748b);
            --sw-surface-1: var(--halo-sw-surface-1-color, #ffffff);
            --sw-surface-2: var(--halo-sw-surface-2-color, #f8fafc);
            --sw-muted-1: var(--halo-sw-muted-1-color, #e2e8f0);
            --sw-muted-2: var(--halo-sw-muted-2-color, #cbd5e1);
            --sw-muted-3: var(--halo-sw-muted-3-color, #94a3b8);
            --sw-highlight-bg: var(--halo-sw-highlight-bg-color, #fff7ed);
            --sw-highlight-border: var(--halo-sw-highlight-border-color, #fdba74);
            --sw-highlight-border-strong: var(--halo-sw-highlight-border-strong-color, #fb923c);
            --sw-highlight-marker: var(--halo-sw-highlight-marker-color, #f59e0b);
            --sw-panel-border: var(--halo-sw-panel-border-color, #dbeafe);
            --sw-shadow-elevated: var(--halo-sw-shadow-elevated-color, rgba(15, 23, 42, 0.2));
            --sw-shadow-primary: var(--halo-sw-shadow-primary-color, rgba(37, 99, 235, 0.14));
            --sw-shadow-primary-hover: var(--halo-sw-shadow-primary-hover-color, rgba(37, 99, 235, 0.12));
            --sw-shadow-highlight-hover: var(--halo-sw-shadow-highlight-hover-color, rgba(245, 158, 11, 0.16));
            --sw-card-rounded: var(--halo-sw-card-rounded, 12px);
            --sw-base-rounded: var(--halo-sw-base-rounded, 10px);
            --sw-panel-rounded: var(--halo-sw-panel-rounded, 14px);
          }
          @media (prefers-color-scheme: dark) {
            :host {
              --sw-primary-1: var(--halo-sw-primary-1-color, #60a5fa);
              --sw-primary-2: var(--halo-sw-primary-2-color, #3b82f6);
              --sw-primary-3: var(--halo-sw-primary-3-color, #93c5fd);
              --sw-primary-contrast: var(--halo-sw-primary-contrast-color, #0f172a);
              --sw-primary-soft-bg: var(--halo-sw-primary-soft-bg-color, #1e293b);
              --sw-primary-soft-border: var(--halo-sw-primary-soft-border-color, #334155);
              --sw-primary-soft-border-2: var(--halo-sw-primary-soft-border-2-color, #334155);
              --sw-text-1: var(--halo-sw-text-1-color, #f9fafb);
              --sw-text-2: var(--halo-sw-text-2-color, #e5e7eb);
              --sw-text-3: var(--halo-sw-text-3-color, #9ca3af);
              --sw-surface-1: var(--halo-sw-surface-1-color, #0f172a);
              --sw-surface-2: var(--halo-sw-surface-2-color, #111827);
              --sw-muted-1: var(--halo-sw-muted-1-color, #374151);
              --sw-muted-2: var(--halo-sw-muted-2-color, #4b5563);
              --sw-muted-3: var(--halo-sw-muted-3-color, #6b7280);
              --sw-highlight-bg: var(--halo-sw-highlight-bg-color, #3f2a12);
              --sw-highlight-border: var(--halo-sw-highlight-border-color, #b45309);
              --sw-highlight-border-strong: var(--halo-sw-highlight-border-strong-color, #d97706);
              --sw-highlight-marker: var(--halo-sw-highlight-marker-color, #fbbf24);
              --sw-panel-border: var(--halo-sw-panel-border-color, #334155);
              --sw-shadow-elevated: var(--halo-sw-shadow-elevated-color, rgba(2, 6, 23, 0.55));
              --sw-shadow-primary: var(--halo-sw-shadow-primary-color, rgba(96, 165, 250, 0.3));
              --sw-shadow-primary-hover: var(--halo-sw-shadow-primary-hover-color, rgba(96, 165, 250, 0.28));
              --sw-shadow-highlight-hover: var(--halo-sw-shadow-highlight-hover-color, rgba(251, 191, 36, 0.26));
            }
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
            border: 1px solid var(--sw-muted-1);
            border-radius: var(--sw-card-rounded);
            padding: 14px;
            background: var(--sw-surface-1);
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
          .month-control {
            position: relative;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .month-trigger {
            border: 1px solid var(--sw-muted-2);
            background: linear-gradient(180deg, var(--sw-surface-1) 0%, var(--sw-surface-2) 100%);
            border-radius: 999px;
            padding: 7px 16px;
            margin: 0;
            min-width: 128px;
            font-size: 17px;
            font-weight: 600;
            color: var(--sw-text-1);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          }
          .month-trigger:hover {
            background: var(--sw-surface-2);
            border-color: var(--sw-muted-3);
          }
          .month-trigger.open {
            border-color: var(--sw-primary-1);
            box-shadow: 0 0 0 3px var(--sw-shadow-primary);
          }
          .month-panel {
            position: absolute;
            top: calc(100% + 10px);
            left: 50%;
            transform: translateX(-50%);
            min-width: 274px;
            border: 1px solid var(--sw-panel-border);
            border-radius: var(--sw-panel-rounded);
            padding: 12px;
            background: var(--sw-surface-1);
            box-shadow: 0 14px 30px var(--sw-shadow-elevated);
            z-index: 20;
          }
          .month-panel.hidden {
            display: none;
          }
          .month-fields {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
          }
          .month-select {
            appearance: none;
            border: 1px solid var(--sw-muted-2);
            border-radius: var(--sw-base-rounded);
            padding: 8px 28px 8px 10px;
            font-size: 13px;
            background: var(--sw-surface-1);
            color: var(--sw-text-1);
            cursor: pointer;
            background-image:
              linear-gradient(45deg, transparent 50%, var(--sw-text-3) 50%),
              linear-gradient(135deg, var(--sw-text-3) 50%, transparent 50%);
            background-position:
              calc(100% - 14px) calc(50% - 2px),
              calc(100% - 9px) calc(50% - 2px);
            background-size: 5px 5px, 5px 5px;
            background-repeat: no-repeat;
          }
          .month-select:focus {
            outline: none;
            border-color: var(--sw-primary-1);
            box-shadow: 0 0 0 3px var(--sw-shadow-primary);
          }
          .month-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
          .month-btn {
            border: 1px solid var(--sw-muted-2);
            background: var(--sw-surface-1);
            border-radius: var(--sw-base-rounded);
            padding: 6px 14px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: border-color 0.2s ease, background 0.2s ease;
          }
          .month-btn:hover {
            background: var(--sw-surface-2);
            border-color: var(--sw-muted-3);
          }
          .month-btn.primary {
            border-color: var(--sw-primary-1);
            background: var(--sw-primary-1);
            color: var(--sw-primary-contrast);
          }
          .month-btn.primary:hover {
            border-color: var(--sw-primary-2);
            background: var(--sw-primary-2);
          }
          .tools {
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: flex-end;
            flex-wrap: wrap;
          }
          .btn {
            border: 1px solid var(--sw-muted-2);
            background: var(--sw-surface-1);
            color: var(--sw-text-1);
            border-radius: 999px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
          }
          .btn:hover {
            background: var(--sw-surface-2);
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
            color: var(--sw-text-3);
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
            border: 1px solid var(--sw-muted-1);
            border-radius: var(--sw-base-rounded);
            background: var(--sw-surface-1);
            color: var(--sw-text-1);
            cursor: pointer;
            font-size: 15px;
          }
          .cell.has-event {
            background: var(--sw-primary-soft-bg);
            border-color: var(--sw-primary-soft-border);
            color: var(--sw-text-1);
          }
          .cell.has-highlight-event {
            background: var(--sw-highlight-bg);
            border-color: var(--sw-highlight-border);
            color: var(--sw-text-1);
          }
          .cell.selected {
            outline: 2px solid var(--sw-primary-2);
            outline-offset: -2px;
          }
          .marker {
            position: absolute;
            right: 8px;
            top: 8px;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--sw-primary-1);
          }
          .marker.marker-highlight {
            background: var(--sw-highlight-marker);
          }
          .list-title-btn {
            border: none;
            background: transparent;
            padding: 0;
            margin: 0 0 10px;
            font-size: 22px;
            font-weight: 700;
            color: var(--sw-text-1);
            cursor: pointer;
          }
          .list-title-btn:hover {
            color: var(--sw-primary-2);
          }
          .list-sub {
            color: var(--sw-text-3);
            font-size: 12px;
            margin-bottom: 8px;
          }
          .item {
            border: 1px solid var(--sw-primary-soft-border-2);
            background: var(--sw-primary-soft-bg);
            border-radius: var(--sw-base-rounded);
            padding: 12px;
            margin-top: 10px;
          }
          .item-link {
            display: block;
            text-decoration: none;
            color: inherit;
            cursor: pointer;
          }
          .item-link:hover {
            border-color: var(--sw-primary-3);
            box-shadow: 0 3px 10px var(--sw-shadow-primary-hover);
          }
          .item.highlight {
            border-color: var(--sw-highlight-border);
            background: var(--sw-highlight-bg);
          }
          .item-link.highlight:hover {
            border-color: var(--sw-highlight-border-strong);
            box-shadow: 0 3px 10px var(--sw-shadow-highlight-hover);
          }
          .date {
            color: var(--sw-text-3);
            font-size: 13px;
          }
          .name {
            margin-top: 4px;
            font-weight: 600;
          }
          .empty {
            color: var(--sw-text-3);
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
            .month-control {
              align-items: flex-start;
            }
            .month-panel {
              left: 0;
              transform: none;
              min-width: min(310px, calc(100vw - 70px));
            }
            .tools {
              justify-content: flex-start;
            }
          }
        </style>
        ${this.state.showCalendarTitle !== false ? `<h2 class="title">${this.state.calendarTitle || '日程'}</h2>` : ''}
        <div class="${wrapClass}">
          <div class="card">
            <div class="head">
              <div>
                <button class="btn" id="prev">上一月</button>
                <button class="btn" id="next" style="margin-left: 8px;">下一月</button>
              </div>
              <div class="month-text">
                <div class="month-control">
                  <button id="monthTrigger" class="month-trigger${this.state.monthPanelOpen ? ' open' : ''}" type="button">${monthText}</button>
                  <div id="monthPanel" class="month-panel${this.state.monthPanelOpen ? '' : ' hidden'}">
                    <div class="month-fields">
                      <select id="monthYear" class="month-select">${yearOptions.join('')}</select>
                      <select id="monthMonth" class="month-select">${monthOptions.join('')}</select>
                    </div>
                    <div class="month-actions">
                      <button id="monthApply" class="month-btn primary" type="button">确定</button>
                    </div>
                  </div>
                </div>
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
            <button class="list-title-btn" id="upcomingReset" type="button">近期日程</button>
            <div class="list-sub">${selectedDay ? `当前筛选：${selectedDay}` : `固定范围：${this.state.upcomingRangeText || '-'}`}</div>
            ${this.state.panelLoading ? '<div class="empty">加载中...</div>' : ''}
            ${!this.state.panelLoading && list.length === 0 ? '<div class="empty">暂无日程</div>' : ''}
            ${list.map((it) => {
              const itemClass = `item${it.highlighted ? ' highlight' : ''}`;
              const dateText = this.escapeHtml(it.startAt ? it.startAt.slice(0, 10) : '');
              const titleText = this.escapeHtml(it.title || '-');
              const body = `
                <div class="date">${dateText}</div>
                <div class="name">${titleText}</div>
              `;
              if (it.relatedPostPermalinkSnapshot) {
                const href = this.escapeHtml(this.normalizePermalink(it.relatedPostPermalinkSnapshot));
                return `<a class="${itemClass} item-link" href="${href}">${body}</a>`;
              }
              return `<div class="${itemClass}">${body}</div>`;
            }).join('')}
          </div>
        </div>
      `;

      const prev = this.shadowRoot.getElementById('prev');
      const next = this.shadowRoot.getElementById('next');
      const today = this.shadowRoot.getElementById('today');
      const monthTrigger = this.shadowRoot.getElementById('monthTrigger');
      const monthPanel = this.shadowRoot.getElementById('monthPanel');
      const monthYear = this.shadowRoot.getElementById('monthYear');
      const monthMonth = this.shadowRoot.getElementById('monthMonth');
      const monthApply = this.shadowRoot.getElementById('monthApply');
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
      if (monthTrigger) {
        monthTrigger.onclick = (e) => {
          e.stopPropagation();
          this.toggleMonthPanel();
        };
      }
      if (monthPanel) {
        monthPanel.onclick = (e) => e.stopPropagation();
      }
      if (monthYear && monthMonth) {
        const updateMonthOptionsByYear = () => {
          const selectedYear = Number(monthYear.value);
          const selectedMonth = Number(monthMonth.value);
          const bounds = this.getMonthRangeBounds();
          const clamped = this.clampYearMonthToRange(
            Number.isInteger(selectedYear) ? selectedYear : pickerValue.year,
            Number.isInteger(selectedMonth) ? selectedMonth : pickerValue.month,
            bounds,
          );
          if (String(clamped.year) !== monthYear.value) {
            monthYear.value = String(clamped.year);
          }
          const monthRange = this.getMonthRangeForYear(clamped.year, bounds);
          const monthOptionHtml = [];
          for (let m = monthRange.start; m <= monthRange.end; m += 1) {
            monthOptionHtml.push(`<option value="${m}">${String(m).padStart(2, '0')}月</option>`);
          }
          monthMonth.innerHTML = monthOptionHtml.join('');
          const nextMonth = Math.min(Math.max(clamped.month, monthRange.start), monthRange.end);
          monthMonth.value = String(nextMonth);
        };
        monthYear.onchange = updateMonthOptionsByYear;
      }
      if (monthApply && monthYear && monthMonth) {
        monthApply.onclick = () => this.applyMonthSelection(monthYear.value, monthMonth.value);
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
