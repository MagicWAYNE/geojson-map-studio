# Map Effect Session Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固化用户提供的完整 v3 地图效果参数，并让效果参数只在当前页面会话生效，刷新后始终恢复源码默认值。

**Architecture:** 默认对象仍由 `mapInwardGlowConfig.ts` 与 `mapEffectConfig.ts` 共同提供，通用 v1/v2/v3 解析和保存 helper 保留。`useMapDebug.ts` 不再读取或写入效果缓存，只从 `MAP_EFFECT_DEFAULTS` 深克隆初始化；现有 watcher 仅负责 normalization 和原位身份保持。

**Tech Stack:** Vue 3、TypeScript、Vitest、Vite。

## Global Constraints

- 旧 `cq-map-effect-config-v1/v2/v3` 键不读取、不写入、不主动删除。
- `cq-map-debug-layout` 布局缓存保持现状。
- 抽屉实时预览、草稿、应用、放弃、重置和复制 v3 JSON 保持可用。
- normalization 和 `resetEffect()` 后保持所有嵌套对象身份稳定。
- 不修改 shader、glow pipeline、hover 时序或地图布局默认值。

---

### Task 1: 固化完整 v3 默认效果参数

**Files:**
- Modify: `src/components/map/mapInwardGlowConfig.test.ts`
- Modify: `src/components/map/mapInwardGlowConfig.ts`
- Modify: `src/components/map/mapEffectConfig.test.ts`
- Modify: `src/components/map/mapEffectConfig.ts`

**Interfaces:**
- Produces: `BASE_INWARD_GLOW_DEFAULTS`、`HOVER_INWARD_GLOW_DEFAULTS`、`MAP_EFFECT_DEFAULTS`。
- Preserves: clone、normalize、v1/v2/v3 load/save helper 的公开签名。

- [ ] **Step 1: 写内扩默认值失败测试**

精确断言 base 为颜色 `#3c69eb`、width 36、strength 0.75、passes 1/4、wave disabled；hover 为 width 64、strength 0.22、passes 2/4、wave disabled。其余字段逐项匹配设计文档。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- src/components/map/mapInwardGlowConfig.test.ts`

Expected: FAIL，旧 base 参数和两个 enabled wave 与新断言不一致。

- [ ] **Step 3: 最小更新两个内扩默认常量**

在 `mapInwardGlowConfig.ts` 按设计文档完整更新两个对象，保留 `freezeInwardGlowDefaults()`。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npm test -- src/components/map/mapInwardGlowConfig.test.ts`

Expected: 全部 PASS。

- [ ] **Step 5: 写完整外层默认值失败测试**

更新 `mapEffectConfig.test.ts` 的完整 `V3_DEFAULTS`。base 锁定 outerColor `#cad6fc`、外扩 100/0.35、near 0.5/1.2、far radius 0.6、softness 0.9；hover 锁定 emissive `#4894db`、外扩 enabled、64/0.12、near radius 0.46。其余字段逐项匹配用户 JSON。

- [ ] **Step 6: 运行配置测试并确认 RED**

Run: `npm test -- src/components/map/mapEffectConfig.test.ts`

Expected: FAIL，当前源码仍返回旧外层默认值。

- [ ] **Step 7: 最小更新 v3 外层默认来源**

在 `mapEffectConfig.ts` 更新 `V2_BASE_DEFAULTS` 和 `V2_HOVER_DEFAULTS` 的对应字段；不改变 legacy v1、migration、storage key 或 helper。

- [ ] **Step 8: 运行两个配置测试文件并确认 GREEN**

Run: `npm test -- src/components/map/mapInwardGlowConfig.test.ts src/components/map/mapEffectConfig.test.ts`

Expected: 全部 PASS。

- [ ] **Step 9: 提交默认参数**

```bash
git add src/components/map/mapInwardGlowConfig.ts src/components/map/mapInwardGlowConfig.test.ts
git add src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts
git commit -m "feat(map): update default effect profile"
```

