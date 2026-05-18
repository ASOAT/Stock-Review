type PageRecord = {
  id: string;
  title: string;
  type: string;
  parentId: string | null;
  content: string;
  path: string | null;
  pinned: number;
  archived: number;
  trashed: number;
  createdAt: string;
  updatedAt: string;
};

type SecurityRecord = {
  id: string;
  market: string;
  code: string;
  exchange: string | null;
  symbol: string;
  name: string;
  shortName: string | null;
  fullName: string | null;
  pinyin: string | null;
  pinyinInitials: string | null;
  aliases: string | null;
  industryLevel1: string | null;
  industryLevel2: string | null;
  industryLevel3: string | null;
  listedDate: string | null;
  delisted: number;
  createdAt: string;
  updatedAt: string;
};

type LinkRecord = {
  id: string;
  sourcePageId: string;
  sourceTitle?: string;
  targetType: string;
  targetId: string | null;
  targetTitle: string;
  displayText: string | null;
  rawText: string;
  createdAt: string;
};

type TradeRecord = {
  id: string;
  tradeDate: string;
  tradeTime: string | null;
  account: string | null;
  market: string;
  securityId: string;
  securityName: string;
  securityCode: string;
  side: string;
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  tax: number;
  netAmount: number | null;
  strategy: string | null;
  reasonBuy: string | null;
  reasonSell: string | null;
  expectation: string | null;
  review: string | null;
  planFollowed: number | null;
  impulsive: number | null;
  mistakeType: string | null;
  linkedPageId: string | null;
  createdAt: string;
  updatedAt: string;
};

type SecurityProfileResponse = {
  security: SecurityRecord;
  linkedPages: PageRecord[];
  linkedTrades: TradeRecord[];
  backlinks: LinkRecord[];
};

type LinkPanelResponse = {
  outgoing: LinkRecord[];
  backlinks: LinkRecord[];
};

type SearchResponse = {
  pages: PageRecord[];
};

type WorkspaceKey = "dashboard" | "review" | "trades" | "research";
type ViewMode = "dashboard" | "editor" | "trades" | "security";

type AppState = {
  pages: PageRecord[];
  trades: TradeRecord[];
  currentPage: PageRecord | null;
  activeWorkspace: WorkspaceKey;
  viewMode: ViewMode;
  saveTimer: number | null;
  searchTimer: number | null;
  lastSignature: string;
  deleteArmed: boolean;
  deleteArmTimer: number | null;
};

const state: AppState = {
  pages: [],
  trades: [],
  currentPage: null,
  activeWorkspace: "dashboard",
  viewMode: "dashboard",
  saveTimer: null,
  searchTimer: null,
  lastSignature: "",
  deleteArmed: false,
  deleteArmTimer: null,
};

const pageList = qs<HTMLDivElement>("#pageList");
const workspaceNavItems = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-workspace]"));
const newPageBtn = qs<HTMLButtonElement>("#newPageBtn");
const newDailyBtn = qs<HTMLButtonElement>("#newDailyBtn");
const globalSearch = qs<HTMLInputElement>("#globalSearch");
const searchResults = qs<HTMLDivElement>("#searchResults");
const saveStatus = qs<HTMLDivElement>("#saveStatus");
const dashboardView = qs<HTMLElement>("#dashboardView");
const editorSurface = qs<HTMLElement>("#editorSurface");
const tradeView = qs<HTMLElement>("#tradeView");
const securityProfileView = qs<HTMLElement>("#securityProfileView");
const pageTitle = qs<HTMLInputElement>("#pageTitle");
const pageType = qs<HTMLSelectElement>("#pageType");
const markdownEditor = qs<HTMLTextAreaElement>("#markdownEditor");
const markdownPreview = qs<HTMLElement>("#markdownPreview");
const deletePageBtn = qs<HTMLButtonElement>("#deletePageBtn");
const addTradeBtn = qs<HTMLButtonElement>("#addTradeBtn");
const tradeSummary = qs<HTMLDivElement>("#tradeSummary");
const tradeTableWrap = qs<HTMLDivElement>("#tradeTableWrap");
const linkPanel = qs<HTMLDivElement>("#linkPanel");
const toast = qs<HTMLDivElement>("#toast");

document.addEventListener("DOMContentLoaded", () => {
  void initialize();
});

async function initialize(): Promise<void> {
  bindEvents();
  await Promise.all([loadPages(), loadTrades()]);
  setActiveWorkspace("dashboard");
  showDashboardView();
}

