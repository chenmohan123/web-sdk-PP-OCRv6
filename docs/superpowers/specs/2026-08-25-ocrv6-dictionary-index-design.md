# PP-OCRv6 字符表索引修复设计

## 背景

PP-OCRv6 的 medium/small recognition ONNX 输出包含 18710 个 CTC 类别，tiny recognition 输出包含 6906 个类别。官方 `inference.yml` 字符表分别包含 18708 和 6904 个字符，另有 CTC blank 类别。当前模型抓取脚本在解析字符表时使用 `trim()`，会删除全角空格 `U+3000` 等有意义的 Unicode 空白，导致生成字典比官方字符表少一个条目。

错位发生在全角空格之后，因此数字、日期和英文等前段字符仍然正确，而中文与后续标点整体映射到错误字符。这是模型类别索引与运行时字典不一致，不是浏览器编码问题，也不通过更换 medium/small 模型解决。

## 目标

- 保留官方字符表中的全角空格及其他有效 Unicode 字符。
- 让生成字典与 ONNX 输出类别建立可验证的一一对应关系。
- 在 SDK 加载识别模型时尽早拒绝字典长度与输出类别不一致的 manifest，避免静默产生乱码。
- 为 medium、small、tiny 三个 recognition 字典增加回归验证。

## 方案

### 字符表生成

修改 `scripts/fetch-pp-ocrv6-models.mjs` 的 YAML 字符表解析逻辑：只去除 YAML 列表项语法需要的前缀和包裹引号，不对字符值调用 `trim()`，并仅过滤真正的空字符串。这样 `U+3000` 会作为一个独立字典项保留。重新生成三个字典，并将 manifest 的 `dictionaryEntries` 更新为官方字符表数量：medium/small 为 18708，tiny 为 6904。

### 运行时校验

在 `packages/sdk/src/factory.ts` 读取字典后，根据 recognition asset 的输出类别维度和 decoder 的 blank index 校验：字典长度必须等于类别数减去 blank 类别数；若 manifest 声明 `dictionaryEntries`，实际长度也必须匹配。校验失败抛出 `INVALID_MANIFEST`，错误信息包含模型 ID、实际长度和期望长度。

### 测试

- 增加脚本级测试，读取每个 recognition 的 `inference.yml` 与生成字典，验证长度相等、`U+3000` 在预期索引、尾部字符不丢失。
- 增加 SDK factory/manifest 测试，验证字典长度不匹配时在加载阶段失败。
- 运行现有模型契约、SDK 单元测试、类型检查、Demo 构建和门户 `sdk:check`。

## 不在本次范围内

- 不调整 PP-OCRv6 模型权重、预处理、检测后处理或 CTC 解码算法。
- 不通过字符替换或启发式纠错掩盖错误字典。
- 不修改 Demo 的布局、高度或模型默认选择；这些是独立的用户体验问题。

## 验收标准

1. 三个 recognition 字典分别包含 18708、18708、6904 个条目。
2. `U+3000` 保留在 medium/small 的第 1748 项、tiny 的第 616 项，之后的中文索引不再偏移。
3. 所有 SDK、模型契约和 Demo 检查通过。
4. 使用 medium recognition 识别中文、数字、日期、英文混合图片时，结果不再出现由字典错位导致的系统性乱码。
