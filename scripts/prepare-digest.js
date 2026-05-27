#!/usr/bin/env node

// ============================================================================
// 公众号信源 · AI 日报 — Prepare Digest（fork 自 follow-builders）
// ============================================================================
// 这个脚本把 LLM 生成日报所需的一切确定性地准备好：
//   1. 下载公开中央 feed（feed-articles.json）
//   2. 下载最新的 prompt（digest.md）
//   3. 读用户本地 config（语言、投递方式）
//   4. 打包成一坨 JSON 从 stdout 输出
//
// LLM 唯一的工作是读这坨 JSON、按 prompt remix、输出日报文本。其余都在这里搞定。
//
// 用法：node prepare-digest.js
// 输出：JSON 到 stdout
// ============================================================================

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// -- 常量（fork 时只需改这几处地址） ----------------------------------------

const USER_DIR = join(homedir(), '.wechat-digest');
const CONFIG_PATH = join(USER_DIR, 'config.json');

const FEED_ARTICLES_URL =
  'https://raw.githubusercontent.com/zhuangjunhong21-blip/wechat-rss-feeds/main/feed-articles.json';

const PROMPTS_BASE =
  'https://raw.githubusercontent.com/zhuangjunhong21-blip/wechat-rss-feeds/main/prompts';
const PROMPT_FILES = ['digest.md'];

// -- 抓取小工具 --------------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

// -- 主流程 ------------------------------------------------------------------

async function main() {
  const errors = [];

  // 1. 读用户 config（缺省：中文、日报、stdout）
  let config = {
    language: 'zh',
    frequency: 'daily',
    delivery: { method: 'stdout' },
  };
  if (existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
    } catch (err) {
      errors.push(`Could not read config: ${err.message}`);
    }
  }

  // 2. 下载中央 feed
  const feed = await fetchJSON(FEED_ARTICLES_URL);
  if (!feed) errors.push('Could not fetch article feed');

  // 3. 加载 prompt，优先级：用户自定义 > GitHub 远程 > skill 内置 fallback
  //    用户在 ~/.wechat-digest/prompts/<file> 有自定义就用它（别被远程覆盖）；
  //    否则拉 GitHub 最新（拿到中央更新）；GitHub 不可达再退回 skill 内置副本。
  const prompts = {};
  const scriptDir = decodeURIComponent(new URL('.', import.meta.url).pathname);
  const localPromptsDir = join(scriptDir, '..', 'prompts');
  const userPromptsDir = join(USER_DIR, 'prompts');

  for (const filename of PROMPT_FILES) {
    const key = filename.replace('.md', '').replace(/-/g, '_');
    const userPath = join(userPromptsDir, filename);
    const localPath = join(localPromptsDir, filename);

    if (existsSync(userPath)) {
      prompts[key] = await readFile(userPath, 'utf-8');
      continue;
    }
    const remote = await fetchText(`${PROMPTS_BASE}/${filename}`);
    if (remote) {
      prompts[key] = remote;
      continue;
    }
    if (existsSync(localPath)) {
      prompts[key] = await readFile(localPath, 'utf-8');
    } else {
      errors.push(`Could not load prompt: ${filename}`);
    }
  }

  // 4. 打包输出 —— LLM 需要的一切，单一内容类型（公众号文章）
  const accounts = feed?.accounts || [];
  const output = {
    status: 'ok',
    generatedAt: new Date().toISOString(),

    // 用户偏好
    config: {
      language: config.language || 'zh',
      frequency: config.frequency || 'daily',
      delivery: config.delivery || { method: 'stdout' },
    },

    // 待 remix 的内容（feed 已按公众号分组、含清洗后正文）
    accounts,

    // 统计（feed 已算好，直接透传）
    stats: {
      accountCount: feed?.stats?.accountCount ?? accounts.length,
      articleCount:
        feed?.stats?.articleCount ??
        accounts.reduce((sum, a) => sum + (a.articles?.length || 0), 0),
      fullContentSuccessRate: feed?.stats?.fullContentSuccessRate ?? 1,
      feedGeneratedAt: feed?.generatedAt || null,
    },

    // prompt —— LLM 读这个并照做
    prompts,

    // 非致命错误
    errors: errors.length > 0 ? errors : undefined,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});