function bindEvents(): void {
  for (const item of workspaceNavItems) {
    item.addEventListener("click", () => {
      const workspace = item.dataset.workspace;
      if (isWorkspaceKey(workspace)) {
        void selectWorkspace(workspace);
      }
    });
  }

  newPageBtn.addEventListener("click", () => {
    if (state.activeWorkspace === "trades") {
      void showTradeView().then(() => addTrade());
      return;
    }
    void createNewPage(defaultPageTypeForWorkspace(state.activeWorkspace));
  });
  newDailyBtn.addEventListener("click", () => {
    void createNewPage("daily_review");
  });

  pageTitle.addEventListener("input", scheduleSave);
  pageType.addEventListener("change", scheduleSave);

  markdownEditor.addEventListener("input", () => {
    renderMarkdownDocument(markdownEditor.value);
    scheduleSave();
  });
  markdownPreview.addEventListener("input", () => {
    markdownEditor.value = renderedDomToMarkdown(markdownPreview);
    scheduleSave();
  });
  markdownPreview.addEventListener("click", (event) => {
    void handleRenderedDocumentClick(event);
  });

  deletePageBtn.addEventListener("click", () => {
    void requestDeleteCurrentPage();
  });

  globalSearch.addEventListener("input", () => {
    if (state.searchTimer !== null) {
      window.clearTimeout(state.searchTimer);
    }
    state.searchTimer = window.setTimeout(() => {
      void runGlobalSearch();
    }, 160);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Node && !searchResults.contains(target) && target !== globalSearch) {
      searchResults.classList.add("is-hidden");
    }
  });

  document.addEventListener("keydown", (event) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && event.key.toLowerCase() === "k") {
      event.preventDefault();
      globalSearch.focus();
      globalSearch.select();
      void runGlobalSearch();
    }
    if (isMod && event.key.toLowerCase() === "n") {
      event.preventDefault();
      if (state.activeWorkspace === "trades") {
        void showTradeView().then(() => addTrade());
        return;
      }
      void createNewPage(defaultPageTypeForWorkspace(state.activeWorkspace));
    }
    if (isMod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveCurrentPage();
    }
  });

  addTradeBtn.addEventListener("click", () => {
    void addTrade();
  });

}

async function loadPages(): Promise<void> {
  const data = await apiGet<{ pages: PageRecord[] }>("/api/pages");
  state.pages = data.pages.filter((page) => !isRemovedUtilityPage(page));
  renderWorkspaceTree();
}

async function loadTrades(): Promise<void> {
  const data = await apiGet<{ trades: TradeRecord[] }>("/api/trades");
  state.trades = data.trades;
}

async function selectWorkspace(workspace: WorkspaceKey): Promise<void> {
  await flushPendingSave();
  setActiveWorkspace(workspace);

  if (workspace === "dashboard") {
    showDashboardView();
    return;
  }
  if (workspace === "trades") {
    await showTradeView();
    return;
  }
  if (workspace === "review") {
    const latestReview = findLatestPageByType(["daily_review"]);
    if (latestReview) {
      await openPage(latestReview.id, { keepWorkspace: true });
      return;
    }
    await createNewPage("daily_review");
    return;
  }
  if (workspace === "research") {
    const latestResearch = findLatestPageByType(["stock_research", "industry_research", "report_review", "event_analysis"]);
    if (latestResearch) {
      await openPage(latestResearch.id, { keepWorkspace: true });
      return;
    }
    await createNewPage("stock_research");
    return;
  }
  showDashboardView();
}

function setActiveWorkspace(workspace: WorkspaceKey): void {
  state.activeWorkspace = workspace;
  for (const item of workspaceNavItems) {
    item.classList.toggle("is-active", item.dataset.workspace === workspace);
  }
  newPageBtn.textContent = workspace === "trades" ? "新增交易" : "新建页面";
  renderWorkspaceTree();
}

function setViewMode(mode: ViewMode): void {
  state.viewMode = mode;
  dashboardView.classList.toggle("is-hidden", mode !== "dashboard");
  editorSurface.classList.toggle("is-hidden", mode !== "editor");
  tradeView.classList.toggle("is-hidden", mode !== "trades");
  securityProfileView.classList.toggle("is-hidden", mode !== "security");
}

function showDashboardView(): void {
  state.currentPage = null;
  setViewMode("dashboard");
  setSaveStatus("saved");
  renderDashboard();
  renderWorkspaceTree();
  linkPanel.innerHTML = "";
}

async function showTradeView(): Promise<void> {
  state.currentPage = null;
  setViewMode("trades");
  await loadTrades();
  renderTradeTable();
  renderWorkspaceTree();
  linkPanel.innerHTML = "";
}

