<template>
  <div class="guide-about" data-workspace-page="guide">
    <header class="guide-about__header">
      <p class="guide-about__eyebrow">GEOJSON MAP STUDIO</p>
      <h1>指引 &amp; 关于</h1>
    </header>

    <section class="guide-about__section" aria-labelledby="guide-intro-title">
      <span class="guide-about__index" aria-hidden="true">01</span>
      <div class="guide-about__content">
        <h2 id="guide-intro-title">简介</h2>
        <p>
          本项目是一个基于 Three.js 的数据地图项目，选择区域或导入 GeoJSON 后即可获得视觉完成度较高的数据地图模型。可用于数据大屏、指挥舱页面、PPT、公众号、小红书等任何您用得上的地方。
        </p>
      </div>
    </section>

    <section class="guide-about__section" aria-labelledby="guide-usage-title">
      <span class="guide-about__index" aria-hidden="true">02</span>
      <div class="guide-about__content">
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
      <div class="guide-about__content">
        <h2 id="guide-service-title">服务和关于我</h2>
        <p>如果这个项目对您有帮助，欢迎通过下方链接了解项目或与我联系。</p>
      </div>
    </section>

    <footer class="guide-about__footer">
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
          href="https://xhslink.cn/m/2fNBjXFHMN3"
          target="_blank"
          rel="noreferrer"
          aria-label="在小红书联系我"
          title="小红书"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" />
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
.guide-about__content { min-width: 0; }
.guide-about__section h2 { margin: 0 0 8px; color: #7de7ff; font-size: 18px; }
.guide-about__section p { margin: 0; color: #b1c9e4; font-size: 15px; line-height: 1.75; }
.guide-about__steps {
  display: grid;
  gap: 11px;
  margin: 0;
  padding-left: 0;
  color: #b1c9e4;
  font-size: 15px;
  line-height: 1.7;
  list-style: decimal outside;
}
.guide-about__steps li { padding-left: 0; }
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
