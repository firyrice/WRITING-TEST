# 写作领域 AI 模型评测工具 — 设计文档

- **状态**：草案 v1
- **日期**：2026-06-11
- **作者**：xuxixi（与 Kiro 协作 brainstorming）

## 1. 项目目标

构建一个面向**写作领域**的 AI 模型横向评测工具。一次任务包含两个角色：

- **测试者**：多个候选模型，针对同一道写作题目各自产出一篇文章。
- **评测者**：单个模型，拿到所有候选文章后**一次性**横向对比、打分、出报告、选冠军。

核心约束：

- 评测时**所有候选文章必须放在同一个请求里**喂给评测者，保证横向对比的可比性。
- 写作 Prompt 在一次任务内对所有测试者保持一致。
- 写作完成后必须由用户**手动点击**【自动评测】才进入评测阶段，不自动触发。
- 任务可保存、可重新打开、可导入导出。

## 2. 用户故事

1. **创建任务**：填一道写作题，从 7 个候选模型里勾几个，可改评测 Prompt，点开始。
2. **观察写作**：每个被勾选的模型有自己的卡片，流式打字机效果实时显示文章。
3. **预览对比**：所有模型写完后，能切"卡片网格 / 并排对比 / Tab"三种视图阅读、对比文章。
4. **触发评测**：点【🎯 自动评测】，评测者一次拿到所有文章，流式输出 markdown 报告。
5. **查看历史**：之前的任务能在 /history 列表里再次打开，含完整文章和报告。
6. **重新评测**：保留候选文章不变，仅重跑评测者（适合换 prompt 试）。
7. **导入导出**：单个任务或全部任务能导出 JSON，便于备份和分享。

## 3. 关键决策

| 决策 | 选定 | 理由 |
| --- | --- | --- |
| 运行形态 | 纯前端 Web 应用 | 零后端、最简部署 |
| 多模型调用 | 全部并行（Promise.allSettled） | 单模型失败不拖累整体 |
| 评测输出 | 纯 markdown 报告 | 渲染简单、人读友好 |
| 默认评测维度 | 文采 / 逻辑结构主题 / 创意情感 / 可读事实 | 4 维覆盖写作主要面向 |
| 历史存储 | IndexedDB + 手动导出导入 JSON | 零后端 + 可备份 |
| 流式输出 | 开启（fetch + ReadableStream） | 体感好 |
| API key | 环境变量 + localStorage 双轨 | 开发部署皆友好 |
| 匿名评测 | 默认开，可在设置中关 | 减少品牌偏见 |
| 技术栈 | React 19 + Vite + Tailwind + zustand + Dexie | 工具型 SPA 甜蜜区 |

## 4. 整体架构

单页应用，所有计算在浏览器内完成。

```
┌─────────────────────────────────────────────────────────┐
│                   React App (浏览器)                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │  pages   │  │  state   │  │ services │  │   db     ││
│  │          │  │          │  │          │  │          ││
│  │ Home     │  │ taskStore│  │ llmClient│  │ taskRepo ││
│  │ NewTask  │  │ runner   │  │ scoring  │  │ (Dexie)  ││
│  │ Detail   │  │ settings │  │ promptR. │  │ flusher  ││
│  │ History  │  │          │  │ aliasMap │  │          ││
│  │ Settings │  │          │  │ sse      │  │          ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│         │           │             │             │        │
│         └───────────┴──────┬──────┴─────────────┘        │
│                            │                             │
└────────────────────────────┼─────────────────────────────┘
                             │ fetch + ReadableStream (SSE)
                             ▼
              http://llmapi.bilibili.co/v1
              (OpenAI-compatible Gateway)
```

**模块边界**

- `services/`：纯逻辑，不依赖 React 和 zustand。便于单元测试。
- `state/`：React 与 services 的桥；调用 services、dispatch 到 zustand store。
- `db/`：Dexie 封装；只接收主键和数据，不知道 store 存在。
- `pages/`：通过 `state/` 暴露的 hook 拿数据，不直接调 services。

**CORS / 反代**：示例 Gateway 是明文 HTTP。Vite dev 配置 `/api -> http://llmapi.bilibili.co` 反代，规避 CORS 与未来上 https 时的混合内容拦截。生产部署文档里说明保持同源或反代。

## 5. 数据模型

### Task

