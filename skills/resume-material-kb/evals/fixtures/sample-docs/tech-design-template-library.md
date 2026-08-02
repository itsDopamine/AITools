# 【技术方案】模板库 2.0（评测用脱敏样例）

## 背景
会议纪要页需要支持用户上传本地模板并管理版本。

## 方案
- 前端：模板库列表 + 本地上传提示组件
- 接口（内部，勿外泄原文）：`POST https://meeting-inner.corp.local/api/v3/corp/998877/templates/upload`
- 关键字段：`fileName`, `version`, `mimeType`

## 目标
提升模板复用率，减少重复排版。
