const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const SIZES = [16, 48, 128];

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  body { background: transparent; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
function draw(size) {
  const canvas = document.getElementById("c");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const s = size / 128; // scale factor

  // Background rounded rect
  const r = 20 * s;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = "#1a2030";
  ctx.fill();

  const barW = Math.round(22 * s);
  const barR = Math.max(2, Math.round(4 * s));
  const baseY = Math.round(110 * s);

  function bar(x, h, color) {
    const bx = Math.round(x * s);
    const bh = Math.round(h * s);
    const by = baseY - bh;
    ctx.beginPath();
    ctx.moveTo(bx + barR, by);
    ctx.lineTo(bx + barW - barR, by);
    ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + barR);
    ctx.lineTo(bx + barW, by + bh - barR);
    ctx.quadraticCurveTo(bx + barW, by + bh, bx + barW - barR, by + bh);
    ctx.lineTo(bx + barR, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - barR);
    ctx.lineTo(bx, by + barR);
    ctx.quadraticCurveTo(bx, by, bx + barR, by);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // 3 bars: moderate / critical / low
  bar(18,  60, "#3b82f6"); // blue  ~55%
  bar(53,  95, "#ef4444"); // red   ~90% (警告カラー)
  bar(88,  35, "#3b82f6"); // blue  ~30%
}
</script>
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html);

  for (const size of SIZES) {
    await page.evaluate((s) => draw(s), size);
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });

    const canvas = await page.$("canvas");
    const outPath = path.join(__dirname, `icon${size}.png`);
    await canvas.screenshot({ path: outPath, omitBackground: true });
    console.log(`✓ icon${size}.png`);
  }

  await browser.close();
})();
