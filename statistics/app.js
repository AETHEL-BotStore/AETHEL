/* AETHEL Statistics dashboard. The bot passes ?report=<signed Supabase URL>. */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const num = (value) => Number(value) || 0;
const money = (value) => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0
}).format(num(value));
const shortMoney = (value) => new Intl.NumberFormat("ru-RU", {
  notation: "compact", maximumFractionDigits: 1
}).format(num(value)) + " ₽";

function localDate(value) {
  if (!value) return null;
  const raw = String(value).trim().replace(" ", "T");
  const result = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T00:00:00" : raw);
  return Number.isNaN(result.getTime()) ? null : result;
}

const isoDate = (value) => {
  const d = value instanceof Date ? value : localDate(value);
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};

const dateText = (value) => {
  const d = localDate(value);
  return d ? new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(d) : "—";
};

const dateTimeText = (value) => {
  const d = localDate(value);
  return d ? new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  }).format(d) : "—";
};

const monthText = (key) => {
  const d = localDate(String(key).slice(0, 7) + "-01");
  return d ? new Intl.DateTimeFormat("ru-RU", {
    month: "short", year: "2-digit"
  }).format(d).replace(".", "") : key;
};

function addDays(offset, hour = 12) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 16);
}

function buildDemo() {
  const services = ["Маникюр", "Ресницы", "Окрашивание", "Уход"];
  const names = ["Анна", "Мария", "Алина", "Виктория", "Елена", "Дарья"];
  const appointments = [];
  for (let i = 0; i < 34; i += 1) {
    const completed = i < 25;
    const service = services[i % services.length];
    const price = [2200, 3000, 4500, 1800][i % 4];
    appointments.push({
      id: i + 1,
      status: completed ? "3" : i === 33 ? "0" : "1",
      datetime: addDays(completed ? -(i * 5 + 2) : i - 23, 10 + (i % 8)),
      user_id: 1000 + (i % names.length),
      client_name: names[i % names.length],
      username: "@aethel_demo_" + (i % names.length + 1),
      phone: "+7 900 000-00-0" + (i % 6),
      service,
      price,
      prepayment: completed || i !== 33 ? 500 : 700,
      payment_id: i % 3 === 0 ? "demo_" + i : null,
      client_note: i % 7 === 0 ? "Любит вечернее время" : ""
    });
  }
  const monthMap = {};
  appointments.filter((item) => item.status === "3").forEach((item) => {
    const key = item.datetime.slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + item.price;
  });
  const months = Object.keys(monthMap).sort();
  const last = months.at(-1) || new Date().toISOString().slice(0, 7);
  const lastDate = localDate(last + "-01");
  const forecastMonths = [1, 2, 3].map((step) => {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + step);
    return isoDate(d).slice(0, 7);
  });
  return {
    master_name: "AETHEL · демонстрация",
    generated_at: new Date().toISOString(),
    appointments,
    historical_months: months,
    historical_values: months.map((key) => monthMap[key]),
    forecast_months: forecastMonths,
    forecast: [52000, 57000, 61000],
    recommendations: [
      "Свяжитесь с клиентами, которые давно не возвращались.",
      "Закрепите повторную запись после самой востребованной услуги."
    ]
  };
}

let report = buildDemo();
let page = 1;
let perPage = 12;
let sleepDays = 60;
let forecastScenario = 1;
let separatePrepayment = localStorage.getItem("aethelStatsSeparatePrepayment") === "1";
const drillGroups = new Map();

function get(...keys) {
  for (const key of keys) {
    if (report[key] !== undefined && report[key] !== null) return report[key];
  }
  return null;
}

function usernameOf(item) {
  const value = item?.username || item?.telegram_username || "";
  if (!value || value === "-") return "";
  return String(value).startsWith("@") ? String(value) : "@" + value;
}

function telegramUrl(item) {
  const username = usernameOf(item);
  if (username) return "https://t.me/" + encodeURIComponent(username.slice(1));
  return item?.user_id ? "tg://user?id=" + encodeURIComponent(item.user_id) : "";
}

function daysAgo(value) {
  const d = localDate(value);
  return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null;
}

function normalizeStatus(value, datetime) {
  const code = String(value ?? "").toLowerCase();
  if (code === "3" || code === "completed" || code === "done") return "completed";
  if (code === "2" || code === "cancelled" || code === "canceled") return "cancelled";
  if (code === "1" || code === "upcoming" || code === "confirmed") return "upcoming";
  if (code === "0" || code === "pending" || code === "waiting") return "pending";
  const d = localDate(datetime);
  return d && d > new Date() ? "upcoming" : "completed";
}

function normalizedAppointments() {
  return (get("appointments", "all_appointments") || []).map((item) => {
    const datetime = item.datetime || (
      item.work_date ? String(item.work_date) + "T" + String(item.start_time || "00:00") : item.date
    );
    const status = normalizeStatus(item.status ?? item.Status, datetime);
    const prepayment = num(item.prepayment ?? item.Prepayment);
    const paymentId = item.payment_id ?? item.PaymentId ?? null;
    return {
      ...item,
      id: item.id ?? item.appointment_id ?? item.Appointments_id,
      datetime,
      work_date: item.work_date || String(datetime || "").slice(0, 10),
      client: item.client_name || item.name || "Без имени",
      phone: item.phone || item.Phone_number || "",
      username: usernameOf(item),
      user_id: item.user_id ?? item.User_id,
      service: item.service || item.service_name || "Без услуги",
      master: item.master_name || report.master_name || "—",
      price: num(item.price ?? item.amount ?? item.Price),
      prepayment,
      payment_id: paymentId,
      status,
      client_note: item.client_note || "",
      appointment_note: item.appointment_note || "",
      comment_text: item.comment_text || "",
      comment_photos: Array.isArray(item.comment_photos) ? item.comment_photos : []
    };
  });
}

function revenueOf(item) {
  const base = num(item?.price ?? item?.amount ?? item?.Price);
  const prepayment = num(item?.prepayment ?? item?.Prepayment);
  return base + (separatePrepayment ? prepayment : 0);
}

function prepaymentAccountingText() {
  return separatePrepayment
    ? "Предоплата добавляется к цене услуги как отдельная часть выручки."
    : "Предоплата считается частью полной цены услуги и отдельно к выручке не прибавляется.";
}

function normalizedClients() {
  const appointments = normalizedAppointments();
  const source = [...(get("clients", "client_stats") || [])];
  if (!source.length) {
    [["loyal_clients", "loyal"], ["sleeping_clients", "sleeping"], ["lost_clients", "lost"], ["new_clients", "new"]]
      .forEach(([key, segment]) => (get(key) || []).forEach((item) => source.push({ ...item, segment })));
  }
  const map = new Map();
  source.forEach((item) => {
    const id = item.user_id ?? item.id;
    if (id === undefined || id === null) return;
    map.set(String(id), {
      ...item,
      user_id: id,
      name: item.name || item.client_name || item.full_name || "Без имени",
      phone: item.phone || item.Phone_number || "",
      username: usernameOf(item)
    });
  });
  appointments.forEach((item) => {
    if (item.user_id === undefined || item.user_id === null) return;
    const key = String(item.user_id);
    const old = map.get(key) || {};
    map.set(key, {
      ...old,
      user_id: item.user_id,
      name: old.name || item.client,
      phone: old.phone || item.phone,
      username: old.username || item.username
    });
  });
  return [...map.values()].map((client) => {
    const rows = appointments.filter((item) => String(item.user_id) === String(client.user_id));
    const completed = rows.filter((item) => item.status === "completed");
    const visitDates = completed.map((item) => localDate(item.datetime)).filter(Boolean).sort((a, b) => a - b);
    const intervals = visitDates.slice(1).map((d, index) => Math.round((d - visitDates[index]) / 86400000));
    const lastVisit = client.last_visit || client.last_date || (visitDates.at(-1) ? isoDate(visitDates.at(-1)) : null);
    const age = daysAgo(lastVisit);
    const visits = completed.length || num(client.visits ?? client.total ?? client.total_visits ?? client.visit_count);
    const spent = completed.length
      ? completed.reduce((sum, item) => sum + revenueOf(item), 0)
      : num(client.spent ?? client.total_spent);
    const next = rows.filter((item) => item.status === "upcoming").sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)))[0];
    let segment = client.segment;
    if (!segment || segment === "all" || ["new", "loyal", "sleeping", "lost"].includes(segment) === false) {
      segment = age !== null && age >= 180 ? "lost" : age !== null && age >= sleepDays ? "sleeping" : num(visits) >= 3 ? "loyal" : "new";
    } else if (age !== null) {
      segment = age >= 180 ? "lost" : age >= sleepDays ? "sleeping" : num(visits) >= 3 ? "loyal" : "new";
    }
    return {
      ...client,
      visits: num(visits),
      spent: num(spent),
      cancelled: num(client.cancelled ?? client.cancelled_count ?? rows.filter((item) => item.status === "cancelled").length),
      first_visit: client.first_visit || (visitDates[0] ? isoDate(visitDates[0]) : null),
      last_visit: lastVisit,
      previous_visit: client.previous_visit || (visitDates.at(-2) ? isoDate(visitDates.at(-2)) : null),
      next_visit: client.next_visit || client.next_date || next?.datetime || null,
      avg_interval_days: client.avg_interval_days ?? client.avg_interval ?? (intervals.length ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null),
      days_since_last: age,
      segment
    };
  });
}

