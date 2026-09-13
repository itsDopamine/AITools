# MCP 通信机制深度解析

> 从用户输入到工具执行的完整流程

## 目录

- [1. Transport 传输层详解](#1-transport-传输层详解)
- [2. 完整通信流程](#2-完整通信流程)
- [3. 工具发现机制](#3-工具发现机制)
- [4. AI 决策过程](#4-ai-决策过程)
- [5. 多 MCP 协同](#5-多-mcp-协同)
- [6. 协议细节](#6-协议细节)

---

## 1. Transport 传输层详解

### 1.1 什么是 StdioServerTransport？

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

**定义**：`StdioServerTransport` 是一个**通信通道**，让 MCP Server 通过标准输入输出（stdin/stdout）与客户端（如 Cursor）进行通信。

### 1.2 Transport 接口

```typescript
// 来自 SDK 类型定义
export interface Transport {
  start(): Promise<void>;                    // 启动传输层
  send(message: JSONRPCMessage): Promise<void>;  // 发送消息
  close(): Promise<void>;                    // 关闭连接
  
  onclose?: () => void;                      // 连接关闭回调
  onerror?: (error: Error) => void;          // 错误回调
  onmessage?: (message: JSONRPCMessage) => void; // 收到消息回调
}
```

### 1.3 StdioServerTransport 实现细节

```typescript
// 来自 SDK 源码
export class StdioServerTransport implements Transport {
  private _stdin: Readable;   // 标准输入流（接收来自 Cursor 的消息）
  private _stdout: Writable;  // 标准输出流（发送消息给 Cursor）
  
  constructor(_stdin?: Readable, _stdout?: Writable) {
    this._stdin = _stdin ?? process.stdin;   // 默认使用 process.stdin
    this._stdout = _stdout ?? process.stdout; // 默认使用 process.stdout
  }
  
  async start(): Promise<void> {
    // 开始监听 stdin 的数据
    this._stdin.on('data', this._ondata);
    this._stdin.on('error', this._onerror);
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    // 将 JSON-RPC 消息写入 stdout
    const jsonString = JSON.stringify(message);
    this._stdout.write(jsonString + '\n');
  }
}
```

### 1.4 为什么需要 Transport？

**必要性**：MCP Server 本身不知道如何与外界通信，Transport 提供了通信能力。

```
┌─────────────────────────┐
│    MCP Server           │
│  (业务逻辑层)           │
│  - 注册工具             │
│  - 处理请求             │
│  - 返回结果             │
└─────────┬───────────────┘
          │ 需要通信通道
          ↓
┌─────────────────────────┐
│    Transport            │
│  (传输层)               │
│  - stdin/stdout 通信    │
│  - HTTP 通信            │
│  - WebSocket 通信       │
└─────────┬───────────────┘
          ↓
    与 Cursor 通信
```

**类比**：
- MCP Server = 大脑（决策和处理）
- Transport = 嘴巴和耳朵（说话和听话）

### 1.5 不创建 Transport 会怎样？

```typescript
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

// 注册工具
server.registerTool(...);

// ❌ 如果不调用 connect()
// await server.connect(transport);  // 缺少这行

// 结果：
// 1. Server 创建成功
// 2. 工具注册成功
// 3. 但是无法与外界通信！
// 4. Cursor 永远无法连接到这个 server
```

**就像**：你造了一台电脑（MCP Server）并安装了软件（工具），但没有连接网线（Transport），所以无法上网。

### 1.6 Transport 如何利用已定义的工具？

```typescript
// 当你调用 connect 时
await server.connect(transport);

// 内部发生的事情：
// 1. Server 将 transport.onmessage 设置为自己的消息处理函数
transport.onmessage = (message) => {
  server._handleMessage(message);  // Server 处理收到的消息
};

// 2. Server 启动 transport
await transport.start();  // 开始监听 stdin

// 3. 当收到 "tools/list" 请求时
// Server 自动遍历所有注册的工具并返回
```

**流程图**：

```
用户在 Cursor 输入问题
    ↓
Cursor 通过 stdin 发送 JSON-RPC 消息
    ↓
StdioServerTransport 监听到数据
    ↓
transport.onmessage(message) 被触发
    ↓
server._handleMessage(message)
    ↓
根据消息类型路由到相应处理器：
  - tools/list → 返回所有注册的工具
  - tools/call → 调用指定工具的 handler
    ↓
结果通过 transport.send() 发送回 Cursor
    ↓
Cursor 接收结果并显示给用户
```

---

## 2. 完整通信流程

### 2.1 初始化阶段（Cursor 启动时）

```
第 1 步：Cursor 读取配置
┌─────────────────────────┐
│ ~/.cursor/mcp.json      │
│ {                       │
│   "mcpServers": {       │
│     "weather": {        │
│       "command": "node",│
│       "args": [...]     │
│     }                   │
│   }                     │
│ }                       │
└──────────┬──────────────┘
           │
第 2 步：启动 MCP Server 进程
           ↓
┌─────────────────────────┐
│ Cursor 执行命令：       │
│ node build/index.js     │
└──────────┬──────────────┘
           │
第 3 步：建立 stdio 连接
           ↓
┌─────────────────────────┐
│ Cursor               ↕  │ stdio 双向通信
│   ↕                     │
│ MCP Server (你的程序)   │
└─────────────────────────┘

第 4 步：初始化握手（JSON-RPC）
Cursor → Server:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "clientInfo": {
      "name": "Cursor",
      "version": "0.x.x"
    }
  }
}

Server → Cursor:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "serverInfo": {
      "name": "weather",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {}  // 声明支持工具
    }
  }
}

第 5 步：工具发现
Cursor → Server:
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}

Server → Cursor:
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_alerts",
        "description": "Get weather alerts for a state",
        "inputSchema": {
          "type": "object",
          "properties": {
            "state": {
              "type": "string",
              "minLength": 2,
              "maxLength": 2,
              "description": "Two-letter state code"
            }
          },
          "required": ["state"]
        }
      },
      {
        "name": "get_forecast",
        "description": "Get weather forecast for a location",
        "inputSchema": {
          "type": "object",
          "properties": {
            "latitude": { "type": "number", "minimum": -90, "maximum": 90 },
            "longitude": { "type": "number", "minimum": -180, "maximum": 180 }
          },
          "required": ["latitude", "longitude"]
        }
      }
    ]
  }
}

第 6 步：Cursor 缓存工具信息
┌─────────────────────────────────────┐
│ Cursor 内存中的工具列表：           │
│ - weather.get_alerts                │
│ - weather.get_forecast              │
│ - other-mcp.some_tool               │
│ - other-mcp.another_tool            │
└─────────────────────────────────────┘
```

### 2.2 用户交互阶段

```
步骤 1：用户输入
┌──────────────────────────────────┐
│ 用户在 Cursor 对话框输入：       │
│ "帮我查一下纽约的天气"           │
└────────────┬─────────────────────┘
             │
步骤 2：AI 分析（在 Cursor 内部）
             ↓
┌──────────────────────────────────┐
│ Claude/GPT 分析用户意图：        │
│                                  │
│ 1. 识别关键词："查"、"天气"     │
│ 2. 提取实体："纽约"              │
│ 3. 查找可用工具                  │
│ 4. 匹配工具描述                  │
│                                  │
│ 可用工具：                       │
│ ✅ get_forecast: 需要经纬度      │
│ ❌ get_alerts: 需要州代码        │
│                                  │
│ 决策：使用 get_forecast          │
│ 问题：需要纽约的经纬度           │
└────────────┬─────────────────────┘
             │
步骤 3：AI 知识查询（可能）
             ↓
┌──────────────────────────────────┐
│ AI 从训练数据中知道：            │
│ 纽约市坐标：                     │
│ - 纬度: 40.7128                  │
│ - 经度: -74.0060                 │
└────────────┬─────────────────────┘
             │
步骤 4：构造工具调用请求
             ↓
┌──────────────────────────────────┐
│ Cursor → MCP Server (通过 stdio)│
│                                  │
│ JSON-RPC 消息：                  │
│ {                                │
│   "jsonrpc": "2.0",              │
│   "id": 123,                     │
│   "method": "tools/call",        │
│   "params": {                    │
│     "name": "get_forecast",      │
│     "arguments": {               │
│       "latitude": 40.7128,       │
│       "longitude": -74.0060      │
│     }                            │
│   }                              │
│ }                                │
└────────────┬─────────────────────┘
             │
步骤 5：MCP Server 接收并处理
             ↓
┌──────────────────────────────────┐
│ StdioServerTransport.onmessage   │
│         ↓                        │
│ Server._handleMessage            │
│         ↓                        │
│ 识别方法: "tools/call"           │
│         ↓                        │
│ 查找工具: "get_forecast"         │
│         ↓                        │
│ 验证参数（Zod）                  │
│   latitude: 40.7128 ✅           │
│   longitude: -74.0060 ✅         │
│         ↓                        │
│ 调用 handler 函数                │
│   async ({ latitude, longitude })│
│         ↓                        │
│ 执行业务逻辑：                   │
│   1. 调用 NWS API                │
│   2. 获取天气数据                │
│   3. 格式化结果                  │
│         ↓                        │
│ 返回结果                         │
└────────────┬─────────────────────┘
             │
步骤 6：返回结果给 Cursor
             ↓
┌──────────────────────────────────┐
│ MCP Server → Cursor (通过 stdio) │
│                                  │
│ JSON-RPC 响应：                  │
│ {                                │
│   "jsonrpc": "2.0",              │
│   "id": 123,                     │
│   "result": {                    │
│     "content": [                 │
│       {                          │
│         "type": "text",          │
│         "text": "Forecast for..."│
│       }                          │
│     ]                            │
│   }                              │
│ }                                │
└────────────┬─────────────────────┘
             │
步骤 7：AI 处理结果并回复用户
             ↓
┌──────────────────────────────────┐
│ Claude/GPT 接收工具返回的数据：  │
│                                  │
│ "Forecast for 40.7128, -74.006:  │
│  Tonight: 6°F, Partly Cloudy     │
│  Thursday: 22°F, Sunny           │
│  ..."                            │
│         ↓                        │
│ AI 生成友好的回复：              │
│                                  │
│ "我查询了纽约的天气预报：        │
│                                  │
│ 🌡️ 今晚：6°F（约-14°C），部分多云│
│ ☀️ 周四：22°F（约-6°C），晴朗    │
│ ..."                             │
└────────────┬─────────────────────┘
             │
步骤 8：显示给用户
             ↓
┌──────────────────────────────────┐
│ 用户在 Cursor 看到回复           │
└──────────────────────────────────┘
```

---

## 3. 工具发现机制

### 3.1 工具列表请求/响应

**请求格式**（Cursor → Server）：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**响应格式**（Server → Cursor）：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_forecast",
        "description": "Get weather forecast for a location",
        "inputSchema": {
          "type": "object",
          "properties": {
            "latitude": {
              "type": "number",
              "minimum": -90,
              "maximum": 90,
              "description": "Latitude of the location"
            },
            "longitude": {
              "type": "number",
              "minimum": -180,
              "maximum": 180,
              "description": "Longitude of the location"
            }
          },
          "required": ["latitude", "longitude"],
          "additionalProperties": false
        }
      }
    ]
  }
}
```

### 3.2 SDK 如何生成工具列表

在您的代码中：

```typescript
server.registerTool(
  "get_forecast",
  {
    description: "Get weather forecast for a location",
    inputSchema: {
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    },
  },
  async ({ latitude, longitude }) => { /* ... */ }
);
```

**SDK 内部处理**：

```typescript
// 伪代码：SDK 内部实现
class McpServer {
  private _tools: Map<string, RegisteredTool> = new Map();
  
  registerTool(name, config, handler) {
    // 1. 将 Zod schema 转换为 JSON Schema
    const jsonSchema = zodToJsonSchema(config.inputSchema);
    
    // 2. 存储工具信息
    this._tools.set(name, {
      name: name,
      description: config.description,
      inputSchema: jsonSchema,
      handler: handler
    });
  }
  
  // 当收到 tools/list 请求时
  async handleToolsList() {
    const tools = Array.from(this._tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
      // 注意：不包含 handler（隐私和安全）
    }));
    
    return { tools };
  }
}
```

**Zod → JSON Schema 转换示例**：

```typescript
// Zod Schema
z.object({
  state: z.string().length(2).describe("Two-letter state code")
})

