import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { access, appendFile, mkdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

type NodeRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: string, callback: (chunk?: unknown) => void): void;
};

type NodeResponse = {
  writeHead(status: number, headers?: Record<string, string | number>): void;
  end(body?: string | Uint8Array): void;
};

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

type TradePatch = {
  tradeDate?: string;
  tradeTime?: string | null;
  account?: string | null;
  market?: string;
  securityId?: string;
  securityName?: string;
  securityCode?: string;
  side?: string;
  quantity?: number;
  price?: number;
  fee?: number;
  tax?: number;
  strategy?: string | null;
  reasonBuy?: string | null;
  reasonSell?: string | null;
  expectation?: string | null;
  review?: string | null;
  planFollowed?: number | null;
  impulsive?: number | null;
  mistakeType?: string | null;
  linkedPageId?: string | null;
};

type CsvImportResult = {
  inserted: number;
  updated: number;
  aliases: number;
  failed: Array<{ row: number; reason: string }>;
};

type ParsedSecurityToken = {
  code: string | null;
  exchange: string | null;
};

const rootDir = process.cwd();
const publicDir = resolve(rootDir, "public");
const workspaceDir = join(rootDir, "StockReviewWorkspace");
const databaseDir = join(workspaceDir, "database");
const logsDir = join(workspaceDir, "logs");
const dbPath = join(databaseDir, "app.sqlite");
const logPath = join(logsDir, "app.log");
const port = Number(process.env.PORT ?? "5173");
const host = "127.0.0.1";

async function main(): Promise<void> {
  await initializeWorkspace();

  const server = createServer((request: NodeRequest, response: NodeResponse) => {
    void handleRequest(request, response);
  });

  server.listen(port, host, () => {
    console.log(`Stock Review Notebook is running at http://${host}:${port}`);
    console.log(`Workspace: ${workspaceDir}`);
  });
}

async function initializeWorkspace(): Promise<void> {
  await mkdir(databaseDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });
  await runMigration();
  await ensureManualTradeSchema();
  await seedInitialSecurities();
  await ensureWelcomePage();
}

async function runMigration(): Promise<void> {
  const migrationPath = join(rootDir, "migrations", "001_initial.sql");
  const migrationSql = String(await readFile(migrationPath, "utf8"));
  await runSql(migrationSql);
  await runSql(
    `INSERT OR IGNORE INTO schema_migrations(version, applied_at)
     VALUES ('001_initial', ${sqlText(nowIso())});`,
  );
}

async function ensureManualTradeSchema(): Promise<void> {
  const foreignKeys = await querySql<{ table: string }>("PRAGMA foreign_key_list(trades);");
  const hasSecurityForeignKey = foreignKeys.some((row) => row.table === "securities");
  if (!hasSecurityForeignKey) {
    return;
  }

  await runSql(
    `PRAGMA foreign_keys = OFF;
     DROP TABLE IF EXISTS trades_rebuild;
     CREATE TABLE trades_rebuild (
       id TEXT PRIMARY KEY,
       trade_date TEXT NOT NULL,
       trade_time TEXT,
       account TEXT,
       market TEXT NOT NULL,
       security_id TEXT NOT NULL DEFAULT '',
       security_name TEXT NOT NULL DEFAULT '',
       security_code TEXT NOT NULL DEFAULT '',
       side TEXT NOT NULL,
       quantity REAL NOT NULL DEFAULT 0,
       price REAL NOT NULL DEFAULT 0,
       amount REAL NOT NULL DEFAULT 0,
       fee REAL DEFAULT 0,
       tax REAL DEFAULT 0,
       net_amount REAL,
       strategy TEXT,
       reason_buy TEXT,
       reason_sell TEXT,
       expectation TEXT,
       review TEXT,
       plan_followed INTEGER,
       impulsive INTEGER,
       mistake_type TEXT,
       linked_page_id TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (linked_page_id) REFERENCES pages(id) ON DELETE SET NULL
     );
     INSERT INTO trades_rebuild(
       id, trade_date, trade_time, account, market, security_id, security_name, security_code,
       side, quantity, price, amount, fee, tax, net_amount, strategy, reason_buy, reason_sell,
       expectation, review, plan_followed, impulsive, mistake_type, linked_page_id, created_at, updated_at
     )
     SELECT
       id, trade_date, trade_time, account, market, security_id, security_name, security_code,
       side, quantity, price, amount, fee, tax, net_amount, strategy, reason_buy, reason_sell,
       expectation, review, plan_followed, impulsive, mistake_type, linked_page_id, created_at, updated_at
     FROM trades;
     DROP TABLE trades;
     ALTER TABLE trades_rebuild RENAME TO trades;
     CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON trades(trade_date);
     CREATE INDEX IF NOT EXISTS idx_trades_security_id ON trades(security_id);
     CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
     CREATE INDEX IF NOT EXISTS idx_trades_mistake_type ON trades(mistake_type);
     PRAGMA foreign_keys = ON;`,
  );
}

async function ensureWelcomePage(): Promise<void> {
  const rows = await querySql<{ count: number }>("SELECT COUNT(*) AS count FROM pages WHERE trashed = 0;");
  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  const id = randomUUID();
  const createdAt = nowIso();
  const content = `# 工作台\n\n## 今日复盘\n\n在这里记录市场、主线、机构票和交易执行质量。\n\n## 股票链接示例\n\n可以输入 [[股票:贵州茅台]]，点击后会按文字直接打开或创建个股研究笔记。\n\n## 后续跟踪\n\n- 待复盘股票\n- 当前持仓相关笔记\n- 需要回顾的交易错误\n`;
  await runSql(
    `INSERT INTO pages(id, title, type, content, pinned, created_at, updated_at)
     VALUES (${sqlText(id)}, '工作台', 'note', ${sqlText(content)}, 1, ${sqlText(createdAt)}, ${sqlText(createdAt)});`,
  );
  await savePageContent(id, "工作台", "note", content, null);
}

async function seedInitialSecurities(): Promise<void> {
  const rows = await querySql<{ count: number }>("SELECT COUNT(*) AS count FROM securities;");
  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  const samplePath = join(rootDir, "data", "securities.sample.csv");
  const sampleCsv = String(await readFile(samplePath, "utf8"));
  await importSecuritiesFromCsv(sampleCsv);
}

