# 股票复盘笔记软件开发规格文档

## 0. 给 Codex 的任务说明

你要开发一个桌面端股票复盘笔记软件。它不是单纯的 Markdown 编辑器，也不是普通表格软件，而是一个面向股票研究、机构票复盘、产业链研究、研报整理、消息分析、交割单复盘的本地知识系统。

产品目标是把 Obsidian 的 Markdown 与双链、Excel 的表格交割单复盘、Notion 的简洁层级目录与数据库视图结合起来，形成一个适合投资研究的本地软件。

用户偏好：

* 不喜欢 emoji，界面不要使用 emoji。
* 风格接近 Notion：简洁、克制、留白、层级清楚。
* 需要桌面软件形式，优先本地存储，离线可用。
* 核心使用场景是 A 股 / 港股 / 美股股票复盘，尤其是机构票、产业链、研报、消息、交易原因与交割单复盘。
* 输入股票名称、股票代码、简称、拼音、部分关键字中的任意一个，都应该能模糊检索并确定股票。

优先级最高的不是炫酷，而是顺手、稳定、体系完整、数据结构可持续扩展。

---

## 1. 推荐技术栈

### 1.1 桌面端框架

优先使用：

* Tauri
* React
* TypeScript
* SQLite

原因：

* Tauri 打包体积小，更适合做本地知识库软件。
* SQLite 适合本地数据库、表格、全文检索、双链索引、交割单数据。
* React 适合做 Notion 风格界面和复杂表格视图。
* TypeScript 适合长期维护。

如果 Codex 判断 Tauri 环境复杂，可以退而求其次使用 Electron。但默认按 Tauri 实现。

### 1.2 前端核心库建议

* React + TypeScript
* Vite
* Tailwind CSS
* Zustand 或 Redux Toolkit，用于前端状态管理
* TanStack Table，用于交割单表格、股票研究数据库视图
* CodeMirror 6 或 Monaco Editor，用于 Markdown 编辑器
* react-markdown / remark / rehype，用于 Markdown 预览
* Fuse.js，用于股票模糊检索
* date-fns，用于日期处理

### 1.3 本地数据库

使用 SQLite。

需要启用：

* FTS5：全文检索笔记、股票、研报摘要、消息事件
* 外键约束
* 数据库 migration 机制

---

## 2. 产品核心模块

整个软件包含 7 个核心模块：

1. 工作台 Dashboard
2. Markdown 笔记与双链系统
3. 层级目录与页面系统
4. 股票主数据与模糊识别系统
5. 表格化交割单复盘系统
6. 产业链 / 研报 / 消息研究系统
7. 全局搜索、标签、反向链接、知识图谱

---

## 3. 信息架构

### 3.1 左侧栏结构

左侧栏要类似 Notion 和 Obsidian 的结合。

推荐结构：

```text
工作台

复盘
  每日复盘
  周复盘
  月复盘
  交易总结

交割单
  全部交易
  按股票
  按月份
  按策略
  错误交易

股票研究
  自选股
  机构票池
  产业链
  公司库
  研报库
  消息事件

文章
  草稿
  已发布
  长文研究

模板
  个股研究模板
  产业链研究模板
  研报拆解模板
  消息分析模板
  交易复盘模板

设置
```

左侧目录必须支持：

* 新建文件夹
* 新建页面
* 拖拽排序
* 页面重命名
* 页面移动
* 页面删除到回收站
* 收藏 / 置顶

### 3.2 页面类型

每个页面都可以是普通 Markdown 页面，但需要支持不同模板。

页面类型包括：

* 普通笔记
* 每日复盘
* 个股研究
* 产业链研究
* 研报拆解
* 消息分析
* 交易复盘
* 长文文章

页面类型不要限制用户写作，但可以决定默认模板和元数据字段。

---

## 4. 核心工作流

### 4.1 日常复盘工作流

用户每天打开软件后，默认进入工作台。

工作台显示：

* 今日交易
* 今日新增笔记
* 今日消息事件
* 今日待复盘股票
* 最近编辑页面
* 当前持仓相关笔记
* 需要回顾的交易错误

用户可以点击“新建每日复盘”，自动生成当天日期的复盘页面。

每日复盘模板应包含：

