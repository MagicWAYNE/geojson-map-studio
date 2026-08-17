# Sentinel-2 本地行政区影像图库

本项目可在构建阶段使用 Copernicus Data Space Ecosystem（CDSE）生成全国、省级、地市级行政区的本地 JPEG 纹理。浏览器运行时只读取项目内静态文件，不访问 Copernicus、天地图或其他在线底图 API。

## 固定数据版本

- 图库版本：`sentinel2-quarterly-2025q2-v1`
- 来源：Copernicus Sentinel-2 Level-3 Quarterly Mosaics
- 主季度：`2025-Q2`
- 有序回退：`2025-Q4`、`2025-Q3`
- 质量阈值：行政区覆盖范围内无数据像素不超过 2%
- 输出投影：`EPSG:3857`
- 输出尺寸：每个目标最长边 2000 像素，另一边按投影范围等比计算
- 生成目标清单：全国 1、省级 34、地市级 342，共 377 项
- Web 部署层级：全国 1、省级 34，共 35 项；地市级生成素材不进入部署包

全国和有地市子目标的省级纹理不再使用一次超大范围的在线请求。直接全国请求，以及内蒙古、新疆、西藏、甘肃的直接省级请求，曾在视觉复核中出现规则的黑色无数据块；这些结果已被拒绝并保留为审计证据。生成器现在先生成地市纹理，再在本地按行政区几何遮罩合成全国和有地市来源的省级纹理，因此这些合成都不增加 CDSE Process API 调用。当前图库包含 32 张可用的合成省级纹理；海南按质量策略不可用。澳门没有地市子目标，继续使用经哈希验证的直接纹理路径，并单独计入生成预算。

来源选择、质量证据和处理检查点位于 `.scratch/sentinel2-local-imagery-v1/`。它们是生成审计材料，不会进入运行时图库。

## 本地生成

项目根目录 `.env` 仅在构建阶段读取以下凭据：

```text
S2_CLIENT_ID=...
S2_CLIENT_SECRET=...
```

凭据、OAuth token、请求头和原始服务响应不得写入图库或浏览器代码。

```bash
# 无网络、无额度消耗：重建并验证 377 项确定性任务清单
npm run imagery:plan
npm run imagery:verify-plan

# 只输出预算；增加 -- --execute 才进行已认证请求
npm run imagery:preflight
npm run imagery:quality
npm run imagery:fetch

# 已有完整检查点后，生成项目内静态图库
npm run imagery:package
npm run imagery:verify-library

# 生成并验证 Vercel 使用的全国 + 省级精简图库
npm run imagery:package:deploy
npm run imagery:verify-library:deploy
```

正式生成命令支持断点恢复。再次运行 `imagery:fetch -- --execute --max-pu 5000` 时，只有通过尺寸和 SHA-256 校验的文件才会跳过；损坏文件会先隔离，再重新获取。

## 交付边界

运行时图库位于：

```text
public/imagery-library/sentinel2-quarterly-2025q2-v1/
├── manifest.json
├── NOTICE-DATA.md
├── SHA256SUMS
└── images/
```

公开部署只携带全国与省级精简图库，约 14 MiB，可随 Web 源码和 Vercel 静态产物发布。完整地市级生成素材继续留在 `.scratch/sentinel2-local-imagery-v1/work/`，不会进入 Git、Vercel 或浏览器运行时。

`manifest.json` 是浏览器唯一的纹理寻址来源。视图组件不拼接行政区资源路径；清单记录目标 ID、像素尺寸、EPSG:3857 范围、季度、质量比例、来源署名和文件哈希。`SHA256SUMS` 覆盖所有运行时文件。验证器会拒绝缺失、篡改、尺寸错误、越界路径、重复目标和孤儿文件。

## 浏览器行为

- “加载本地影像图”默认关闭，只有从内置区域库加载的全国或省级地图可启用；地市级明确显示为当前部署不支持。
- 控件在界面中的准确名称为“加载本地 Sentinel-2 影像”。
- 开启后先读取同源 `manifest.json`，再加载该目标的本地 JPEG。
- SHA-256 校验优先使用安全上下文中的 Web Crypto；通过局域网 HTTP 地址访问、浏览器不提供 `crypto.subtle` 时，自动使用兼容实现，仍会完整校验影像哈希。
- 快速切换行政区会中止旧清单请求并丢弃迟到结果。
- 未通过质量阈值的目标明确回退到科技蓝外观，不会临时请求在线影像。
- 影像使用清单中的 EPSG:3857 范围拟合到现有 Three.js 挤出几何；没有第二个地图渲染器或第二张 canvas。
- 开关、换区和组件卸载都复用现有场景销毁流程，纹理、材质和几何会被释放。

## 数据许可与署名

代码许可证与影像数据声明必须分开。所有 2025 年来源的修改纹理使用以下准确声明：

```text
Contains modified Copernicus Sentinel data 2025
```

Copernicus Sentinel 数据允许在合法范围内复制、传播、公开交流、改编、修改和与其他数据组合；修改后的公开输出需要上述来源声明。权威依据：

- [Sentinel Data Legal Notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)
- [CDSE Terms and conditions](https://dataspace.copernicus.eu/terms-and-conditions)

Copernicus 许可只覆盖影像来源，不自动授予天地图行政区 GeoJSON 的再分发许可。开源发布前仍需独立完成 GeoJSON 数据授权审查。