```ts
type TaskStatus =
  | 'idle'           // 创建中
  | 'writing'        // 测试者正在写
  | 'writing_done'   // 全部写完，等用户点自动评测
  | 'judging'        // 评测者正在跑
  | 'done'           // 完成
  | 'error';         // 整体失败（仅在创建/初始化阶段）

type Task = {
  id: string;                    // uuid
  createdAt: number;
  updatedAt: number;
  title: string;                 // 默认取 writingPrompt 前 30 字
  status: TaskStatus;

  writingPrompt: string;         // 写作题目（每个测试者拿到的就是它）
  judgePrompt: string;           // 评测 Prompt 模板，含 {{writing_prompt}} 和 {{articles}} 占位符
  judgeModel: string;            // 默认 'claude-4.7-opus'
  anonymize: boolean;            // 默认 true

  candidates: Candidate[];       // 7 个模型里勾的那几个

  judgeResult?: {
    rawMarkdown: string;
    renderedAt: number;
    durationMs: number;
    error?: string;
  };
};

type Candidate = {
  modelId: string;               // 'gemini-3.1-pro' 等
  alias: string;                 // 匿名时用 '模型 A' / '模型 B' / ...
  status: 'pending' | 'streaming' | 'done' | 'error';
  article: string;               // 流式拼接的实时内容
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
};
```

### Settings（单例）

```ts
type Settings = {
  apiKey: string;                          // 来源优先级：localStorage > VITE_LLM_API_KEY
  apiBaseUrl: string;                      // 默认 '/api/v1'（dev 反代）或 'http://llmapi.bilibili.co/v1'
  defaultWritingPrompt: string;
  defaultJudgePrompt: string;
  defaultSelectedModels: string[];
  defaultJudgeModel: string;               // 默认 'claude-4.7-opus'
  defaultAnonymize: boolean;               // 默认 true
};
```

### ModelCatalog（静态常量）

```ts
const MODELS = [
  { id: 'claude-4.7-opus',    label: 'Claude 4.7 Opus',    family: 'claude' },
  { id: 'claude-4.6-sonnet',  label: 'Claude 4.6 Sonnet',  family: 'claude' },
  { id: 'gemini-3.1-pro',     label: 'Gemini 3.1 Pro',     family: 'gemini' },
  { id: 'qwen3.7-max',        label: 'Qwen 3.7 Max',       family: 'qwen' },
  { id: 'deepseek-v4-pro',    label: 'DeepSeek V4 Pro',    family: 'deepseek' },
  { id: 'glm-5.1',            label: 'GLM 5.1',            family: 'glm' },
  { id: 'kimi-k2.6',          label: 'Kimi K2.6',          family: 'kimi' },
];
```

加新模型：改这一份常量。

## 6. LLM 调用层

### 写作调用（每个测试者一次）

```ts
async function streamWriting(opts: {
  modelId: string;
  prompt: string;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
  onChunk: (delta: string) => void;
}): Promise<{ fullText: string }>
```

- 直接 `fetch` 调 `/chat/completions`，**不引 OpenAI SDK**（在浏览器需 dangerouslyAllowBrowser，体积超 100KB）。
- 解析 `text/event-stream`：`response.body!.getReader()` + `TextDecoder`，按 `\n\n` 切 SSE block，提取 `data: {...}` 中的 `choices[0].delta.content`。
- system prompt 固定为「你是一位专业的写作助手。」（先固定不暴露）。
- HTTP 非 200 → 抛 `LLMError(modelId, status, body)`。
- 流中途断了：保留已收到的内容，状态置 `error`，不影响其他模型。

### 7 路并发编排

```ts
async function runWritingPhase(task: Task, signal: AbortSignal) {
  await Promise.allSettled(
    task.candidates.map(c =>
      streamWriting({ ...c, signal, onChunk: delta => taskStore.appendDelta(task.id, c.modelId, delta) })
        .then(({ fullText }) => taskStore.markCandidateDone(task.id, c.modelId, fullText))
        .catch(err => taskStore.markCandidateError(task.id, c.modelId, err.message))
    )
  );
  taskStore.setStatus(task.id, 'writing_done');
}
```

**`Promise.allSettled` 而非 `Promise.all`**：单模型挂掉不能拖累全场。

### 评测调用（一次性把所有文章打包）

**关键：单次调用，所有候选文章拼在一个 user message 里**，保证横向对比可比。

prompt 模板渲染：把 `judgePrompt` 中的 `{{articles}}` 替换为：

