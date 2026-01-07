/**
 * Badge Icon Generator for Windows Taskbar Overlay
 *
 * This script generates badge-1.png through badge-9.png and badge-9plus.png
 * for use as Windows taskbar overlay icons in Tauri.
 *
 * Uses sharp library for PNG generation from SVG.
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('sharp not installed. Installing...');
  require('child_process').execSync('npm install sharp --save-dev', { stdio: 'inherit' });
  sharp = require('sharp');
}

const OUTPUT_DIR = path.join(__dirname, '../public/icons');
const ICON_SIZE = 32; // 32x32 pixels for Windows overlay icons

/**
 * Generate SVG for a badge with a number
 * @param {string} text - The text to display (1-9 or "9+")
 * @returns {string} SVG markup
 */
function generateBadgeSvg(text) {
  const fontSize = text.length > 1 ? 18 : 22;
  const textY = text.length > 1 ? 22 : 23;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <circle cx="16" cy="16" r="14" fill="#FF3B30"/>
  <circle cx="16" cy="16" r="12" fill="#FF3B30" stroke="#FFFFFF" stroke-width="1.5"/>
  <text x="16" y="${textY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${text}</text>
</svg>`;
}

async function generateBadgeIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating badge icons...');

  // Generate badges 1-9
  for (let i = 1; i <= 9; i++) {
    const svg = generateBadgeSvg(String(i));
    const outputPath = path.join(OUTPUT_DIR, `badge-${i}.png`);

    await sharp(Buffer.from(svg))
      .resize(ICON_SIZE, ICON_SIZE)
      .png()
      .toFile(outputPath);

    console.log(`Created: badge-${i}.png`);
  }

  // Generate 9+ badge
  const svg9plus = generateBadgeSvg('9+');
  const outputPath9plus = path.join(OUTPUT_DIR, 'badge-9plus.png');

  await sharp(Buffer.from(svg9plus))
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toFile(outputPath9plus);

  console.log('Created: badge-9plus.png');

  console.log('\nAll badge icons generated successfully!');
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

generateBadgeIcons().catch(console.error);
