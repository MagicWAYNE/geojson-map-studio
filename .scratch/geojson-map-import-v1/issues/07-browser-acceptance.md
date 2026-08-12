# 1920×1080 浏览器验收与完成条件

Status: ready-for-human

## Objective

在当前 worktree 的 `127.0.0.1` 服务完成真实浏览器闭环。

## Acceptance flow

1. 空 active record：内置重庆地图、纹理、HUD、柱体、hover、轮播与下钻正常。
2. 有效 GeoJSON、无 metrics：3 区科技蓝、现有效果保留，无柱体/旧重庆值；刷新仍保留。
3. 加 metrics：只给 2 个匹配区域显示柱体，摘要含 1 缺失与 1 多余。
4. 每个非法 fixture 都显示精确错误，当前 active 地图不变。
5. 恢复内置地图并刷新后仍为完整内置地图。
6. 两轮 loader/home 往返始终单 canvas，控制台无未处理错误或 Vue warning。
7. 保存无 metrics 与有 metrics 两张 1920×1080 截图。

## Completion condition

- spec 八项验收均有自动化或浏览器证据，Standards/Spec 双轴评审无未解决 actionable finding。
- 目标提交位于 `codex/open-source-prep`。
- 不合并、不推送、不部署、不删除 worktree，并在交付报告中明确这些边界。

## Comments

实现提交后进入人工复核。
