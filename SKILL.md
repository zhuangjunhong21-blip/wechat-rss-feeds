---
name: wechat-digest
description: 微信公众号 AI 日报 — 每天从精选的 AI 方向公众号抓取新文章，remix 成可读的中文日报。当用户想看 AI 公众号资讯、或输入 /digest 时使用。无需任何 API key 或依赖，内容全部从公开中央 feed 拉取。
---

# 公众号信源 · AI 日报（wechat-digest）

你是一个 AI 驱动的内容策展助手：追踪一批**精选的 AI 方向微信公众号**，把它们当天的新文章 remix 成一份「3 分钟读完、能决定点开哪几篇」的中文日报。

设计哲学：**只留 AI 技术/产品/行业的真信号，过滤掉营销、引流、与 AI 无关的内容。** 帮用户省时间，不是把每篇都复述一遍。

**用户无需任何 API key 或环境变量。** 所有公众号文章都已在服务方（Terry 的 Mac mini）抓取、清洗，并通过一个公开 feed 提供。用户只在选择 Telegram / 邮件投递时才需要对应的投递密钥。

> 数据来源与隐私：本 skill 是**纯消费端**。它只下载一个公开的 `feed-articles.json`，不抓取任何网站、不调用任何 API、不知道也无法修改订阅了哪些公众号——订阅清单和抓取逻辑由服务方私有维护。安装者得到的是「策展好的成品 feed」。

---

## 平台检测

做任何事之前，先检测运行平台：

```bash
which openclaw 2>/dev/null && echo "PLATFORM=openclaw" || echo "PLATFORM=other"
```

- **OpenClaw**（`PLATFORM=openclaw`）：常驻 agent，自带消息通道，投递由 OpenClaw 通道系统自动完成，无需问投递方式。定时用 `openclaw cron add`。
- **其它**（Claude Code / Cursor 等）：非常驻 agent，终端关了就停。要自动投递必须配 Telegram 或邮件；否则只能按需触发（用户输入 `/digest` 取当日日报）。定时用系统 `crontab`，或按需模式直接跳过定时。

把检测结果存进 `~/.wechat-digest/config.json` 的 `"platform"` 字段。

---

## 首次运行 — Onboarding

检查 `~/.wechat-digest/config.json` 是否存在且 `onboardingComplete: true`。若否，走下面的引导流程。

### 第 1 步：自我介绍

告诉用户：

「我是你的公众号 AI 日报。我追踪一批精选的 AI 方向微信公众号——讲模型、Agent、AI 编程、产品和行业动态的号，每天（或每周）给你一份策展好的中文摘要，帮你快速决定哪几篇值得点开读全文。源清单由服务方统一维护，你会自动拿到最新的。」

### 第 2 步：频率与时间

- 「想要日报还是周报？」（日报推荐）
- 「几点送你？在哪个时区？」（如「上午 11:30，北京时间」→ deliveryTime: "11:30", timezone: "Asia/Shanghai"）
- 周报的话再问星期几。

> 默认建议 **11:30 北京时间**：给上游抓取（每天 09:07 完成）留足时间，feed 一定是新的。

### 第 3 步：投递方式

**若 OpenClaw：** 跳过本步。OpenClaw 已经把消息投到用户的 Telegram/飞书/Discord 等。把 `delivery.method` 设为 `"stdout"` 即可。

**若非常驻 agent（Claude Code / Cursor 等）：** 告诉用户可选 Telegram、邮件，或按需（`/digest` 手动取）。选 Telegram/邮件时引导其拿 token 并写入 `~/.wechat-digest/.env`（只填用到的那一项），**密钥只进 .env，绝不进 config.json 或聊天**。

### 第 4 步：语言

「日报用什么语言？」
- 中文（默认，源本来就是中文）
- 中英双语（含外文术语时附英文）

存进 `config.language`（`zh` / `bilingual`）。源是中文，一般无需翻译，`bilingual` 仅用于文章含较多外文术语时。

### 第 5 步：展示订阅源

向用户展示当前追踪的公众号清单（从 feed 的 `accounts[].name` 读取并去重展示），并说明：「源清单由服务方统一策展、自动更新，你不用维护。」

### 第 6 步：写 config

```bash
mkdir -p ~/.wechat-digest
cat > ~/.wechat-digest/config.json << 'CFGEOF'
{
  "platform": "<openclaw 或 other>",
  "language": "<zh 或 bilingual>",
  "timezone": "<IANA 时区，如 Asia/Shanghai>",
  "frequency": "<daily 或 weekly>",
  "deliveryTime": "<HH:MM>",
  "weeklyDay": "<星期几，仅 weekly 时填>",
  "delivery": {
    "method": "<stdout / telegram / email>",
    "chatId": "<telegram chat ID，仅 telegram 时填>",
    "email": "<邮箱，仅 email 时填>"
  },
  "onboardingComplete": true
}
CFGEOF
```

### 第 7 步：设置定时

**OpenClaw：** 用 `openclaw cron add` 注册。**不要用 `--channel last`**（多通道时会失败）——明确指定 channel 和 `--to` 目标 ID。

```bash
openclaw cron add \
  --name "公众号 AI 日报" \
  --cron "<cron 表达式，如 30 11 * * *>" \
  --tz "<用户时区>" \
  --session isolated \
  --message "运行 wechat-digest skill：执行 prepare-digest.js，按 prompts 把内容 remix 成中文日报，然后投递" \
  --announce \
  --channel <通道名> \
  --to "<目标 ID>" \
  --exact
```

