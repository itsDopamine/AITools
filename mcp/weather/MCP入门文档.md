# MCP (Model Context Protocol) 入门指南

> 基于实战项目 weather MCP server 的完整学习文档

## 目录

- [1. 什么是 MCP](#1-什么是-mcp)
- [2. 项目结构](#2-项目结构)
- [3. 核心概念](#3-核心概念)
- [4. 代码详解](#4-代码详解)
- [5. 配置与部署](#5-配置与部署)
- [6. 深入理解](#6-深入理解)
- [7. 常见问题](#7-常见问题)
- [8. 参考资源](#8-参考资源)

---

## 1. 什么是 MCP

### 1.1 简介

**Model Context Protocol (MCP)** 是一个开放协议，用于在 LLM 应用（如 Cursor、Claude）和外部数据源、工具之间建立无缝集成。

### 1.2 核心优势

- **标准化接口**：统一的协议规范
- **类型安全**：基于 TypeScript 和 Zod 的类型系统
- **易于集成**：IDE 原生支持（如 Cursor）
- **可扩展性**：支持自定义工具和资源

### 1.3 工作原理

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Cursor IDE │  stdio  │  MCP Server │  HTTP   │ External API│
│             │◄───────►│             │◄───────►│             │
│     AI      │         │   (你的)    │         │  (Weather)  │
└─────────────┘         └─────────────┘         └─────────────┘
```

**通信流程**：
1. 用户在 Cursor 中提问
2. Cursor AI 识别需要调用工具
3. 通过 stdio 调用 MCP Server
4. MCP Server 请求外部 API
5. 返回结果给 Cursor
6. Cursor 展示给用户

---

## 2. 项目结构

### 2.1 典型的 MCP Server 项目结构

```
weather/
├── src/
│   └── index.ts          # MCP Server 主文件
├── build/                # 编译后的 JS 文件
│   └── index.js
├── node_modules/         # 依赖包
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
└── package-lock.json     # 依赖锁定
```

### 2.2 核心依赖

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3",  // MCP SDK
    "zod": "^3.25.76"                         // 参数验证库
  },
  "devDependencies": {
    "@types/node": "^25.0.10",                // Node.js 类型
    "typescript": "^5.9.3"                    // TypeScript
  }
}
```

### 2.3 package.json 关键配置

```json
{
  "type": "module",           // 使用 ES Module
  "bin": {
    "weather": "./build/index.js"  // 可执行文件路径
  },
  "scripts": {
    "build": "tsc"            // 编译命令（跨平台）
  }
}
```

**注意**：原始的 `"build": "tsc && chmod 755 build/index.js"` 在 Windows 上会失败，因为 Windows 没有 `chmod` 命令。应该只使用 `tsc`，权限由 npm 自动处理。

---

## 3. 核心概念

### 3.1 MCP Server

**定义**：一个运行在本地或远程的服务，向 AI 提供工具（tools）和资源（resources）。

**特点**：
- 使用 stdio（标准输入输出）与客户端通信
- 基于 JSON-RPC 2.0 协议
- 支持多个工具注册

### 3.2 Tool (工具)

**定义**：MCP Server 向 AI 暴露的功能单元。

**组成**：
1. **工具名称** (name)：唯一标识符
2. **工具定义** (definition)：描述和参数模式
3. **处理函数** (handler)：实际执行逻辑

### 3.3 Transport (传输层)

**StdioServerTransport**：通过标准输入输出进行通信的传输方式。

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 4. 代码详解

### 4.1 完整代码结构

```typescript
// 1. 导入依赖
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 2. 配置常量
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// 3. 创建 MCP Server
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

// 4. 辅助函数
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  // HTTP 请求逻辑
}

// 5. 类型定义
interface AlertFeature { /* ... */ }
interface ForecastPeriod { /* ... */ }

// 6. 注册工具
server.registerTool("get_alerts", { /* ... */ }, async ({ state }) => {
  // 工具逻辑
});

server.registerTool("get_forecast", { /* ... */ }, async ({ latitude, longitude }) => {
  // 工具逻辑
});

// 7. 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

### 4.2 创建 MCP Server 实例

```typescript
const server = new McpServer({
  name: "weather",      // 服务器名称（必需）
  version: "1.0.0",     // 版本号（必需）
});
```

### 4.3 HTTP 请求辅助函数

```typescript
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,           // 必需：识别请求来源
    Accept: "application/geo+json",     // 必需：指定返回格式
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;  // 失败时返回 null，而不是抛出异常
  }
}
```

**设计要点**：
- 使用泛型 `<T>` 支持不同的返回类型
- 错误捕获并返回 `null`，避免崩溃
- 设置必要的 HTTP 头

### 4.4 TypeScript 接口定义

```typescript
// 警报特征
interface AlertFeature {
  properties: {
    event?: string;        // 事件类型
    areaDesc?: string;     // 区域描述
    severity?: string;     // 严重程度
    status?: string;       // 状态
    headline?: string;     // 标题
  };
}

// 预报时段
interface ForecastPeriod {
  name?: string;           // 时段名称（如 "Tonight"）
  temperature?: number;    // 温度
  temperatureUnit?: string;// 温度单位
  windSpeed?: string;      // 风速
  windDirection?: string;  // 风向
  shortForecast?: string;  // 简短预报
}

// API 响应类型
interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;     // 预报 URL
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}
```

---

## 5. 配置与部署

### 5.1 编译项目

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

编译后生成 `build/index.js` 文件。

### 5.2 配置 Cursor

#### 方法 1：通过 Cursor 设置界面

1. 打开 Cursor Settings
2. 找到 **MCP** 设置
3. 添加自定义 MCP Server

#### 方法 2：手动编辑配置文件

**配置文件位置**：
- Windows: `C:\Users\<用户名>\.cursor\mcp.json`
- macOS/Linux: `~/.cursor/mcp.json`

**配置内容**：

```json
{
  "mcpServers": {
    "weather": {
      "isActive": true,
      "command": "node",
      "args": [
        "E:\\Test\\mcp\\weather\\build\\index.js"
      ],
      "name": "weather"
    }
  }
}
```

**配置说明**：
- `weather`: 服务器标识符（自定义）
- `isActive`: 是否启用
- `command`: 执行命令（直接用 `node`）
- `args`: 参数数组（JS 文件的完整路径）
- `name`: 显示名称

### 5.3 验证连接

配置完成后，检查 MCP server 状态：

```
C:\Users\<用户名>\.cursor\projects\<项目hash>\mcps\user-weather\
├── SERVER_METADATA.json    # 服务器元数据
├── tools\                  # 工具描述文件
│   ├── get_alerts.json
│   └── get_forecast.json
```

如果 `tools/` 目录存在并包含工具定义，说明连接成功！

### 5.4 测试 MCP Server

在 Cursor 对话中测试：

```
用户：帮我查一下纽约（纬度 40.7128，经度 -74.0060）的天气
AI：调用 get_forecast 工具...
结果：显示纽约的天气预报
```

---

## 6. 深入理解

### 6.1 工具注册详解

#### 6.1.1 registerTool 方法签名

```typescript
server.registerTool<OutputArgs, InputArgs>(
  name: string,           // 参数 1：工具名称
  config: {               // 参数 2：工具配置
    title?: string;
    description?: string;
    inputSchema?: InputArgs;
    outputSchema?: OutputArgs;
    annotations?: ToolAnnotations;
    _meta?: Record<string, unknown>;
  },
  callback: ToolCallback<InputArgs>  // 参数 3：处理函数
): RegisteredTool;
```

#### 6.1.2 三大参数详解

##### 参数 1：工具名称 (name)

```typescript
"get_alerts"
```

- **作用**：工具的唯一标识符
- **命名规范**：使用 snake_case
- **注意**：在同一 MCP server 中必须唯一

##### 参数 2：工具配置 (config)

```typescript
{
  description: "Get weather alerts for a state",
  inputSchema: {
    state: z.string().length(2).describe("Two-letter state code")
  }
}
```

**description（工具描述）**：
- 告诉 AI 这个工具的功能
- 影响 AI 是否选择调用此工具
- 应简洁明了

**inputSchema（输入模式）**：
- 定义工具接受的参数
- **必须使用 Zod schema**
- 自动进行运行时验证
- TypeScript 自动推导类型

##### 参数 3：处理函数 (handler)

```typescript
async ({ state }) => {
  // state 的类型已经被 TypeScript 推导
  const stateCode = state.toUpperCase();
  
  // 业务逻辑...
  
  return {
    content: [
      { type: "text", text: "结果文本" }
    ]
  };
}
```

**特点**：
- 参数通过解构获取
- 参数已经过 Zod 验证
- 必须返回特定格式

### 6.2 Zod 验证机制

#### 6.2.1 为什么必须使用 Zod？

从 MCP SDK 类型定义可以看出：

```typescript
// 来自 @modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts
registerTool<
  OutputArgs extends ZodRawShapeCompat | AnySchema,
  InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined
>(...)

// 来自 zod-compat.d.ts
export type ZodRawShapeCompat = Record<string, AnySchema>;
export type AnySchema = z3.ZodTypeAny | z4.$ZodType;
```

**结论**：MCP SDK 强制要求 `inputSchema` 必须是 Zod schema。

#### 6.2.2 Zod 基础用法

```typescript
import { z } from "zod";

// 基础类型
z.string()              // 字符串
z.number()              // 数字
z.boolean()             // 布尔值
z.date()                // 日期
z.undefined()           // undefined
z.null()                // null
z.any()                 // 任意类型

// 字符串验证
z.string()
  .min(1)               // 最小长度
  .max(100)             // 最大长度
  .length(2)            // 精确长度
  .email()              // 邮箱格式
  .url()                // URL 格式
  .regex(/^\d+$/)       // 正则匹配

// 数字验证
z.number()
  .min(0)               // 最小值
  .max(100)             // 最大值
  .int()                // 整数
  .positive()           // 正数
  .negative()           // 负数

// 可选和默认值
z.string().optional()   // 可选字符串
z.number().default(0)   // 默认值为 0

// 对象
z.object({
  name: z.string(),
  age: z.number()
})

// 数组
z.array(z.string())     // 字符串数组

// 枚举
z.enum(["admin", "user", "guest"])

// 联合类型
z.union([z.string(), z.number()])
```

#### 6.2.3 inputSchema 与 handler 的类型关系

**类型推导过程**：

```typescript
// 1. 定义 inputSchema
inputSchema: {
  state: z.string().length(2)
}

// 2. TypeScript 使用 ShapeOutput 推导类型
type InferredType = {
  state: string  // 从 z.string() 推导
}

// 3. handler 自动获得类型
async ({ state }: { state: string }) => {
  // state 的类型是 string，编辑器有智能提示
  state.toUpperCase();  // ✅ OK
  state.toFixed();       // ❌ 错误：string 没有 toFixed
}
```

**核心机制**：

```typescript
// 来自 zod-compat.d.ts
export type ShapeOutput<Shape extends ZodRawShapeCompat> = {
  [K in keyof Shape]: SchemaOutput<Shape[K]>;
};
```

这个类型工具会：
1. 遍历 inputSchema 的每个键
2. 提取每个 Zod schema 的输出类型
3. 组合成最终的参数类型

#### 6.2.4 验证流程

```typescript
// 用户调用
callTool("get_alerts", { state: "CA", extra: "ignored" })
    ↓
// MCP Server 接收
rawInput = { state: "CA", extra: "ignored" }
    ↓
// Zod 验证（来自 safeParse 函数）
result = safeParse(inputSchema, rawInput)
    ↓
// 验证结果
{
  success: true,
  data: { state: "CA" }  // 只包含 schema 中定义的字段
}
    ↓
// 传递给 handler
handler({ state: "CA" })
```

**重要**：
- 只有 `inputSchema` 中定义的字段会被传递
- 额外的字段会被忽略
- 验证失败会自动返回错误，不会调用 handler

### 6.3 返回值格式

#### 6.3.1 CallToolResult 类型

```typescript
// 来自 @modelcontextprotocol/sdk/dist/esm/types.d.ts
export declare const CallToolResultSchema: z.ZodObject<{
  _meta: z.ZodOptional<...>,
  content: z.ZodArray<z.ZodUnion<[
    // text 内容
    z.ZodObject<{
      type: z.ZodLiteral<"text">;
      text: z.ZodString;
      annotations: z.ZodOptional<...>;
      _meta: z.ZodOptional<...>;
    }>,
    // image 内容
    z.ZodObject<{
      type: z.ZodLiteral<"image">;
      data: z.ZodString;      // base64 编码
      mimeType: z.ZodString;  // 如 "image/png"
      annotations: z.ZodOptional<...>;
    }>,
    // audio 内容
    z.ZodObject<{
      type: z.ZodLiteral<"audio">;
      data: z.ZodString;      // base64 编码
      mimeType: z.ZodString;  // 如 "audio/mp3"
      annotations: z.ZodOptional<...>;
    }>,
    // ... 其他内容类型
  ]>>
}>;
```

#### 6.3.2 支持的内容类型

##### 1. text（文本）

```typescript
{
  type: "text",
  text: "这是返回的文本内容"
}
```

##### 2. image（图片）

```typescript
{
  type: "image",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAUA...",  // base64 编码
  mimeType: "image/png"
}
```

支持的图片格式：
- `image/png`
- `image/jpeg`
- `image/gif`
- `image/webp`

##### 3. audio（音频）

```typescript
{
  type: "audio",
  data: "//uQxAAA...",  // base64 编码
  mimeType: "audio/mp3"
}
```

支持的音频格式：
- `audio/mp3`
- `audio/wav`
- `audio/ogg`

#### 6.3.3 返回多个内容块

```typescript
return {
  content: [
    { 
      type: "text", 
      text: "天气预报摘要" 
    },
    { 
      type: "image", 
      data: weatherMapBase64,
      mimeType: "image/png" 
    },
    { 
      type: "text", 
      text: "详细信息..." 
    }
  ]
};
```

### 6.4 完整工具示例

#### 示例 1：get_alerts（天气警报）

```typescript
server.registerTool(
  // 参数 1：工具名称
  "get_alerts",
  
  // 参数 2：工具配置
  {
    description: "Get weather alerts for a state",
    inputSchema: {
      state: z
        .string()
        .length(2)
        .describe("Two-letter state code (e.g. CA, NY)"),
    },
  },
  
  // 参数 3：处理函数
  async ({ state }) => {
    // 1. 转换为大写
    const stateCode = state.toUpperCase();
    
    // 2. 构建 API URL
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    
    // 3. 调用 API
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    // 4. 错误处理
    if (!alertsData) {
      return {
        content: [{
          type: "text",
          text: "Failed to retrieve alerts data",
        }],
      };
    }

    // 5. 检查是否有警报
    const features = alertsData.features || [];
    if (features.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No active alerts for ${stateCode}`,
        }],
      };
    }

    // 6. 格式化警报
    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

    // 7. 返回结果
    return {
      content: [{
        type: "text",
        text: alertsText,
      }],
    };
  }
);
```

#### 示例 2：get_forecast（天气预报）

```typescript
server.registerTool(
  "get_forecast",
  {
    description: "Get weather forecast for a location",
    inputSchema: {
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .describe("Latitude of the location"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location"),
    },
  },
  async ({ latitude, longitude }) => {
    // 第一步：获取网格点数据
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
      return {
        content: [{
          type: "text",
          text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
        }],
      };
    }

    // 获取预报 URL
    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
      return {
        content: [{
          type: "text",
          text: "Failed to get forecast URL from grid point data",
        }],
      };
    }

    // 第二步：获取预报数据
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
      return {
        content: [{
          type: "text",
          text: "Failed to retrieve forecast data",
        }],
      };
    }

    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No forecast periods available",
        }],
      };
    }

    // 格式化预报数据
    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n")
    );

    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

    return {
      content: [{
        type: "text",
        text: forecastText,
      }],
    };
  }
);
```

### 6.5 启动服务器

```typescript
async function main() {
  // 1. 创建 stdio 传输层
  const transport = new StdioServerTransport();
  
  // 2. 连接服务器到传输层
  await server.connect(transport);
  
  // 3. 输出启动消息（使用 stderr，不干扰 MCP 通信）
  console.error("Weather MCP Server running on stdio");
}

// 4. 启动并捕获错误
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

**关键点**：
- 使用 `console.error()` 而不是 `console.log()`
- 因为 stdout 用于 MCP 协议通信
- stderr 用于日志输出

---

## 7. 常见问题

### 7.1 构建问题

**问题**：Windows 上运行 `npm run build` 报错：`'chmod' 不是内部或外部命令`

**原因**：`chmod` 是 Unix/Linux 命令，Windows 不支持

**解决方案**：修改 `package.json`：

```json
// ❌ 错误
"scripts": {
  "build": "tsc && chmod 755 build/index.js"
}

// ✅ 正确（跨平台）
"scripts": {
  "build": "tsc"
}
```

npm 在安装时会自动处理 `bin` 字段中文件的执行权限。

### 7.2 连接问题

**问题**：Cursor 显示 "Connection closed" 或 "No server info found"

**可能原因**：
1. MCP 配置文件中的路径错误
2. 配置中使用了错误的 `command`
3. `build/index.js` 文件不存在或有错误

**诊断步骤**：

1. **手动测试 MCP Server**：
```bash
node build/index.js
# 应该输出：Weather MCP Server running on stdio
# 按 Ctrl+C 退出
```

2. **检查配置文件路径**：
```json
// Windows 路径格式
"args": ["E:\\Test\\mcp\\weather\\build\\index.js"]

// 或使用正斜杠
"args": ["E:/Test/mcp/weather/build/index.js"]
```

3. **检查 command 配置**：
```json
// ✅ 正确：直接运行本地文件
{
  "command": "node",
  "args": ["E:\\Test\\mcp\\weather\\build\\index.js"]
}

// ❌ 错误：试图从 npm 安装不存在的包
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-weather", "..."]
}
```

### 7.3 API 限制

**问题**：查询非美国地区天气失败

**原因**：本项目使用 NWS (National Weather Service) API，只支持美国境内

**解决方案**：使用支持全球的天气 API：
- **OpenWeatherMap**：https://openweathermap.org/api
- **WeatherAPI**：https://www.weatherapi.com（支持中文）
- **Visual Crossing**：https://www.visualcrossing.com

### 7.4 类型错误

**问题**：TypeScript 报错："Property 'xxx' does not exist on type..."

**解决方案**：
1. 确保安装了类型定义：`npm install @types/node`
2. 检查 `tsconfig.json` 配置
3. 使用 TypeScript 接口定义 API 响应类型

### 7.5 Zod 验证失败

**问题**：调用工具时参数验证失败

**诊断**：
```typescript
// 添加调试日志
inputSchema: {
  state: z
    .string()
    .length(2)
    .describe("Two-letter state code")
    .refine((val) => {
      console.error(`Validating state: ${val}`);
      return val.length === 2;
    })
}
```

**常见错误**：
- 参数类型不匹配（如传入数字而期望字符串）
- 参数长度/范围不符合要求
- 缺少必需参数

---

## 8. 参考资源

### 8.1 官方文档

- **MCP 官方网站**：https://modelcontextprotocol.io
- **MCP 规范**：https://modelcontextprotocol.io/specification/latest
- **Schema 参考**：https://modelcontextprotocol.io/specification/2025-11-25/schema
- **MCP SDK (GitHub)**：https://github.com/modelcontextprotocol/typescript-sdk

### 8.2 相关工具文档

- **Zod 官方文档**：https://zod.dev
- **TypeScript 手册**：https://www.typescriptlang.org/docs/
- **Node.js 文档**：https://nodejs.org/docs/

### 8.3 示例项目

- **官方示例**：https://github.com/modelcontextprotocol/servers
- **Cursor MCP 文档**：https://docs.cursor.com/context/mcp

### 8.4 社区资源

- **MCP GitHub 讨论**：https://github.com/modelcontextprotocol/modelcontextprotocol/discussions
- **Discord 社区**：https://discord.gg/modelcontextprotocol（查看最新链接）

---

## 附录 A：完整代码示例

### Weather MCP Server (index.ts)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Create server instance
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

// Register weather tools
server.registerTool(
  "get_alerts",
  {
    description: "Get weather alerts for a state",
    inputSchema: {
      state: z
        .string()
        .length(2)
        .describe("Two-letter state code (e.g. CA, NY)"),
    },
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    if (!alertsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve alerts data",
          },
        ],
      };
    }

    const features = alertsData.features || [];
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No active alerts for ${stateCode}`,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: alertsText,
        },
      ],
    };
  },
);

server.registerTool(
  "get_forecast",
  {
    description: "Get weather forecast for a location",
    inputSchema: {
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .describe("Latitude of the location"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location"),
    },
  },
  async ({ latitude, longitude }) => {
    // Get grid point data
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      };
    }

    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get forecast URL from grid point data",
          },
        ],
      };
    }

    // Get forecast data
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve forecast data",
          },
        ],
      };
    }

    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No forecast periods available",
          },
        ],
      };
    }

    // Format forecast periods
    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n"),
    );

    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: forecastText,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