```markdown
# YYYY-MM-DD 每日复盘

## 一、今日市场

## 二、今日主线

## 三、机构票观察

## 四、产业链变化

## 五、消息事件

## 六、今日交易

## 七、交易原因与执行质量

## 八、明日计划

## 九、需要继续跟踪的问题
```

### 4.2 个股研究工作流

用户输入股票名称、代码或关键字，选择股票后，可以进入股票主页。

股票主页应该包含：

* 股票基本信息
* 相关笔记
* 相关交易
* 相关研报
* 相关消息
* 所属行业 / 产业链
* 当前研究结论
* 投资逻辑
* 催化剂
* 风险点
* 估值与预期差

股票主页不是普通页面，而是一个聚合视图。它可以链接到多个 Markdown 页面。

### 4.3 交割单复盘工作流

用户可以像 Excel 一样录入交易。

每一笔交易必须能够记录：

* 日期
* 时间
* 市场
* 股票代码
* 股票名称
* 买卖方向
* 数量
* 成交价
* 成交金额
* 手续费
* 印花税
* 账户
* 策略标签
* 买入原因
* 卖出原因
* 交易前预期
* 交易后复盘
* 对应笔记
* 对应消息
* 对应研报
* 是否计划内交易
* 是否冲动交易
* 错误类型
* 复盘结论

表格要支持：

* 新增行
* 批量粘贴
* 从 CSV 导入
* 导出 CSV
* 排序
* 筛选
* 分组
* 按股票聚合
* 按月份聚合
* 按策略聚合
* 按错误类型聚合
* 自动计算盈亏
* 自动关联股票主页

### 4.4 产业链与研报工作流

用户研究机构票时，经常会看产业链和研报。

软件要支持：

* 创建产业链页面
* 创建研报拆解笔记
* 把研报和股票、产业链、消息事件关联起来
* 对同一个股票聚合所有研报和消息
* 对同一个产业链聚合所有相关公司

产业链研究模板：

```markdown
# 产业链名称

## 一、产业背景

## 二、需求侧变化

## 三、供给侧变化

## 四、价值量增量环节

## 五、上游

## 六、中游

## 七、下游

## 八、关键材料 / 设备 / 工艺

## 九、A股 / 港股 / 美股相关公司

## 十、纯血标的筛选

## 十一、景气度验证指标

## 十二、后续跟踪清单
```

研报拆解模板：

```markdown
# 研报标题

## 一、研报来源

## 二、核心结论

## 三、关键数据

## 四、产业链位置

## 五、涉及公司

## 六、市场可能忽略的点

## 七、与已有认知的冲突

## 八、可验证指标

## 九、我的判断
```

---

## 5. 股票模糊识别系统

这是非常重要的功能。

用户很多时候只记得股票名称，不记得股票代码。软件必须支持只输入名称、简称、拼音、关键字或代码的一部分，就能模糊检索出目标股票。

### 5.1 股票主数据表

建立 `securities` 表。

字段建议：

```sql
CREATE TABLE securities (
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

CREATE UNIQUE INDEX idx_securities_market_code ON securities(market, code);
CREATE INDEX idx_securities_name ON securities(name);
CREATE INDEX idx_securities_short_name ON securities(short_name);
CREATE INDEX idx_securities_pinyin ON securities(pinyin);
CREATE INDEX idx_securities_pinyin_initials ON securities(pinyin_initials);
```

`id` 建议格式：

```text
CN-A-600519.SH
CN-A-300750.SZ
HK-00700.HK
US-NVDA
```

### 5.2 股票别名表

有些股票有简称、俗称、历史名、集团名、核心产品名。

建立 `security_aliases` 表。

```sql
CREATE TABLE security_aliases (
  id TEXT PRIMARY KEY,
  security_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX idx_security_aliases_alias ON security_aliases(alias);
```

例如：

* 贵州茅台：茅台、贵州茅、600519
* 宁德时代：宁德、CATL、300750
* 工业富联：富联、FII、601138

用户也可以手动添加别名。

### 5.3 模糊检索规则

实现 `resolveSecurity(query: string)`。

输入可以是：

* 股票代码：`600519`
* 带交易所代码：`600519.SH`
* 中文名称：`贵州茅台`
* 简称：`茅台`
* 拼音：`guizhoumaotai`
* 拼音首字母：`gzmt`
* 公司全称关键词：`宁德`
* 产业链相关别名：`CATL`