async function handleRequest(request: NodeRequest, response: NodeResponse): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl);
      return;
    }

    await serveStatic(response, requestUrl.pathname);
  } catch (error) {
    await logError(error);
    sendJson(response, 500, { error: "服务内部错误，请查看本地日志。", detail: getErrorMessage(error) });
  }
}

async function handleApi(request: NodeRequest, response: NodeResponse, requestUrl: URL): Promise<void> {
  const method = (request.method ?? "GET").toUpperCase();
  const pathname = requestUrl.pathname;

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true, workspace: workspaceDir });
    return;
  }

  if (method === "GET" && pathname === "/api/pages") {
    sendJson(response, 200, { pages: await listPages() });
    return;
  }

  if (method === "POST" && pathname === "/api/pages") {
    const body = await readJsonBody<{ title?: string; type?: string; parentId?: string | null; content?: string }>(request);
    const page = await createPage(body.title, body.type, body.parentId ?? null, body.content);
    sendJson(response, 201, { page });
    return;
  }

  const pageMatch = pathname.match(/^\/api\/pages\/([^/]+)$/);
  if (pageMatch && method === "GET") {
    const page = await getPage(pageMatch[1]);
    if (!page) {
      sendJson(response, 404, { error: "页面不存在" });
      return;
    }
    sendJson(response, 200, { page });
    return;
  }

  if (pageMatch && method === "PUT") {
    const body = await readJsonBody<{ title?: string; type?: string; content?: string; parentId?: string | null }>(request);
    const page = await updatePage(pageMatch[1], body);
    sendJson(response, 200, { page });
    return;
  }

  if (pageMatch && method === "DELETE") {
    await trashPage(pageMatch[1]);
    sendJson(response, 200, { ok: true });
    return;
  }

  const pageLinksMatch = pathname.match(/^\/api\/pages\/([^/]+)\/links$/);
  if (pageLinksMatch && method === "GET") {
    sendJson(response, 200, await getPageLinkPanel(pageLinksMatch[1]));
    return;
  }

  if (method === "GET" && pathname === "/api/securities/search") {
    sendJson(response, 200, { securities: [] });
    return;
  }

  const securityProfileMatch = pathname.match(/^\/api\/securities\/([^/]+)\/profile$/);
  if (securityProfileMatch && method === "GET") {
    const profile = await getSecurityProfile(decodeURIComponent(securityProfileMatch[1]));
    if (!profile) {
      sendJson(response, 404, { error: "股票不存在" });
      return;
    }
    sendJson(response, 200, profile);
    return;
  }

  if (method === "POST" && pathname === "/api/securities/import-csv") {
    const body = await readJsonBody<{ csvText?: string }>(request);
    if (!body.csvText) {
      sendJson(response, 400, { error: "缺少 CSV 内容" });
      return;
    }
    sendJson(response, 200, { result: await importSecuritiesFromCsv(body.csvText) });
    return;
  }

  if (method === "GET" && pathname === "/api/trades") {
    sendJson(response, 200, { trades: await listTrades() });
    return;
  }

  if (method === "POST" && pathname === "/api/trades") {
    const body = await readJsonBody<TradePatch>(request);
    sendJson(response, 201, { trade: await createTrade(body) });
    return;
  }

  const tradeMatch = pathname.match(/^\/api\/trades\/([^/]+)$/);
  if (tradeMatch && method === "PUT") {
    const body = await readJsonBody<TradePatch>(request);
    sendJson(response, 200, { trade: await updateTrade(tradeMatch[1], body) });
    return;
  }

  if (tradeMatch && method === "DELETE") {
    await deleteTrade(tradeMatch[1]);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/search") {
    const query = requestUrl.searchParams.get("q") ?? "";
    sendJson(response, 200, {
      pages: await searchPages(query, 8),
    });
    return;
  }

  sendJson(response, 404, { error: "未找到接口" });
}

async function listPages(): Promise<PageRecord[]> {
  return querySql<PageRecord>(
    `SELECT id, title, type, parent_id AS parentId, content, path, pinned, archived, trashed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM pages
     WHERE trashed = 0
     ORDER BY pinned DESC, updated_at DESC;`,
  );
}

async function getPage(id: string): Promise<PageRecord | null> {
  const rows = await querySql<PageRecord>(
    `SELECT id, title, type, parent_id AS parentId, content, path, pinned, archived, trashed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM pages
     WHERE id = ${sqlText(id)} AND trashed = 0
     LIMIT 1;`,
  );
  return rows[0] ?? null;
}

async function createPage(title?: string, type?: string, parentId?: string | null, content?: string): Promise<PageRecord> {
  const id = randomUUID();
  const createdAt = nowIso();
  const safeTitle = (title ?? "未命名页面").trim() || "未命名页面";
  const safeType = (type ?? "note").trim() || "note";
  const pageContent = content ?? createTemplateContent(safeTitle, safeType);
  await runSql(
    `INSERT INTO pages(id, title, type, parent_id, content, created_at, updated_at)
     VALUES (${sqlText(id)}, ${sqlText(safeTitle)}, ${sqlText(safeType)}, ${sqlText(parentId ?? null)},
             ${sqlText(pageContent)}, ${sqlText(createdAt)}, ${sqlText(createdAt)});`,
  );
  await savePageContent(id, safeTitle, safeType, pageContent, parentId ?? null);
  const page = await getPage(id);
  if (!page) {
    throw new Error("页面创建后无法读取");
  }
  return page;
}

async function updatePage(
  id: string,
  patch: { title?: string; type?: string; content?: string; parentId?: string | null },
): Promise<PageRecord> {
  const existing = await getPage(id);
  if (!existing) {
    throw new Error("页面不存在");
  }
  const title = patch.title !== undefined ? patch.title.trim() || "未命名页面" : existing.title;
  const type = patch.type !== undefined ? patch.type.trim() || "note" : existing.type;
  const content = patch.content !== undefined ? patch.content : existing.content;
  const parentId = patch.parentId !== undefined ? patch.parentId : existing.parentId;
  await savePageContent(id, title, type, content, parentId ?? null);
  const page = await getPage(id);
  if (!page) {
    throw new Error("页面保存后无法读取");
  }
  return page;
}

