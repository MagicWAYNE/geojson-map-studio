# 上传页与路由闭环

Status: ready-for-human

## Objective

新增独立 `/map-loader`，完成文件选择、校验摘要、应用和恢复内置地图。

## Scope

- `/` 继续为 map-only，HomeView 异步加载 active document。
- GeoJSON 必选、metrics 可选，只有完整校验通过才可应用；成功后导航 `/`。
- 名称字段选择与冲突值、结构化错误、存储 warning 可见。
- 恢复内置地图需要明确点击，成功后导航 `/`。

## Acceptance

- 页面语义、键盘操作和按钮 enable/disable 正确。
- 冲突阻止应用；成功激活/重置调用正确模块。
- 首页不重新引入页头、侧栏或调试抽屉。

## Comments

实现提交后进入人工复核。