返回候选列表，而不是直接强行匹配一个。

返回结构：

```ts
type SecurityCandidate = {
  id: string;
  market: string;
  code: string;
  exchange?: string;
  name: string;
  shortName?: string;
  fullName?: string;
  industry?: string;
  score: number;
  matchReason: string;
};
```

匹配优先级：

1. 完整代码精确匹配
2. 带交易所代码精确匹配
3. 股票名称精确匹配
4. 股票简称精确匹配
5. 用户自定义别名精确匹配
6. 股票代码前缀匹配
7. 名称包含匹配
8. 简称包含匹配
9. 拼音全拼匹配
10. 拼音首字母匹配
11. Fuse.js 模糊匹配

### 5.4 股票选择器组件

实现 `SecurityPicker` 组件。

要求：

* 用户输入时实时搜索
* 支持键盘上下选择
* 支持 Enter 确认
* 支持显示市场、代码、名称、行业
* 支持最近使用股票优先
* 支持自选股优先
* 支持持仓股票优先
* 支持模糊匹配原因展示

输入框示例：

```text
输入股票名称 / 代码 / 拼音 / 关键字
```

候选显示示例：

```text
贵州茅台    600519.SH    白酒    匹配：名称包含“茅台”
宁德时代    300750.SZ    电池    匹配：别名 CATL
工业富联    601138.SH    消费电子    匹配：简称包含“富联”
```

### 5.5 股票数据更新

实现一个股票数据导入界面。

支持：

* 从 CSV 导入股票主数据
* 更新已有股票
* 保留用户自定义别名
* 支持 A 股、港股、美股
* 后续可扩展行情接口

CSV 字段：

```csv
market,code,exchange,symbol,name,short_name,full_name,pinyin,pinyin_initials,industry_level_1,industry_level_2,industry_level_3,listed_date
```

不要把软件强绑定到某一个行情 API。要做成 Provider 抽象。

```ts
interface SecurityDataProvider {
  name: string;
  importFromFile(filePath: string): Promise<Security[]>;
  refresh?(): Promise<Security[]>;
}
```

---

## 6. Markdown 与双链系统

### 6.1 Markdown 编辑器

需要支持：

* Markdown 原文编辑
* 实时预览
* 分屏编辑 / 预览
* 标题目录
* 代码块
* 表格
* 引用
* 图片粘贴
* 附件链接
* 自动保存
* 历史版本

### 6.2 双链语法

支持 Obsidian 风格双链：

```markdown
[[页面标题]]
[[页面标题|显示文本]]
[[股票:贵州茅台]]
[[产业链:PCB]]
[[研报:某某证券-电子行业深度]]
```

需要解析并写入 `links` 表。

```sql
CREATE TABLE links (
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
```

`target_type` 可取：

* page
* security
* industry
* report
* event
* unknown

当用户输入 `[[股票:茅台]]` 时，应调用股票模糊识别系统，让用户选择具体股票，然后保存为确定的 `security_id`。

### 6.3 反向链接

每个页面右侧显示：

* 哪些页面链接到了当前页面
* 哪些交易关联了当前页面
* 哪些研报关联了当前页面
* 哪些消息关联了当前页面

反向链接不是简单文本搜索，而是基于 `links` 表和关联表生成。

### 6.4 未创建页面

如果用户写了 `[[某个新主题]]`，但页面不存在，应在右侧或全局搜索里显示为“未创建页面”。点击后可以创建。

---

## 7. 数据库设计

### 7.1 页面表

```sql
CREATE TABLE pages (
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

CREATE INDEX idx_pages_parent_id ON pages(parent_id);
CREATE INDEX idx_pages_title ON pages(title);
CREATE INDEX idx_pages_type ON pages(type);
```

虽然用户不喜欢 emoji，但 `icon` 字段可以保留，默认不显示或只使用简单图标。