async function savePageContent(
  id: string,
  title: string,
  type: string,
  content: string,
  parentId: string | null,
): Promise<void> {
  const updatedAt = nowIso();
  await runSql(
    `UPDATE pages
     SET title = ${sqlText(title)},
         type = ${sqlText(type)},
         parent_id = ${sqlText(parentId)},
         content = ${sqlText(content)},
         updated_at = ${sqlText(updatedAt)}
     WHERE id = ${sqlText(id)};`,
  );
  await syncPageFts(id, title, content);
  await syncLinksForPage(id, content);
}

async function trashPage(id: string): Promise<void> {
  await runSql(
    `UPDATE pages SET trashed = 1, updated_at = ${sqlText(nowIso())} WHERE id = ${sqlText(id)};
     DELETE FROM links WHERE source_page_id = ${sqlText(id)};
     DELETE FROM page_fts WHERE id = ${sqlText(id)};`,
  );
}

async function syncPageFts(id: string, title: string, content: string): Promise<void> {
  await runSql(
    `DELETE FROM page_fts WHERE id = ${sqlText(id)};
     INSERT INTO page_fts(id, title, content)
     VALUES (${sqlText(id)}, ${sqlText(title)}, ${sqlText(content)});`,
  );
}

async function syncSecurityFts(security: SecurityRecord, aliases: string[]): Promise<void> {
  await runSql(
    `DELETE FROM security_fts WHERE id = ${sqlText(security.id)};
     INSERT INTO security_fts(id, code, name, short_name, full_name, pinyin, pinyin_initials, aliases)
     VALUES (${sqlText(security.id)}, ${sqlText(security.code)}, ${sqlText(security.name)},
             ${sqlText(security.shortName)}, ${sqlText(security.fullName)}, ${sqlText(security.pinyin)},
             ${sqlText(security.pinyinInitials)}, ${sqlText(aliases.join(";"))});`,
  );
}

async function syncLinksForPage(sourcePageId: string, content: string): Promise<void> {
  const links = await parseWikiLinks(content, sourcePageId);
  const statements: string[] = [`DELETE FROM links WHERE source_page_id = ${sqlText(sourcePageId)};`];
  for (const link of links) {
    statements.push(
      `INSERT INTO links(id, source_page_id, target_type, target_id, target_title, display_text, raw_text, created_at)
       VALUES (${sqlText(link.id)}, ${sqlText(sourcePageId)}, ${sqlText(link.targetType)}, ${sqlText(link.targetId)},
               ${sqlText(link.targetTitle)}, ${sqlText(link.displayText)}, ${sqlText(link.rawText)}, ${sqlText(link.createdAt)});`,
    );
  }
  await runSql(statements.join("\n"));
}

async function parseWikiLinks(content: string, sourcePageId: string): Promise<LinkRecord[]> {
  const links: LinkRecord[] = [];
  const linkPattern = /\[\[([^\]\n]+?)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content)) !== null) {
    const rawBody = match[1]?.trim();
    if (!rawBody) {
      continue;
    }

    const [targetPart, displayText] = splitOnce(rawBody, "|");
    const [prefix, value] = splitOnce(targetPart, ":");
    const createdAt = nowIso();

    if (value && normalizePrefix(prefix) === "股票") {
      const targetTitle = value.trim();
      links.push({
        id: randomUUID(),
        sourcePageId,
        targetType: "security",
        targetId: null,
        targetTitle,
        displayText: displayText?.trim() || null,
        rawText: match[0],
        createdAt,
      });
      continue;
    }

    const pageTitle = targetPart.trim();
    const page = await findPageByTitle(pageTitle);
    links.push({
      id: randomUUID(),
      sourcePageId,
      targetType: page ? "page" : "unknown",
      targetId: page?.id ?? null,
      targetTitle: pageTitle,
      displayText: displayText?.trim() || null,
      rawText: match[0],
      createdAt,
    });
  }

  return links;
}

async function findPageByTitle(title: string): Promise<PageRecord | null> {
  const rows = await querySql<PageRecord>(
    `SELECT id, title, type, parent_id AS parentId, content, path, pinned, archived, trashed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM pages
     WHERE title = ${sqlText(title)} AND trashed = 0
     ORDER BY updated_at DESC
     LIMIT 1;`,
  );
  return rows[0] ?? null;
}

async function getPageLinkPanel(pageId: string): Promise<{ outgoing: LinkRecord[]; backlinks: LinkRecord[] }> {
  const page = await getPage(pageId);
  if (!page) {
    return { outgoing: [], backlinks: [] };
  }

  const outgoing = await querySql<LinkRecord>(
    `SELECT id, source_page_id AS sourcePageId, target_type AS targetType, target_id AS targetId,
            target_title AS targetTitle, display_text AS displayText, raw_text AS rawText, created_at AS createdAt
     FROM links
     WHERE source_page_id = ${sqlText(pageId)}
     ORDER BY created_at DESC;`,
  );

  const backlinks = await querySql<LinkRecord>(
    `SELECT l.id, l.source_page_id AS sourcePageId, p.title AS sourceTitle,
            l.target_type AS targetType, l.target_id AS targetId, l.target_title AS targetTitle,
            l.display_text AS displayText, l.raw_text AS rawText, l.created_at AS createdAt
     FROM links l
     JOIN pages p ON p.id = l.source_page_id
     WHERE l.source_page_id <> ${sqlText(pageId)}
       AND p.trashed = 0
       AND l.target_type IN ('page', 'unknown')
       AND (l.target_id = ${sqlText(pageId)} OR l.target_title = ${sqlText(page.title)})
     ORDER BY l.created_at DESC;`,
  );

  return { outgoing, backlinks };
}