// 转换为 JSON Schema
{
  "type": "object",
  "properties": {
    "state": {
      "type": "string",
      "minLength": 2,
      "maxLength": 2,
      "description": "Two-letter state code"
    }
  },
  "required": ["state"],
  "additionalProperties": false
}
```

### 3.3 Cursor 的工具缓存

```typescript
// Cursor 内部结构（概念模型）
class CursorMCPManager {
  private toolRegistry = new Map<string, ToolInfo>();
  
  async connectToMCPServer(serverName: string, config: ServerConfig) {
    // 1. 启动 MCP Server 进程
    const process = spawn(config.command, config.args);
    
    // 2. 建立 stdio 通信
    const transport = new StdioTransport(process.stdin, process.stdout);
    
    // 3. 初始化握手
    await this.initialize(transport);
    
    // 4. 获取工具列表
    const response = await transport.request({
      method: "tools/list",
      params: {}
    });
    
    // 5. 缓存工具信息（加上服务器前缀）
    response.tools.forEach(tool => {
      this.toolRegistry.set(
        `${serverName}.${tool.name}`,  // 如 "weather.get_forecast"
        {
          serverName: serverName,
          toolName: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          transport: transport  // 保存通信通道
        }
      );
    });
  }
}
```

---

## 4. AI 决策过程

### 4.1 AI 如何决定是否调用 MCP

```
用户输入："帮我查一下纽约的天气"
    ↓
