import { execFile } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = new URL('../', import.meta.url);
const outputDirectory = new URL('web/store-assets/screenshots/', projectRoot);
const outputDirectoryPath = fileURLToPath(outputDirectory);
const temporaryBackgroundFilename = '.store-screenshot-background.png';
const iconImageHref = '../../../src/icons/icon128.png';
const renderFontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';

const screenshotSpecs = [
  {
    slug: '01-find-any-page',
    marker: 'NAVIGATION',
    title: ['Find Salesforce', 'pages in seconds.'],
    body: ['Search Setup, objects, and flows,', 'plus permissions and users.'],
    image: 'command-palette.png',
    imageWidth: 660,
    imageX: 550,
    imageY: 180,
    route: ['SHORTCUT', 'TYPE', 'ENTER'],
  },
  {
    slug: '02-fuzzy-search',
    marker: 'SMART SEARCH',
    title: ['Type less.', 'Navigate faster.'],
    body: ['Partial names are enough.', 'Fuzzy search finds the match.'],
    image: 'fuzzy-search.png',
    imageWidth: 660,
    imageX: 550,
    imageY: 220,
    route: ['SHORTCUT', 'PARTIAL NAME', 'MATCH'],
  },
  {
    slug: '03-open-new-tab',
    marker: 'KEYBOARD FLOW',
    title: ['Keep your', 'current page open.'],
    body: ['Hold Shift, Ctrl, or Command.', 'Launch the result in a new tab.'],
    image: 'command-palette.png',
    imageWidth: 660,
    imageX: 550,
    imageY: 180,
    route: ['SHORTCUT', 'SEARCH', 'MODIFIER + ENTER'],
  },
  {
    slug: '04-configure-sources',
    marker: 'CONTROL',
    title: ['Your org.', 'Your commands.'],
    body: ['Choose sources and custom commands.', 'See what you use most.'],
    image: 'options.png',
    imageWidth: 660,
    imageX: 550,
    imageY: 180,
    route: ['OPEN SETTINGS', 'CHOOSE SOURCES', 'SAVE'],
  },
  {
    slug: '05-one-shortcut',
    marker: 'QUICK START',
    title: ['One shortcut.', 'Deep navigation.'],
    body: ['Open it from any Lightning page.', 'Stay in the flow.'],
    image: 'popup.png',
    imageWidth: 480,
    imageX: 720,
    imageY: 140,
    secondaryImage: 'command-palette.png',
    secondaryImageWidth: 570,
    secondaryImageX: 620,
    secondaryImageY: 350,
    route: ['OPEN', 'SEARCH', 'GO'],
  },
];

/**
 * Escape content for use in SVG text nodes.
 * @param {string} value text to escape
 * @returns {string}
 */
function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Render a multi-line SVG text block.
 * @param {Array<string>} lines text lines
 * @param {number} x horizontal position
 * @param {number} y first baseline position
 * @param {number} lineHeight distance between baselines
 * @param {string} attributes SVG text attributes
 * @returns {string}
 */
function renderTextLines(lines, x, y, lineHeight, attributes) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" ${attributes}>${escapeXml(line)}</text>`
    )
    .join('\n');
}

/**
 * Render a product screenshot inside a framed, clipped card.
 * @param {object} options card options
 * @param {string} options.imageHref source image path
 * @param {number} options.sourceWidth source image width
 * @param {number} options.sourceHeight source image height
 * @param {number} options.x horizontal position
 * @param {number} options.y vertical position
 * @param {number} options.width rendered width
 * @returns {string}
 */
function renderProductCard({
  imageHref,
  sourceWidth,
  sourceHeight,
  x,
  y,
  width,
}) {
  const height = Math.round((width * sourceHeight) / sourceWidth);
  return `
    <image href="${imageHref}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${height - 2}" rx="25" ry="25" fill="none" stroke="#9AB2D8" stroke-width="2"/>
  `;
}

/**
 * Resize a source screenshot and apply real transparent rounded corners before
 * it is placed in the composed Store image.
 * @param {string} inputPath source screenshot path
 * @param {string} outputPath temporary rounded screenshot path
 * @param {number} width target width
 * @param {number} height target height
 * @returns {Promise<void>}
 */