```
## 模型 A 的作品
<article>
... 文章正文 ...
</article>

## 模型 B 的作品
<article>
... 文章正文 ...
</article>

...
```

- 匿名时 `alias` 走 A/B/C/D/E/F/G；非匿名时直接用模型名。
- 失败的候选注入为 `（生成失败：错误信息）`，prompt 里说明"如某个模型为'生成失败'，请在评分中如实指出"。
- 评测者也走 streaming，结果实时往 `judgeResult.rawMarkdown` 追加。
- 报告渲染层做 alias→真实模型名替换（即使匿名也能在最终报告里看到真名）。

### 默认评测 Prompt

```
你是一位资深的中文写作评测专家。下面是几位 AI 模型针对同一道写作题目交出的答卷，请你横向对比、打分并选出最佳。

## 写作题目
{{writing_prompt}}

## 各模型的作品
{{articles}}

请按以下要求输出 markdown 评测报告：

1. **评分总表**：用 markdown 表格，每行一个模型，列出 4 个维度的分数（10 分制）和总分（加权平均）：
   - 文采与语言表达
   - 逻辑、结构与主题切合
   - 创意与情感感染力
   - 可读性与事实准确性
2. **逐篇点评**：每个模型一段 100~200 字的具体评语，引用原文佐证。
3. **横向对比**：哪些模型擅长什么、短板在哪、风格差异。
4. **冠军与理由**：明确指出最佳模型，并给出 3 条核心理由。

请严格保持中立，不要因为模型名称（如出现）产生偏见。
若某模型标注为"生成失败"，请在评分中如实给出 0 分并在点评中说明。
```

## 7. UI 流程与页面

### 路由

```
/                  HomePage          引导到新建/历史/设置
/new               NewTaskPage       表单：writing prompt + 模型勾选 + 评测设置
/task/:id          TaskDetailPage    写作 + 评测主战场
/history           HistoryPage       历史任务列表
/settings          SettingsPage      API key / 默认 prompt / 默认勾选
```

### 完整用户流程

1. 首次访问，若 API key 既未在 localStorage 也未在环境变量中 → 引导去 /settings 配。
2. 点【新建任务】→ /new
   - 写作 Prompt 输入框（默认填上次用过的）
   - 模型勾选 7 个 checkbox（默认勾上次勾的）
   - 评测者模型下拉（默认 claude-4.7-opus）
   - 匿名评测开关（默认开）
   - 折叠的"评测 Prompt"高级编辑区
   - 【开始测试】按钮
3. 点【开始测试】→ 创建 Task 入库 → 跳 /task/:id。
4. **写作阶段**
   - 顶部状态条："正在写作 3/7 已完成"
   - 候选 grid，每个模型独立卡片，**实时流式追加文章**
   - 任意时刻可点【取消】abort 所有未完成的请求
5. **全部写完（writing_done）**
   - 状态条变"全部完成，请点击自动评测"
   - 出现【🎯 自动评测】按钮
   - 用户可在此**停留任意时间**预览各模型作品，对比阅读
6. 点【自动评测】→ judging
   - 报告区域出现流式 markdown 渲染框，边出边渲染
7. **完成态（done）**
   - 报告永久展示
   - 顶部右侧【⟳ 重新评测】（保留候选文章，仅重跑 judging）
   - 【⤓ 导出 JSON】：导出整个 Task 对象（含 writingPrompt / judgePrompt / candidates 全文 / judgeResult），不含 Settings；【⤒ 导入】支持单任务文件或全量任务数组
8. /history
   - 时间倒序的任务卡列表
   - 顶部【⤒ 导入】【⤓ 全部导出】

### 关键交互细节

- **任务一旦开始就立即入库**：刷新页面，回到 /task/:id 仍能看到已生成的内容。
- **不允许同一 Task 重复跑写作**：`status === 'writing_done'` 后，「开始测试」按钮消失；想重跑得新建任务，保护已有产出。
- **评测可重跑无数次**：judging 不影响候选数据。
- **错误友好**：单个模型 fail 时卡片显示红色错误条 + 重试按钮（仅重试这一个模型）。

### 视图切换器（Detail 页核心组件）

- **卡片网格**（默认）：3 列 grid，每张卡显示前几行 + 展开按钮。
- **并排对比**：横向滚动，每模型一列，文章全文上下铺开，便于精读对比。
- **Tab**：上方一排 tab，下方一个大区显示当前选中模型的全文。
- 三种视图共享同一份候选数据，纯前端切换。