┌────────────────────────────────────────────┐
│ AI 决策树                                  │
│                                            │
│ 1. 意图识别                                │
│    └─ 关键词："查"、"天气"                 │
│    └─ 意图类型：信息查询                   │
│                                            │
│ 2. 知识来源判断                            │
│    ├─ 训练数据？❌（实时天气不在训练数据中）│
│    ├─ 上下文？❌（对话中没有相关信息）      │
│    └─ 外部工具？✅（需要调用 MCP）         │
│                                            │
│ 3. 工具匹配                                │
│    遍历所有可用工具：                      │
│    ├─ weather.get_forecast                 │
│    │   描述："Get weather forecast..."     │
│    │   匹配度：95% ✅                       │
│    │                                       │
│    ├─ weather.get_alerts                   │
│    │   描述："Get weather alerts..."       │
│    │   匹配度：30% ❌                       │
│    │                                       │
│    └─ browser.navigate                     │
│        描述："Navigate to a URL"           │
│        匹配度：5% ❌                        │
│                                            │
│ 4. 参数提取                                │
│    需要：latitude, longitude               │
│    从用户输入："纽约"                      │
│    └─ 地理知识：纽约 = (40.7128, -74.006) │
│                                            │
│ 5. 决策：调用 weather.get_forecast        │
└────────────────────────────────────────────┘
```

### 4.2 AI 不调用 MCP 的情况

**示例 1：简单问答**

```
用户："什么是 MCP？"
AI 思考：
  - 这是概念性问题
  - 答案在我的训练数据中
  - 不需要实时信息
  ✅ 直接回答，不调用工具