---

## 附录 B：快速开始检查清单

### 开发环境

- [ ] 安装 Node.js (v18+)
- [ ] 安装 TypeScript (`npm install -g typescript`)
- [ ] 安装 Cursor IDE

### 项目初始化

- [ ] 创建项目目录
- [ ] 运行 `npm init -y`
- [ ] 安装依赖：`npm install @modelcontextprotocol/sdk zod`
- [ ] 安装开发依赖：`npm install -D typescript @types/node`
- [ ] 创建 `tsconfig.json`
- [ ] 创建 `src/index.ts`

### 编写代码

- [ ] 导入必要的依赖
- [ ] 创建 MCP Server 实例
- [ ] 定义 TypeScript 接口
- [ ] 注册工具（至少一个）
- [ ] 实现 main 函数

### 构建和测试

- [ ] 运行 `npm run build`
- [ ] 手动测试：`node build/index.js`
- [ ] 配置 Cursor MCP 设置
- [ ] 重启 Cursor
- [ ] 在对话中测试工具

### 调试

- [ ] 检查 MCP server 状态文件
- [ ] 查看 Cursor 日志
- [ ] 验证工具定义文件生成

---

## 附录 C：术语表

| 术语 | 英文 | 解释 |
|------|------|------|
| **MCP** | Model Context Protocol | 模型上下文协议，连接 AI 和工具的标准协议 |
| **Server** | MCP Server | 提供工具和资源的服务程序 |
| **Tool** | Tool | 暴露给 AI 的功能单元 |
| **Transport** | Transport | 通信传输层，如 stdio、HTTP |
| **stdio** | Standard Input/Output | 标准输入输出，用于进程间通信 |
| **Zod** | Zod | TypeScript 优先的模式验证库 |
| **Schema** | Schema | 数据结构定义 |
| **Handler** | Handler | 处理函数，工具的实际执行逻辑 |
| **JSON-RPC** | JSON-RPC | 基于 JSON 的远程过程调用协议 |

---

## 结语

恭喜！您已经完成了 MCP 入门学习。

通过本文档，您应该掌握了：
- ✅ MCP 的基本概念和工作原理
- ✅ 如何创建一个 MCP Server
- ✅ 如何注册和实现工具
- ✅ 如何配置 Cursor 连接 MCP
- ✅ Zod 验证机制和类型推导
- ✅ 常见问题的解决方法

**下一步建议**：
1. 尝试修改现有工具，添加新功能
2. 创建自己的 MCP Server 连接其他 API
3. 探索 MCP 的高级特性（Resources、Prompts）
4. 参与 MCP 社区讨论和贡献

祝您开发愉快！🚀

---

**文档版本**：v1.0  
**最后更新**：2026-01-29  
**基于项目**：Weather MCP Server