const allAppointments = () => normalizedAppointments();
const allClients = () => normalizedClients();

function serviceData() {
  const completed = allAppointments().filter((item) => item.status === "completed");
  if (completed.length) {
    const map = new Map();
    completed.forEach((item) => {
      const row = map.get(item.service) || { service: item.service, count: 0, income: 0 };
      row.count += 1;
      row.income += revenueOf(item);
      map.set(item.service, row);
    });
    return [...map.values()].sort((a, b) => b.income - a.income);
  }
  return (get("service_stats", "services") || []).map((item) => ({
    service: item.service || item.service_name || item.name || "Без услуги",
    count: num(item.count ?? item.total_count),
    income: num(item.income ?? item.total_income ?? item.revenue)
  })).sort((a, b) => b.income - a.income);
}

function rawStats() {
  const source = get("total_stats", "totals") || {};
  const appointments = allAppointments();
  if (!appointments.length) return {
    total_appointments: 0, completed: 0, upcoming: 0, pending: 0, canceled: 0,
    total_income: 0, avg_check: 0, ...source
  };
  const completed = appointments.filter((item) => item.status === "completed");
  const income = completed.reduce((sum, item) => sum + revenueOf(item), 0);
  return {
    ...source,
    total_appointments: appointments.length,
    completed: completed.length,
    upcoming: appointments.filter((item) => item.status === "upcoming").length,
    pending: appointments.filter((item) => item.status === "pending").length,
    canceled: appointments.filter((item) => item.status === "cancelled").length,
    total_income: income,
    avg_check: completed.length ? income / completed.length : 0
  };
}