```

**示例 2：缺少必要信息**

```
用户："查一下天气"
AI 思考：
  - 需要调用 get_forecast
  - 但缺少位置信息
  - latitude 和 longitude 是必需参数
  ✅ 先询问用户："请问您想查询哪里的天气？"
```

**示例 3：没有匹配的工具**

```
用户："帮我发送一封邮件"
AI 思考：
  - 需要邮件发送功能
  - 查找可用工具：weather.get_forecast, weather.get_alerts
  - 没有邮件相关的工具
  ✅ 回复："抱歉，我目前没有发送邮件的功能"
```

### 4.3 描述字段的重要性

工具的 `description` 是 AI 决策的关键：

```typescript
// ✅ 好的描述
description: "Get weather forecast for a location"
// AI 可以理解：这个工具用于获取天气预报

// ❌ 不好的描述
description: "Weather"
// AI 无法确定：这是查询天气？还是设置天气？还是分析天气？

// ✅ 更详细的描述
description: "Get detailed 7-day weather forecast for any location using latitude and longitude coordinates. Returns temperature, wind, and conditions."
// AI 更容易判断是否适合用户的需求
```

---

## 5. 多 MCP 协同

### 5.1 可以同时配置多个 MCP 吗？

**答案：可以！**

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["E:/Test/mcp/weather/build/index.js"]
    },
    "database": {
      "command": "node",
      "args": ["E:/Test/mcp/database/build/index.js"]
    },
    "browser": {
      "command": "node",
      "args": ["C:/path/to/browser-mcp/index.js"]
    }
  }
}
```

### 5.2 工具命名空间

