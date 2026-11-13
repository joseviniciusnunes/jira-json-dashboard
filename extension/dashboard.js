const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "jiraConfig";
const WEEKEND_KEY = "jiraHideWeekend";

let config = { url: "", email: "" };
let days = [];
let hideWeekend = true;

// ---------- Utilitários ----------

const localYmd = (date) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);

const shiftDay = (ymd, delta) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta, 12))
        .toISOString()
        .slice(0, 10);
};

const shiftWeek = (ymd, delta) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta * 7, 12))
        .toISOString()
        .slice(0, 10);
};

const dateLabel = (ymd) =>
    new Intl.DateTimeFormat("pt-BR", {
        timeZone: "UTC",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
    }).format(new Date(ymd + "T12:00:00Z"));

const escapeHtml = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );

const fmtTime = (value) =>
    value
        ? new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
          }).format(new Date(value))
        : "";

function setWeek(startYmd) {
    $("startDate").value = startYmd;
    $("endDate").value = shiftDay(startYmd, 6);
}

function currentWeekStart() {
    const today = new Date();
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    return localYmd(start);
}

function visibleDays() {
    if (!hideWeekend) return days;
    return days.filter((day) => {
        const dow = new Date(day + "T12:00:00Z").getUTCDay();
        return dow !== 0 && dow !== 6;
    });
}

function setMessage(text) {
    $("message").textContent = text || "";
}

// ---------- Configuração ----------

function showConfig() {
    $("configPanel").classList.remove("hidden");
    $("dashboardPanel").classList.add("hidden");
}

function showDashboard() {
    $("configPanel").classList.add("hidden");
    $("dashboardPanel").classList.remove("hidden");
}

function loadConfig(cb) {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
        config = data[STORAGE_KEY] || { url: "", email: "" };
        if (config.url) $("url").value = config.url;
        cb && cb();
    });
}

$("save").addEventListener("click", () => {
    const url = $("url").value.trim().replace(/\/+$/, "");
    if (!/^https:\/\/[^/]+$/i.test(url)) {
        $("configHint").textContent =
            "Informe uma URL válida, ex.: https://suaempresa.atlassian.net";
        return;
    }
    config.url = url;
    chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
        $("configHint").textContent = "URL salva! Buscando dados...";
        loadDashboard();
    });
});

// ---------- API do Jira ----------