function renderDashboard(): void {
  const typeCounts = countPagesByType();
  const recentPages = [...state.pages].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 8);
  const today = localDateString();
  const todayTrades = state.trades.filter((trade) => trade.tradeDate === today);
  const totalAmount = state.trades.reduce((sum, trade) => sum + trade.amount, 0);

  dashboardView.innerHTML = `
    <div class="dashboard-hero">
      <div>
        <div class="eyebrow">全局总览</div>
        <h1>工作台</h1>
        <p>汇总所有页面、研究笔记与交割单记录。左侧目录按工作区和类别自动归档。</p>
      </div>
      <button class="button button-primary" data-action="daily-review" type="button">新建每日复盘</button>
    </div>
    <div class="metric-strip">
      ${metricCard("页面", state.pages.length)}
      ${metricCard("复盘", typeCounts.daily_review ?? 0)}
      ${metricCard("研究", (typeCounts.stock_research ?? 0) + (typeCounts.industry_research ?? 0) + (typeCounts.report_review ?? 0) + (typeCounts.event_analysis ?? 0))}
      ${metricCard("交易", state.trades.length)}
      ${metricCard("成交额", formatMoney(totalAmount))}
    </div>
    <div class="dashboard-grid">
      <section class="overview-panel">
        <div class="section-heading">最近文件</div>
        <div class="overview-list">
          ${recentPages.map((page) => overviewPageRow(page)).join("") || emptyMarkup("暂无页面")}
        </div>
      </section>
      <section class="overview-panel">
        <div class="section-heading">今日交易</div>
        <div class="overview-list">
          ${todayTrades.map((trade) => overviewTradeRow(trade)).join("") || emptyMarkup("今日暂无交易")}
        </div>
      </section>
      <section class="overview-panel overview-panel-wide">
        <div class="section-heading">文件分布</div>
        <div class="category-grid">
          ${categoryCard("复盘", state.pages.filter((page) => page.type === "daily_review"))}
          ${categoryCard("股票研究", state.pages.filter((page) => ["stock_research", "industry_research", "report_review", "event_analysis"].includes(page.type)))}
          ${categoryCard("文章与笔记", state.pages.filter((page) => ["note", "article"].includes(page.type) && !["模板", "设置"].includes(page.title)))}
        </div>
      </section>
    </div>
  `;

  dashboardView.querySelector<HTMLElement>("[data-action='daily-review']")?.addEventListener("click", () => {
    void createNewPage("daily_review");
  });
  dashboardView.querySelectorAll<HTMLElement>("[data-page-id]").forEach((node) => {
    node.addEventListener("click", () => {
      void openPage(node.dataset.pageId ?? "");
    });
  });
}

function renderWorkspaceTree(): void {
  pageList.innerHTML = "";
  pageList.append(
    workspaceRoot("工作台", "dashboard", [
      actionLeaf("总览", "dashboard"),
      ...pageLeaves(state.pages.filter((page) => page.title === "工作台")),
    ]),
    workspaceRoot("复盘", "review", [
      folderNode("每日复盘", pageLeaves(state.pages.filter((page) => page.type === "daily_review"))),
    ]),
    workspaceRoot("交割单", "trades", [actionLeaf("全部交易", "trades")]),
    workspaceRoot("股票研究", "research", [
      folderNode("个股研究", pageLeaves(state.pages.filter((page) => page.type === "stock_research"))),
      folderNode("产业链", pageLeaves(state.pages.filter((page) => page.type === "industry_research"))),
      folderNode("研报", pageLeaves(state.pages.filter((page) => page.type === "report_review"))),
      folderNode("消息", pageLeaves(state.pages.filter((page) => page.type === "event_analysis"))),
    ]),
    workspaceRoot("文章", "dashboard", [
      folderNode("普通笔记", pageLeaves(state.pages.filter((page) => page.type === "note" && !["工作台", "模板", "设置"].includes(page.title)))),
      folderNode("长文文章", pageLeaves(state.pages.filter((page) => page.type === "article"))),
    ]),
  );
}

function workspaceRoot(title: string, workspace: WorkspaceKey, children: HTMLElement[]): HTMLElement {
  const details = document.createElement("details");
  details.className = "tree-folder";
  details.open = true;
  const summary = document.createElement("summary");
  summary.className = `tree-folder-row${state.activeWorkspace === workspace ? " is-active" : ""}`;
  summary.textContent = title;
  summary.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    void selectWorkspace(workspace);
  });
  details.append(summary, ...children);
  return details;
}

function folderNode(title: string, children: HTMLElement[]): HTMLElement {
  const details = document.createElement("details");
  details.className = "tree-folder tree-folder-child";
  details.open = true;
  const summary = document.createElement("summary");
  summary.className = "tree-folder-row";
  summary.textContent = `${title}${children.length ? "" : " 0"}`;
  details.append(summary, ...(children.length ? children : [emptyNode("暂无页面")]));
  return details;
}