```
┌────────────────────────────────────────┐
│ Cursor 的工具注册表                    │
├────────────────────────────────────────┤
│ weather.get_forecast                   │
│ weather.get_alerts                     │
│ database.query                         │
│ database.insert                        │
│ browser.navigate                       │
│ browser.click                          │
└────────────────────────────────────────┘
```

每个工具都有**命名空间前缀**（MCP Server 名称），避免冲突。

### 5.3 同时调用多个 MCP

**场景**：用户问："查询纽约的天气，并把结果保存到数据库"

```
AI 决策：
  1. 需要调用 weather.get_forecast（获取天气）
  2. 需要调用 database.insert（保存数据）
  3. 这两个调用有依赖关系（先获取再保存）

执行流程：
  Step 1: 调用 weather.get_forecast
    Cursor → weather MCP Server
    ↓
    返回天气数据
  
  Step 2: 调用 database.insert
    Cursor → database MCP Server
    传入：天气数据（从 Step 1 获得）
    ↓
    返回：保存成功
  
  Step 3: AI 综合结果回复用户
    "我查询了纽约的天气：[天气信息]，
     并已将数据保存到数据库中。"
```

### 5.4 并行调用多个工具

**场景**：用户问："同时查询纽约和洛杉矶的天气"

```typescript
// AI 可以并行调用
Promise.all([
  callTool("weather", "get_forecast", {
    latitude: 40.7128,
    longitude: -74.0060
  }),
  callTool("weather", "get_forecast", {
    latitude: 34.0522,
    longitude: -118.2437
  })
]).then(results => {
  // 同时得到两个城市的天气
});
```

**通信流程**：

```
Cursor 同时发送两个请求到同一个 MCP Server：

Request #1 (id: 100):
{
  "method": "tools/call",
  "params": { "name": "get_forecast", "arguments": { "latitude": 40.7128, ... } }
}

Request #2 (id: 101):
{
  "method": "tools/call",
  "params": { "name": "get_forecast", "arguments": { "latitude": 34.0522, ... } }
}

MCP Server 并发处理两个请求：
  ├─ Handler #1: async ({ latitude: 40.7128, ... })
  └─ Handler #2: async ({ latitude: 34.0522, ... })

返回两个响应（可能顺序不同）：
Response (id: 101): { "result": { "content": [...] } }  // 洛杉矶
Response (id: 100): { "result": { "content": [...] } }  // 纽约

Cursor 根据 id 匹配请求和响应
```

### 5.5 跨 MCP 协作示例

**复杂场景**：用户："搜索巴黎的天气，截图天气网站，并发送邮件给我"

```
AI 执行计划：
  ┌──────────────────────────────────────┐
  │ Step 1: 调用 browser.navigate       │
  │   MCP: browser                       │
  │   Tool: navigate                     │
  │   Args: { url: "weather.com/paris" } │
  └────────────┬─────────────────────────┘
               ↓
  ┌──────────────────────────────────────┐
  │ Step 2: 调用 browser.screenshot     │
  │   MCP: browser                       │
  │   Tool: take_screenshot              │
  │   Args: {}                           │
  │   Result: base64 图片数据            │
  └────────────┬─────────────────────────┘
               ↓
  ┌──────────────────────────────────────┐
  │ Step 3: 调用 email.send             │
  │   MCP: email                         │
  │   Tool: send_email                   │
  │   Args: {                            │
  │     to: "user@example.com",          │
  │     subject: "巴黎天气截图",         │
  │     attachment: [base64数据]         │
  │   }                                  │
  └──────────────────────────────────────┘

每一步都是独立的 MCP 调用，
AI 协调整个流程并传递数据。
```

---

## 6. 协议细节

### 6.1 JSON-RPC 2.0 消息格式

MCP 使用 JSON-RPC 2.0 协议进行通信。

#### 请求消息

```typescript
interface JSONRPCRequest {
  jsonrpc: "2.0";           // 协议版本
  id: string | number;      // 请求 ID（用于匹配响应）
  method: string;           // 方法名
  params?: object | array;  // 参数
}
```

**示例**：

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "method": "tools/call",
  "params": {
    "name": "get_forecast",
    "arguments": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }
}
```

#### 成功响应

```typescript
interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;      // 对应的请求 ID
  result: any;              // 结果数据
}
```

**示例**：

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Forecast for 40.7128, -74.0060: ..."
      }
    ]
  }
}
```

#### 错误响应