async function searchPages(query: string, limit: number): Promise<PageRecord[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return querySql<PageRecord>(
      `SELECT id, title, type, parent_id AS parentId, content, path, pinned, archived, trashed,
              created_at AS createdAt, updated_at AS updatedAt
       FROM pages
       WHERE trashed = 0
       ORDER BY updated_at DESC
       LIMIT ${safeLimit(limit)};`,
    );
  }

  const like = `%${escapeLike(trimmed)}%`;
  return querySql<PageRecord>(
    `SELECT id, title, type, parent_id AS parentId, content, path, pinned, archived, trashed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM pages
     WHERE trashed = 0
       AND (title LIKE ${sqlText(like)} ESCAPE '\\' OR content LIKE ${sqlText(like)} ESCAPE '\\')
     ORDER BY CASE WHEN title LIKE ${sqlText(like)} ESCAPE '\\' THEN 0 ELSE 1 END, updated_at DESC
     LIMIT ${safeLimit(limit)};`,
  );
}

async function importSecuritiesFromCsv(csvText: string): Promise<CsvImportResult> {
  const rows = parseCsv(csvText);
  const result: CsvImportResult = { inserted: 0, updated: 0, aliases: 0, failed: [] };
  if (rows.length < 2) {
    result.failed.push({ row: 1, reason: "CSV 至少需要表头和一行数据" });
    return result;
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const values = rows[rowIndex];
    if (values.every((value) => value.trim() === "")) {
      continue;
    }

    const record = recordFromCsv(headers, values);
    try {
      const imported = await upsertSecurity(record);
      result[imported.created ? "inserted" : "updated"] += 1;
      result.aliases += imported.aliases;
    } catch (error) {
      result.failed.push({ row: rowIndex + 1, reason: getErrorMessage(error) });
    }
  }

  return result;
}

async function getSecurityProfile(securityId: string): Promise<{
  security: SecurityRecord;
  linkedPages: PageRecord[];
  linkedTrades: TradeRecord[];
  backlinks: LinkRecord[];
} | null> {
  const security = await getSecurityById(securityId);
  if (!security) {
    return null;
  }

  const linkedPages = await querySql<PageRecord>(
    `SELECT DISTINCT p.id, p.title, p.type, p.parent_id AS parentId, p.content, p.path, p.pinned, p.archived, p.trashed,
            p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM links l
     JOIN pages p ON p.id = l.source_page_id
     WHERE p.trashed = 0
       AND l.target_type = 'security'
       AND l.target_id = ${sqlText(securityId)}
     ORDER BY p.updated_at DESC
     LIMIT 20;`,
  );
  const linkedTrades = await listTrades(`security_id = ${sqlText(securityId)}`);
  const backlinks = await querySql<LinkRecord>(
    `SELECT l.id, l.source_page_id AS sourcePageId, p.title AS sourceTitle,
            l.target_type AS targetType, l.target_id AS targetId, l.target_title AS targetTitle,
            l.display_text AS displayText, l.raw_text AS rawText, l.created_at AS createdAt
     FROM links l
     JOIN pages p ON p.id = l.source_page_id
     WHERE p.trashed = 0
       AND l.target_type = 'security'
       AND l.target_id = ${sqlText(securityId)}
     ORDER BY l.created_at DESC;`,
  );

  return { security, linkedPages, linkedTrades, backlinks };
}

async function getSecurityById(id: string): Promise<SecurityRecord | null> {
  const rows = await querySql<SecurityRecord>(
    `SELECT id, market, code, exchange, symbol, name, short_name AS shortName, full_name AS fullName,
            pinyin, pinyin_initials AS pinyinInitials, aliases,
            industry_level_1 AS industryLevel1, industry_level_2 AS industryLevel2,
            industry_level_3 AS industryLevel3, listed_date AS listedDate,
            delisted, created_at AS createdAt, updated_at AS updatedAt
     FROM securities
     WHERE id = ${sqlText(id)}
     LIMIT 1;`,
  );
  return rows[0] ?? null;
}

async function listTrades(whereClause = "1 = 1"): Promise<TradeRecord[]> {
  return querySql<TradeRecord>(
    `SELECT id, trade_date AS tradeDate, trade_time AS tradeTime, account, market,
            security_id AS securityId, security_name AS securityName, security_code AS securityCode,
            side, quantity, price, amount, fee, tax, net_amount AS netAmount,
            strategy, reason_buy AS reasonBuy, reason_sell AS reasonSell, expectation, review,
            plan_followed AS planFollowed, impulsive, mistake_type AS mistakeType,
            linked_page_id AS linkedPageId, created_at AS createdAt, updated_at AS updatedAt
     FROM trades
     WHERE ${whereClause}
     ORDER BY trade_date DESC, updated_at DESC;`,
  );
}

async function createTrade(patch: TradePatch): Promise<TradeRecord> {
  const id = randomUUID();
  const now = nowIso();
  const normalized = normalizeTradePatch(patch);
  await runSql(
    `INSERT INTO trades(
       id, trade_date, trade_time, account, market, security_id, security_name, security_code,
       side, quantity, price, amount, fee, tax, net_amount, strategy, reason_buy, reason_sell,
       expectation, review, plan_followed, impulsive, mistake_type, linked_page_id, created_at, updated_at
     )
     VALUES (
       ${sqlText(id)}, ${sqlText(normalized.tradeDate)}, ${sqlText(normalized.tradeTime)}, ${sqlText(normalized.account)},
       ${sqlText(normalized.market)}, ${sqlText(normalized.securityId)}, ${sqlText(normalized.securityName)},
       ${sqlText(normalized.securityCode)}, ${sqlText(normalized.side)}, ${normalized.quantity}, ${normalized.price},
       ${normalized.amount}, ${normalized.fee}, ${normalized.tax}, ${sqlText(normalized.netAmount)},
       ${sqlText(normalized.strategy)}, ${sqlText(normalized.reasonBuy)}, ${sqlText(normalized.reasonSell)},
       ${sqlText(normalized.expectation)}, ${sqlText(normalized.review)}, ${sqlText(normalized.planFollowed)},
       ${sqlText(normalized.impulsive)}, ${sqlText(normalized.mistakeType)}, ${sqlText(normalized.linkedPageId)},
       ${sqlText(now)}, ${sqlText(now)}
     );`,
  );
  const trade = await getTrade(id);
  if (!trade) {
    throw new Error("交易创建后无法读取");
  }
  return trade;
}

