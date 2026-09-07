# OCRv6 示例与缓存整改计划

范围为单 SDK runtime、Demo 和 Examples；遵循门户 standards/v1 的 SDK、Demo、Examples 契约。修改前检查见门户 reports/sdk-standard/2026-09-07-examples-cache/ocr-before.json；原审计保留不改写。

1. 用受控下载、IndexedDB 事务和自定义 manifest 复现迟到写回、误删及容量缺口，再加入内置缓存写入代次、操作队列和当前/全部 SDK 字节统计。保留原有清理 API。
2. 验证初始化期间释放、重复操作、失败恢复，再让 Demo 清理同步互斥、取消并等待在途任务、释放会话、使用实际 manifest 身份并刷新容量与结果状态。
3. 先验证独立消费者无法构建，再补 vanilla/react/vite 独立依赖和 dev/build；五个示例固定已发布 0.1.8、默认 ModelScope 并保留 Hugging Face 选项，处理重复运行与卸载。示例不使用本次新增 API。
4. 执行定向回归、包测试、类型检查、SDK/Demo/独立消费者构建及浏览器 smoke；记录真实推理和环境限制。主代理负责最终 checker、独立审查和远程发布。

不修改旧审计的耗时、后端等其他问题，不发布 npm 或提升版本。