function startOfWeek(d) {
  const result = new Date(d);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function groupKey(datetime, unit) {
  const d = localDate(datetime);
  if (!d) return "Без даты";
  if (unit === "day") return isoDate(d);
  if (unit === "week") return isoDate(startOfWeek(d));
  if (unit === "year") return String(d.getFullYear());
  return isoDate(d).slice(0, 7);
}

function groupLabel(key, unit) {
  if (unit === "day") return dateText(key);
  if (unit === "week") return "с " + dateText(key).replace(/\s\d{4}\s?г?\.?$/, "");
  if (unit === "month") return monthText(key);
  return key;
}

function aggregateRows(rows, unit, valueGetter) {
  const map = new Map();
  rows.forEach((row) => {
    const key = groupKey(row.datetime, unit);
    const current = map.get(key) || { key, label: groupLabel(key, unit), value: 0, rows: [] };
    current.value += valueGetter(row);
    current.rows.push(row);
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

function metricKpi(label, value, note = "") {
  return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value">' + value + '</div>' +
    (note ? '<div class="kpi-delta">' + esc(note) + '</div>' : "") + '</div>';
}

function emptyState(text) {
  return '<div class="empty-state"><b>Пока недостаточно данных</b><span>' + esc(text) + '</span></div>';
}

function drawLineChart(target, labels, series, drillPrefix = "") {
  const root = $(target);
  if (!root) return;
  const values = series.flatMap((line) => line.values.filter((value) => Number.isFinite(value)));
  if (!labels.length || !values.length) {
    root.innerHTML = emptyState("График появится после накопления записей.");
    return;
  }
  const width = 920, height = 330, left = 68, right = 24, top = 24, bottom = 58;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = Math.max(...values, 1) * 1.08;
  const x = (index) => left + (labels.length === 1 ? plotWidth / 2 : index * plotWidth / (labels.length - 1));
  const y = (value) => top + plotHeight - num(value) / max * plotHeight;
  let grid = "";
  for (let step = 0; step <= 4; step += 1) {
    const value = max * (4 - step) / 4;
    const yy = top + plotHeight * step / 4;
    grid += '<line class="chart-grid" x1="' + left + '" y1="' + yy + '" x2="' + (width - right) + '" y2="' + yy + '"></line>';
    grid += '<text class="chart-axis-y" x="' + (left - 10) + '" y="' + (yy + 4) + '">' + esc(shortMoney(value)) + '</text>';
  }
  const labelEvery = Math.max(1, Math.ceil(labels.length / 7));
  let xLabels = "";
  labels.forEach((label, index) => {
    if (index % labelEvery === 0 || index === labels.length - 1) {
      xLabels += '<text class="chart-axis-x" x="' + x(index) + '" y="' + (height - 22) + '">' + esc(label) + '</text>';
    }
  });
  let lines = "";
  series.forEach((line, lineIndex) => {
    const points = [];
    line.values.forEach((value, index) => {
      if (Number.isFinite(value)) points.push({ index, value, x: x(index), y: y(value) });
    });
    if (!points.length) return;
    const path = points.map((point, index) => (index ? "L" : "M") + point.x.toFixed(1) + "," + point.y.toFixed(1)).join(" ");
    if (lineIndex === 0 && points.length > 1) {
      const area = path + " L" + points.at(-1).x + "," + (top + plotHeight) + " L" + points[0].x + "," + (top + plotHeight) + " Z";
      lines += '<path class="chart-area" d="' + area + '"></path>';
    }
    lines += '<path class="chart-line ' + (line.dashed ? "is-forecast" : "is-fact") + '" style="--series:' + line.color + '" d="' + path + '"></path>';
    points.forEach((point) => {
      const pointPrefix = line.drillPrefix ?? drillPrefix;
      const key = pointPrefix ? pointPrefix + ":" + (line.keys?.[point.index] || labels[point.index]) : "";
      lines += '<g class="chart-point" ' + (key ? 'data-drill="' + esc(key) + '" role="button" tabindex="0"' : "") + '>' +
        '<circle cx="' + point.x + '" cy="' + point.y + '" r="10" class="point-hit"></circle>' +
        '<circle cx="' + point.x + '" cy="' + point.y + '" r="4.5" style="--series:' + line.color + '"></circle>' +
        '<title>' + esc(line.name + " · " + labels[point.index] + " · " + money(point.value)) + '</title></g>';
    });
  });
  root.innerHTML = '<svg class="revenue-svg" viewBox="0 0 ' + width + " " + height + '" aria-label="График дохода">' + grid + xLabels + lines + '</svg>';
}

function drawBars(target, data, formatter = money, drillPrefix = "") {
  const root = $(target);
  if (!root) return;
  if (!data.length) {
    root.innerHTML = emptyState("Выберите другой период или дождитесь новых записей.");
    return;
  }
  const max = Math.max(...data.map((item) => item.value), 1);
  root.innerHTML = '<div class="interactive-bars">' + data.map((item) => {
    const height = Math.max(3, item.value / max * 100);
    const key = drillPrefix + ":" + item.key;
    return '<button class="bar-column" type="button" data-drill="' + esc(key) + '" aria-label="' + esc(item.label + ": " + formatter(item.value)) + '">' +
      '<span class="bar-value">' + formatter(item.value) + '</span><i style="height:' + height + '%"></i><span class="bar-label">' + esc(item.label) + '</span></button>';
  }).join("") + '</div>';
}

function paymentLabel(item) {
  if (!item.prepayment) return '<span class="payment neutral">Не требуется</span>';
  return '<span class="payment neutral">Сумма задана в услуге · факт оплаты не отслеживается</span>';
}

function statusLabel(status) {
  return {
    completed: "Выполнена",
    upcoming: "Подтверждена",
    pending: "Ожидает",
    cancelled: "Отменена"
  }[status] || status;
}

function clientProfile(item) {
  const name = item.name || item.client || "Без имени";
  const url = telegramUrl(item);
  const username = usernameOf(item);
  return '<div class="client-main"><button class="client-profile" type="button" data-client="' + esc(item.user_id) + '" title="Открыть карточку клиента">' +
    '<span class="avatar">' + esc(name[0]?.toUpperCase() || "?") + '</span><b>' + esc(name) + '</b></button>' +
    '<div class="client-contact">' + (url ? '<a class="user-link" target="_blank" rel="noopener" href="' + esc(url) + '">' + esc(username || "Открыть Telegram") + '</a>' : '<small class="muted">Telegram не указан</small>') +
    (item.phone ? '<small>' + esc(item.phone) + '</small>' : "") + '</div></div>';
}

function actionButtons(item) {
  const url = telegramUrl(item);
  const copyValue = usernameOf(item) || item.phone || "";
  return '<div class="actions">' + (url ? '<a class="ghost mini" target="_blank" rel="noopener" href="' + esc(url) + '">Чат</a>' : "") +
    '<button class="icon-button" type="button" title="Скопировать контакт" data-copy="' + esc(copyValue) + '">⧉</button>' +
    '<button class="icon-button" type="button" title="Открыть карточку" data-client="' + esc(item.user_id) + '">•••</button></div>';
}

function monthFinance() {
  const appointments = allAppointments();
  const month = isoDate(new Date()).slice(0, 7);
  const fact = appointments.filter((item) => item.status === "completed" && String(item.datetime).slice(0, 7) === month).reduce((sum, item) => sum + revenueOf(item), 0);
  const booked = appointments.filter((item) => item.status === "upcoming" && String(item.datetime).slice(0, 7) === month).reduce((sum, item) => sum + revenueOf(item), 0);
  const configuredPrepayment = appointments.filter((item) => item.status === "upcoming" && String(item.datetime).slice(0, 7) === month).reduce((sum, item) => sum + item.prepayment, 0);
  const localForecast = baseForecast().find((item) => item.key === month)?.value || 0;
  const serverForecast = appointments.length ? 0 : num(get("total_stats")?.current_month_forecast ?? get("current_month_forecast"));
  return { month, fact, booked, configuredPrepayment, forecast: Math.max(fact + booked, localForecast, serverForecast) };
}

function revenueTimeline(unit) {
  const appointments = allAppointments();
  const actual = aggregateRows(appointments.filter((item) => item.status === "completed"), unit, revenueOf);
  const confirmed = aggregateRows(appointments.filter((item) => item.status === "upcoming"), unit, revenueOf);
  const actualMap = new Map(actual.map((item) => [item.key, item]));
  const forecastMap = new Map(confirmed.map((item) => [item.key, item]));
  if (unit === "month") {
    const forecastSeries = appointments.length
      ? baseForecast()
      : (get("forecast_months") || []).map((key, index) => ({ key, value: num((get("forecast") || [])[index]) }));
    forecastSeries.forEach((forecastItem) => {
      const key = forecastItem.key;
      const existing = forecastMap.get(key);
      forecastMap.set(key, {
        key,
        label: monthText(key),
        value: Math.max(num(forecastItem.value), existing?.value || 0),
        rows: existing?.rows || []
      });
    });
    const current = monthFinance();
    forecastMap.set(current.month, {
      key: current.month,
      label: monthText(current.month),
      value: current.forecast,
      rows: appointments.filter((item) => item.status === "upcoming" && String(item.datetime).slice(0, 7) === current.month)
    });
  }
  const keys = [...new Set([...actualMap.keys(), ...forecastMap.keys()])].sort();
  const limit = unit === "day" ? 30 : unit === "week" ? 20 : unit === "month" ? 24 : 10;
  const visible = keys.slice(-limit);
  visible.forEach((key) => {
    const actualRow = actualMap.get(key);
    const forecastRow = forecastMap.get(key);
    drillGroups.set("overview-actual:" + key, {
      title: groupLabel(key, unit) + " · фактический доход",
      rows: actualRow?.rows || [],
      value: actualRow?.value || 0,
      note: "В сумму входят только выполненные записи."
    });
    drillGroups.set("overview-forecast:" + key, {
      title: groupLabel(key, unit) + " · ожидаемый доход",
      rows: forecastRow?.rows || [],
      value: forecastRow?.value || 0,
      note: "Сумма в заголовке — прогноз. В списке показаны конкретные подтверждённые записи, поэтому их сумма может быть ниже прогноза."
    });
  });
  return {
    labels: visible.map((key) => groupLabel(key, unit)),
    keys: visible,
    actual: visible.map((key) => actualMap.has(key) ? actualMap.get(key).value : null),
    forecast: visible.map((key) => forecastMap.has(key) ? forecastMap.get(key).value : null)
  };
}

function renderOverviewIncome() {
  const unit = $("#incomePeriod")?.value || "month";
  const timeline = revenueTimeline(unit);
  drawLineChart("#incomeChart", timeline.labels, [
    { name: "Факт", color: "#9b82ff", values: timeline.actual, keys: timeline.keys, drillPrefix: "overview-actual" },
    { name: "Прогноз", color: "#ff74b2", values: timeline.forecast, keys: timeline.keys, dashed: true, drillPrefix: "overview-forecast" }
  ]);
}

function renderSegments(clients) {
  const groups = {
    all: clients,
    new: clients.filter((item) => item.segment === "new"),
    loyal: clients.filter((item) => item.segment === "loyal"),
    sleeping: clients.filter((item) => item.segment === "sleeping"),
    lost: clients.filter((item) => item.segment === "lost")
  };
  const names = { all: "Всего", new: "Новые", loyal: "Постоянные", sleeping: "Спящие", lost: "Ушедшие" };
  const html = Object.entries(groups).map(([key, rows]) =>
    '<button class="segment" type="button" data-segment="' + key + '"><small>' + names[key] + '</small><b>' + rows.length + '</b><span>открыть список →</span></button>'
  ).join("");
  $("#clientSegments").innerHTML = Object.entries(groups).filter(([key]) => key !== "all").map(([key, rows]) =>
    '<button class="segment" type="button" data-segment="' + key + '"><small>' + names[key] + '</small><b>' + rows.length + '</b><span>посмотреть →</span></button>'
  ).join("");
  $("#clientSegmentsLarge").innerHTML = html;
}

function renderInsights(stats, clients, appointments) {
  const rows = [];
  const sleeping = clients.filter((item) => item.segment === "sleeping").length;
  const lost = clients.filter((item) => item.segment === "lost").length;
  const pending = appointments.filter((item) => item.status === "pending").length;
  if (sleeping) rows.push(["Можно вернуть в запись", sleeping + " клиентов не приходили больше " + sleepDays + " дней."]);
  if (lost) rows.push(["Риск потери", lost + " клиентов не были больше шести месяцев."]);
  if (pending) rows.push(["Нужно подтвердить", pending + " записей ожидают подтверждения мастера."]);
  if (!rows.length) rows.push(["Всё под контролем", "Критичных точек сейчас не обнаружено."]);
  $("#insights").innerHTML = rows.map(([title, text]) => '<button class="insight" type="button" data-go="' + (title.includes("подтверд") ? "appointments" : "clients") + '"><strong>' + esc(title) + '</strong><span>' + esc(text) + '</span></button>').join("");
  const top = clients.slice().sort((a, b) => b.spent - a.spent)[0];
  $("#topClientCallout").innerHTML = top
    ? 'Самый ценный клиент — <button class="inline-client" type="button" data-client="' + esc(top.user_id) + '">' + esc(top.name) + '</button>. Доход: <b>' + money(top.spent) + "</b>."
    : "История клиентов пока небольшая.";
}

function renderUpcoming(appointments) {
  const rows = appointments.filter((item) => item.status === "upcoming").sort((a, b) => String(a.datetime).localeCompare(String(b.datetime))).slice(0, 5);
  $("#upcomingMini").innerHTML = rows.length ? rows.map((item) =>
    '<button class="upcoming-item" type="button" data-appointment="' + esc(item.id) + '"><span><b>' + esc(item.client) + '</b><small>' + esc(item.service) + '</small></span><span><i>' + dateTimeText(item.datetime) + '</i><b>' + money(revenueOf(item)) + '</b></span></button>'
  ).join("") : emptyState("Будущих подтверждённых записей пока нет.");
}

function renderServices() {
  const data = serviceData();
  const total = data.reduce((sum, item) => sum + item.income, 0);
  $("#serviceMini").innerHTML = data.slice(0, 4).map((item, index) =>
    '<button class="service-tile" type="button" data-service-open="' + esc(item.service) + '"><span>0' + (index + 1) + '</span><b>' + esc(item.service) + '</b><strong>' + money(item.income) + '</strong><small>' + item.count + " записей</small></button>"
  ).join("") || emptyState("Услуги появятся после выполненных записей.");
  const colors = ["#9b82ff", "#ff74b2", "#60deb0", "#f4c766", "#69b8ff", "#b990ff"];
  let offset = 0;
  const gradient = data.slice(0, 6).map((item, index) => {
    const start = offset;
    offset += total ? item.income / total * 100 : 0;
    return colors[index % colors.length] + " " + start + "% " + offset + "%";
  }).join(",");
  $("#serviceDonut").innerHTML = data.length
    ? '<button class="donut" type="button" data-go="money" style="background:conic-gradient(' + gradient + ')"><span class="donut-center"><b>' + money(total) + '</b><small>общий доход</small></span></button><div class="donut-legend">' + data.slice(0, 6).map((item, index) => '<button type="button" data-service-open="' + esc(item.service) + '"><i style="background:' + colors[index % colors.length] + '"></i><span>' + esc(item.service) + '</span><b>' + Math.round(item.income / Math.max(total, 1) * 100) + '%</b></button>').join("") + "</div>"
    : emptyState("Недостаточно данных по услугам.");
  const max = Math.max(...data.map((item) => item.income), 1);
  $("#serviceBars").innerHTML = data.map((item) =>
    '<button class="service-row" type="button" data-service-open="' + esc(item.service) + '"><span>' + esc(item.service) + '</span><div class="bar"><i style="width:' + (item.income / max * 100) + '%"></i></div><small>' + money(item.income) + "</small></button>"
  ).join("") || emptyState("Нет выполненных записей.");
  $("#servicesTable").innerHTML = data.map((item) =>
    "<tr><td><button class=\"table-link\" type=\"button\" data-service-open=\"" + esc(item.service) + "\">" + esc(item.service) + "</button></td><td>" + item.count + "</td><td><b>" + money(item.income) + "</b></td><td>" + money(item.income / Math.max(item.count, 1)) + "</td><td>" + Math.round(item.income / Math.max(total, 1) * 100) + "%</td></tr>"
  ).join("") || '<tr><td colspan="5">Нет данных</td></tr>';
}

function renderClients(clients) {
  const query = ($("#clientSearch")?.value || "").toLowerCase();
  const segment = $("#clientSegmentFilter")?.value || "all";
  const filtered = clients.filter((item) => (segment === "all" || item.segment === segment) &&
    (item.name + " " + item.phone + " " + item.username).toLowerCase().includes(query));
  const segmentNames = { new: "Новый", loyal: "Постоянный", sleeping: "Спящий", lost: "Ушедший" };
  $("#clientsTable").innerHTML = filtered.map((item) =>
    "<tr><td>" + clientProfile(item) + '</td><td><span class="status ' + item.segment + '">' + segmentNames[item.segment] + "</span></td><td>" + item.visits + "</td><td><b>" + money(item.spent) + "</b></td><td>" + dateText(item.last_visit) + (item.days_since_last !== null ? '<br><small class="muted">' + item.days_since_last + " дн. назад</small>" : "") + "</td><td>" + (item.avg_interval_days ? item.avg_interval_days + " дн." : "—") + "</td><td>" + actionButtons(item) + "</td></tr>"
  ).join("") || '<tr><td colspan="7" class="muted">Ничего не найдено</td></tr>';
  $("#clientsCards").innerHTML = filtered.map((item) =>
    '<article class="mobile-card"><div class="mobile-card-head">' + clientProfile(item) + '<span class="status ' + item.segment + '">' + segmentNames[item.segment] + '</span></div><div class="mobile-stats"><span><small>Визитов</small><b>' + item.visits + '</b></span><span><small>Потратил</small><b>' + money(item.spent) + '</b></span><span><small>Последний визит</small><b>' + dateText(item.last_visit) + '</b></span></div>' + actionButtons(item) + "</article>"
  ).join("") || emptyState("Клиенты не найдены.");
}

function filteredAppointments() {
  const query = ($("#appointmentSearch")?.value || "").toLowerCase();
  const status = $("#statusFilter")?.value || "all";
  const service = $("#serviceFilter")?.value || "all";
  const from = $("#dateFrom")?.value || "";
  const to = $("#dateTo")?.value || "";
  return allAppointments().filter((item) =>
    (status === "all" || item.status === status) &&
    (service === "all" || item.service === service) &&
    (!from || String(item.datetime).slice(0, 10) >= from) &&
    (!to || String(item.datetime).slice(0, 10) <= to) &&
    (item.client + " " + item.phone + " " + item.username + " " + item.service).toLowerCase().includes(query)
  );
}

function renderAppointments(rows) {
  const counts = {
    completed: rows.filter((item) => item.status === "completed").length,
    upcoming: rows.filter((item) => item.status === "upcoming").length,
    pending: rows.filter((item) => item.status === "pending").length,
    cancelled: rows.filter((item) => item.status === "cancelled").length
  };
  const configuredPrepayment = rows.reduce((sum, item) => sum + item.prepayment, 0);
  $("#appointmentSubstats").innerHTML = '<span class="substat">Всего <b>' + rows.length + '</b></span><span class="substat">Выполнено <b>' + counts.completed + '</b></span><span class="substat">Подтверждено <b>' + counts.upcoming + '</b></span><span class="substat">Ожидают <b>' + counts.pending + '</b></span><span class="substat">Предоплата по настройкам <b>' + money(configuredPrepayment) + "</b></span>";
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  page = Math.min(Math.max(1, page), pages);
  const slice = rows.slice((page - 1) * perPage, page * perPage);
  $("#appointmentsTable").innerHTML = slice.map((item) =>
    "<tr><td>" + dateTimeText(item.datetime) + "</td><td>" + clientProfile({ ...item, name: item.client }) + "</td><td><button class=\"table-link\" type=\"button\" data-appointment=\"" + esc(item.id) + "\">" + esc(item.service) + "</button>" + (item.client_note || item.appointment_note || item.comment_text ? '<br><small class="muted">Есть заметка</small>' : "") + "</td><td><b>" + money(revenueOf(item)) + "</b></td><td>" + (item.prepayment ? money(item.prepayment) + "<br>" + paymentLabel(item) : paymentLabel(item)) + '</td><td><span class="status ' + item.status + '">' + statusLabel(item.status) + '</span></td><td><button class="icon-button" type="button" data-appointment="' + esc(item.id) + '">•••</button></td></tr>'
  ).join("") || '<tr><td colspan="7" class="muted">Записей не найдено</td></tr>';
  $("#appointmentsCards").innerHTML = slice.map((item) =>
    '<article class="mobile-card appointment-card" data-appointment="' + esc(item.id) + '"><div class="mobile-card-head"><span><small>' + dateTimeText(item.datetime) + '</small><b>' + esc(item.service) + '</b></span><span class="status ' + item.status + '">' + statusLabel(item.status) + '</span></div>' + clientProfile({ ...item, name: item.client }) + '<div class="mobile-stats"><span><small>Доход по режиму</small><b>' + money(revenueOf(item)) + '</b></span><span><small>Предоплата</small><b>' + (item.prepayment ? money(item.prepayment) : "Не требуется") + '</b></span></div><div class="payment-row">' + paymentLabel(item) + "</div></article>"
  ).join("") || emptyState("Записей не найдено.");
  $("#pageInfo").textContent = page + " / " + pages;
  $("#pageInfoMobile").textContent = page + " / " + pages;
}

function buildBehaviorMetrics(clients) {
  const appointments = allAppointments();
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const rowsByUser = new Map();
  appointments.forEach((item) => {
    if (item.user_id === undefined || item.user_id === null) return;
    const key = String(item.user_id);
    if (!rowsByUser.has(key)) rowsByUser.set(key, []);
    rowsByUser.get(key).push(item);
  });

  const base = clients.map((client) => {
    const rows = rowsByUser.get(String(client.user_id)) || [];
    const completed = rows.filter((item) => item.status === "completed");
    const cancelled = rows.filter((item) => item.status === "cancelled");
    const visits = completed.length;
    const spent = completed.reduce((sum, item) => sum + revenueOf(item), 0);
    const uniqueDates = [...new Set(completed.map((item) => String(item.datetime || "").slice(0, 10)).filter(Boolean))]
      .sort().map(localDate).filter(Boolean);
    const intervals = uniqueDates.slice(1).map((date, index) => Math.max(0, Math.round((date - uniqueDates[index]) / 86400000)));
    const avgInterval = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null;
    const lastVisit = uniqueDates.at(-1) || null;
    const daysSinceLast = lastVisit ? Math.max(0, Math.floor((Date.now() - lastVisit.getTime()) / 86400000)) : null;
    const interactions = visits + cancelled.length;
    const cancelRate = interactions ? cancelled.length / interactions : 0;
    const hours = completed.map((item) => localDate(item.datetime)?.getHours()).filter((hour) => Number.isFinite(hour));
    const avgHour = hours.length ? hours.reduce((sum, hour) => sum + hour, 0) / hours.length : null;
    return { client, rows, completed, cancelled, visits, spent, intervals, avgInterval, daysSinceLast, interactions, cancelRate, avgHour };
  }).filter((item) => item.visits > 0);

  const maxSpent = Math.max(...base.map((item) => item.spent), 1);
  const sortedSpent = base.map((item) => item.spent).sort((a, b) => a - b);
  const q75 = sortedSpent.length ? sortedSpent[Math.floor((sortedSpent.length - 1) * .75)] : 0;

  const lv = [];
  const dna = [];
  const typeIncome = {};

  base.forEach((item) => {
    const visitScore = clamp((item.visits - 1) / 7);
    const expectedInterval = item.avgInterval || 45;
    const recencyGrace = clamp(expectedInterval * 1.35, 30, 90);
    let recencyScore = 0;
    if (item.daysSinceLast === null) recencyScore = 0;
    else if (item.daysSinceLast <= recencyGrace) recencyScore = 1;
    else if (item.daysSinceLast <= Math.max(90, recencyGrace * 2)) recencyScore = .62;
    else if (item.daysSinceLast <= 180) recencyScore = .28;

    const reliabilityScore = (item.visits + 1) / Math.max(1, item.visits + item.cancelled.length + 2);
    let regularityScore = 0;
    if (item.intervals.length === 1) regularityScore = .4;
    if (item.intervals.length >= 2) {
      const mean = item.avgInterval || 1;
      const variance = item.intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / item.intervals.length;
      const cv = Math.sqrt(variance) / Math.max(mean, 1);
      regularityScore = clamp(1 - cv, .15, 1);
    }
    const valueScore = clamp(Math.sqrt(item.spent / maxSpent));
    const score = Math.round(
      visitScore * 40 +
      recencyScore * 15 +
      reliabilityScore * 20 +
      regularityScore * 10 +
      valueScore * 15
    );

    const riskThreshold = Math.max(75, expectedInterval * 2.2);
    let clientType;
    if (item.daysSinceLast !== null && item.daysSinceLast >= 180) clientType = "Ушедший клиент";
    else if (item.daysSinceLast !== null && item.daysSinceLast > riskThreshold) clientType = "Риск ухода";
    else if (item.interactions >= 3 && item.cancelRate >= .35) clientType = "Частые отмены";
    else if (item.visits <= 1) clientType = "Новый клиент";
    else if (item.visits >= 8 && item.spent >= q75) clientType = "Ключевой клиент";
    else if (item.visits >= 5) clientType = "Постоянный клиент";
    else clientType = "Возвращающийся клиент";

    let level;
    let recommendation;
    if (clientType === "Ушедший клиент") {
      level = "Ценный, но ушёл";
      recommendation = "Вернуть персональным предложением и удобным окном";
    } else if (clientType === "Риск ухода") {
      level = "Риск ухода";
      recommendation = "Напомнить о записи до выпадения клиента из привычного цикла";
    } else if (clientType === "Частые отмены") {
      level = "Нестабильный";
      recommendation = "Подтверждать визит заранее и использовать предоплату";
    } else if (score >= 85) {
      level = "Ядро базы";
      recommendation = "Удерживать: приоритетные окна, персональное внимание, ранняя запись";
    } else if (score >= 70) {
      level = "Очень лояльный";
      recommendation = "Поддерживать регулярность и предлагать следующую запись заранее";
    } else if (score >= 55) {
      level = "Постоянный";
      recommendation = "Закрепить привычный интервал между визитами";
    } else if (score >= 40) {
      level = "Развивающийся";
      recommendation = "Главная цель — увеличить число повторных визитов";
    } else {
      level = "Новый / нестабильный";
      recommendation = "Довести клиента до второго подтверждённого визита";
    }

    const timeLabel = item.avgHour === null ? "время —" : item.avgHour < 12 ? "утро" : item.avgHour >= 17 ? "вечер" : "день";
    const intervalLabel = item.avgInterval ? "~" + Math.round(item.avgInterval) + " дн." : "интервал —";
    const profile = item.visits + " виз. · " + Math.round(item.cancelRate * 100) + "% отмен · " + intervalLabel + " · " + timeLabel;

    const common = {
      user_id: item.client.user_id,
      name: item.client.name,
      phone: item.client.phone,
      username: item.client.username,
      telegram_url: item.client.telegram_url
    };
    lv.push({ ...common, lv: score, level, rec: recommendation });
    dna.push({ ...common, dna_code: profile, client_type: clientType, strategy: recommendation });
    typeIncome[clientType] = (typeIncome[clientType] || 0) + item.spent;
  });

  const totalIncome = Object.values(typeIncome).reduce((sum, value) => sum + value, 0);
  const gdr = totalIncome > 0
    ? 1 - Object.values(typeIncome).reduce((sum, value) => sum + (value / totalIncome) ** 2, 0)
    : null;
  return { lv, dna, typeIncome, gdr };
}

function renderBehavior(clients) {
  const behavior = buildBehaviorMetrics(clients);
  const lv = behavior.lv;
  const dna = behavior.dna;
  $("#lvLegend").innerHTML = '<span class="lv-pill lv-high">85+ · ядро базы</span><span class="lv-pill lv-mid">70–84 · очень лояльный</span><span class="lv-pill lv-low">40–69 · развивается / требует внимания</span>';
  $("#lvTable").innerHTML = lv.slice().sort((a, b) => num(b.lv) - num(a.lv)).map((item) =>
    "<tr><td>" + clientProfile(item) + "</td><td><b>" + num(item.lv) + "%</b></td><td>" + esc(item.level || "—") + '</td><td class="muted">' + esc(item.rec || "—") + "</td></tr>"
  ).join("") || '<tr><td colspan="4" class="muted">LV появится после первой выполненной записи.</td></tr>';

  const typeIncome = behavior.typeIncome;
  const max = Math.max(...Object.values(typeIncome).map(num), 1);
  $("#typeIncome").innerHTML = Object.entries(typeIncome).filter(([, value]) => num(value) > 0).sort((a, b) => b[1] - a[1]).map(([name, value]) =>
    '<div class="type-row"><span>' + esc(name) + '</span><div class="bar"><i style="width:' + (num(value) / max * 100) + '%"></i></div><b>' + money(value) + "</b></div>"
  ).join("") || emptyState("Типы появятся после выполненных записей.");

  if (behavior.gdr === null) {
    $("#gdrNote").innerHTML = "Метрика устойчивости появится после накопления выполненных записей.";
  } else {
    const gdr = behavior.gdr;
    $("#gdrNote").innerHTML = "Устойчивость структуры дохода: <b>" + gdr.toFixed(2) + "</b>. " +
      (gdr < .25 ? "Доход сильно сосредоточен в одной группе клиентов." : gdr < .5 ? "Есть заметная зависимость от нескольких групп." : "Доход распределён между группами достаточно устойчиво.");
  }

  $("#dnaTable").innerHTML = dna.map((item) =>
    "<tr><td>" + clientProfile(item) + "</td><td>" + esc(usernameOf(item) || "—") + '</td><td class="dna-code">' + esc(item.dna_code || "—") + "</td><td>" + esc(item.client_type || "—") + '</td><td class="muted">' + esc(item.strategy || "—") + "</td></tr>"
  ).join("") || '<tr><td colspan="5" class="muted">Профиль поведения появится после первой выполненной записи.</td></tr>';
}

function analyticsRows() {
  const status = $("#analyticsStatus")?.value || "completed";
  const service = $("#analyticsService")?.value || "all";
  const from = $("#analyticsFrom")?.value || "";
  const to = $("#analyticsTo")?.value || "";
  return allAppointments().filter((item) =>
    (status === "all" ? item.status !== "cancelled" : item.status === status) &&
    (service === "all" || item.service === service) &&
    (!from || String(item.datetime).slice(0, 10) >= from) &&
    (!to || String(item.datetime).slice(0, 10) <= to)
  );
}

function renderAnalytics() {
  const rows = analyticsRows();
  const metric = $("#analyticsMetric")?.value || "income";
  const group = $("#analyticsGroup")?.value || "month";
  const view = $("#analyticsView")?.value || "bars";
  const groups = new Map();
  rows.forEach((item) => {
    let key, label;
    if (group === "service") {
      key = item.service;
      label = item.service;
    } else if (group === "month_service") {
      const month = groupKey(item.datetime, "month");
      key = month + "|" + item.service;
      label = monthText(month) + " · " + item.service;
    } else {
      key = groupKey(item.datetime, group);
      label = groupLabel(key, group);
    }
    const bucket = groups.get(key) || { key, label, rows: [] };
    bucket.rows.push(item);
    groups.set(key, bucket);
  });
  const data = [...groups.values()].map((bucket) => {
    const total = bucket.rows.reduce((sum, item) => sum + revenueOf(item), 0);
    const value = metric === "appointments"
      ? bucket.rows.length
      : metric === "avg_check"
        ? total / Math.max(bucket.rows.length, 1)
        : metric === "prepayment"
          ? bucket.rows.reduce((sum, item) => sum + item.prepayment, 0)
          : total;
    drillGroups.set("analytics:" + bucket.key, { title: bucket.label, rows: bucket.rows });
    return { ...bucket, value };
  }).sort((a, b) => group === "service" ? b.value - a.value : String(a.key).localeCompare(String(b.key)));
  const formatter = metric === "appointments" ? (value) => String(value) : money;
  const totalIncome = rows.reduce((sum, item) => sum + revenueOf(item), 0);
  const totalPrepayment = rows.reduce((sum, item) => sum + item.prepayment, 0);
  $("#analyticsSummary").innerHTML = '<span class="substat">Записей <b>' + rows.length + '</b></span><span class="substat">Сумма <b>' + money(totalIncome) + '</b></span><span class="substat">Средний чек <b>' + money(totalIncome / Math.max(rows.length, 1)) + '</b></span><span class="substat">Предоплата по настройкам <b>' + money(totalPrepayment) + "</b></span>";
  if (view === "table") {
    $("#analyticsChart").innerHTML = '<div class="analytics-table"><div class="analytics-table-head"><span>Группа</span><span>Значение</span><span>Записей</span></div>' + data.map((item) =>
      '<button type="button" data-drill="analytics:' + esc(item.key) + '"><span>' + esc(item.label) + '</span><b>' + formatter(item.value) + '</b><small>' + item.rows.length + "</small></button>"
    ).join("") + "</div>";
  } else if (view === "line") {
    drawLineChart("#analyticsChart", data.map((item) => item.label), [{
      name: $("#analyticsMetric option:checked")?.textContent || "Показатель",
      color: "#9b82ff",
      values: data.map((item) => item.value),
      keys: data.map((item) => item.key)
    }], "analytics");
  } else {
    drawBars("#analyticsChart", data, formatter, "analytics");
  }
}

function monthlyHistory() {
  const completed = allAppointments().filter((item) => item.status === "completed");
  if (completed.length) {
    const raw = aggregateRows(completed, "month", revenueOf).map((item) => ({ key: item.key, value: item.value }));
    if (!raw.length) return [];
    const map = new Map(raw.map((item) => [item.key, item.value]));
    const start = localDate(raw[0].key + "-01");
    const end = localDate(raw.at(-1).key + "-01");
    const filled = [];
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard < 120) {
      const key = isoDate(cursor).slice(0, 7);
      filled.push({ key, value: map.get(key) || 0 });
      cursor.setMonth(cursor.getMonth() + 1);
      guard += 1;
    }
    return filled;
  }
  const reportMonths = get("historical_months") || [];
  const reportValues = get("historical_values") || [];
  return reportMonths.map((key, index) => ({ key, value: num(reportValues[index]) }));
}

function baseForecast() {
  const currentMonth = isoDate(new Date()).slice(0, 7);
  const history = monthlyHistory().filter((item) => item.key < currentMonth).slice(-6);
  if (history.length < 2) return [];
  const trend = (history.at(-1).value - history[0].value) / Math.max(1, history.length - 1);
  const lastDate = localDate(history.at(-1).key + "-01");
  return [1, 2, 3].map((step) => {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + step);
    return { key: isoDate(d).slice(0, 7), value: Math.max(0, history.at(-1).value + trend * step) };
  });
}

function renderForecast() {
  const history = monthlyHistory();
  const forecast = baseForecast().map((item) => ({ ...item, value: item.value * forecastScenario }));
  const labels = [...history.map((item) => monthText(item.key)), ...forecast.map((item) => monthText(item.key))];
  const actualValues = [...history.map((item) => item.value), ...forecast.map(() => null)];
  const predictedValues = [...history.map((item, index) => index === history.length - 1 ? item.value : null), ...forecast.map((item) => item.value)];
  drawLineChart("#forecastChart", labels, [
    { name: "Факт", color: "#9b82ff", values: actualValues },
    { name: "Прогноз", color: "#ff74b2", values: predictedValues, dashed: true }
  ]);
  const next = forecast[0]?.value || 0;
  const last = history.at(-1)?.value || 0;
  const growth = last ? (next - last) / last * 100 : 0;
  const booked = allAppointments().filter((item) => item.status === "upcoming").reduce((sum, item) => sum + revenueOf(item), 0);
  $("#forecastKpis").innerHTML = [
    metricKpi("Следующий месяц", money(next), forecastScenario === 1 ? "базовый сценарий" : forecastScenario < 1 ? "осторожный сценарий" : "оптимистичный сценарий"),
    metricKpi("Изменение", (growth >= 0 ? "+" : "") + Math.round(growth) + "%", "к последнему факту"),
    metricKpi("Уже подтверждено", money(booked), "будущие записи"),
    metricKpi("История для прогноза", history.length + " мес.", "чем больше полных месяцев, тем устойчивее ориентир")
  ].join("");
  $("#forecastList").innerHTML = forecast.length ? forecast.map((item) =>
    '<button class="forecast-row" type="button" data-forecast-month="' + item.key + '"><span>' + monthText(item.key) + '</span><b>' + money(item.value) + "</b></button>"
  ).join("") : emptyState("Нужно минимум два месяца истории.");
  const confirmedByMonth = aggregateRows(allAppointments().filter((item) => item.status === "upcoming"), "month", revenueOf);
  $("#forecastCoverage").innerHTML = forecast.length ? forecast.map((item) => {
    const confirmed = confirmedByMonth.find((row) => row.key === item.key)?.value || 0;
    const percent = Math.min(100, item.value ? confirmed / item.value * 100 : 0);
    return '<button class="plan-row interactive" type="button" data-forecast-month="' + item.key + '"><span>' + monthText(item.key) + '</span><div class="plan-line"><i style="width:' + percent + '%"></i></div><b>' + Math.round(percent) + "%</b></button>";
  }).join("") : emptyState("Покрытие появится вместе с прогнозом.");
  const now = new Date();
  const currentStart = new Date(now); currentStart.setDate(now.getDate() - 60);
  const previousStart = new Date(now); previousStart.setDate(now.getDate() - 120);
  const serviceMap = new Map();
  allAppointments().filter((item) => item.status === "completed").forEach((item) => {
    const d = localDate(item.datetime);
    if (!d || d < previousStart) return;
    const row = serviceMap.get(item.service) || { current: 0, previous: 0 };
    if (d >= currentStart) row.current += revenueOf(item); else row.previous += revenueOf(item);
    serviceMap.set(item.service, row);
  });
  $("#serviceMomentum").innerHTML = [...serviceMap.entries()].sort((a, b) => b[1].current - a[1].current).slice(0, 6).map(([service, values]) => {
    const delta = values.previous ? (values.current - values.previous) / values.previous * 100 : values.current ? 100 : 0;
    return '<button class="momentum-row" type="button" data-service-open="' + esc(service) + '"><span><b>' + esc(service) + '</b><small>' + money(values.current) + '</small></span><strong class="' + (delta >= 0 ? "positive" : "negative") + '">' + (delta >= 0 ? "↗ +" : "↘ ") + Math.round(delta) + "%</strong></button>";
  }).join("") || emptyState("Нужно больше истории по услугам.");
  const recommendations = get("recommendations") || [];
  $("#recommendations").innerHTML = recommendations.length ? recommendations.map((text) =>
    '<div class="insight"><strong>Рекомендация</strong><span>' + esc(text) + "</span></div>"
  ).join("") : '<div class="insight"><strong>Продолжайте собирать данные</strong><span>Рекомендации станут точнее после новых записей.</span></div>';
}

function renderFinance() {
  const stats = rawStats();
  const clients = allClients();
  const appointments = allAppointments();
  const repeat = clients.filter((item) => item.visits > 1).length / Math.max(clients.length, 1);
  const cancelRate = stats.canceled / Math.max(stats.total_appointments, 1);
  $("#moneyKpis").innerHTML = [
    metricKpi("Средний чек", money(stats.avg_check)),
    metricKpi("Всего записей", stats.total_appointments),
    metricKpi("Повторные клиенты", Math.round(repeat * 100) + "%"),
    metricKpi("Отмены", Math.round(cancelRate * 100) + "%")
  ].join("");
  $("#avgCheck").textContent = money(stats.avg_check);
  $("#repeatRate").textContent = Math.round(repeat * 100) + "%";
  $("#cancelRate").textContent = Math.round(cancelRate * 100) + "%";
  const month = monthFinance();
  const scale = Math.max(month.fact, month.forecast, 1);
  $("#planFact").innerHTML = '<div class="plan-row"><span>Факт</span><div class="plan-line"><i style="width:' + (month.fact / scale * 100) + '%"></i></div><b>' + money(month.fact) + '</b></div><div class="plan-row"><span>Прогноз</span><div class="plan-line forecast-line"><i style="width:' + (month.forecast / scale * 100) + '%"></i></div><b>' + money(month.forecast) + "</b></div>";
  const future = appointments.filter((item) => item.status === "upcoming" && item.prepayment > 0);
  const completedWithPrepayment = appointments.filter((item) => item.status === "completed" && item.prepayment > 0);
  const futureConfigured = future.reduce((sum, item) => sum + item.prepayment, 0);
  const completedConfigured = completedWithPrepayment.reduce((sum, item) => sum + item.prepayment, 0);
  $("#prepaymentSummary").innerHTML =
    '<div class="mode-summary"><b>' + (separatePrepayment ? 'Отдельно от цены услуги' : 'Входит в цену услуги') + '</b><span>' + esc(prepaymentAccountingText()) + '</span></div>' +
    '<div class="plan-row"><span>В выполненных записях</span><div class="plan-line"><i style="width:100%"></i></div><b>' + money(completedConfigured) + '</b></div>' +
    '<div class="plan-row"><span>В будущих записях</span><div class="plan-line waiting-line"><i style="width:100%"></i></div><b>' + money(futureConfigured) + '</b></div>' +
    '<small class="muted prepayment-disclaimer">Это суммы, заданные в настройках услуг. Они не подтверждают фактическое получение или возврат денег.</small>';
  const monthly = aggregateRows(appointments.filter((item) => item.status === "completed"), "month", revenueOf);
  monthly.forEach((item) => drillGroups.set("monthly:" + item.key, { title: item.label, rows: item.rows }));
  drawBars("#incomeChartLarge", monthly.map((item) => ({ ...item, label: monthText(item.key) })), money, "monthly");
  renderAnalytics();
}

function renderOverview() {
  const stats = rawStats();
  const clients = allClients();
  const appointments = allAppointments();
  const month = monthFinance();
  const progress = Math.min(100, month.forecast ? month.fact / month.forecast * 100 : 0);
  $("#kpis").innerHTML = [
    metricKpi("Доход", money(stats.total_income), "за весь период"),
    metricKpi("Выполнено записей", stats.completed),
    metricKpi("Подтверждено", stats.upcoming, "будущие записи"),
    metricKpi("Клиентов", clients.length, "в базе отчёта")
  ].join("");
  $("#monthFact").textContent = money(month.fact);
  $("#monthForecast").textContent = money(month.forecast);
  $("#monthPrepayment").textContent = money(month.booked);
  $("#monthProgress").style.width = progress + "%";
  $("#monthProgressText").textContent = month.forecast ? "Получено " + Math.round(progress) + "% от ожидаемого итога месяца" : "Недостаточно данных для прогноза";
  $("#monthDelta").textContent = Math.round(progress) + "%";
  renderInsights(stats, clients, appointments);
  renderOverviewIncome();
  renderSegments(clients);
  renderUpcoming(appointments);
}

function clientDetails(id) {
  const client = allClients().find((item) => String(item.user_id) === String(id));
  if (!client) return;
  const rows = allAppointments().filter((item) => String(item.user_id) === String(id)).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));
  const url = telegramUrl(client);
  $("#clientModalContent").innerHTML = '<div class="modal-profile"><span class="avatar large">' + esc(client.name[0]?.toUpperCase() || "?") + '</span><div><h2>' + esc(client.name) + '</h2><p>' + (url ? '<a class="user-link" target="_blank" rel="noopener" href="' + esc(url) + '">' + esc(usernameOf(client) || "Открыть Telegram") + "</a>" : "Telegram не указан") + (client.phone ? " · " + esc(client.phone) : "") + '</p></div></div><div class="detail-grid"><div class="detail-chip"><span>Визитов</span><b>' + client.visits + '</b></div><div class="detail-chip"><span>Потратил</span><b>' + money(client.spent) + '</b></div><div class="detail-chip"><span>Средний интервал</span><b>' + (client.avg_interval_days ? client.avg_interval_days + " дн." : "—") + '</b></div><div class="detail-chip"><span>Последний визит</span><b>' + dateText(client.last_visit) + '</b></div></div><div class="actions modal-actions"><button class="ghost" type="button" data-copy="' + esc(usernameOf(client) || client.phone || "") + '">Скопировать контакт</button>' + (url ? '<a class="ghost" target="_blank" rel="noopener" href="' + esc(url) + '">Открыть Telegram</a>' : "") + '<button class="ghost" type="button" data-remind="' + esc(client.name) + '">Текст напоминания</button></div><h3>История записей</h3><div class="timeline">' + (rows.map((item) =>
    '<button class="timeline-item" type="button" data-appointment="' + esc(item.id) + '"><b>' + dateTimeText(item.datetime) + " · " + esc(item.service) + '</b><small>' + money(revenueOf(item)) + " · " + statusLabel(item.status) + (item.prepayment ? " · предоплата по настройке " + money(item.prepayment) : "") + "</small>" + (item.client_note || item.appointment_note || item.comment_text ? '<em>' + esc(item.client_note || item.appointment_note || item.comment_text) + "</em>" : "") + "</button>"
  ).join("") || emptyState("История записей отсутствует.")) + "</div>";
  openModal("clientModal");
}