async function updateTrade(id: string, patch: TradePatch): Promise<TradeRecord> {
  const existing = await getTrade(id);
  if (!existing) {
    throw new Error("交易不存在");
  }
  const normalized = normalizeTradePatch({ ...tradeToPatch(existing), ...patch });
  await runSql(
    `UPDATE trades SET
       trade_date = ${sqlText(normalized.tradeDate)},
       trade_time = ${sqlText(normalized.tradeTime)},
       account = ${sqlText(normalized.account)},
       market = ${sqlText(normalized.market)},
       security_id = ${sqlText(normalized.securityId)},
       security_name = ${sqlText(normalized.securityName)},
       security_code = ${sqlText(normalized.securityCode)},
       side = ${sqlText(normalized.side)},
       quantity = ${normalized.quantity},
       price = ${normalized.price},
       amount = ${normalized.amount},
       fee = ${normalized.fee},
       tax = ${normalized.tax},
       net_amount = ${sqlText(normalized.netAmount)},
       strategy = ${sqlText(normalized.strategy)},
       reason_buy = ${sqlText(normalized.reasonBuy)},
       reason_sell = ${sqlText(normalized.reasonSell)},
       expectation = ${sqlText(normalized.expectation)},
       review = ${sqlText(normalized.review)},
       plan_followed = ${sqlText(normalized.planFollowed)},
       impulsive = ${sqlText(normalized.impulsive)},
       mistake_type = ${sqlText(normalized.mistakeType)},
       linked_page_id = ${sqlText(normalized.linkedPageId)},
       updated_at = ${sqlText(nowIso())}
     WHERE id = ${sqlText(id)};`,
  );
  const trade = await getTrade(id);
  if (!trade) {
    throw new Error("交易保存后无法读取");
  }
  return trade;
}

async function deleteTrade(id: string): Promise<void> {
  await runSql(`DELETE FROM trades WHERE id = ${sqlText(id)};`);
}

async function getTrade(id: string): Promise<TradeRecord | null> {
  const rows = await listTrades(`id = ${sqlText(id)}`);
  return rows[0] ?? null;
}

function tradeToPatch(trade: TradeRecord): TradePatch {
  return {
    tradeDate: trade.tradeDate,
    tradeTime: trade.tradeTime,
    account: trade.account,
    market: trade.market,
    securityId: trade.securityId,
    securityName: trade.securityName,
    securityCode: trade.securityCode,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    fee: trade.fee,
    tax: trade.tax,
    strategy: trade.strategy,
    reasonBuy: trade.reasonBuy,
    reasonSell: trade.reasonSell,
    expectation: trade.expectation,
    review: trade.review,
    planFollowed: trade.planFollowed,
    impulsive: trade.impulsive,
    mistakeType: trade.mistakeType,
    linkedPageId: trade.linkedPageId,
  };
}

function normalizeTradePatch(patch: TradePatch): Required<Pick<TradePatch,
  "tradeDate" | "tradeTime" | "account" | "market" | "securityId" | "securityName" | "securityCode" | "side" |
  "quantity" | "price" | "fee" | "tax" | "strategy" | "reasonBuy" | "reasonSell" | "expectation" |
  "review" | "planFollowed" | "impulsive" | "mistakeType" | "linkedPageId"
>> & { amount: number; netAmount: number } {
  const quantity = numberOrZero(patch.quantity);
  const price = numberOrZero(patch.price);
  const fee = numberOrZero(patch.fee);
  const tax = numberOrZero(patch.tax);
  const side = valueOrDefault(patch.side, "BUY");
  const amount = roundMoney(quantity * price);
  const netAmount = side === "SELL" ? roundMoney(amount - fee - tax) : roundMoney(amount + fee + tax);

  return {
    tradeDate: valueOrDefault(patch.tradeDate, localDateIso()),
    tradeTime: optional(patch.tradeTime),
    account: optional(patch.account),
    market: valueOrDefault(patch.market, "CN-A"),
    securityId: valueOrDefault(patch.securityId, ""),
    securityName: valueOrDefault(patch.securityName, ""),
    securityCode: valueOrDefault(patch.securityCode, ""),
    side,
    quantity,
    price,
    amount,
    fee,
    tax,
    netAmount,
    strategy: optional(patch.strategy),
    reasonBuy: optional(patch.reasonBuy),
    reasonSell: optional(patch.reasonSell),
    expectation: optional(patch.expectation),
    review: optional(patch.review),
    planFollowed: patch.planFollowed ?? null,
    impulsive: patch.impulsive ?? null,
    mistakeType: optional(patch.mistakeType),
    linkedPageId: optional(patch.linkedPageId),
  };
}