### 7.2 标签表

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE page_tags (
  page_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (page_id, tag_id),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

### 7.3 交易表

```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  trade_date TEXT NOT NULL,
  trade_time TEXT,
  account TEXT,
  market TEXT NOT NULL,
  security_id TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  amount REAL NOT NULL,
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
  linked_event_id TEXT,
  linked_report_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id),
  FOREIGN KEY (linked_page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE INDEX idx_trades_trade_date ON trades(trade_date);
CREATE INDEX idx_trades_security_id ON trades(security_id);
CREATE INDEX idx_trades_strategy ON trades(strategy);
CREATE INDEX idx_trades_mistake_type ON trades(mistake_type);
```

`side` 建议取值：

* BUY
* SELL
* BUY_TO_COVER
* SELL_SHORT

A 股用户一般只用 BUY 和 SELL，但数据结构应支持扩展。

### 7.4 持仓与交易聚合

不要只存持仓，也要能由交易流水计算持仓。

实现一个 `PositionService`：

* 按股票聚合买入数量、卖出数量、剩余数量
* 计算持仓成本
* 计算已实现盈亏
* 计算未实现盈亏时可以暂时手动录入最新价

可以先用后端服务层计算，不一定一开始就建立持仓表。

### 7.5 研报表

```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT,
  author TEXT,
  publish_date TEXT,
  file_path TEXT,
  summary TEXT,
  key_points TEXT,
  page_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE TABLE report_securities (
  report_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  PRIMARY KEY (report_id, security_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);
```

### 7.6 消息事件表

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  url TEXT,
  content TEXT,
  event_type TEXT,
  importance INTEGER DEFAULT 3,
  page_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE TABLE event_securities (
  event_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  PRIMARY KEY (event_id, security_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);
```

事件类型建议：

* 订单
* 价格
* 产能
* 技术路线
* 政策
* 业绩
* 并购
* 供需
* 海外龙头
* 研报观点
* 传闻待验证

### 7.7 产业链表

```sql
CREATE TABLE industries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  description TEXT,
  page_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES industries(id) ON DELETE SET NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE TABLE industry_securities (
  industry_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  role TEXT,
  purity_score INTEGER,
  elasticity_score INTEGER,
  notes TEXT,
  PRIMARY KEY (industry_id, security_id),
  FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE CASCADE,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);
```

`role` 示例：

* 上游材料
* 设备
* 零部件
* 制造
* 封装
* 设计
* 下游应用
* 终端客户

### 7.8 全文检索表

使用 SQLite FTS5。

```sql
CREATE VIRTUAL TABLE page_fts USING fts5(
  title,
  content,
  tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE security_fts USING fts5(
  code,
  name,
  short_name,
  full_name,
  pinyin,
  pinyin_initials,
  aliases,
  tokenize = 'unicode61'
);
```

每次页面保存后更新 `page_fts`。

每次股票数据更新后更新 `security_fts`。

---

## 8. 页面设计

### 8.1 整体布局

```text
┌────────────────────────────────────────────────────────────┐
│ 顶部栏：全局搜索 / 命令面板 / 当前页面路径 / 保存状态       │
├───────────────┬──────────────────────────────┬─────────────┤
│ 左侧目录       │ 主编辑区                      │ 右侧信息栏   │
│               │                              │             │
│ 工作台         │ Markdown 编辑器 / 表格 / 视图 │ 反向链接     │
│ 复盘           │                              │ 页面属性     │
│ 交割单         │                              │ 关联股票     │
│ 股票研究       │                              │ 相关交易     │
│ 产业链         │                              │ 相关研报     │
│ 设置           │                              │ 相关消息     │
└───────────────┴──────────────────────────────┴─────────────┘
```

要求：

* 左侧栏可折叠
* 右侧栏可折叠
* 顶部全局搜索始终可用
* 主编辑区尽量干净
* 使用浅色主题优先，后续支持深色主题
* 字体大小适合长时间阅读
* 不使用高饱和颜色
* 不使用 emoji 作为主要信息表达

### 8.2 全局搜索

快捷键：

* `Ctrl/Cmd + K` 打开全局搜索和命令面板
* `Ctrl/Cmd + P` 快速打开页面
* `Ctrl/Cmd + Shift + F` 全文搜索

搜索对象：

* 页面
* 股票
* 交易
* 研报
* 消息事件
* 产业链
* 标签

搜索结果分组显示。

示例：

```text
股票
  宁德时代 300750.SZ 电池
  宁德新能源 未上市公司 / 别名

页面
  宁德时代个股研究
  动力电池产业链

交易
  2026-05-15 买入 宁德时代

研报
  某证券-电池行业深度报告
```

### 8.3 个股主页设计

进入某只股票后，展示聚合信息。

```text
股票名称 代码 市场 行业

核心结论
  当前观点：看多 / 中性 / 看空 / 跟踪中
  逻辑摘要：...
  主要催化：...
  风险点：...

关联内容
  笔记  研报  消息  交易  产业链

交易概览
  买入次数
  卖出次数
  当前持仓
  成本
  已实现盈亏
  复盘错误

研究时间线
  YYYY-MM-DD 消息事件
  YYYY-MM-DD 研报观点
  YYYY-MM-DD 买入 / 卖出
  YYYY-MM-DD 复盘笔记
```

个股主页支持新建：

* 个股研究笔记
* 交易复盘
* 消息事件
* 研报拆解

---

## 9. 交割单表格设计

### 9.1 表格字段

默认显示字段：

```text
日期 | 时间 | 股票 | 代码 | 方向 | 数量 | 成交价 | 成交金额 | 策略 | 买入/卖出原因 | 计划内 | 冲动 | 错误类型 | 复盘 | 关联笔记
```

高级字段可隐藏：

```text
账户 | 市场 | 手续费 | 印花税 | 净金额 | 预期 | 关联消息 | 关联研报 | 创建时间 | 更新时间
```

### 9.2 单元格交互

股票列使用 `SecurityPicker`。

输入 `茅台`，弹出候选，选择后自动填充：

* security_id
* 股票名称
* 股票代码
* 市场

方向列使用下拉框。

策略列支持已有策略自动补全。

错误类型支持下拉和自定义。

关联笔记支持页面搜索。

### 9.3 交易复盘字段

错误类型建议内置：

* 无错误
* 买点过早
* 买点过晚
* 卖点过早
* 卖点过晚
* 追高
* 恐慌卖出
* 逻辑不完整
* 未按计划执行
* 仓位过重
* 仓位过轻
* 忽视风险
* 消息误判
* 产业趋势误判
* 业绩预期误判
* 情绪交易

允许用户自定义。

### 9.4 视图

交割单支持多种视图：

* 全部交易
* 按股票分组
* 按日期分组
* 按月份分组
* 按策略分组
* 按错误类型分组
* 当前持仓相关交易
* 已清仓股票交易

### 9.5 统计指标

基础统计：

* 总交易次数
* 买入次数
* 卖出次数
* 胜率
* 平均盈利
* 平均亏损
* 盈亏比
* 最大单笔盈利
* 最大单笔亏损
* 最常见错误类型
* 最赚钱策略
* 最亏钱策略

先实现基于已完成买卖闭环的简单统计，后续再扩展复杂成本计算。

---

## 10. 模板系统

用户可以从模板新建页面。

内置模板：

1. 每日复盘模板
2. 个股研究模板
3. 产业链研究模板
4. 研报拆解模板
5. 消息分析模板
6. 交易复盘模板
7. 长文文章模板

模板存储在数据库中，也可以暴露为 Markdown 文件。

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 10.1 个股研究模板

```markdown
# {{stock_name}} 个股研究

## 一、公司概况

## 二、业务拆分

## 三、所属产业链

## 四、核心投资逻辑

## 五、价值量增量

## 六、景气度来源

## 七、供需格局

## 八、竞争格局

## 九、纯度与弹性

## 十、机构认知差

## 十一、催化剂

## 十二、风险点

## 十三、估值与业绩弹性

## 十四、跟踪指标

## 十五、交易计划
```

### 10.2 消息分析模板

```markdown
# 消息标题

## 一、消息来源

## 二、消息发生时间

## 三、直接影响对象

## 四、涉及产业链

## 五、影响路径

## 六、受益环节

## 七、受损环节

## 八、对应公司

## 九、市场是否已经充分反应

## 十、需要验证的数据

## 十一、交易意义
```

### 10.3 交易复盘模板

```markdown
# {{stock_name}} 交易复盘 - {{date}}

## 一、交易记录

## 二、交易前判断

## 三、买入 / 卖出原因

## 四、当时市场环境

## 五、执行过程

## 六、结果

## 七、做对了什么

## 八、做错了什么

## 九、以后如何改进

## 十、是否需要更新个股研究结论
```

---

## 11. 关联关系设计

软件的核心不是孤立记录，而是关联。

需要支持以下关联：

* 页面关联股票
* 页面关联产业链
* 页面关联研报
* 页面关联消息
* 交易关联股票
* 交易关联笔记
* 交易关联消息
* 交易关联研报
* 研报关联股票
* 研报关联产业链
* 消息关联股票
* 消息关联产业链
* 产业链关联股票

实现方式：

* 明确关联表
* Markdown 双链自动解析
* 用户手动添加关联
* 股票主页自动聚合关联内容

不要只靠 Markdown 文本搜索。

---

## 12. 数据导入导出

### 12.1 交割单导入

支持 CSV 导入。

导入时步骤：

1. 用户选择 CSV 文件
2. 显示字段映射界面
3. 用户把 CSV 字段映射到软件字段
4. 系统逐行识别股票
5. 无法确定的股票进入待确认列表
6. 用户确认后导入
7. 生成导入日志

### 12.2 Markdown 导出

页面可以导出为：

* 单个 Markdown 文件
* 整个知识库 Markdown 文件夹

导出时保留：

* 层级目录
* Markdown 内容
* 图片附件
* 双链文本

### 12.3 数据库备份

设置页提供：

* 手动备份
* 自动备份
* 选择备份目录
* 恢复备份

备份对象：

* SQLite 数据库
* 附件文件夹
* 配置文件

---

## 13. 本地文件结构

建议本地 workspace 结构：

```text
StockReviewWorkspace/
  database/
    app.sqlite
  attachments/
    images/
    pdfs/
    reports/
  exports/
  backups/
  config/
    settings.json
```

用户第一次打开软件时选择 workspace 目录。

如果用户不选择，则默认创建在系统用户文档目录下。

---

## 14. 后端服务层设计

即使是本地软件，也要分层。

建议目录：

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    layout/
    editor/
    table/
    security/
    search/
    sidebar/
  features/
    pages/
    trades/
    securities/
    reports/
    events/
    industries/
    backlinks/
    templates/
    dashboard/
  services/
    db/
    pageService.ts
    tradeService.ts
    securityService.ts
    searchService.ts
    backlinkService.ts
    importService.ts
    exportService.ts
  stores/
  types/
  utils/
```

如果使用 Tauri：

```text
src-tauri/
  src/
    main.rs
    db.rs
    commands/
      pages.rs
      trades.rs
      securities.rs
      search.rs
```

React 前端通过 Tauri command 调用 Rust 后端读写 SQLite。

如果实现成本过高，可以先在前端通过 SQLite 插件访问本地数据库，但最终建议保持清晰分层。

---

## 15. 关键函数设计

### 15.1 股票解析

```ts
async function searchSecurities(query: string, options?: {
  limit?: number;
  preferWatchlist?: boolean;
  preferRecent?: boolean;
  preferHolding?: boolean;
}): Promise<SecurityCandidate[]>;
```

实现逻辑：

1. normalize query
2. 判断是否像股票代码
3. 查询精确匹配
4. 查询别名匹配
5. 查询包含匹配
6. 查询拼音匹配
7. Fuse.js 模糊匹配
8. 合并结果并去重
9. 根据匹配类型、最近使用、自选股、持仓加权排序

normalize 规则：

* trim
* 转小写
* 全角转半角
* 去掉空格
* 去掉 `.SH` / `.SZ` 后可同时匹配
* 中文保持原样

### 15.2 页面保存与双链解析

```ts
async function savePage(pageId: string, content: string): Promise<void>;
```

保存步骤：

1. 更新 pages.content
2. 解析 Markdown 中的 `[[...]]`
3. 删除旧 links
4. 插入新 links
5. 更新 page_fts
6. 更新时间戳

### 15.3 获取反向链接

```ts
async function getBacklinks(target: {
  type: 'page' | 'security' | 'industry' | 'report' | 'event';
  id: string;
}): Promise<Backlink[]>;
```

返回：

* 来源页面
* 命中文本
* 链接类型
* 创建时间

### 15.4 获取股票聚合视图

```ts
async function getSecurityProfile(securityId: string): Promise<SecurityProfile>;
```

返回：

* 股票基本信息
* 关联页面
* 关联交易
* 关联研报
* 关联消息
* 关联产业链
* 持仓与盈亏概览
* 最近时间线

---

## 16. MVP 开发顺序

不要一开始做所有功能。按以下阶段实现。

### Phase 1：基础框架

目标：软件能打开，有本地数据库，有左侧目录，有 Markdown 页面。

任务：

1. 初始化 Tauri + React + TypeScript 项目
2. 配置 Tailwind
3. 创建 SQLite 数据库
4. 实现 migration
5. 实现 pages 表
6. 实现左侧目录
7. 实现新建 / 编辑 / 保存页面
8. 实现 Markdown 编辑器
9. 实现自动保存

验收标准：

* 可以新建页面
* 可以写 Markdown
* 关闭重开后内容还在
* 左侧目录能展示页面层级

### Phase 2：股票主数据与模糊检索

目标：输入股票名称或代码能找到股票。

任务：

1. 实现 securities 表
2. 实现 security_aliases 表
3. 实现 CSV 导入股票主数据
4. 实现 searchSecurities
5. 实现 SecurityPicker
6. 在全局搜索中加入股票搜索

验收标准：

* 输入 `600519` 能找到贵州茅台
* 输入 `茅台` 能找到贵州茅台
* 输入 `gzmt` 能找到贵州茅台
* 输入 `宁德` 能找到宁德时代
* 同名或近似名股票能展示候选列表，不误选

### Phase 3：交割单表格

目标：像 Excel 一样录入交易，并关联股票。

任务：

1. 实现 trades 表
2. 实现交易表格视图
3. 股票列接入 SecurityPicker
4. 实现新增、编辑、删除交易
5. 实现排序、筛选
6. 实现 CSV 导入导出
7. 实现基础统计

验收标准：

* 可以录入买入 / 卖出
* 可以模糊选择股票
* 可以记录交易原因和复盘
* 可以按股票筛选交易
* 可以导入 CSV

### Phase 4：双链与反向链接

目标：Markdown 页面支持 Obsidian 风格双链。

任务：

1. 实现 `[[页面]]` 解析
2. 实现 `[[股票:xxx]]` 解析
3. 实现 links 表
4. 实现反向链接面板
5. 实现未创建页面
6. 实现点击双链跳转

验收标准：

* 写 `[[PCB产业链]]` 可以形成链接
* 写 `[[股票:茅台]]` 可以选择贵州茅台并关联
* 股票主页能显示引用它的页面
* 页面右侧能显示反向链接

### Phase 5：研报、消息、产业链

目标：支持机构票研究工作流。

任务：

1. 实现 reports 表
2. 实现 events 表
3. 实现 industries 表
4. 实现个股主页聚合视图
5. 实现产业链页面
6. 实现研报拆解模板
7. 实现消息分析模板

验收标准：

* 股票主页能看到相关交易、笔记、研报、消息
* 产业链能关联多个股票
* 研报能关联多个股票
* 消息能关联多个股票

### Phase 6：全文搜索、模板、备份

目标：软件可长期使用。

任务：

1. 实现 FTS5 全文搜索
2. 实现全局搜索分组
3. 实现模板系统
4. 实现 Markdown 导出
5. 实现数据库备份恢复
6. 实现设置页

验收标准：

* 可以搜到页面正文内容
* 可以从模板新建页面
* 可以导出 Markdown
* 可以备份和恢复数据库

---

## 17. 交互细节要求

### 17.1 自动保存

Markdown 页面编辑后 800ms debounce 自动保存。

保存状态显示：

* 已保存
* 保存中
* 保存失败

不要弹窗打断用户。

### 17.2 命令面板

`Ctrl/Cmd + K` 打开命令面板。

命令包括：

* 新建页面
* 新建每日复盘
* 新建交易
* 搜索股票
* 打开交割单
* 打开股票主页
* 导入交割单
* 导入股票数据
* 打开设置

### 17.3 快捷键

* `Ctrl/Cmd + N` 新建页面
* `Ctrl/Cmd + S` 手动保存
* `Ctrl/Cmd + K` 命令面板
* `Ctrl/Cmd + P` 快速打开页面
* `Ctrl/Cmd + Shift + F` 全文搜索
* `Ctrl/Cmd + /` 显示快捷键说明

### 17.4 表格体验

交割单表格要尽量接近 Excel：

* 单击选中单元格
* 双击编辑
* Enter 确认
* Tab 跳到下一个单元格
* 支持复制粘贴多行
* 支持列宽调整
* 支持固定表头
* 支持隐藏列

---

## 18. 视觉风格

整体接近 Notion。

### 18.1 色彩

* 背景：接近白色或浅灰
* 主文字：深灰 / 黑色
* 次级文字：灰色
* 边框：浅灰
* 强调色：低饱和蓝灰或中性黑

不要使用花哨渐变。

### 18.2 字体与间距

* 页面标题大而清晰
* 正文字号 15px 到 16px
* 行高 1.6 左右
* 表格字号可略小
* 左侧栏紧凑但不要拥挤
* 页面最大宽度可设置为 900px 到 1100px

### 18.3 组件风格

* 按钮简洁
* 表格线条淡
* 弹窗少用强边框
* hover 状态轻微变化
* 不要大量图标
* 不要 emoji

---

## 19. 错误处理

### 19.1 股票无法识别

当用户输入的股票无法识别时：

* 不要静默失败
* 显示“未找到匹配股票”
* 提供“手动创建股票”入口
* 提供“检查股票数据是否需要更新”入口

### 19.2 CSV 导入失败

显示：

* 哪些行成功
* 哪些行失败
* 失败原因
* 是否可以下载错误报告

### 19.3 数据库错误

不要让软件直接崩溃。

显示普通错误提示，并记录日志。

本地日志路径：

```text
workspace/logs/app.log
```

---

## 20. 测试清单

### 20.1 股票搜索测试

必须测试：

* 代码精确匹配
* 代码前缀匹配
* 中文名称匹配
* 中文简称匹配
* 别名匹配
* 拼音匹配
* 拼音首字母匹配
* 模糊输入错别字
* 多候选股票
* 已退市股票是否显示

### 20.2 页面系统测试

必须测试：

* 新建页面
* 编辑页面
* 删除页面
* 恢复页面
* 移动页面
* 页面重命名
* Markdown 保存
* 双链解析
* 反向链接更新

### 20.3 交易系统测试

必须测试：

* 新增交易
* 编辑交易
* 删除交易
* 股票选择
* CSV 导入
* CSV 导出
* 筛选
* 排序
* 分组
* 盈亏统计

### 20.4 数据安全测试

必须测试：

* 关闭软件后数据不丢
* 异常退出后数据尽可能保留
* 备份可恢复
* 导出 Markdown 可读
* 导入错误不会污染已有数据

---

## 21. Codex 执行要求

请 Codex 按阶段开发，不要一次性生成巨大不可维护代码。

每个阶段完成后都要：

1. 给出完成的文件清单
2. 说明新增了哪些功能
3. 说明如何运行
4. 说明如何测试
5. 说明当前已知问题
6. 不要删除已有功能

代码要求：

* 使用 TypeScript 严格类型
* 数据库访问集中封装
* 不要把 SQL 散落在组件里
* UI 组件和业务逻辑分离
* 表格、编辑器、股票搜索都要拆成可复用组件
* 所有时间使用 ISO 字符串存储
* 所有金额用 number 存储，但显示时统一格式化
* 所有 ID 使用 UUID 或稳定字符串 ID

---

## 22. 第一轮实际开发指令

第一轮先完成 Phase 1 和 Phase 2 的最小闭环。

请 Codex 先实现：

1. Tauri + React + TypeScript 项目骨架
2. Tailwind 风格系统
3. SQLite 初始化与 migration
4. `pages` 表
5. `securities` 表
6. `security_aliases` 表
7. 左侧目录
8. Markdown 页面编辑和自动保存
9. 股票 CSV 导入
10. 股票模糊搜索服务
11. `SecurityPicker` 组件
12. 全局搜索中可以搜索页面和股票

第一轮不要先做复杂图谱、AI 总结、行情接口、云同步。

第一轮验收目标：

* 软件能作为桌面应用打开
* 能创建并保存 Markdown 页面
* 能导入股票主数据
* 能输入股票名称 / 代码 / 拼音 / 关键字找到股票
* 能在页面中插入股票链接的基础形式

---

## 23. 后续增强方向

MVP 稳定后，再考虑：

* PDF 研报管理
* PDF 摘要提取
* AI 辅助研报拆解
* 行情数据接入
* K 线截图关联交易
* 自动生成周复盘
* 交易错误模式统计
* 产业链图谱可视化
* 多设备同步
* WebDAV / Git 备份
* 插件系统

这些都不是第一阶段重点。第一阶段重点是本地知识库、股票识别、交割单复盘和双链关联。