```typescript
interface JSONRPCError {
  jsonrpc: "2.0";
  id: string | number;
  error: {
    code: number;           // 错误代码
    message: string;        // 错误消息
    data?: any;             // 额外信息
  };
}
```

**示例**：

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "validationErrors": [
        "latitude must be between -90 and 90"
      ]
    }
  }
}
```

### 6.2 标准 MCP 方法

| 方法 | 说明 | 调用时机 |
|------|------|----------|
| `initialize` | 初始化连接 | Cursor 启动时 |
| `initialized` | 确认初始化完成 | initialize 后 |
| `tools/list` | 获取工具列表 | 初始化后立即调用 |
| `tools/call` | 调用工具 | 用户需要执行操作时 |
| `resources/list` | 获取资源列表 | 需要访问资源时 |
| `resources/read` | 读取资源 | 需要资源内容时 |
| `prompts/list` | 获取提示词列表 | 需要提示词时 |
| `prompts/get` | 获取提示词内容 | 选择提示词时 |

### 6.3 stdio 通信格式

**消息分隔**：每条消息独占一行，以换行符 `\n` 结束

```
Cursor → MCP Server (stdin):
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}\n
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{...}}\n

MCP Server → Cursor (stdout):
{"jsonrpc":"2.0","id":1,"result":{...}}\n
{"jsonrpc":"2.0","id":2,"result":{"tools":[...]}}\n
{"jsonrpc":"2.0","id":3,"result":{"content":[...]}}\n
```

**StdioServerTransport 的处理逻辑**：

```typescript
// 简化的实现
class StdioServerTransport {
  private _readBuffer = '';
  