async function upsertSecurity(record: Record<string, string>): Promise<{ created: boolean; aliases: number }> {
  const normalizedRecord = normalizeSecurityRecord(record);
  const market = valueOrDefault(normalizedRecord.market, "CN-A");
  const code = required(normalizedRecord.code, "code");
  const exchange = optional(normalizedRecord.exchange);
  const symbol = valueOrDefault(normalizedRecord.symbol, exchange ? `${code}.${exchange}` : code);
  const name = required(normalizedRecord.name, "name");
  const now = nowIso();
  const id = buildSecurityId(market, symbol);

  const existingRows = await querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM securities WHERE market = ${sqlText(market)} AND code = ${sqlText(code)};`,
  );
  const created = (existingRows[0]?.count ?? 0) === 0;

  await runSql(
    `INSERT INTO securities(
       id, market, code, exchange, symbol, name, short_name, full_name, pinyin, pinyin_initials,
       aliases, industry_level_1, industry_level_2, industry_level_3, listed_date, delisted, created_at, updated_at
     )
     VALUES (
       ${sqlText(id)}, ${sqlText(market)}, ${sqlText(code)}, ${sqlText(exchange)}, ${sqlText(symbol)},
       ${sqlText(name)}, ${sqlText(optional(normalizedRecord.short_name))}, ${sqlText(optional(normalizedRecord.full_name))},
       ${sqlText(optional(normalizedRecord.pinyin))}, ${sqlText(optional(normalizedRecord.pinyin_initials))}, ${sqlText(optional(normalizedRecord.aliases))},
       ${sqlText(optional(normalizedRecord.industry_level_1))}, ${sqlText(optional(normalizedRecord.industry_level_2))},
       ${sqlText(optional(normalizedRecord.industry_level_3))}, ${sqlText(optional(normalizedRecord.listed_date))}, 0,
       ${sqlText(now)}, ${sqlText(now)}
     )
     ON CONFLICT(market, code) DO UPDATE SET
       exchange = excluded.exchange,
       symbol = excluded.symbol,
       name = excluded.name,
       short_name = excluded.short_name,
       full_name = excluded.full_name,
       pinyin = excluded.pinyin,
       pinyin_initials = excluded.pinyin_initials,
       aliases = excluded.aliases,
       industry_level_1 = excluded.industry_level_1,
       industry_level_2 = excluded.industry_level_2,
       industry_level_3 = excluded.industry_level_3,
       listed_date = excluded.listed_date,
       updated_at = excluded.updated_at;`,
  );

  const savedSecurity = await getSecurityByMarketCode(market, code);
  if (!savedSecurity) {
    throw new Error(`股票 ${market} ${code} 保存失败`);
  }

  const aliases = collectAliases(normalizedRecord, savedSecurity);
  let aliasCount = 0;
  for (const alias of aliases) {
    const inserted = await insertAliasIfMissing(savedSecurity.id, alias, "import");
    if (inserted) {
      aliasCount += 1;
    }
  }
  await syncSecurityFts(savedSecurity, aliases);

  return { created, aliases: aliasCount };
}

async function getSecurityByMarketCode(market: string, code: string): Promise<SecurityRecord | null> {
  const rows = await querySql<SecurityRecord>(
    `SELECT id, market, code, exchange, symbol, name, short_name AS shortName, full_name AS fullName,
            pinyin, pinyin_initials AS pinyinInitials, aliases,
            industry_level_1 AS industryLevel1, industry_level_2 AS industryLevel2,
            industry_level_3 AS industryLevel3, listed_date AS listedDate,
            delisted, created_at AS createdAt, updated_at AS updatedAt
     FROM securities
     WHERE market = ${sqlText(market)} AND code = ${sqlText(code)}
     LIMIT 1;`,
  );
  return rows[0] ?? null;
}

async function insertAliasIfMissing(securityId: string, alias: string, aliasType: string): Promise<boolean> {
  const cleanAlias = alias.trim();
  if (!cleanAlias) {
    return false;
  }

  const rows = await querySql<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM security_aliases
     WHERE security_id = ${sqlText(securityId)}
       AND lower(alias) = lower(${sqlText(cleanAlias)});`,
  );
  if ((rows[0]?.count ?? 0) > 0) {
    return false;
  }

  await runSql(
    `INSERT INTO security_aliases(id, security_id, alias, alias_type, created_at)
     VALUES (${sqlText(`alias-${stableHash(`${securityId}:${cleanAlias}`)}`)}, ${sqlText(securityId)},
             ${sqlText(cleanAlias)}, ${sqlText(aliasType)}, ${sqlText(nowIso())});`,
  );
  return true;
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

function recordFromCsv(headers: string[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index] ?? "";
    if (!header) {
      continue;
    }
    const value = cleanCell(values[index]);
    if (!value) {
      continue;
    }
    if (record[header]) {
      record[header] = header === "aliases" ? `${record[header]};${value}` : record[header];
      continue;
    }
    record[header] = value;
  }
  return record;
}

function collectAliases(record: Record<string, string>, security: SecurityRecord): string[] {
  const aliases = new Set<string>();
  for (const value of [record.aliases, security.aliases, security.shortName, security.code, security.symbol]) {
    for (const alias of splitAliases(value ?? "")) {
      aliases.add(alias);
    }
  }
  return [...aliases].filter((alias) => alias && alias !== security.name);
}

function splitAliases(value: string): string[] {
  return value
    .split(/[;；,，|、]/)
    .map((alias) => alias.trim())
    .filter(Boolean);
}

async function querySql<T>(sql: string): Promise<T[]> {
  const result = await execSql(["-json", dbPath, sql]);
  const output = result.stdout.trim();
  if (!output) {
    return [];
  }
  return JSON.parse(output) as T[];
}

async function runSql(sql: string): Promise<void> {
  await execSql([dbPath], `.bail on\nPRAGMA foreign_keys = ON;\n${sql}\n`);
}

async function execSql(args: string[], input?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("sqlite3", args, { cwd: rootDir });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: unknown) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk: unknown) => {
      stderr += String(chunk);
    });
    child.on("error", (error: unknown) => {
      rejectPromise(error);
    });
    child.on("close", (code: number) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      rejectPromise(new Error(`SQLite 执行失败：${stderr || stdout || `exit ${code}`}`));
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function serveStatic(response: NodeResponse, pathname: string): Promise<void> {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const targetPath = resolve(publicDir, relativePath);
  const normalizedPublicDir = `${publicDir}`.toLowerCase();
  if (!targetPath.toLowerCase().startsWith(normalizedPublicDir)) {
    sendJson(response, 403, { error: "路径不合法" });
    return;
  }

  const finalPath = existsSync(targetPath) ? targetPath : join(publicDir, "index.html");
  try {
    await access(finalPath);
    const data = await readFile(finalPath);
    response.writeHead(200, { "Content-Type": contentType(finalPath) });
    response.end(data);
  } catch {
    sendJson(response, 404, { error: "文件不存在" });
  }
}

function sendJson(response: NodeResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJsonBody<T>(request: NodeRequest): Promise<T> {
  const body = await readBody(request);
  if (!body.trim()) {
    return {} as T;
  }
  return JSON.parse(body) as T;
}

async function readBody(request: NodeRequest): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    let body = "";
    request.on("data", (chunk: unknown) => {
      body += String(chunk);
      if (body.length > 20 * 1024 * 1024) {
        rejectPromise(new Error("请求体过大"));
      }
    });
    request.on("end", () => resolvePromise(body));
    request.on("error", (error: unknown) => rejectPromise(error));
  });
}