function appointmentDetails(id) {
  const item = allAppointments().find((row) => String(row.id) === String(id));
  if (!item) return;
  $("#drillModalContent").innerHTML = '<div class="modal-title-row"><div><span class="status ' + item.status + '">' + statusLabel(item.status) + '</span><h2>' + esc(item.service) + '</h2><p>' + dateTimeText(item.datetime) + "</p></div><b>" + money(revenueOf(item)) + '</b></div>' + clientProfile({ ...item, name: item.client }) + '<div class="detail-grid"><div class="detail-chip"><span>Цена услуги</span><b>' + money(item.price) + '</b></div><div class="detail-chip"><span>Предоплата по настройке</span><b>' + (item.prepayment ? money(item.prepayment) : "Не требуется") + '</b></div><div class="detail-chip"><span>Учёт в доходе</span><b>' + (separatePrepayment ? "Добавляется отдельно" : "Входит в цену услуги") + '</b></div></div><div class="metric-note">Факт получения или возврата предоплаты страница не определяет.</div><div class="note-stack">' + [item.client_note, item.appointment_note, item.comment_text].filter(Boolean).map((text) => '<div class="metric-note">' + esc(text) + "</div>").join("") + "</div>";
  openModal("drillModal");
}

function openDrill(key) {
  const group = drillGroups.get(key);
  if (!group) return;
  const rows = group.rows || [];
  const total = group.value ?? rows.reduce((sum, item) => sum + revenueOf(item), 0);
  const note = group.note ? '<div class="metric-note">' + esc(group.note) + '</div>' : "";
  $("#drillModalContent").innerHTML = '<div class="modal-title-row"><div><span class="eyebrow">РАСШИФРОВКА</span><h2>' + esc(group.title) + '</h2><p>' + rows.length + " записей</p></div><b>" + money(total) + '</b></div>' + note + '<div class="drill-list">' + (rows.slice().sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).map((item) =>
    '<button type="button" data-appointment="' + esc(item.id) + '"><span><b>' + esc(item.client) + '</b><small>' + dateTimeText(item.datetime) + " · " + esc(item.service) + '</small></span><strong>' + money(revenueOf(item)) + "</strong></button>"
  ).join("") || emptyState("Для этого показателя пока нет конкретных записей.")) + "</div>";
  openModal("drillModal");
}

