# 脱敏规则

简历素材可能外传，默认按**可对外**标准写。

## 必须处理

| 类型 | 处理方式 |
|------|----------|
| 内部项目/产品代号 | 改为通用名：如「企业会议 Web 端」「纪要 SSR 服务」 |
| 真实客户名 | `某大型客户` / `某金融机构` |
| 未公开 API 完整路径 | 模拟：`POST /api/v1/meetings/{id}/summary`；或只写「纪要生成接口」 |
| 请求/响应里的敏感字段值 | 只保留字段名与含义：`userId`、`meetingDurationSec` |
| 内网域名、IP、端口 | 删除或改为 `https://api.example.com` |
| Token、密钥、工号、邮箱前缀若可定位个人 | 删除 |

## 可以保留

- 公开技术栈（Vue、Nuxt、Electron、WebSocket、Protobuf 等）
- 已公开的产品能力描述
- 相对指标（「耗时降低约 40%」）；绝对内部流水号不要

## 不确定时

写成 `[敏感-待确认]` 占位，并在 changelog 列出，**不要猜测公开**。

## 接口写法示例

❌ `POST https://meeting-inner.wps.cn/api/v3/corp/12345/record/purge`

✅ `POST /api/v1/recordings/cleanup`（关键字段：`retentionDays`, `scope=enterprise`）

✅ 「设计企业录制清理任务接口，支持按保留天数与范围触发清理」
