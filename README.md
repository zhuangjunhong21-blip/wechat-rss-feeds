# wechat-rss-feeds

每天自动抓取订阅的微信公众号文章，产出结构化 JSON feed，供下游 agent（OpenClaw `wechat-digest` skill）拉取并整理成中文日报。

本仓库是**消费总线**：只存放给 agent 消费的结构化数据与 prompt 模板，不含任何原文知识库（原文走私有 Obsidian 库，不上传）。

## 内容

| 文件 | 说明 |
|---|---|
| `feed-articles.json` | 每天由 Mac mini 自动更新的当日新增文章（结构见下） |
| `prompts/digest.md` | 日报生成指令（过滤 + 摘要 + 组装 + 语言，单文件） |

## feed-articles.json 结构

```json
{
  "status": "ok",
  "generatedAt": "2026-05-26T09:07:00+08:00",
  "sourceType": "wechat-mp",
  "stats": {
    "accountCount": 5,
    "articleCount": 12,
    "newArticleCount": 12,
    "fullContentSuccessRate": 1.0
  },
  "accounts": [
    {
      "name": "公众号名",
      "feedId": "数字 id",
      "articles": [
        {
          "title": "...",
          "link": "https://mp.weixin.qq.com/s?...",
          "pubDate": "2026-05-25T21:57:00+08:00",
          "contentText": "清洗后的纯文本正文",
          "contentLength": 3421,
          "hasFullContent": true,
          "hash": "sha256..."
        }
      ]
    }
  ],
  "errors": []
}
```

- `hasFullContent=false` 表示该篇只抓到标题没抓到正文（自部署 IP 偶被微信短封所致）；下游 prompt 应对这类文章降级为"仅标题提示"。
- `stats.fullContentSuccessRate` 低于 0.7 时基本可判定 IP 被封。

## 下游接入（OpenClaw wechat-digest skill）

通过 raw URL 无鉴权拉取：

```
https://raw.githubusercontent.com/zhuangjunhong21-blip/wechat-rss-feeds/main/feed-articles.json
https://raw.githubusercontent.com/zhuangjunhong21-blip/wechat-rss-feeds/main/prompts/digest.md
```

prompts 加载优先级：用户本地 `~/.wechat-digest/prompts/<file>` > 本仓库 remote > skill 内置 fallback。