async function renderRoundedScreenshot(inputPath, outputPath, width, height) {
  await execFileAsync('magick', [
    inputPath,
    '-resize',
    `${width}x${height}!`,
    '(',
    '-size',
    `${width}x${height}`,
    'xc:none',
    '-fill',
    'white',
    '-draw',
    `roundrectangle 0,0 ${width - 1},${height - 1} 26,26`,
    ')',
    '-alpha',
    'off',
    '-compose',
    'CopyOpacity',
    '-composite',
    `PNG32:${outputPath}`,
  ]);
}

/**
 * Render the keyboard workflow strip shown on every Store screenshot.
 * @param {Array<string>} steps workflow labels
 * @returns {string}
 */
function renderRoute(steps) {
  let x = 64;
  return steps
    .map((step, index) => {
      const width = Math.max(116, step.length * 9 + 64);
      const arrow =
        index === steps.length - 1
          ? ''
          : `<path d="M${x + width + 16} 695H${x + width + 48}" stroke="#2F6FED" stroke-width="2"/><path d="M${x + width + 42} 689L${x + width + 48} 695L${x + width + 42} 701" fill="none" stroke="#2F6FED" stroke-width="2"/>`;
      const chip = `<rect x="${x}" y="670" width="${width}" height="50" rx="16" fill="#173A74"/><text x="${x + width / 2}" y="700" text-anchor="middle" class="route">${escapeXml(step)}</text>${arrow}`;
      x += width + 70;
      return chip;
    })
    .join('\n');
}

/**
 * Build one 1280x800 Store screenshot SVG.
 * @param {object} spec screenshot specification
 * @param {number} index screenshot index
 * @param {Map<string, {imageHref: string, width: number, height: number}>} images product images
 * @returns {string}
 */