function createTemplateContent(title: string, type: string): string {
  if (type === "daily_review") {
    return `# ${title}\n\n## 一、今日市场\n\n## 二、今日主线\n\n## 三、机构票观察\n\n## 四、产业链变化\n\n## 五、消息事件\n\n## 六、今日交易\n\n## 七、交易原因与执行质量\n\n## 八、明日计划\n\n## 九、需要继续跟踪的问题\n`;
  }
  if (type === "stock_research") {
    return `# ${title}\n\n## 一、公司概况\n\n## 二、业务拆分\n\n## 三、所属产业链\n\n## 四、核心投资逻辑\n\n## 五、催化剂\n\n## 六、风险点\n\n## 七、估值与预期差\n`;
  }
  return `# ${title}\n\n`;
}

const HEADER_ALIASES: Record<string, string> = {
  market: "market",
  市场: "market",
  市场类型: "market",
  证券市场: "market",
  股票市场: "market",
  code: "code",
  ticker: "code",
  代码: "code",
  股票代码: "code",
  证券代码: "code",
  资产代码: "code",
  symbol: "symbol",
  tscode: "symbol",
  ts_code: "symbol",
  secucode: "symbol",
  secu_code: "symbol",
  完整代码: "symbol",
  交易代码: "symbol",
  exchange: "exchange",
  交易所: "exchange",
  交易市场: "exchange",
  交易所代码: "exchange",
  name: "name",
  cname: "name",
  中文名称: "name",
  名称: "name",
  股票名称: "name",
  证券名称: "name",
  shortname: "short_name",
  short_name: "short_name",
  简称: "short_name",
  股票简称: "short_name",
  证券简称: "short_name",
  full_name: "full_name",
  fullname: "full_name",
  公司全称: "full_name",
  全称: "full_name",
  pinyin: "pinyin",
  cnspell: "pinyin",
  拼音: "pinyin",
  全拼: "pinyin",
  pinyininitials: "pinyin_initials",
  pinyin_initials: "pinyin_initials",
  首字母: "pinyin_initials",
  简拼: "pinyin_initials",
  拼音首字母: "pinyin_initials",
  industry: "industry_level_1",
  industry_level_1: "industry_level_1",
  行业: "industry_level_1",
  所属行业: "industry_level_1",
  一级行业: "industry_level_1",
  申万一级行业: "industry_level_1",
  industry_level_2: "industry_level_2",
  二级行业: "industry_level_2",
  申万二级行业: "industry_level_2",
  industry_level_3: "industry_level_3",
  三级行业: "industry_level_3",
  申万三级行业: "industry_level_3",
  listed_date: "listed_date",
  list_date: "listed_date",
  ipodate: "listed_date",
  ipo_date: "listed_date",
  上市日期: "listed_date",
  上市时间: "listed_date",
  aliases: "aliases",
  alias: "aliases",
  别名: "aliases",
  同义词: "aliases",
};

const EXCHANGE_ALIASES: Record<string, string> = {
  SH: "SH",
  SHA: "SH",
  SSE: "SH",
  SHSE: "SH",
  XSHG: "SH",
  上海: "SH",
  上海证券交易所: "SH",
  上交所: "SH",
  沪市: "SH",
  沪A: "SH",
  SZ: "SZ",
  SZA: "SZ",
  SZSE: "SZ",
  SHE: "SZ",
  XSHE: "SZ",
  深圳: "SZ",
  深圳证券交易所: "SZ",
  深交所: "SZ",
  深市: "SZ",
  深A: "SZ",
  BJ: "BJ",
  BSE: "BJ",
  XBSE: "BJ",
  北京: "BJ",
  北京证券交易所: "BJ",
  北交所: "BJ",
  HK: "HK",
  HKEX: "HK",
  XHKG: "HK",
  香港: "HK",
  港股: "HK",
  NYSE: "NYSE",
  NASDAQ: "NASDAQ",
  AMEX: "AMEX",
};

const MARKET_ALIASES: Record<string, string> = {
  CNA: "CN-A",
  "CN-A": "CN-A",
  A: "CN-A",
  A股: "CN-A",
  沪深: "CN-A",
  沪深A股: "CN-A",
  中国A股: "CN-A",
  HK: "HK",
  HKG: "HK",
  港股: "HK",
  香港: "HK",
  US: "US",
  USA: "US",
  美股: "US",
  美国: "US",
};

function normalizeHeader(value: string): string {
  const canonical = cleanCell(value).toLowerCase().replace(/\s+/g, "_");
  const compact = canonical.replace(/[\s_.\-()/（）]/g, "");
  return HEADER_ALIASES[canonical] ?? HEADER_ALIASES[compact] ?? canonical;
}

function normalizeSecurityRecord(record: Record<string, string>): Record<string, string> {
  const parsedCode = parseSecurityToken(record.code);
  const parsedSymbol = parseSecurityToken(record.symbol);
  const rawCode = parsedCode.code ?? parsedSymbol.code ?? record.code ?? record.symbol ?? "";
  let exchange = normalizeExchange(record.exchange) ?? parsedCode.exchange ?? parsedSymbol.exchange;
  let market = normalizeMarket(record.market, exchange, rawCode);
  let code = normalizeSecurityCode(rawCode, exchange, market);
  exchange = exchange ?? inferExchange(code, market);
  market = market ?? inferMarket(exchange, code);
  code = normalizeSecurityCode(code, exchange, market);

  const symbol = normalizeSecuritySymbol(record.symbol, code, exchange);
  const name = optional(record.name) ?? optional(record.short_name) ?? optional(record.full_name) ?? "";

  return {
    ...record,
    market,
    code,
    exchange: exchange ?? "",
    symbol,
    name,
    short_name: optional(record.short_name) ?? "",
    full_name: optional(record.full_name) ?? "",
    pinyin: optional(record.pinyin) ?? "",
    pinyin_initials: optional(record.pinyin_initials) ?? "",
    aliases: optional(record.aliases) ?? "",
    industry_level_1: optional(record.industry_level_1) ?? "",
    industry_level_2: optional(record.industry_level_2) ?? "",
    industry_level_3: optional(record.industry_level_3) ?? "",
    listed_date: normalizeListedDate(record.listed_date) ?? "",
  };
}

