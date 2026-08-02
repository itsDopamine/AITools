# meta.json 约定

`meta.json` 是知识库的**状态与游标**文件，不是正文。正文在 Markdown。

## 示例

```json
{
  "kb_version": "1.0",
  "title": "简历素材知识库",
  "created_at": "2026-07-30T10:00:00+08:00",
  "updated_at": "2026-07-30T10:00:00+08:00",
  "authors": [
    { "name": "Zhang San", "email": "zhangsan@example.com" },
    { "name": "zhangsan", "email": "" }
  ],
  "date_range": {
    "start": "2024-01-01",
    "end": "2026-07-30"
  },
  "repos": [
    {
      "id": "meeting_web",
      "path": "D:/CodeBase/meeting_web",
      "remote": "git@gitlab.example.com/meeting_web.git",
      "endpoint": {
        "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "committed_at": "2026-07-29T18:00:00+08:00",
        "collected_at": "2026-07-30T10:00:00+08:00"
      },
      "stats": {
        "commits_scanned": 128,
        "work_items": 12
      }
    }
  ],
  "paths": {
    "works": "works",
    "analyses": "analyses",
    "highlights": "project-highlights",
    "changelog": "changelog"
  },
  "notes": "多仓库共用本知识库；增量时以各 repo.endpoint.commit 为排他下界（不含该 commit）。"
}
```

## 字段说明

| 字段 | 含义 |
|------|------|
| `authors` | 用于 `git --author` 的全部别名 |
| `repos[].endpoint.commit` | 该仓库已处理到的最新本人提交（完整 hash） |
| `repos[].endpoint.committed_at` | 该 commit 的提交时间 |
| `date_range` | 知识库覆盖的内容时间窗（初始化或最近一次全量） |

## 增量语义

- 采集区间：`(endpoint.commit, HEAD]` 内、且匹配 authors 的提交
- 更新成功后把 endpoint 推进到新的最新本人提交
- 若 rebase/历史重写导致 endpoint 消失：停止自动推进，在 changelog 告警并请用户指定新起点
