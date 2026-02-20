/**
 * Make white/near-white background of public/yin-yang.png transparent.
 * Run: node scripts/make-yin-yang-transparent.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const inputPath = join(root, "public", "yin-yang.png");
const outputPath = inputPath;

const pipeline = sharp(inputPath).ensureAlpha().raw();
const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// Make white and near-white pixels fully transparent (threshold 252 = almost any white)
const threshold = 252;
for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r >= threshold && g >= threshold && b >= threshold) {
    data[i + 3] = 0;
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(outputPath);

console.log("Done: yin-yang.png background made transparent.");