function parseSecurityToken(value: string | undefined): ParsedSecurityToken {
  const cleanValue = cleanCell(value).toUpperCase().replace(/\s+/g, "");
  if (!cleanValue) {
    return { code: null, exchange: null };
  }

  const suffixMatch = cleanValue.match(/^([0-9A-Z]+(?:\.[A-Z])?)[.:_\-]([A-Z]{2,6})$/);
  if (suffixMatch) {
    const exchange = normalizeExchange(suffixMatch[2]);
    if (exchange) {
      return { code: suffixMatch[1], exchange };
    }
  }

  const prefixMatch = cleanValue.match(/^([A-Z]{2,6})[.:_\-]?([0-9]{1,6})$/);
  if (prefixMatch) {
    const exchange = normalizeExchange(prefixMatch[1]);
    if (exchange) {
      return { code: prefixMatch[2], exchange };
    }
  }

  return { code: cleanValue, exchange: null };
}

function normalizeSecurityCode(value: string | undefined, exchange: string | null, market: string | null): string {
  const cleanValue = cleanCell(value).toUpperCase().replace(/\s+/g, "");
  if (!cleanValue) {
    return "";
  }
  if (/^\d+$/.test(cleanValue)) {
    if (exchange === "HK" || market === "HK") {
      return cleanValue.padStart(5, "0");
    }
    if (cleanValue.length < 6) {
      return cleanValue.padStart(6, "0");
    }
  }
  return cleanValue;
}

function normalizeSecuritySymbol(value: string | undefined, code: string, exchange: string | null): string {
  const parsed = parseSecurityToken(value);
  if (parsed.code && parsed.exchange) {
    const market = inferMarket(parsed.exchange, parsed.code);
    return `${normalizeSecurityCode(parsed.code, parsed.exchange, market)}.${parsed.exchange}`;
  }

  const cleanValue = cleanCell(value).toUpperCase().replace(/\s+/g, "");
  if (cleanValue && cleanValue !== code && !exchange) {
    return cleanValue;
  }
  return exchange ? `${code}.${exchange}` : code;
}

function normalizeExchange(value: string | undefined | null): string | null {
  const cleanValue = cleanCell(value).toUpperCase().replace(/\s+/g, "");
  if (!cleanValue) {
    return null;
  }
  return EXCHANGE_ALIASES[cleanValue] ?? null;
}

function normalizeMarket(value: string | undefined | null, exchange: string | null, code: string): string | null {
  const cleanValue = cleanCell(value).toUpperCase().replace(/\s+/g, "");
  if (cleanValue && MARKET_ALIASES[cleanValue]) {
    return MARKET_ALIASES[cleanValue];
  }
  if (cleanValue.includes("港")) {
    return "HK";
  }
  if (cleanValue.includes("美")) {
    return "US";
  }
  if (cleanValue.includes("沪") || cleanValue.includes("深") || cleanValue.includes("北交")) {
    return "CN-A";
  }
  return exchange || code ? inferMarket(exchange, code) : null;
}

function inferExchange(code: string, market: string | null): string | null {
  const cleanCode = cleanCell(code).toUpperCase();
  if (market === "HK" && /^\d{1,5}$/.test(cleanCode)) {
    return "HK";
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    return null;
  }
  if (/^[69]/.test(cleanCode)) {
    return "SH";
  }
  if (/^[03]/.test(cleanCode)) {
    return "SZ";
  }
  if (/^[48]/.test(cleanCode)) {
    return "BJ";
  }
  return null;
}

function inferMarket(exchange: string | null, code: string): string {
  if (exchange === "SH" || exchange === "SZ" || exchange === "BJ") {
    return "CN-A";
  }
  if (exchange === "HK") {
    return "HK";
  }
  if (exchange === "NYSE" || exchange === "NASDAQ" || exchange === "AMEX") {
    return "US";
  }

  const cleanCode = cleanCell(code).toUpperCase();
  if (/^\d{6}$/.test(cleanCode)) {
    return "CN-A";
  }
  if (/^\d{5}$/.test(cleanCode)) {
    return "HK";
  }
  if (/^[A-Z]{1,5}([.-][A-Z])?$/.test(cleanCode)) {
    return "US";
  }
  return "CN-A";
}

function normalizeListedDate(value: string | undefined): string | null {
  const cleanValue = optional(value);
  if (!cleanValue) {
    return null;
  }
  if (/^\d{8}$/.test(cleanValue)) {
    return `${cleanValue.slice(0, 4)}-${cleanValue.slice(4, 6)}-${cleanValue.slice(6, 8)}`;
  }
  return cleanValue.replace(/\//g, "-");
}

function cleanCell(value: string | undefined | null): string {
  return (value ?? "").replace(/^\uFEFF/, "").trim();
}

function required(value: string | undefined, field: string): string {
  const cleanValue = optional(value);
  if (!cleanValue) {
    throw new Error(`缺少必填字段 ${field}`);
  }
  return cleanValue;
}

function optional(value: string | undefined | null): string | null {
  const cleanValue = (value ?? "").trim();
  return cleanValue ? cleanValue : null;
}

function valueOrDefault(value: string | undefined | null, defaultValue: string): string {
  return optional(value) ?? defaultValue;
}

function buildSecurityId(market: string, symbol: string): string {
  return `${market}-${symbol}`.toUpperCase();
}

function sqlText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function safeLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 12;
  }
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

function nowIso(): string {
  return new Date().toISOString();
}

function localDateIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberOrZero(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizePrefix(value: string | undefined): string {
  return (value ?? "").trim();
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index < 0) {
    return [value, undefined];
  }
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function contentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  return types[extension] ?? "application/octet-stream";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function logError(error: unknown): Promise<void> {
  const line = `${nowIso()} ${getErrorMessage(error)}\n`;
  await mkdir(logsDir, { recursive: true });
  await appendFile(logPath, line, "utf8");
}

void main().catch(async (error: unknown) => {
  await logError(error);
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