### 视觉风格

- Tailwind + 一组极简 shadcn 风格组件。
- 中性色：白底 + 灰阶文字 + 主色 `#5b6cff`（主按钮、状态条、冠军徽章）。
- 卡片：细边框 + 4px 圆角，无阴影。
- 状态色：pending=灰、writing=蓝（脉冲）、done=绿、error=红。
- 不引图标库；emoji（🎯 ⏱ ✅ ❌ ⏳ ⟳ ⤓ ⤒）即可。

## 8. 状态机与并发控制

### 任务级状态机

```
       ┌──────────────────────────────────────┐
       ▼                                      │
   [idle] ─ start ─→ [writing] ──┬─ all settled ──→ [writing_done]
                                 │                       │
                                 │                  click 自动评测
                                 │                       ▼
                                 │                    [judging]
                                 │                       │
                                 │                    done│
                                 │                       ▼
                                 │                    [done]
                                 │                       ▲
                                 │       click 重新评测  │
                                 │                       │
                                 └───────────────────────┘
```

**规则**

- 进入 `writing_done` 的条件：所有候选状态都不再是 `pending`/`streaming`（即每个候选要么 `done` 要么 `error`）。
- 单模型失败不阻断整体进入 `writing_done`；评测 prompt 里如实标注失败。
- `writing_done → judging` **必须用户手动点击**。
- `judging` 失败不污染候选数据，可重跑无数次。

### 并发控制

```ts
class TaskRunner {
  private writingControllers = new Map<string, AbortController>();
  private judgingControllers = new Map<string, AbortController>();

  async startWriting(taskId: string) {
    const ac = new AbortController();
    this.writingControllers.set(taskId, ac);

    const task = await db.tasks.get(taskId);
    setStatus(taskId, 'writing');

    await Promise.allSettled(
      task.candidates.map(c =>
        streamWriting({ ...c, signal: ac.signal, onChunk: ... })
          .then(({ fullText }) => markCandidateDone(taskId, c.modelId, fullText))
          .catch(err => markCandidateError(taskId, c.modelId, err))
      )
    );

    this.writingControllers.delete(taskId);
    setStatus(taskId, 'writing_done');
  }

  cancelWriting(taskId: string) {
    this.writingControllers.get(taskId)?.abort();
  }
  // judging 同理
}
```

**为什么 controller 在 store 内部 Map 而不是 React state**：用户切到 /history 再切回来，写作还在跑——controller 不应跟组件 unmount 一起被清掉。

### 持久化策略

- 流过程中：内存 `taskStore.candidates[i].article` 累积，UI 直接读它。
- **节流写盘**：每 1.5 秒 flush 一次最新文章到 IndexedDB；候选 done/error 时立即 flush。
- 用户主动刷新：可能丢最近 1.5 秒以内的内容，但 done 后必完整。

### 错误恢复

- **网络断开 / API key 失效**：单候选 markCandidateError，UI 卡片显示错误 + 【重试】（只重启这一个）。
- **页面刷新中途**：rehydrate 最新 IndexedDB；如果 status 仍为 `writing` 且无活跃 controller，UI 显示"写作已中断"+ 【继续未完成的模型】（重新跑 status 还是 pending/streaming 的候选）。
- **API 限流（429）**：错误信息显示 + 重试按钮，**不自动重试**避免雪崩。

## 9. 测试策略

### 必测的纯逻辑（单元测试，Vitest）

1. **`services/sse.ts` SSE 解析器**
   - 单条 `data: {...}\n\n` 解析正确
   - 跨 chunk 边界（一个 SSE 事件被拆成两次 read 返回）
   - `data: [DONE]` 终止
   - 损坏的 data 行被跳过且记录 warning
2. **`services/promptRender.ts`**
   - `{{writing_prompt}}` 被替换
   - `{{articles}}` 注入候选文章 + 别名
   - 匿名 vs 非匿名的差异
   - 失败候选标注为"生成失败"
3. **`services/aliasMap.ts`**
   - 7/4 候选的 alias 分配（A/B/C/D...，不跳号）
   - 报告 markdown 渲染时 alias→真实模型名替换正确，不误伤"模型 ABC"连写
4. **`db/taskRepo.ts`**
   - CRUD
   - 节流 flusher 不丢最后一帧
   - export → import 字节级等价