function pageLeaves(pages: PageRecord[]): HTMLElement[] {
  return pages.map((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-item${state.currentPage?.id === page.id ? " is-active" : ""}`;
    button.innerHTML = `
      <span class="page-item-title">${escapeHtml(page.title)}</span>
      <span class="page-item-meta">${pageTypeLabel(page.type)} · ${formatDate(page.updatedAt)}</span>
    `;
    button.addEventListener("click", () => {
      void openPage(page.id, { keepWorkspace: true });
    });
    return button;
  });
}

function actionLeaf(label: string, workspace: WorkspaceKey): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-item";
  button.innerHTML = `<span class="page-item-title">${escapeHtml(label)}</span><span class="page-item-meta">工作区视图</span>`;
  button.addEventListener("click", () => {
    void selectWorkspace(workspace);
  });
  return button;
}

async function openPage(id: string, options?: { keepWorkspace?: boolean }): Promise<void> {
  if (!id) {
    return;
  }
  await flushPendingSave();
  const data = await apiGet<{ page: PageRecord }>(`/api/pages/${encodeURIComponent(id)}`);
  state.currentPage = data.page;
  if (!options?.keepWorkspace) {
    setActiveWorkspace(inferWorkspaceFromPage(data.page));
  }
  setViewMode("editor");
  pageTitle.value = data.page.title;
  pageType.value = data.page.type;
  markdownEditor.value = data.page.content;
  state.lastSignature = currentDraftSignature();
  resetDeleteButton();
  renderMarkdownDocument(data.page.content);
  setSaveStatus("saved");
  renderWorkspaceTree();
  await loadLinkPanel();
}

async function createNewPage(type: string): Promise<void> {
  const title = defaultTitleForType(type);
  const data = await apiPost<{ page: PageRecord }>("/api/pages", { title, type });
  await loadPages();
  await openPage(data.page.id);
  pageTitle.focus();
  pageTitle.select();
}

function scheduleSave(): void {
  setSaveStatus("dirty");
  if (state.saveTimer !== null) {
    window.clearTimeout(state.saveTimer);
  }
  state.saveTimer = window.setTimeout(() => {
    void saveCurrentPage();
  }, 800);
}

async function flushPendingSave(): Promise<void> {
  if (state.saveTimer !== null) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
    await saveCurrentPage();
  }
}

async function saveCurrentPage(): Promise<void> {
  if (!state.currentPage || state.viewMode !== "editor") {
    return;
  }
  markdownEditor.value = renderedDomToMarkdown(markdownPreview);
  const signature = currentDraftSignature();
  if (signature === state.lastSignature) {
    setSaveStatus("saved");
    return;
  }

  setSaveStatus("saving");
  try {
    const data = await apiPut<{ page: PageRecord }>(`/api/pages/${encodeURIComponent(state.currentPage.id)}`, {
      title: pageTitle.value,
      type: pageType.value,
      content: markdownEditor.value,
    });
    state.currentPage = data.page;
    state.lastSignature = currentDraftSignature();
    await loadPages();
    await loadLinkPanel();
    setSaveStatus("saved");
  } catch (error) {
    setSaveStatus("error");
    showToast(getErrorMessage(error));
  }
}

async function requestDeleteCurrentPage(): Promise<void> {
  if (!state.currentPage || state.viewMode !== "editor") {
    return;
  }

  if (!state.deleteArmed) {
    state.deleteArmed = true;
    deletePageBtn.textContent = "确认删除";
    deletePageBtn.classList.add("is-armed");
    showToast("再次点击确认删除当前笔记");
    if (state.deleteArmTimer !== null) {
      window.clearTimeout(state.deleteArmTimer);
    }
    state.deleteArmTimer = window.setTimeout(resetDeleteButton, 3200);
    return;
  }

  const deletedTitle = state.currentPage.title;
  if (state.deleteArmTimer !== null) {
    window.clearTimeout(state.deleteArmTimer);
    state.deleteArmTimer = null;
  }
  await apiDelete(`/api/pages/${encodeURIComponent(state.currentPage.id)}`);
  state.currentPage = null;
  resetDeleteButton();
  await loadPages();
  showDashboardView();
  showToast(`已删除：${deletedTitle}`);
}

function resetDeleteButton(): void {
  state.deleteArmed = false;
  if (state.deleteArmTimer !== null) {
    window.clearTimeout(state.deleteArmTimer);
    state.deleteArmTimer = null;
  }
  deletePageBtn.textContent = "删除笔记";
  deletePageBtn.classList.remove("is-armed");
}

function currentDraftSignature(): string {
  return JSON.stringify([pageTitle.value, pageType.value, markdownEditor.value]);
}

function renderMarkdownDocument(markdown: string): void {
  markdownPreview.innerHTML = markdownToHtml(markdown);
}

async function handleRenderedDocumentClick(event: MouseEvent): Promise<void> {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const link = target.closest<HTMLElement>(".wiki-link");
  if (!link) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const targetType = link.dataset.targetType;
  if (targetType === "security") {
    const query = link.dataset.query ?? link.textContent ?? "";
    await openOrCreateStockNote(query);
  }
}

function setSaveStatus(status: "saved" | "saving" | "dirty" | "error"): void {
  saveStatus.classList.toggle("is-saving", status === "saving" || status === "dirty");
  saveStatus.classList.toggle("is-error", status === "error");
  const labels: Record<typeof status, string> = {
    saved: "已保存",
    saving: "保存中",
    dirty: "待保存",
    error: "保存失败",
  };
  saveStatus.textContent = labels[status];
}

async function runGlobalSearch(): Promise<void> {
  const query = globalSearch.value.trim();
  if (!query) {
    searchResults.classList.add("is-hidden");
    return;
  }
  const data = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
  renderGlobalSearchResults(data);
}

function renderGlobalSearchResults(data: SearchResponse): void {
  searchResults.innerHTML = "";
  searchResults.classList.remove("is-hidden");
  const visiblePages = data.pages.filter((page) => !isRemovedUtilityPage(page));
  appendSearchGroup("页面", visiblePages, (page) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "search-row";
    row.innerHTML = `
      <div class="row-title"><span>${escapeHtml(page.title)}</span><span class="row-meta">${pageTypeLabel(page.type)}</span></div>
      <div class="row-meta">${escapeHtml(snippet(page.content))}</div>
    `;
    row.addEventListener("click", () => {
      searchResults.classList.add("is-hidden");
      void openPage(page.id);
    });
    return row;
  });
  if (!visiblePages.length) {
    searchResults.append(emptyNode("没有匹配结果"));
  }
}

function appendSearchGroup<T>(title: string, items: T[], renderer: (item: T) => HTMLElement): void {
  if (!items.length) {
    return;
  }
  const group = document.createElement("div");
  group.className = "search-group";
  const heading = document.createElement("div");
  heading.className = "search-group-title";
  heading.textContent = title;
  group.append(heading);
  for (const item of items) {
    group.append(renderer(item));
  }
  searchResults.append(group);
}

async function loadLinkPanel(): Promise<void> {
  if (!state.currentPage) {
    linkPanel.innerHTML = "";
    return;
  }
  const data = await apiGet<LinkPanelResponse>(`/api/pages/${encodeURIComponent(state.currentPage.id)}/links`);
  renderLinkPanel(data);
}

function renderLinkPanel(data: LinkPanelResponse): void {
  linkPanel.innerHTML = "";
  const outgoingTitle = document.createElement("div");
  outgoingTitle.className = "link-section-title";
  outgoingTitle.textContent = "当前页面链接";
  linkPanel.append(outgoingTitle);
  if (!data.outgoing.length) {
    linkPanel.append(emptyNode("暂无链接"));
  } else {
    for (const link of data.outgoing) {
      linkPanel.append(renderLinkRow(link, "outgoing"));
    }
  }

  const backlinkTitle = document.createElement("div");
  backlinkTitle.className = "link-section-title";
  backlinkTitle.textContent = "反向链接";
  linkPanel.append(backlinkTitle);
  if (!data.backlinks.length) {
    linkPanel.append(emptyNode("暂无反向链接"));
  } else {
    for (const link of data.backlinks) {
      linkPanel.append(renderLinkRow(link, "backlink"));
    }
  }
}

function renderLinkRow(link: LinkRecord, kind: "outgoing" | "backlink"): HTMLElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "link-row";
  const typeLabel = link.targetType === "security" ? "股票" : link.targetType === "page" ? "页面" : "未创建";
  row.innerHTML = `
    <div class="row-title"><span>${escapeHtml(kind === "backlink" ? link.sourceTitle ?? "未知页面" : link.targetTitle)}</span><span class="row-meta">${typeLabel}</span></div>
    <div class="row-meta">${escapeHtml(link.rawText)}</div>
  `;
  row.addEventListener("click", () => {
    if (kind === "backlink") {
      void openPage(link.sourcePageId);
    } else if (link.targetType === "security") {
      void openOrCreateStockNote(link.targetTitle);
    }
  });
  return row;
}

async function openSecurityProfile(securityId: string): Promise<void> {
  if (!securityId) {
    return;
  }
  await flushPendingSave();
  const data = await apiGet<SecurityProfileResponse>(`/api/securities/${encodeURIComponent(securityId)}/profile`);
  setActiveWorkspace("research");
  setViewMode("security");
  state.currentPage = null;
  renderSecurityProfile(data);
  linkPanel.innerHTML = "";
}

async function openOrCreateStockNote(stockNameInput: string): Promise<void> {
  const stockName = stockNameInput.trim();
  if (!stockName) {
    return;
  }
  await flushPendingSave();
  const existingNote = findStockResearchNote(stockName);
  if (existingNote) {
    await openPage(existingNote.id);
    return;
  }

  const created = await apiPost<{ page: PageRecord }>("/api/pages", {
    title: `${stockName} 个股研究`,
    type: "stock_research",
    content: blankStockNoteContent(stockName),
  });
  await loadPages();
  await openPage(created.page.id);
  showToast(`已创建：${stockName} 个股研究`);
}

function findStockResearchNote(stockName: string): PageRecord | undefined {
  const expectedTitle = `${stockName} 个股研究`;
  return state.pages
    .filter((page) => page.type === "stock_research" && (page.title === expectedTitle || page.title === stockName))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function renderSecurityProfile(data: SecurityProfileResponse): void {
  const security = data.security;
  const industry = [security.industryLevel1, security.industryLevel2, security.industryLevel3].filter(Boolean).join(" / ");
  securityProfileView.innerHTML = `
    <div class="profile-hero">
      <div>
        <div class="eyebrow">股票主页</div>
        <h1>${escapeHtml(security.name)}</h1>
        <p>${escapeHtml(security.symbol)} · ${escapeHtml(security.market)}${industry ? ` · ${escapeHtml(industry)}` : ""}</p>
      </div>
      <button class="button button-primary" data-action="new-stock-note" type="button">打开个股研究</button>
    </div>
    <div class="metric-strip">
      ${metricCard("关联笔记", data.linkedPages.length)}
      ${metricCard("关联交易", data.linkedTrades.length)}
      ${metricCard("买入次数", data.linkedTrades.filter((trade) => trade.side === "BUY").length)}
      ${metricCard("卖出次数", data.linkedTrades.filter((trade) => trade.side === "SELL").length)}
    </div>
    <div class="dashboard-grid">
      <section class="overview-panel">
        <div class="section-heading">相关笔记</div>
        <div class="overview-list">
          ${data.linkedPages.map((page) => overviewPageRow(page)).join("") || emptyMarkup("暂无相关笔记")}
        </div>
      </section>
      <section class="overview-panel">
        <div class="section-heading">相关交易</div>
        <div class="overview-list">
          ${data.linkedTrades.map((trade) => overviewTradeRow(trade)).join("") || emptyMarkup("暂无相关交易")}
        </div>
      </section>
      <section class="overview-panel overview-panel-wide">
        <div class="section-heading">基础信息</div>
        <div class="profile-facts">
          <div><span>代码</span><strong>${escapeHtml(security.symbol)}</strong></div>
          <div><span>市场</span><strong>${escapeHtml(security.market)}</strong></div>
          <div><span>简称</span><strong>${escapeHtml(security.shortName ?? "-")}</strong></div>
          <div><span>全称</span><strong>${escapeHtml(security.fullName ?? "-")}</strong></div>
          <div><span>拼音</span><strong>${escapeHtml(security.pinyin ?? "-")}</strong></div>
          <div><span>行业</span><strong>${escapeHtml(industry || "-")}</strong></div>
        </div>
      </section>
    </div>
  `;
  securityProfileView.querySelector<HTMLElement>("[data-action='new-stock-note']")?.addEventListener("click", () => {
    void openOrCreateStockNote(security.name);
  });
  securityProfileView.querySelectorAll<HTMLElement>("[data-page-id]").forEach((node) => {
    node.addEventListener("click", () => {
      void openPage(node.dataset.pageId ?? "");
    });
  });
}

async function addTrade(): Promise<void> {
  const trade = await apiPost<{ trade: TradeRecord }>("/api/trades", {
    tradeDate: localDateString(),
    side: "BUY",
    quantity: 0,
    price: 0,
  });
  state.trades = [trade.trade, ...state.trades];
  renderTradeTable();
}

function renderTradeTable(): void {
  const buyCount = state.trades.filter((trade) => trade.side === "BUY").length;
  const sellCount = state.trades.filter((trade) => trade.side === "SELL").length;
  const totalAmount = state.trades.reduce((sum, trade) => sum + trade.amount, 0);
  tradeSummary.innerHTML = `
    ${metricCard("总笔数", state.trades.length)}
    ${metricCard("买入", buyCount)}
    ${metricCard("卖出", sellCount)}
    ${metricCard("成交额", formatMoney(totalAmount))}
  `;

  tradeTableWrap.innerHTML = `
    <table class="trade-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>股票</th>
          <th>代码</th>
          <th>方向</th>
          <th>数量</th>
          <th>成交价</th>
          <th>成交额</th>
          <th>策略</th>
          <th>原因</th>
          <th>复盘</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${state.trades.map((trade) => tradeRowHtml(trade)).join("")}
      </tbody>
    </table>
  `;

  tradeTableWrap.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-trade-field]").forEach((input) => {
    input.addEventListener("change", () => {
      void handleTradeFieldChange(input);
    });
  });
  tradeTableWrap.querySelectorAll<HTMLElement>("[data-delete-trade]").forEach((button) => {
    button.addEventListener("click", () => {
      void deleteTrade(button.dataset.deleteTrade ?? "");
    });
  });
}

function tradeRowHtml(trade: TradeRecord): string {
  const reason = trade.side === "SELL" ? trade.reasonSell ?? "" : trade.reasonBuy ?? "";
  return `
    <tr>
      <td><input data-trade-id="${trade.id}" data-trade-field="tradeDate" type="date" value="${escapeAttr(trade.tradeDate)}" /></td>
      <td><input class="stock-cell" data-trade-id="${trade.id}" data-trade-field="securityName" value="${escapeAttr(trade.securityName)}" /></td>
      <td><input data-trade-id="${trade.id}" data-trade-field="securityCode" value="${escapeAttr(trade.securityCode)}" /></td>
      <td>
        <select data-trade-id="${trade.id}" data-trade-field="side">
          <option value="BUY"${trade.side === "BUY" ? " selected" : ""}>买入</option>
          <option value="SELL"${trade.side === "SELL" ? " selected" : ""}>卖出</option>
          <option value="BUY_TO_COVER"${trade.side === "BUY_TO_COVER" ? " selected" : ""}>买入平仓</option>
          <option value="SELL_SHORT"${trade.side === "SELL_SHORT" ? " selected" : ""}>卖空</option>
        </select>
      </td>
      <td><input data-trade-id="${trade.id}" data-trade-field="quantity" type="number" step="1" value="${trade.quantity}" /></td>
      <td><input data-trade-id="${trade.id}" data-trade-field="price" type="number" step="0.001" value="${trade.price}" /></td>
      <td class="amount-cell">${formatMoney(trade.amount)}</td>
      <td><input data-trade-id="${trade.id}" data-trade-field="strategy" value="${escapeAttr(trade.strategy ?? "")}" /></td>
      <td><textarea data-trade-id="${trade.id}" data-trade-field="reason">${escapeHtml(reason)}</textarea></td>
      <td><textarea data-trade-id="${trade.id}" data-trade-field="review">${escapeHtml(trade.review ?? "")}</textarea></td>
      <td><button class="icon-button" data-delete-trade="${trade.id}" type="button">删除</button></td>
    </tr>
  `;
}

async function handleTradeFieldChange(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): Promise<void> {
  const tradeId = input.dataset.tradeId;
  const field = input.dataset.tradeField;
  const trade = state.trades.find((item) => item.id === tradeId);
  if (!tradeId || !field || !trade) {
    return;
  }

  const patch: Record<string, unknown> = {};
  if (field === "quantity" || field === "price") {
    patch[field] = Number(input.value);
  } else if (field === "reason") {
    patch[trade.side === "SELL" ? "reasonSell" : "reasonBuy"] = input.value;
  } else {
    patch[field] = input.value;
  }
  const data = await apiPut<{ trade: TradeRecord }>(`/api/trades/${encodeURIComponent(tradeId)}`, patch);
  replaceTrade(data.trade);
  renderTradeTable();
}

async function deleteTrade(id: string): Promise<void> {
  if (!id) {
    return;
  }
  await apiDelete(`/api/trades/${encodeURIComponent(id)}`);
  state.trades = state.trades.filter((trade) => trade.id !== id);
  renderTradeTable();
}

function replaceTrade(trade: TradeRecord): void {
  state.trades = state.trades.map((item) => (item.id === trade.id ? trade : item));
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }
    if (isMarkdownTable(lines, index)) {
      const tableLines: string[] = [];
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        tableLines.push(lines[index] ?? "");
        index += 1;
      }
      html.push(markdownTableToHtml(tableLines));
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      html.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
      index += 1;
      continue;
    }
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? "").match(/^\s*[-*]\s+(.+)$/);
        if (!current) {
          break;
        }
        items.push(`<li>${renderInline(current[1] ?? "")}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      html.push(`<blockquote>${renderInline(quote[1] ?? "")}</blockquote>`);
      index += 1;
      continue;
    }
    html.push(`<p>${renderInline(line)}</p>`);
    index += 1;
  }
  return html.join("");
}