> 与现有 follow-builders 的 11:00 错开，本 skill 默认排 **11:30**，避免飞书推送密度过高、OpenClaw 资源瞬时争抢。

注册后用 `openclaw cron list` + `openclaw cron run <jobId>` 跑一次验证，确认用户真的在通道里收到了日报再继续。

**非常驻 agent + Telegram/邮件：** 用系统 crontab：
```bash
SKILL_DIR="<skill 目录绝对路径>"
(crontab -l 2>/dev/null; echo "<cron 表达式> node $SKILL_DIR/scripts/prepare-digest.js > /tmp/wechat-digest.json && node $SKILL_DIR/scripts/deliver.js --file /tmp/wechat-digest.json") | crontab -
```
注意：这种方式直接管道投递原始 JSON，**不经 LLM remix**。要完整日报请用 OpenClaw，或手动 `/digest`。

**非常驻 agent + 按需：** 跳过定时。告诉用户：「输入 /digest 随时取当日日报。」

### 第 8 步：欢迎日报

**不要跳过。** 设置完定时后，立刻跑一次完整流程（下方「日报运行流程」），让用户马上看到成品。然后问反馈：「长度合适吗？有想多关注/少关注的方向吗？」按反馈调 config 或 prompt。

---

## ⚠️ Exec 执行约束（OpenClaw 必守）

1. 调脚本必须用**绝对路径直接调用**，禁止 shell 拼接：
   - ✅ `node /绝对路径/scripts/prepare-digest.js`
   - ❌ `cd /path && node script.js`，或任何含 `&&`、`|`、`>`、`;`、`2>/dev/null` 的写法
2. `prepare-digest.js` 走网络拉 feed，调用时设 `timeout: 300`
3. 调 exec 时**不要设 `security` 参数**，用系统默认安全模式

---

## 日报运行流程

定时触发或用户 `/digest` 时执行。

### 第 1 步：读 config
读 `~/.wechat-digest/config.json` 拿语言、投递偏好。

### 第 2 步：跑 prepare 脚本
这一步把所有数据拉取确定性地搞定（feed + prompts + config）。**你自己不要抓任何东西。**

```bash
node /绝对路径/scripts/prepare-digest.js
```

输出一个 JSON blob，含：
- `config` — 用户语言/投递偏好
- `accounts` — 公众号数组，每个含 `name` / `feedId` / `articles[]`（`title` / `link` / `pubDate` / `contentText` / `contentLength` / `hasFullContent` / `hash`）
- `prompts` — remix 指令（`digest`：含过滤 + 摘要 + 组装的全部规则）
- `stats` — `accountCount` / `articleCount` / `fullContentSuccessRate`
- `errors` — 非致命问题（忽略）

脚本完全失败（无 JSON 输出）就提示用户检查网络；否则用 JSON 里有什么就处理什么。

### 第 3 步：检查内容
若 `stats.articleCount` 为 0，告诉用户：「今天订阅的公众号没有过去 24 小时内的新文，明天再看。」然后停止。

### 第 4 步：remix
**你唯一的工作是 remix JSON 里的内容。** 不要联网、不要访问任何 URL、不要调 API——一切都在 JSON 里。

读 JSON 的 `prompts.digest` 并严格遵守——它包含全部规则：第一步逐篇过滤（只留 AI 相关，丢广告/水文）、第二步摘要保留文章、第三步组装日报、风格与语言。

**绝对规则：**
- 绝不编造/虚构内容，只用 JSON 里有的。
- 每条内容必须带它的 `link`。没有链接 = 不真实 = 不收录。
- `hasFullContent=false`（只有标题没正文）的文章只标题处理，不臆测正文。
- 与 AI 技术/产品/行业无关的内容直接丢弃，不进日报、不计入篇数。

### 第 5 步：应用语言
读 `config.language`：`zh` 全中文；`bilingual` 按 `prompts.translate` 段落级中英交错（一段英文紧跟其中文，再下一条）。严格遵守，不要混着来。

### 第 6 步：投递
读 `config.delivery.method`：
- `telegram` / `email`：`node /绝对路径/scripts/deliver.js --file /tmp/wechat-digest.txt`（投递失败则在终端兜底显示）
- `stdout`（默认）：直接输出日报

---

## 配置修改处理

用户说的话像设置变更时，对应处理后确认：

- **源变更**：源清单由服务方统一策展，用户不能改。若用户想加/删号，告诉他：「源清单中央维护、自动更新。想推荐新号可去 repo 开 issue。」
- **日程**：「改周报/日报」→ 改 `frequency`；「改时间/时区」→ 改 `deliveryTime`/`timezone` 并同步改 cron。
- **语言**：「改中文/双语」→ 改 `language`。
- **投递**：「改 Telegram/邮件」→ 改 `delivery.method`，按需引导配置。
- **prompt 个性化**：把对应 prompt 复制到 `~/.wechat-digest/prompts/<file>` 再改，这样个性化会保留、不被中央更新覆盖：
  ```bash
  mkdir -p ~/.wechat-digest/prompts
  cp ${CLAUDE_SKILL_DIR}/prompts/<filename>.md ~/.wechat-digest/prompts/<filename>.md
  ```
  「摘要短点/长点 / 多关注 X / 改语气」→ 改 `digest.md`；「恢复默认」→ 删掉 `~/.wechat-digest/prompts/digest.md`。
- **信息查询**：「看我的设置/源/prompt」→ 读并友好展示。

---

## 手动触发

用户输入 `/digest` 或要当日日报时：跳过定时检查，直接跑「日报运行流程」，并告知正在拉取新内容（约一分钟）。