5. **`state/taskRunner.ts`**
   - 全部 done → `writing_done`
   - 部分 error + 部分 done → 仍 `writing_done`（不是 `error`）
   - 全部 error → 仍 `writing_done`（评测层处理边界）
   - cancelWriting 后所有候选状态被冻结

### 集成测试（Vitest + RTL + MSW）

```
test('完整流程：勾 3 个模型 → 全部完成 → 自动评测 → 报告渲染', ...);
test('一个模型失败时，其余仍完成且能进入评测', ...);
```

MSW 拦截 `/v1/chat/completions`，mock 流式响应。

### 不测的部分

- 视图切换器（纯 CSS，目测）
- 设置页表单（controlled 输入，目测）
- 历史导入导出端到端（repo 层单测覆盖即可）

### 测试栈

- **Vitest**：单元 + 集成
- **@testing-library/react**：组件渲染
- **MSW**：mock fetch 流式响应（支持 ReadableStream）

## 10. 文件结构

```
writing-test/
├── README.md
├── package.json
├── vite.config.ts                    # /api → llmapi.bilibili.co 反代
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── .env.example                      # VITE_LLM_API_KEY=...
├── .gitignore
│
├── docs/superpowers/specs/
│   └── 2026-06-11-writing-eval-tool-design.md
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── NewTaskPage.tsx
│   │   ├── TaskDetailPage.tsx
│   │   ├── HistoryPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── components/
│   │   ├── ui/                       # Button / Card / Tabs / Textarea / Checkbox / Select / Dialog
│   │   ├── ModelCheckboxGrid.tsx
│   │   ├── CandidateCard.tsx
│   │   ├── CandidateGrid.tsx
│   │   ├── CandidateSplitView.tsx
│   │   ├── CandidateTabView.tsx
│   │   ├── ViewSwitcher.tsx
│   │   ├── ReportPanel.tsx
│   │   ├── PromptEditor.tsx
│   │   ├── StatusBadge.tsx
│   │   └── TaskListItem.tsx
│   │
│   ├── services/
│   │   ├── llmClient.ts
│   │   ├── sse.ts
│   │   ├── scoring.ts
│   │   ├── promptRender.ts
│   │   ├── aliasMap.ts
│   │   └── errors.ts
│   │
│   ├── state/
│   │   ├── taskStore.ts
│   │   ├── taskRunner.ts
│   │   └── settingsStore.ts
│   │
│   ├── db/
│   │   ├── schema.ts
│   │   ├── taskRepo.ts
│   │   └── flusher.ts
│   │
│   ├── constants/
│   │   ├── models.ts
│   │   └── defaultPrompts.ts
│   │
│   └── lib/
│       ├── markdown.ts               # marked 配置 + 安全渲染
│       ├── format.ts
│       └── id.ts
│
└── tests/
    ├── unit/
    │   ├── sse.test.ts
    │   ├── promptRender.test.ts
    │   ├── aliasMap.test.ts
    │   ├── taskRepo.test.ts
    │   └── taskRunner.test.ts
    ├── integration/
    │   └── TaskDetailPage.test.tsx
    └── fixtures/
        ├── sse-responses.ts
        └── sample-articles.ts
```

## 11. 配置与部署

### 环境变量（`.env.local`）

```
VITE_LLM_API_KEY=bsk-xxxxxxxxxxxxxxxxxxxxxxxx
VITE_LLM_BASE_URL=http://llmapi.bilibili.co/v1
```

API key 优先级：`localStorage` > 环境变量。Settings 页留空时从环境变量取。

### Vite 反代（dev）

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://llmapi.bilibili.co',
      changeOrigin: true,
      rewrite: p => p.replace(/^\/api/, ''),
    },
  },
},
```

dev 下 `apiBaseUrl` 默认 `/api/v1`；生产部署若同源反代亦同；若直连则 `http://llmapi.bilibili.co/v1`。

### 启动命令

```bash
pnpm install
pnpm dev          # 开发
pnpm build        # 产出 dist/
pnpm test         # 单元 + 集成
pnpm test:watch
```

## 12. 范围之外（YAGNI）

明确不做的事，避免本期失焦：

- 多评测者投票 / 评测者 ensemble
- 写作任务定时执行 / 批量执行
- 用户系统、协作、分享链接
- 模型温度 / max_tokens 等参数微调（先用 gateway 默认值）
- 评测分数的可视化图表（雷达图等；先用 markdown 表格）
- 移动端适配（最小可用即可，主要面向桌面）
- 暗色模式

如有强需求，后续单独立项。
