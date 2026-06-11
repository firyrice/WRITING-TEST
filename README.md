# 写作模型评测工具

让多个 AI 模型针对同一道写作题目作答，再用一个评测者模型横向对比、打分、给出 markdown 评测报告。

## 功能

- 多模型并发写作（最多 7 个候选模型同时跑），每个模型独立流式输出
- 用户手动触发评测——所有候选文章一次性打包送给评测者，保证横向可比
- 三种文章预览视图：卡片网格、并排对比、Tab
- 默认匿名评测（评测者看到「模型 A/B/C」），报告渲染时再映射回真实模型名
- 评测可重跑（保留候选文章，仅重新评测）
- 历史任务持久化（IndexedDB），支持导入导出 JSON
- 支持自定义写作 / 评测 Prompt

## 技术栈

React 19 · Vite · TypeScript · Tailwind · zustand · Dexie · marked · DOMPurify · react-router · Vitest · React Testing Library

## 启动

```bash
pnpm install
cp .env.example .env.local        # 填入 VITE_LLM_API_KEY
pnpm dev                           # http://localhost:5173
```

也可以不填环境变量，直接进 `/settings` 页面填写 API Key（保存到 localStorage）。

## 测试

```bash
pnpm test            # 单跑一次（36 个测试，单元 + 集成）
pnpm test:watch
```

## 构建

```bash
pnpm build           # 产出 dist/
pnpm preview         # 本地预览构建产物
```

## 部署

应用是一个静态前端，可部署到任意 CDN / 对象存储 / nginx。

LLM Gateway 走明文 HTTP，dev 通过 Vite 反代到 `/api`。生产部署时建议同源反代到 Gateway，避免 mixed-content 限制（HTTPS 页面调用 HTTP API 会被浏览器拦截）。

## 文档

- 设计文档：[`docs/superpowers/specs/2026-06-11-writing-eval-tool-design.md`](docs/superpowers/specs/2026-06-11-writing-eval-tool-design.md)
- 实施计划：[`docs/superpowers/plans/2026-06-11-writing-eval-tool.md`](docs/superpowers/plans/2026-06-11-writing-eval-tool.md)

## 模型清单

候选模型（在 `src/constants/models.ts` 维护）：

- Claude 4.7 Opus（默认评测者）
- Claude 4.6 Sonnet
- Gemini 3.1 Pro
- Qwen 3.7 Max
- DeepSeek V4 Pro
- GLM 5.1
- Kimi K2.6

加新模型只需修改 `MODELS` 常量。

## 项目结构

```
src/
├── pages/            5 个路由页
├── components/       UI 组件（ui/ 是基础组件）
├── services/         纯逻辑：LLM 调用、SSE 解析、prompt 渲染、别名映射
├── state/            zustand store + 任务编排（含 AbortController）
├── db/               Dexie schema + repo + 节流写盘
├── constants/        模型清单 + 默认 prompt
├── lib/              工具函数
└── types/            类型定义
tests/
├── unit/             services / db / state 单元测试
├── integration/      TaskDetailPage 完整流程
└── fixtures/         测试数据
```