---

### Task 2: 将效果状态改为会话态并禁用缓存读写

**Files:**
- Modify: `src/composables/useMapDebug.test.ts`
- Modify: `src/composables/useMapDebug.ts`

**Interfaces:**
- Consumes: `cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)`。
- Produces: `useMapDebug().effect` 仍是模块级 reactive 单例，但每次模块加载从源码默认值初始化。
- Preserves: `resetEffect()`、`effectJson`、runtime status、布局缓存和返回字段。

- [ ] **Step 1: 写忽略旧缓存的失败测试**

分别预置自定义 v1、v2、v3 值，记录 `getItem`/`setItem`/`removeItem`。模块加载后断言 `effect` 等于 `MAP_EFFECT_DEFAULTS`，三个效果 key 从未读取、从未删除；布局 key 仍可读取。

- [ ] **Step 2: 写零写入与刷新恢复默认的失败测试**

修改外扩、inward wave 和 hover 字段并等待 `nextTick()`；断言没有效果 key 写入。`vi.resetModules()` 后重新导入，断言效果恢复 `MAP_EFFECT_DEFAULTS`。保留 normalization 测试，证明非法值仍原位裁切但不写缓存。

- [ ] **Step 3: 运行应用测试并确认 RED**

Run: `npm test -- src/composables/useMapDebug.test.ts`

Expected: FAIL，当前实现仍读取旧 key、写入 v3 key并恢复缓存值。

- [ ] **Step 4: 最小修改应用运行路径**

`useMapDebug.ts` 不再导入 `loadMapEffectConfig` 和 `saveMapEffectConfig`，初始化改为：

```ts
const effect = reactive(cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
```

watcher 只做 normalization：

```ts
watch(effect, (value) => {
  const normalized = normalizeMapEffectConfig(value)
  assignMapEffectConfig(effect, normalized)
}, { deep: true })
```

保留 `storage()`、`loadLayout()` 和 layout watcher。

- [ ] **Step 5: 运行应用测试并确认 GREEN**

Run: `npm test -- src/composables/useMapDebug.test.ts`

Expected: 全部 PASS；效果 key 零读取、零写入、零删除，布局缓存仍通过。

- [ ] **Step 6: 运行相关组件回归**

Run: `npm test -- src/components/debug/MapEffectControls.test.ts src/components/debug/MapInwardGlowControls.test.ts src/components/map/ChongqingMap3D.test.ts src/components/map/mapEffectWatcher.test.ts`

Expected: 全部 PASS。

- [ ] **Step 7: 运行完整门禁**

Run: `npm test`

Expected: 所有 Vitest 文件零失败。

Run: `npm run typecheck`

Expected: `vue-tsc --noEmit` 退出码 0。

Run: `npm run build`

Expected: 生产构建退出码 0，仅允许已知 large-chunk advisory。

Run: `git diff --check`

Expected: 无输出。

- [ ] **Step 8: 提交会话态改动**

```bash
git add src/composables/useMapDebug.ts src/composables/useMapDebug.test.ts
git commit -m "feat(map): make effect tuning session-only"
```

- [ ] **Step 9: 浏览器验收**

从当前 worktree 重启 `vite preview --host 0.0.0.0 --port 4173`。旧效果缓存存在时刷新，抽屉复制参数仍等于源码默认；当次修改后实时生效，再刷新恢复源码默认；布局修改后刷新仍保留。

---

## Final Review Checklist

- [ ] 完整默认 JSON 与用户提供值逐字段一致。
- [ ] 应用不读取、不写入、不删除 v1/v2/v3 效果缓存。
- [ ] 当前会话内实时调试和 normalization 正常。
- [ ] 刷新恢复源码默认值，布局持久化保持。
- [ ] reset/apply 保持嵌套对象身份。
- [ ] 全量测试、typecheck、build、diff-check 和浏览器验收通过。
