# Vercel 部署说明

## 当前项目

- Vercel 项目：`magicwaynes-projects/geojson-map-studio`
- 正式地址：<https://geojson-map-studio.vercel.app>
- 框架：Vite + Vue
- 构建命令：`npm run build`
- 输出目录：`dist`
- Node.js：项目要求 20 或更高版本
- 影像层级：全国与省级；地市级影像不进入 Web 部署包

`vercel.json` 固定了框架、构建命令、输出目录和版本化影像资源的长期缓存头。CDSE OAuth 凭据只用于本地生成影像，不需要、也不得上传到 Vercel。

## 第一次部署

```bash
# 1. 本地验收
npm test -- --run --exclude '.claude/worktrees/**'
npm run imagery:verify-library:deploy
npm run build

# 2. 登录；终端会给出一次性设备授权链接
npx vercel login

# 3. 创建并关联项目，然后部署
npx vercel --yes
```

Vercel 的首次项目部署会直接成为 Production。项目创建后，本地会产生 `.vercel/project.json`；它只保存项目和团队标识，已被 `.gitignore` 排除，不应提交。

## 日常部署

当前项目已经连接 GitHub 仓库：

- 推送到 `main`：自动创建 Production 部署。
- 推送其他分支或创建 Pull Request：自动创建 Preview 部署。
- 在本地执行 `npx vercel`：创建 Preview 部署。
- 在本地执行 `npx vercel --prod`：明确发布到 Production。

推荐工作流：

```text
功能分支 -> 本地测试 -> 推送分支 -> Vercel Preview 验收
         -> 合并 main -> Vercel Production 自动部署
```

不要把 `.env`、CDSE OAuth 凭据或完整地市级生成检查点加入部署。`.vercelignore` 是 CLI 上传时的额外保护。

## 影像包

公开部署包可重复生成：

```bash
npm run imagery:package:deploy
npm run imagery:verify-library:deploy
```

部署包包含 35 个清单目标：全国 1 项、省级 34 项；当前为 34 张可用 JPEG 和 1 项质量回退。浏览器只读取同源静态文件，不调用 Copernicus 或天地图 API。

影像目录带有数据集版本号，并设置一年不可变缓存。若将来替换任何图片或 manifest 内容，必须发布新的数据集版本路径，不能覆盖已有版本。

## 查看状态与回滚

```bash
# 查看当前正式部署
npx vercel inspect geojson-map-studio.vercel.app

# 查看部署列表
npx vercel ls geojson-map-studio
```

如果新版本出现问题，可在 Vercel 控制台的 Deployments 页面选择上一条通过验收的部署并执行 Promote/Redeploy。回滚的是线上指向，不会修改 Git 历史；问题修复后仍应正常提交代码。

参考：

- [Vercel 部署环境](https://vercel.com/docs/deployments/environments)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Vercel 平台限制](https://vercel.com/docs/limits)