function buildScreenshotSvg(spec, index, images) {
  const primary = images.get(spec.image);
  const secondary = spec.secondaryImage
    ? images.get(spec.secondaryImage)
    : null;
  const primaryCard = renderProductCard({
    imageHref: primary.imageHref,
    sourceWidth: primary.width,
    sourceHeight: primary.height,
    x: spec.imageX,
    y: spec.imageY,
    width: spec.imageWidth,
  });
  const secondaryCard = secondary
    ? renderProductCard({
        imageHref: secondary.imageHref,
        sourceWidth: secondary.width,
        sourceHeight: secondary.height,
        x: spec.secondaryImageX,
        y: spec.secondaryImageY,
        width: spec.secondaryImageWidth,
      })
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <defs>
  </defs>
  <style>
    .display { font-family: Arial, Helvetica, sans-serif; font-size: 52px; font-weight: 700; fill: #102A4C; }
    .body { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 400; fill: #3D5877; }
    .marker { font-family: Menlo, Monaco, monospace; font-size: 15px; font-weight: 700; fill: #0B66D4; letter-spacing: 2.4px; }
    .brand { font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 700; fill: #17365F; }
    .counter { font-family: Menlo, Monaco, monospace; font-size: 15px; font-weight: 700; fill: #52719B; letter-spacing: 1.5px; }
    .route { font-family: Menlo, Monaco, monospace; font-size: 14px; font-weight: 700; fill: #FFFFFF; letter-spacing: 0.8px; }
  </style>
  <image href="${temporaryBackgroundFilename}" x="0" y="0" width="1280" height="800"/>
  <g stroke="#91A9CA" stroke-width="1" opacity="0.12">
    <path d="M0 56H1280M0 112H1280M0 168H1280M0 224H1280M0 280H1280M0 336H1280M0 392H1280M0 448H1280M0 504H1280M0 560H1280M0 616H1280M0 672H1280M0 728H1280M0 784H1280"/>
    <path d="M56 0V800M112 0V800M168 0V800M224 0V800M280 0V800M336 0V800M392 0V800M448 0V800M504 0V800M560 0V800M616 0V800M672 0V800M728 0V800M784 0V800M840 0V800M896 0V800M952 0V800M1008 0V800M1064 0V800M1120 0V800M1176 0V800M1232 0V800"/>
  </g>
  <path d="M965 -70C1080 80 1088 195 1015 295S920 490 1030 565S1225 690 1335 610" fill="none" stroke="#7DA7F2" stroke-width="110" stroke-linecap="round" opacity="0.12"/>
  <circle cx="1050" cy="290" r="12" fill="#2F6FED" opacity="0.45"/>
  <circle cx="1026" cy="565" r="12" fill="#2F6FED" opacity="0.45"/>
  <image href="${iconImageHref}" x="62" y="45" width="50" height="50"/>
  <text x="128" y="79" class="brand">Force Navigator Reloaded</text>
  <text x="1172" y="78" text-anchor="end" class="counter">${String(index).padStart(2, '0')} / ${String(screenshotSpecs.length).padStart(2, '0')}</text>
  <rect x="64" y="128" width="72" height="5" rx="2.5" fill="#2F6FED"/>
  <text x="64" y="166" class="marker">${escapeXml(spec.marker)}</text>
  ${renderTextLines(spec.title, 64, 230, 60, 'class="display"')}
  ${renderTextLines(spec.body, 64, 382, 31, 'class="body"')}
  ${secondaryCard}
  ${primaryCard}
  <path d="M64 644H1216" stroke="#7E9BC4" stroke-opacity="0.55"/>
  ${renderRoute(spec.route)}
</svg>`;
}

const imageDimensions = new Map([
  ['command-palette.png', { width: 854, height: 415 }],
  ['fuzzy-search.png', { width: 812, height: 301 }],
  ['options.png', { width: 1703, height: 829 }],
  ['popup.png', { width: 513, height: 311 }],
]);

await mkdir(outputDirectory, { recursive: true });
const temporaryBackgroundPath = fileURLToPath(
  new URL(temporaryBackgroundFilename, outputDirectory)
);
await execFileAsync('magick', [
  '-size',
  '1280x800',
  'xc:#EEF5FF',
  `PNG24:${temporaryBackgroundPath}`,
]);
const images = new Map();

for (const [filename, dimensions] of imageDimensions) {
  images.set(filename, {
    ...dimensions,
    sourcePath: fileURLToPath(
      new URL(`src/welcome/images/${filename}`, projectRoot)
    ),
  });
}

try {
  for (const [index, spec] of screenshotSpecs.entries()) {
    const screenshotNumber = index + 1;
    const svgFilename = `.${spec.slug}.render.svg`;
    const svgUrl = new URL(svgFilename, outputDirectory);
    const temporaryFiles = [fileURLToPath(svgUrl)];
    const renderedImages = new Map(images);

    for (const [role, filename, width] of [
      ['primary', spec.image, spec.imageWidth],
      ['secondary', spec.secondaryImage, spec.secondaryImageWidth],
    ]) {
      if (!filename || !width) {
        continue;
      }
      const source = images.get(filename);
      const height = Math.round((width * source.height) / source.width);
      const renderedFilename = `.${spec.slug}.${role}.png`;
      const renderedPath = fileURLToPath(
        new URL(renderedFilename, outputDirectory)
      );
      await renderRoundedScreenshot(
        source.sourcePath,
        renderedPath,
        width,
        height
      );
      temporaryFiles.push(renderedPath);
      renderedImages.set(filename, {
        imageHref: renderedFilename,
        width,
        height,
      });
    }

    try {
      await writeFile(
        svgUrl,
        buildScreenshotSvg(spec, screenshotNumber, renderedImages)
      );
      await execFileAsync(
        'magick',
        [
          '-font',
          renderFontPath,
          svgFilename,
          '-strip',
          '-colorspace',
          'sRGB',
          `PNG24:${spec.slug}.png`,
        ],
        { cwd: outputDirectoryPath }
      );
    } finally {
      await Promise.all(
        temporaryFiles.map((temporaryFile) =>
          unlink(temporaryFile).catch(() => undefined)
        )
      );
    }
  }
} finally {
  await unlink(temporaryBackgroundPath).catch(() => undefined);
}

console.log(`Rendered ${screenshotSpecs.length} Chrome Web Store screenshots.`);