function openForecastMonth(key) {
  const rows = allAppointments().filter((item) => String(item.datetime).slice(0, 7) === key && item.status === "upcoming");
  drillGroups.set("forecast:" + key, { title: monthText(key) + " · подтверждённые записи", rows });
  openDrill("forecast:" + key);
}

function openService(service) {
  const rows = allAppointments().filter((item) => item.service === service && item.status === "completed");
  drillGroups.set("service:" + service, {
    title: service + " · выполненные записи",
    rows,
    value: rows.reduce((sum, item) => sum + revenueOf(item), 0),
    note: "Доход и количество здесь совпадают с разделом «Услуги»: учитываются только выполненные записи."
  });
  openDrill("service:" + service);
}

function openModal(id) {
  const modal = $("#" + id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = $("#" + id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal.open")) document.body.classList.remove("modal-open");
}

const tourSteps = [
  { section: "overview", selector: "#kpis", title: "Обзор", text: "Здесь только главные показатели. Доход считается по выполненным записям; будущие подтверждённые записи показываются отдельно как ожидаемые." },
  { section: "money", selector: "#revenueMode", title: "Как считается предоплата", text: "Обычно предоплата уже входит в полную цену услуги, поэтому второй раз к доходу не прибавляется. Если в вашем прайсе цена указана без предоплаты, включите этот переключатель — тогда она будет добавляться отдельно во всех финансовых расчётах." },
  { section: "clients", selector: "#clientSegmentsLarge", title: "Клиенты", text: "Сегменты зависят от количества выполненных визитов и давности последнего визита. Порог «спящего» клиента можно менять сверху." },
  { section: "services", selector: "#serviceBars", title: "Услуги", text: "Доход услуги и число записей считаются только по выполненным визитам. Нажмите на услугу — откроется ровно тот же набор записей." },
  { section: "behavior", selector: "#lvTable", title: "Лояльность", text: "LV 0–100 учитывает повторные визиты, свежесть последнего визита, отмены, регулярность и общий вклад. Тип клиента рядом объясняет текущее поведение простыми словами." },
  { section: "forecast", selector: "#forecastKpis", title: "Прогноз", text: "Прогноз строится по полным прошлым месяцам и не считается обещанием дохода. «Уже подтверждено» — реальные будущие записи, а сценарии помогают оценить диапазон." }
];
let tourIndex = 0;
let tourReturnSection = "overview";

function clearTourFocus() {
  document.querySelector(".tour-focus")?.classList.remove("tour-focus");
}

function renderTourStep() {
  const step = tourSteps[tourIndex];
  clearTourFocus();
  goToSection(step.section);
  $("#tourStepLabel").textContent = "Шаг " + (tourIndex + 1) + " из " + tourSteps.length;
  $("#tourTitle").textContent = step.title;
  $("#tourText").textContent = step.text;
  $("#tourPrev").disabled = tourIndex === 0;
  $("#tourNext").textContent = tourIndex === tourSteps.length - 1 ? "Готово" : "Далее →";
  requestAnimationFrame(() => {
    const target = $(step.selector);
    if (!target) return;
    target.classList.add("tour-focus");
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

function startTour() {
  tourReturnSection = document.querySelector(".section.active")?.id || "overview";
  tourIndex = 0;
  $("#tourCoach").classList.add("open");
  $("#tourCoach").setAttribute("aria-hidden", "false");
  document.body.classList.add("tour-open");
  renderTourStep();
}

function closeTour(restore = true) {
  clearTourFocus();
  $("#tourCoach").classList.remove("open");
  $("#tourCoach").setAttribute("aria-hidden", "true");
  document.body.classList.remove("tour-open");
  if (restore) goToSection(tourReturnSection);
}

function showNavigationAttention() {
  const help = $("#helpBtn");
  help?.classList.add("attention");
  setTimeout(() => help?.classList.remove("attention"), 2600);
  if (window.matchMedia("(max-width: 900px)").matches) {
    const sidebar = $(".sidebar");
    sidebar?.classList.add("nav-attention");
    setTimeout(() => sidebar?.classList.remove("nav-attention"), 3200);
  }
}

function syncRevenueModeControl() {
  const toggle = $("#separatePrepaymentToggle");
  if (toggle) toggle.checked = separatePrepayment;
  $("#revenueMode")?.classList.toggle("is-separate", separatePrepayment);
}

function setSeparatePrepayment(enabled) {
  separatePrepayment = Boolean(enabled);
  localStorage.setItem("aethelStatsSeparatePrepayment", separatePrepayment ? "1" : "0");
  page = 1;
  render();
  showToast(separatePrepayment
    ? "Предоплата теперь добавляется к цене услуги"
    : "Предоплата снова считается частью цены услуги");
}

function populateFilters() {
  const services = [...new Set(allAppointments().map((item) => item.service))].sort();
  ["serviceFilter", "analyticsService"].forEach((id) => {
    const select = $("#" + id);
    if (!select) return;
    const current = select.value || "all";
    select.innerHTML = '<option value="all">Все услуги</option>' + services.map((service) => '<option value="' + esc(service) + '">' + esc(service) + "</option>").join("");
    select.value = services.includes(current) ? current : "all";
  });
}

function render() {
  drillGroups.clear();
  const stats = rawStats();
  const clients = allClients();
  const appointments = allAppointments();
  $("#masterName").textContent = report.master_name || "Статистика мастера";
  $("#updatedAt").textContent = report.generated_at ? "обновлено " + dateTimeText(report.generated_at) : "онлайн";
  syncRevenueModeControl();
  populateFilters();
  renderOverview();
  renderFinance();
  renderClients(clients);
  renderAppointments(filteredAppointments());
  renderServices();
  renderBehavior(clients);
  renderForecast();
  document.documentElement.style.setProperty("--data-ready", "1");
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function copyText(value) {
  if (!value) return showToast("Нечего копировать");
  try {
    await navigator.clipboard.writeText(value);
    showToast("Скопировано");
  } catch {
    showToast(value);
  }
}

function goToSection(id) {
  $$(".nav").forEach((button) => button.classList.toggle("active", button.dataset.section === id));
  $$(".section").forEach((section) => section.classList.toggle("active", section.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetAnalytics() {
  $("#analyticsMetric").value = "income";
  $("#analyticsGroup").value = "month";
  $("#analyticsStatus").value = "completed";
  $("#analyticsService").value = "all";
  $("#analyticsFrom").value = "";
  $("#analyticsTo").value = "";
  $("#analyticsView").value = "bars";
  renderAnalytics();
}

async function load() {
  const url = new URLSearchParams(location.search).get("report");
  if (!url) {
    render();
    showNavigationAttention();
    return;
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    report = await response.json();
    render();
    showNavigationAttention();
  } catch (error) {
    console.error(error);
    showToast("Не удалось загрузить отчёт. Проверьте срок действия ссылки.");
    render();
    showNavigationAttention();
  }
}

$$(".nav").forEach((button) => button.addEventListener("click", () => goToSection(button.dataset.section)));
$("#incomePeriod")?.addEventListener("change", renderOverviewIncome);
$("#clientSearch")?.addEventListener("input", () => renderClients(allClients()));
$("#clientSegmentFilter")?.addEventListener("change", () => renderClients(allClients()));
$("#sleepThreshold")?.addEventListener("change", (event) => {
  sleepDays = num(event.target.value);
  render();
});
["appointmentSearch", "statusFilter", "serviceFilter", "dateFrom", "dateTo"].forEach((id) => {
  $("#" + id)?.addEventListener("input", () => {
    page = 1;
    renderAppointments(filteredAppointments());
  });
});
["analyticsMetric", "analyticsGroup", "analyticsStatus", "analyticsService", "analyticsFrom", "analyticsTo", "analyticsView"].forEach((id) => {
  $("#" + id)?.addEventListener("input", renderAnalytics);
});
$("#resetAnalytics")?.addEventListener("click", resetAnalytics);
$("#prevPage")?.addEventListener("click", () => { page = Math.max(1, page - 1); renderAppointments(filteredAppointments()); });
$("#nextPage")?.addEventListener("click", () => { page += 1; renderAppointments(filteredAppointments()); });
$("#prevPageMobile")?.addEventListener("click", () => { page = Math.max(1, page - 1); renderAppointments(filteredAppointments()); });
$("#nextPageMobile")?.addEventListener("click", () => { page += 1; renderAppointments(filteredAppointments()); });
$("#printBtn")?.addEventListener("click", () => window.print());
$("#copyLinkBtn")?.addEventListener("click", () => copyText(location.href));
$("#separatePrepaymentToggle")?.addEventListener("change", (event) => setSeparatePrepayment(event.target.checked));
$("#prepaymentHelp")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const popover = $("#prepaymentHelpPopover");
  const open = popover?.classList.toggle("open");
  popover?.setAttribute("aria-hidden", open ? "false" : "true");
});
$("#helpBtn")?.addEventListener("click", startTour);
$("#tourClose")?.addEventListener("click", () => closeTour(true));
$("#tourPrev")?.addEventListener("click", () => { if (tourIndex > 0) { tourIndex -= 1; renderTourStep(); } });
$("#tourNext")?.addEventListener("click", () => {
  if (tourIndex >= tourSteps.length - 1) closeTour(true);
  else { tourIndex += 1; renderTourStep(); }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#prepaymentHelpPopover") && !event.target.closest("#prepaymentHelp")) {
    $("#prepaymentHelpPopover")?.classList.remove("open");
    $("#prepaymentHelpPopover")?.setAttribute("aria-hidden", "true");
  }
  const go = event.target.closest("[data-go]");
  if (go) goToSection(go.dataset.go);
  const client = event.target.closest("[data-client]");
  if (client) clientDetails(client.dataset.client);
  const appointment = event.target.closest("[data-appointment]");
  if (appointment && !event.target.closest("[data-client]")) appointmentDetails(appointment.dataset.appointment);
  const drill = event.target.closest("[data-drill]");
  if (drill) openDrill(drill.dataset.drill);
  const copy = event.target.closest("[data-copy]");
  if (copy) copyText(copy.dataset.copy);
  const reminder = event.target.closest("[data-remind]");
  if (reminder) copyText("Здравствуйте, " + reminder.dataset.remind + "! Давно не виделись 💛 Если хотите, я могу подобрать для вас удобное окошко.");
  const segment = event.target.closest("[data-segment]");
  if (segment) {
    goToSection("clients");
    $("#clientSegmentFilter").value = segment.dataset.segment;
    renderClients(allClients());
  }
  const service = event.target.closest("[data-service-open]");
  if (service) openService(service.dataset.serviceOpen);
  const month = event.target.closest("[data-forecast-month]");
  if (month) openForecastMonth(month.dataset.forecastMonth);
  const scenario = event.target.closest("[data-scenario]");
  if (scenario) {
    forecastScenario = num(scenario.dataset.scenario) || 1;
    $$("[data-scenario]").forEach((button) => button.classList.toggle("active", button === scenario));
    renderForecast();
  }
  const close = event.target.closest("[data-close-modal]");
  if (close) closeModal(close.dataset.closeModal);
  if (event.target.classList.contains("modal")) closeModal(event.target.id);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if ($("#tourCoach")?.classList.contains("open")) closeTour(true);
    else $$(".modal.open").forEach((modal) => closeModal(modal.id));
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-drill]")) {
    event.preventDefault();
    openDrill(event.target.dataset.drill);
  }
});

load();
