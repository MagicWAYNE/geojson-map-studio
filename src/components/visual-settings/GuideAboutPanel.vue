<template>
  <div class="guide-about" data-workspace-page="guide">
    <header class="guide-about__header">
      <p class="guide-about__eyebrow">GEOJSON MAP STUDIO</p>
      <h1>指引 &amp; 关于</h1>
    </header>

    <section class="guide-about__section" aria-labelledby="guide-intro-title">
      <span class="guide-about__index" aria-hidden="true">01</span>
      <div>
        <h2 id="guide-intro-title">简介</h2>
        <p>
          本项目是一个基于 Three.js 的数据地图项目，选择区域或导入 GeoJSON 后即可获得视觉完成度较高的数据地图模型。可用于数据大屏、指挥舱页面、PPT、公众号、小红书等任何您用得上的地方。
        </p>
      </div>
    </section>

    <section class="guide-about__section" aria-labelledby="guide-usage-title">
      <span class="guide-about__index" aria-hidden="true">02</span>
      <div>
        <h2 id="guide-usage-title">指引</h2>
        <ol class="guide-about__steps">
          <li>
            上传 GeoJSON 文件来获得自己想要的区域。推荐使用
            <a
              href="https://datav.aliyun.com/portal/school/atlas/area_selector"
              target="_blank"
              rel="noreferrer"
            >阿里云 DataV 数据可视化平台的 GeoJSON 工具</a>。
          </li>
          <li>在“分块数据配置”中添加数据，即可实现柱状图和选中后展示数据的效果。</li>
          <li>
            鼠标左键拖动可旋转模型角度；鼠标中键拖动可调整缩放；鼠标右键拖动可调整位置。
          </li>
          <li>制作过程中常用的视觉样式参数基本均已开放，您可以进一步调整并形成自己的视觉方案。</li>
        </ol>
      </div>
    </section>

    <section class="guide-about__section guide-about__section--service" aria-labelledby="guide-service-title">
      <span class="guide-about__index" aria-hidden="true">03</span>
      <div>
        <h2 id="guide-service-title">服务和关于我</h2>
        <p>如果这个项目对您有帮助，欢迎通过下方链接了解项目或与我联系。</p>
      </div>
    </section>

    <footer class="guide-about__footer">
      <p>如需定制化服务可以通过以下方式联系我。</p>
      <nav class="guide-about__contacts" aria-label="项目与联系方式">
        <a
          href="https://github.com/MagicWAYNE/geojson-map-studio"
          target="_blank"
          rel="noreferrer"
          aria-label="在 GitHub 查看本项目"
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.88c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.82c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
          </svg>
        </a>
        <a
          href="https://x.com/Wolfrid10888630"
          target="_blank"
          rel="noreferrer"
          aria-label="在 X 联系我"
          title="X"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.09 17.84h1.72L8.44 4.05H6.59l11.22 15.79Z" />
          </svg>
        </a>
        <a
          href="mailto:wei.mingda@outlook.com"
          aria-label="发送邮件至 wei.mingda@outlook.com"
          title="Email"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm9 8.25L20.5 6.5h-17L12 12.25Zm0 2.42L3 8.58V18h18V8.58l-9 6.09Z" />
          </svg>
        </a>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.guide-about {
  display: flex;
  flex: 1;
  min-height: 0;
  padding-right: 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex-direction: column;
  gap: 14px;
}
.guide-about__header {
  padding: 4px 2px 8px;
  border-bottom: 1px solid rgba(63, 169, 255, 0.28);
}
.guide-about__eyebrow {
  margin: 0 0 4px !important;
  color: #2edcff !important;
  font: 12px/1.4 monospace !important;
  letter-spacing: 0.18em;
}
.guide-about__header h1 { margin: 0; color: #fff; font-size: 28px; }
.guide-about__section {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  padding: 16px;
  background: rgba(36, 131, 255, 0.06);
  border: 1px solid rgba(36, 131, 255, 0.28);
  border-radius: 6px;
}
.guide-about__index {
  color: rgba(46, 220, 255, 0.72);
  font: 15px/1.4 monospace;
}
.guide-about__section h2 { margin: 0 0 8px; color: #7de7ff; font-size: 18px; }
.guide-about__section p { margin: 0; color: #b1c9e4; font-size: 15px; line-height: 1.75; }
.guide-about__steps { display: grid; gap: 11px; margin: 0; padding-left: 20px; color: #b1c9e4; font-size: 15px; line-height: 1.7; }
.guide-about__steps li::marker { color: #2edcff; font-family: monospace; }
.guide-about__steps a { color: #67dcff; text-underline-offset: 3px; }
.guide-about__steps a:hover, .guide-about__steps a:focus-visible { color: #fff; }
.guide-about__section--service { margin-top: 2px; }
.guide-about__footer {
  display: grid;
  gap: 12px;
  margin-top: auto;
  padding: 16px;
  background: linear-gradient(135deg, rgba(0, 222, 255, 0.09), rgba(36, 131, 255, 0.05));
  border: 1px solid rgba(67, 194, 255, 0.32);
  border-radius: 6px;
}
.guide-about__footer p { margin: 0; color: #dcecff; font-size: 15px; line-height: 1.6; }
.guide-about__contacts { display: flex; align-items: center; gap: 12px; }
.guide-about__contacts a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #8feeff;
  background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(75, 203, 255, 0.5);
  border-radius: 50%;
  transition: color 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.guide-about__contacts a:hover, .guide-about__contacts a:focus-visible {
  color: #fff;
  border-color: #00deff;
  transform: translateY(-1px);
}
.guide-about__contacts svg { width: 19px; height: 19px; fill: currentColor; }
</style>