async function jiraFetch(path) {
    const response = await fetch(`${config.url}${path}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

async function getCurrentUser() {
    const data = await jiraFetch("/rest/api/3/myself");
    return {
        email: data.emailAddress || "",
        displayName: data.displayName || "",
    };
}

async function fetchIssues(start, end) {
    const jql =
        `status CHANGED BY currentUser() DURING ("${start} 00:00", "${end} 23:59") ` +
        `AND issuetype != História ORDER BY updated ASC`;

    const params = new URLSearchParams({
        jql,
        fields: "summary,status,issuetype,project",
        expand: "changelog",
        maxResults: "100",
    });

    const data = await jiraFetch(`/rest/api/3/search/jql?${params.toString()}`);
    return data.issues || [];
}

function getHistories(issue) {
    const c = issue.changelog;
    if (Array.isArray(c)) return c;
    if (Array.isArray(c?.histories)) return c.histories;
    if (Array.isArray(c?.values)) return c.values;
    return [];
}

// ---------- Renderização ----------

function render() {
    const columns = Object.fromEntries(days.map((day) => [day, new Map()]));
    let issueCount = 0;

    const issues = window.__issues || [];

    for (const issue of issues) {
        const type = (issue.fields?.issuetype?.name || "").toLocaleLowerCase(
            "pt-BR",
        );
        if (type === "história" || type === "story") continue;

        issueCount++;

        for (const history of getHistories(issue)) {
            if (
                config.email &&
                history.author?.emailAddress?.toLowerCase() !== config.email
            ) {
                continue;
            }
            if (!history.created) continue;

            const eventDay = localYmd(new Date(history.created));
            if (!columns[eventDay]) continue;

            for (const item of history.items || []) {
                if (item.field !== "status" && item.fieldId !== "status")
                    continue;

                if (!columns[eventDay].has(issue.key)) {
                    columns[eventDay].set(issue.key, {
                        key: issue.key,
                        summary: issue.fields?.summary || "(sem resumo)",
                        type: issue.fields?.issuetype?.name || "",
                        project: issue.fields?.project?.name || "",
                        typeIcon: issue.fields?.issuetype?.iconUrl || "",
                        currentStatus:
                            issue.fields?.status?.name || "(sem status)",
                        currentStatusColor:
                            issue.fields?.status?.statusCategory?.colorName ||
                            "medium-gray",
                        movements: [],
                    });
                }

                const card = columns[eventDay].get(issue.key);
                card.movements.push({
                    from: item.fromString || "(sem status anterior)",
                    to: item.toString || "(sem status novo)",
                    author:
                        history.author?.displayName || "Usuário desconhecido",
                    date: history.created,
                });
            }
        }
    }

    let totalMovements = 0;
    let totalCards = 0;

    const visible = visibleDays();
    // Todas as colunas sempre em uma única linha, dividindo a largura igualmente.
    $("board").style.gridTemplateColumns =
        `repeat(${visible.length}, minmax(0, 1fr))`;

    $("board").innerHTML = visible
        .map((day) => {
            const cards = [...columns[day].values()];

            cards.forEach((card) => {
                card.movements.sort(
                    (a, b) => new Date(a.date) - new Date(b.date),
                );
            });

            totalCards += cards.length;
            totalMovements += cards.reduce(
                (sum, card) => sum + card.movements.length,
                0,
            );

            return `
        <section class="day">
          <h2>${dateLabel(day)}</h2>
          <div class="count">
            ${cards.length} card(s) ·
            ${cards.reduce((s, c) => s + c.movements.length, 0)} movimentação(ões)
          </div>

          ${
              cards.length
                  ? cards
                        .map(
                            (card) => `
            <article class="card">
              <div class="card-header">
                ${
                    card.typeIcon
                        ? `
                  <img
                    src="${escapeHtml(card.typeIcon)}"
                    class="issue-type-icon"
                    title="${escapeHtml(card.type)}"
                    alt="${escapeHtml(card.type)}"
                  >
                `
                        : ""
                }

                <a class="key"
                  href="${escapeHtml(config.url)}/browse/${encodeURIComponent(card.key)}"
                  target="_blank" rel="noopener">
                  ${escapeHtml(card.key)}
                </a>
              </div>

              <div class="summary">${escapeHtml(card.summary)}</div>

              <span class="status-badge status-${escapeHtml(card.currentStatusColor)}">
                ${escapeHtml(card.currentStatus)}
              </span>

              <div class="movements">
                ${card.movements
                    .map(
                        (m) => `
                  <div class="movement">
                    <div class="movement-time">${fmtTime(m.date)}</div>
                    <div class="transition">
                      <span class="status">${escapeHtml(m.from)}</span>
                      <span>→</span>
                      <span class="status">${escapeHtml(m.to)}</span>
                    </div>
                    <div class="author">${escapeHtml(m.author)}</div>
                  </div>
                `,
                    )
                    .join("")}
              </div>

              <div class="meta">
                ${escapeHtml(card.project)} · ${escapeHtml(card.type)}
              </div>
            </article>
          `,
                        )
                        .join("")
                  : `
            <div class="empty">Nenhuma movimentação</div>
          `
          }
        </section>
      `;
        })
        .join("");

    $("stats").textContent =
        `${totalCards} cards únicos · ${totalMovements} movimentações · ${issueCount} issues`;

    setMessage("");
}

// ---------- Fluxo principal ----------

async function loadDashboard() {
    const start = $("startDate").value;
    const end = $("endDate").value;

    if (!config.url) {
        showConfig();
        return;
    }

    showDashboard();
    $("board").innerHTML = `
        <div class="loading" style="grid-column:1/-1">
            <div class="spinner"></div>
            <div>Buscando dados do Jira...</div>
        </div>`;
    setMessage("");

    try {
        if (!config.email) {
            const user = await getCurrentUser();
            config.email = user.email;
            chrome.storage.local.set({ [STORAGE_KEY]: config });
        }

        $("headerSub").textContent =
            `Usuário: ${config.email || "?"} · ${start} até ${end}`;

        const issues = await fetchIssues(start, end);
        window.__issues = issues;

        days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
        render();
    } catch (error) {
        setMessage(
            "Erro ao buscar dados do Jira: " +
                error.message +
                ". Verifique se você está logado no Jira e se a URL está correta.",
        );
        $("board").innerHTML = "";
    }
}

// ---------- Eventos ----------

$("prevWeek").addEventListener("click", () => {
    setWeek(shiftWeek($("startDate").value, -1));
    loadDashboard();
});

$("nextWeek").addEventListener("click", () => {
    setWeek(shiftWeek($("startDate").value, 1));
    loadDashboard();
});

$("refresh").addEventListener("click", loadDashboard);

$("openConfig").addEventListener("click", () => {
    showConfig();
    $("configHint").textContent =
        "Altere a URL se necessário e clique em Salvar.";
});

$("hideWeekend").addEventListener("change", () => {
    hideWeekend = $("hideWeekend").checked;
    try {
        localStorage.setItem(WEEKEND_KEY, String(hideWeekend));
    } catch {
        // Armazenamento indisponível — ignora.
    }
    if (!$("dashboardPanel").classList.contains("hidden")) render();
});

// ---------- Inicialização ----------

setWeek(currentWeekStart());

// Restaura a preferência de ocultar sábado/domingo.
try {
    const saved = localStorage.getItem(WEEKEND_KEY);
    if (saved !== null) hideWeekend = saved === "true";
} catch {
    // Armazenamento indisponível — ignora.
}
$("hideWeekend").checked = hideWeekend;

loadConfig(() => {
    if (config.url) {
        loadDashboard();
    } else {
        showConfig();
    }
});