  _ondata(chunk: Buffer) {
    // 将新数据加入缓冲区
    this._readBuffer += chunk.toString('utf-8');
    
    // 处理缓冲区中的完整消息
    while (true) {
      const newlineIndex = this._readBuffer.indexOf('\n');
      if (newlineIndex === -1) break;  // 没有完整消息
      
      // 提取一条完整消息
      const messageLine = this._readBuffer.slice(0, newlineIndex);
      this._readBuffer = this._readBuffer.slice(newlineIndex + 1);
      
      // 解析 JSON
      try {
        const message = JSON.parse(messageLine);
        // 触发 onmessage 回调
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }
}
```

### 6.4 完整的消息交换示例

```
时间轴：从 Cursor 启动到工具调用完成

T0: Cursor 启动，读取 mcp.json
    ↓

T1: Cursor 执行命令启动 MCP Server
    Command: node build/index.js
    ↓

T2: MCP Server 进程启动
    执行 main()
    创建 StdioServerTransport
    调用 server.connect(transport)
    调用 transport.start()
    → 开始监听 stdin
    输出到 stderr: "Weather MCP Server running on stdio"
    ↓

T3: Cursor 发送 initialize 请求
    Cursor → Server (stdin):
    {
      "jsonrpc": "2.0",
      "id": "init-1",
      "method": "initialize",
      "params": {
        "protocolVersion": "2025-11-25",
        "clientInfo": {
          "name": "Cursor",
          "version": "0.42.0"
        },
        "capabilities": {}
      }
    }
    ↓

T4: Server 收到并处理 initialize
    transport._ondata() 触发
    → 解析 JSON
    → server._handleMessage()
    → server._handleInitialize()
    
    Server → Cursor (stdout):
    {
      "jsonrpc": "2.0",
      "id": "init-1",
      "result": {
        "protocolVersion": "2025-11-25",
        "serverInfo": {
          "name": "weather",
          "version": "1.0.0"
        },
        "capabilities": {
          "tools": {},
          "logging": {}
        }
      }
    }
    ↓

T5: Cursor 发送 tools/list 请求
    Cursor → Server:
    {
      "jsonrpc": "2.0",
      "id": "tools-1",
      "method": "tools/list",
      "params": {}
    }
    ↓

T6: Server 返回工具列表
    server._handleToolsList()
    → 遍历 this._tools
    → 将 Zod schema 转换为 JSON Schema
    
    Server → Cursor:
    {
      "jsonrpc": "2.0",
      "id": "tools-1",
      "result": {
        "tools": [
          {
            "name": "get_alerts",
            "description": "Get weather alerts for a state",
            "inputSchema": { ... }
          },
          {
            "name": "get_forecast",
            "description": "Get weather forecast for a location",
            "inputSchema": { ... }
          }
        ]
      }
    }
    ↓

T7: Cursor 缓存工具信息，等待用户输入
    [等待中...]
    ↓

T8: 用户输入："帮我查一下纽约的天气"
    ↓

T9: AI 分析并决定调用工具
    → 匹配到 get_forecast
    → 知道纽约坐标
    
    Cursor → Server:
    {
      "jsonrpc": "2.0",
      "id": "call-42",
      "method": "tools/call",
      "params": {
        "name": "get_forecast",
        "arguments": {
          "latitude": 40.7128,
          "longitude": -74.0060
        }
      }
    }
    ↓

T10: Server 处理工具调用
    server._handleToolCall()
    → 查找工具: get_forecast
    → Zod 验证参数: ✅
    → 调用 handler({ latitude: 40.7128, longitude: -74.0060 })
      → makeNWSRequest("https://api.weather.gov/points/40.7128,-74.0060")
      → 解析响应，获取 forecast URL
      → makeNWSRequest(forecastUrl)
      → 格式化数据
    → 返回结果
    
    Server → Cursor:
    {
      "jsonrpc": "2.0",
      "id": "call-42",
      "result": {
        "content": [
          {
            "type": "text",
            "text": "Forecast for 40.7128, -74.0060:\n\nTonight:\nTemperature: 6°F\n..."
          }
        ]
      }
    }
    ↓

T11: AI 处理结果并回复用户
    → 接收工具返回的数据
    → 生成友好的回复
    → 显示给用户
```

---

## 7. 深入理解：代码执行路径

### 7.1 Server 端代码执行路径

```typescript
// 用户代码：src/index.ts
async function main() {
  const transport = new StdioServerTransport();  // ← 这里
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}
```

**执行路径详解**：

```
1. new StdioServerTransport()
   ├─ 创建实例
   ├─ 设置 _stdin = process.stdin
   ├─ 设置 _stdout = process.stdout
   └─ 初始化 _readBuffer = ''

2. server.connect(transport)
   ├─ 保存 transport 引用
   ├─ 设置回调：
   │  ├─ transport.onmessage = (msg) => this._handleMessage(msg)
   │  ├─ transport.onerror = (err) => this._handleError(err)
   │  └─ transport.onclose = () => this._handleClose()
   ├─ 调用 transport.start()
   │  └─ stdin.on('data', this._ondata)  ← 开始监听
   └─ 发送就绪通知（如果需要）

3. 等待消息...

4. 当 Cursor 通过 stdin 发送数据：
   process.stdin.emit('data', buffer)
   ↓
   transport._ondata(buffer)
   ├─ 将数据加入 _readBuffer
   ├─ 查找换行符
   ├─ 提取完整的 JSON 行
   ├─ JSON.parse()
   └─ 触发 transport.onmessage(message)
      ↓
      server._handleMessage(message)
      ├─ 根据 message.method 路由：
      │  ├─ "initialize" → _handleInitialize()
      │  ├─ "tools/list" → _handleToolsList()
      │  ├─ "tools/call" → _handleToolCall()
      │  └─ ...
      └─ 生成响应 → transport.send(response)
         ├─ JSON.stringify(response)
         └─ stdout.write(json + '\n')  ← 发送回 Cursor
```

### 7.2 工具调用的详细执行

```typescript
// 当收到 tools/call 消息时
async _handleToolCall(message: JSONRPCRequest) {
  const { name, arguments: args } = message.params;
  
  // 1. 查找工具
  const tool = this._tools.get(name);
  if (!tool) {
    return this._sendError(message.id, -32601, `Tool not found: ${name}`);
  }
  
  // 2. 验证参数（Zod）
  const result = safeParse(tool.inputSchema, args);
  if (!result.success) {
    return this._sendError(message.id, -32602, `Invalid params: ${result.error}`);
  }
  
  // 3. 调用 handler
  try {
    const handlerResult = await tool.handler(result.data, {
      // 额外的上下文信息
      requestId: message.id,
      // ...
    });
    
    // 4. 返回结果
    this._sendResponse(message.id, handlerResult);
  } catch (error) {
    this._sendError(message.id, -32000, error.message);
  }
}
```

**具体到您的 get_forecast 工具**：

```typescript
server.registerTool(
  "get_forecast",
  { /* config */ },
  async ({ latitude, longitude }) => {  // ← handler 函数
    // 👇 这里是您的业务逻辑
    const pointsUrl = `${NWS_API_BASE}/points/${latitude},${longitude}`;
    const pointsData = await makeNWSRequest(pointsUrl);
    // ...
    return {
      content: [{ type: "text", text: forecastText }]
    };
  }
);
```

**执行时的调用栈**：

```
process.stdin (Cursor 的输入)
  ↓
StdioServerTransport._ondata()
  ↓
StdioServerTransport.onmessage()
  ↓
McpServer._handleMessage()
  ↓
McpServer._handleToolCall()
  ↓
safeParse(inputSchema, arguments)  // Zod 验证
  ↓
tool.handler({ latitude: 40.7128, longitude: -74.0060 })  // 👈 您的代码！
  ↓
  makeNWSRequest(pointsUrl)
  ↓
  fetch("https://api.weather.gov/points/40.7128,-74.0060")
  ↓
  处理响应
  ↓
  return { content: [...] }
  ↓
McpServer._sendResponse()
  ↓
StdioServerTransport.send()
  ↓
process.stdout.write(json + '\n')  // 发送回 Cursor
```

---

## 8. 总结

### 8.1 关键要点

1. **Transport 是必需的**：它是 MCP Server 与外界通信的唯一通道
   
2. **stdio 是最常用的传输方式**：通过标准输入输出进行进程间通信

3. **工具发现是自动的**：Cursor 在启动时会自动获取所有工具列表

4. **AI 负责决策**：是否调用工具、调用哪个工具由 AI 根据用户意图和工具描述判断

5. **可以同时使用多个 MCP**：每个 MCP 独立运行，工具有命名空间隔离

6. **JSON-RPC 2.0 协议**：所有通信都遵循标准协议格式

### 8.2 核心流程回顾

```
用户输入
  ↓
AI 分析意图
  ↓
查找匹配的工具（从已缓存的工具列表）
  ↓
构造 tools/call 请求
  ↓
通过 stdio 发送到 MCP Server
  ↓
Transport 接收消息
  ↓
Server 路由到对应的处理器
  ↓
Zod 验证参数
  ↓
调用 handler 函数（您的代码）
  ↓
返回结果
  ↓
通过 stdio 发送回 Cursor
  ↓
AI 处理结果
  ↓
生成友好回复
  ↓
显示给用户
```

### 8.3 理解检查清单

- [ ] 理解 Transport 的作用（通信通道）
- [ ] 理解 stdio 通信机制（stdin/stdout）
- [ ] 理解工具发现流程（tools/list）
- [ ] 理解 AI 决策过程（意图识别 + 工具匹配）
- [ ] 理解多 MCP 协同（命名空间 + 并行调用）
- [ ] 理解 JSON-RPC 协议（请求/响应格式）
- [ ] 理解完整的消息流转路径

---

## 附录：调试技巧

### A1. 查看 stdio 通信

**临时修改代码，打印所有通信消息**：

```typescript
// src/index.ts
async function main() {
  const transport = new StdioServerTransport();
  
  // 拦截 onmessage，打印接收的消息
  const originalOnMessage = transport.onmessage;
  transport.onmessage = (message) => {
    console.error('[RECV]', JSON.stringify(message, null, 2));
    originalOnMessage?.call(transport, message);
  };
  
  // 拦截 send，打印发送的消息
  const originalSend = transport.send.bind(transport);
  transport.send = async (message) => {
    console.error('[SEND]', JSON.stringify(message, null, 2));
    return originalSend(message);
  };
  
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}
```

### A2. 手动测试 MCP Server

**创建测试脚本**：

```javascript
// test-mcp.js
import { spawn } from 'child_process';

const mcp = spawn('node', ['build/index.js']);

// 发送初始化请求
mcp.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    clientInfo: { name: "test", version: "1.0.0" }
  }
}) + '\n');

// 发送工具列表请求
mcp.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
}) + '\n');

// 发送工具调用请求
mcp.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "get_forecast",
    arguments: {
      latitude: 40.7128,
      longitude: -74.0060
    }
  }
}) + '\n');

// 监听输出
mcp.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

mcp.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});
```

运行：`node test-mcp.js`

---

**文档版本**：v1.0  
**最后更新**：2026-01-29  
**相关文档**：MCP入门文档.md