function renderInline(value: string): string {
  let output = escapeHtml(value);
  output = output.replace(/\[\[([^\]]+)\]\]/g, (_match, body: string) => {
    const [target, display] = splitOnce(body, "|");
    const [prefix, valuePart] = splitOnce(target, ":");
    if (valuePart && prefix.trim() === "股票") {
      const label = display || valuePart;
      return `<span class="wiki-link security-link" data-target-type="security" data-query="${escapeAttr(valuePart.trim())}" title="点击打开股票笔记">${escapeHtml(label.trim())}</span>`;
    }
    const label = display || target;
    return `<span class="wiki-link" data-target-type="page" data-query="${escapeAttr(target.trim())}">${escapeHtml(label.trim())}</span>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  return output;
}

function renderedDomToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];
  root.childNodes.forEach((node) => {
    const markdown = nodeToMarkdown(node);
    if (markdown.trim()) {
      blocks.push(markdown);
    }
  });
  return `${blocks.join("\n\n")}\n`;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  const tag = node.tagName.toLowerCase();
  if (node.classList.contains("wiki-link")) {
    const label = node.textContent?.trim() ?? "";
    if (node.dataset.targetType === "security") {
      return `[[股票:${node.dataset.query || label}]]`;
    }
    return `[[${node.dataset.query || label}]]`;
  }
  if (tag === "h1") return `# ${inlineChildrenToMarkdown(node)}`;
  if (tag === "h2") return `## ${inlineChildrenToMarkdown(node)}`;
  if (tag === "h3") return `### ${inlineChildrenToMarkdown(node)}`;
  if (tag === "blockquote") return `> ${inlineChildrenToMarkdown(node)}`;
  if (tag === "pre") return `\`\`\`\n${node.textContent ?? ""}\n\`\`\``;
  if (tag === "ul") {
    return Array.from(node.children).map((child) => `- ${inlineChildrenToMarkdown(child as HTMLElement)}`).join("\n");
  }
  if (tag === "table") {
    return htmlTableToMarkdown(node);
  }
  if (tag === "p" || tag === "div") {
    return inlineChildrenToMarkdown(node);
  }
  return inlineChildrenToMarkdown(node);
}

function inlineChildrenToMarkdown(node: HTMLElement): string {
  return Array.from(node.childNodes).map((child) => nodeToMarkdown(child)).join("").trim();
}

function isMarkdownTable(lines: string[], index: number): boolean {
  const current = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return current.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
}

function markdownTableToHtml(lines: string[]): string {
  const cleanRows = lines
    .filter((line, index) => index !== 1)
    .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
  const head = cleanRows[0] ?? [];
  const body = cleanRows.slice(1);
  return `
    <table>
      <thead><tr>${head.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>
      <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function htmlTableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => cell.textContent?.trim() ?? ""),
  );
  if (!rows.length) {
    return "";
  }
  const head = rows[0] ?? [];
  const divider = head.map(() => "---");
  return [head, divider, ...rows.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function metricCard(label: string, value: number | string): string {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function categoryCard(title: string, pages: PageRecord[]): string {
  return `
    <div class="category-card">
      <div class="row-title"><span>${escapeHtml(title)}</span><span class="row-meta">${pages.length}</span></div>
      <div class="category-stack">${pages.slice(0, 4).map((page) => `<button data-page-id="${page.id}" type="button">${escapeHtml(page.title)}</button>`).join("") || "<span class='muted-text'>暂无文件</span>"}</div>
    </div>
  `;
}

function overviewPageRow(page: PageRecord): string {
  return `
    <button class="overview-row" data-page-id="${page.id}" type="button">
      <span>${escapeHtml(page.title)}</span>
      <small>${escapeHtml(pageTypeLabel(page.type))} · ${escapeHtml(formatDate(page.updatedAt))}</small>
    </button>
  `;
}

function overviewTradeRow(trade: TradeRecord): string {
  return `
    <button class="overview-row" data-security-id="${trade.securityId}" type="button">
      <span>${escapeHtml(trade.securityName)} ${escapeHtml(sideLabel(trade.side))}</span>
      <small>${escapeHtml(trade.tradeDate)} · ${escapeHtml(formatMoney(trade.amount))}</small>
    </button>
  `;
}

function emptyMarkup(text: string): string {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function countPagesByType(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const page of state.pages) {
    counts[page.type] = (counts[page.type] ?? 0) + 1;
  }
  return counts;
}

function defaultPageTypeForWorkspace(workspace: WorkspaceKey): string {
  if (workspace === "review") return "daily_review";
  if (workspace === "research") return "stock_research";
  return "note";
}

function defaultTitleForType(type: string): string {
  if (type === "daily_review") return `${localDateString()} 每日复盘`;
  if (type === "stock_research") return "未命名个股研究";
  if (type === "industry_research") return "未命名产业链研究";
  if (type === "report_review") return "未命名研报拆解";
  if (type === "event_analysis") return "未命名消息分析";
  return "未命名页面";
}

function findLatestPageByType(types: string[]): PageRecord | undefined {
  return state.pages
    .filter((page) => types.includes(page.type))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function inferWorkspaceFromPage(page: PageRecord): WorkspaceKey {
  if (page.type === "daily_review") return "review";
  if (["stock_research", "industry_research", "report_review", "event_analysis"].includes(page.type)) return "research";
  return "dashboard";
}

function pageTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    note: "普通笔记",
    daily_review: "每日复盘",
    stock_research: "个股研究",
    industry_research: "产业链研究",
    report_review: "研报拆解",
    event_analysis: "消息分析",
    article: "长文文章",
  };
  return labels[type] ?? type;
}

function sideLabel(side: string): string {
  const labels: Record<string, string> = {
    BUY: "买入",
    SELL: "卖出",
    BUY_TO_COVER: "买入平仓",
    SELL_SHORT: "卖空",
  };
  return labels[side] ?? side;
}

function isWorkspaceKey(value: string | undefined): value is WorkspaceKey {
  return value === "dashboard" || value === "review" || value === "trades" || value === "research";
}

function isRemovedUtilityPage(page: PageRecord): boolean {
  return page.title === "模板" || page.title === "设置";
}

function dashboardContent(): string {
  return `# 工作台

## 今日复盘

## 今日交易

## 当前关注

## 最近结论
`;
}

function blankStockNoteContent(stockName: string): string {
  return `# ${stockName} 个股研究

[[股票:${stockName}]]

`;
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return parseApiResponse<T>(response);
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(response);
}

async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(response);
}

async function apiDelete<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });
  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string; detail?: string };
  if (!response.ok) {
    throw new Error(data.error || data.detail || `请求失败：${response.status}`);
  }
  return data;
}

function qs<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`缺少 DOM 节点：${selector}`);
  }
  return element;
}

function emptyNode(text: string): HTMLElement {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = text;
  return node;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char] ?? char;
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index < 0) {
    return [value, undefined];
  }
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function snippet(content: string): string {
  return content.replace(/\s+/g, " ").slice(0, 88);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function localDateString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.remove("is-hidden");
  window.setTimeout(() => {
    toast.classList.add("is-hidden");
  }, 2600);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
