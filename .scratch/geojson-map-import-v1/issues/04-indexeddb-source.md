# IndexedDB active map source

Status: ready-for-human

## Objective

封装最后成功激活的自定义地图包与内置回退。

## Scope

- 通过 `MapPackageStore` 注入存储，实现 `load()`、`activate()`、`resetToBuiltin()` 和生产 IndexedDB adapter。
- 固定数据库/store/schema 版本，只持久化原始包，不存文件路径或大文件到 localStorage。
- 完整准备后才原子写入；失败保留旧记录。

## Acceptance

- 空库加载内置地图，刷新/新实例恢复自定义地图。
- 写入失败保持旧 active record。
- 损坏、未知版本或读取失败回退内置地图并返回 warning。
- reset 删除 active record，后续仍加载内置地图。

## Comments

实现提交后进入人工复核。
