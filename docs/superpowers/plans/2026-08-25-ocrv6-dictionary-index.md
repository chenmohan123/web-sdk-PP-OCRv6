# PP-OCRv6 字符表索引修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 PP-OCRv6 recognition 字典因丢失全角空格导致的中文索引错位，并在生成和运行时建立长度校验。

**Architecture:** 保留官方 `inference.yml` 字符表的每个 Unicode 字符，重新生成三个字典；SDK 加载字典后使用 recognition 输出类别数减去 blank 类别数校验长度，并在 manifest 声明时交叉校验 `dictionaryEntries`。模型权重和 CTC 解码流程不变。

**Tech Stack:** Node.js 脚本、TypeScript SDK、Vitest、Node test runner、pnpm。

---

### Task 1: 增加字符表生成回归测试

**Files:**
- Create: `scripts/dictionary-contract.test.mjs`
- Modify: `package.json`（将测试加入 `test` 或 `verify` 流程）

- [ ] **Step 1: 写失败测试**

测试读取 `models/pp-ocrv6/1.0.0/metadata/PP-OCRv6_*_rec/inference.yml` 和对应字典，使用与抓取脚本相同的 YAML 列表规则提取字符，断言 medium/small 为 18708 项、tiny 为 6904 项，且全角空格索引分别为 1748/616，最后一个字符一致。

- [ ] **Step 2: 运行测试确认当前失败**

运行：`node --test scripts/dictionary-contract.test.mjs`

预期：失败，报告生成字典比官方字符表少一项且全角空格缺失。

- [ ] **Step 3: 将测试接入仓库验证**

在根 `package.json` 的 `test` 脚本中加入该 Node test 文件，保持现有 SDK 测试命令不变。

### Task 2: 修复官方字符表解析并重生成字典

**Files:**
- Modify: `scripts/fetch-pp-ocrv6-models.mjs:45-57`
- Modify: `models/pp-ocrv6/1.0.0/dictionaries/PP-OCRv6_medium_rec.txt`
- Modify: `models/pp-ocrv6/1.0.0/dictionaries/PP-OCRv6_small_rec.txt`
- Modify: `models/pp-ocrv6/1.0.0/dictionaries/PP-OCRv6_tiny_rec.txt`
- Modify: `models/pp-ocrv6/1.0.0/manifest.json`

- [ ] **Step 1: 修改解析逻辑**

让 `extractCharacterDictionary` 对列表值只做 YAML 引号解析，不调用 `trim()`；以 `character.length > 0` 过滤真正的空字符串，从而保留 `U+3000`。

- [ ] **Step 2: 重新生成字典**

使用已缓存的官方 `inference.yml` 执行生成脚本的固定 revision 参数并使用 `--force`，或用等价的仓库脚本逻辑重写三个字典，确保不重新下载模型权重。

- [ ] **Step 3: 更新 manifest 数量**

将 medium/small recognition 的 `decoder.dictionaryEntries` 更新为 18708，将 tiny 更新为 6904；保持模型 SHA-256、URL、revision 不变。

- [ ] **Step 4: 运行字符表测试**

运行：`node --test scripts/dictionary-contract.test.mjs`

预期：通过，且全角空格保留在固定索引。

### Task 3: 增加 SDK 加载期字典长度校验

**Files:**
- Modify: `packages/sdk/src/factory.ts`（`loadDictionary` 及 recognition 准备流程）
- Modify: `packages/sdk/tests/manifest.test.ts` 或新增 `packages/sdk/tests/dictionary-contract.test.ts`

- [ ] **Step 1: 写失败测试**

构造带 recognition asset 的 manifest：输出类别为 4、blankIndex 为 0、字典只有 2 项，并声明 `dictionaryEntries: 3`；调用公开 manifest 解析/加载路径，断言抛出 `PPOCRv6Error`，错误码为 `INVALID_MANIFEST`，消息包含实际与期望长度。

- [ ] **Step 2: 运行目标测试确认失败**

运行：`pnpm --filter web-sdk-pp-ocrv6 exec vitest run packages/sdk/tests/dictionary-contract.test.ts`

预期：失败，因为当前加载路径不会校验字典与输出类别的对应关系。

- [ ] **Step 3: 实现最小校验**

在读取字典后计算 `classCount`（recognition output shape 最后一个正整数维度）和 `blankIndex`，要求 `dictionary.length === classCount - 1`；若存在 `dictionaryEntries`，同时要求其等于实际长度。任何不匹配都抛出 `new PPOCRv6Error("INVALID_MANIFEST", ...)`。

- [ ] **Step 4: 运行目标测试确认通过**

运行：`pnpm --filter web-sdk-pp-ocrv6 exec vitest run packages/sdk/tests/dictionary-contract.test.ts`

预期：通过，并且错误消息能定位 asset ID、实际长度和期望长度。

### Task 4: 全量验证与版本记录

**Files:**
- Modify: `CHANGELOG.md`（记录字符表索引修复）
- Modify: `reports/`（仅生成本地验证报告，不提交用户数据）

- [ ] **Step 1: 运行门户标准检查（修改前后）**

运行：`pnpm sdk:check -- --repo F:\git\00_chenmohan\github\web-sdk-PP-OCRv6`

预期：无新的 required 失败。

- [ ] **Step 2: 运行 SDK 与模型验证**

运行：`pnpm test`、`pnpm typecheck`、`node scripts/model-contract.test.mjs`、`node scripts/verify-pp-ocrv6-models.mjs --report`。

预期：所有命令成功，模型权重校验值不变。

- [ ] **Step 3: 构建 Demo 并运行浏览器回归**

运行：`pnpm --filter @ppocrv6/demo typecheck`、`pnpm --filter @ppocrv6/demo build`、`pnpm --filter @ppocrv6/demo test`。

预期：图片预览、框选联动、移动端无横向溢出测试全部通过。

- [ ] **Step 4: 记录变更并提交**

使用中文提交信息，提交生成脚本、字典、manifest、SDK 校验、测试、变更日志和设计/计划文档；不提交模型下载临时文件或用户图片。
