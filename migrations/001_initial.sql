PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  parent_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  path TEXT,
  icon TEXT,
  cover TEXT,
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  trashed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_title ON pages(title);
CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);

CREATE TABLE IF NOT EXISTS securities (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  code TEXT NOT NULL,
  exchange TEXT,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  full_name TEXT,
  pinyin TEXT,
  pinyin_initials TEXT,
  aliases TEXT,
  industry_level_1 TEXT,
  industry_level_2 TEXT,
  industry_level_3 TEXT,
  listed_date TEXT,
  delisted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_securities_market_code ON securities(market, code);
CREATE INDEX IF NOT EXISTS idx_securities_name ON securities(name);
CREATE INDEX IF NOT EXISTS idx_securities_short_name ON securities(short_name);
CREATE INDEX IF NOT EXISTS idx_securities_pinyin ON securities(pinyin);
CREATE INDEX IF NOT EXISTS idx_securities_pinyin_initials ON securities(pinyin_initials);

CREATE TABLE IF NOT EXISTS security_aliases (
  id TEXT PRIMARY KEY,
  security_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_aliases_alias ON security_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_security_aliases_security_id ON security_aliases(security_id);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_title TEXT NOT NULL,
  display_text TEXT,
  raw_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_links_source_page_id ON links(source_page_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_type, target_id, target_title);

CREATE VIRTUAL TABLE IF NOT EXISTS page_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS security_fts USING fts5(
  id UNINDEXED,
  code,
  name,
  short_name,
  full_name,
  pinyin,
  pinyin_initials,
  aliases,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS trades (
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

CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_security_id ON trades(security_id);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
CREATE INDEX IF NOT EXISTS idx_trades_mistake_type ON trades(mistake_type);
