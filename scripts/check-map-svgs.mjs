import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const roots = [
  "apps/web/assets/map-icons/raw",
  "apps/web/assets/map-icons/optimized"
];

const failures = [];

for (const root of roots) {
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => entry.name)
    .sort();

  if (!entries.length) {
    failures.push(`${root}: no SVG files found`);
    continue;
  }

  for (const entry of entries) {
    const filePath = join(root, entry);
    const source = await readFile(filePath, "utf8");

    if (!/\bviewBox=/.test(source)) {
      failures.push(`${filePath}: missing viewBox`);
    }

    if (/<svg[^>]*\s(?:width|height)=/i.test(source)) {
      failures.push(`${filePath}: fixed width/height should stay out of source assets`);
    }

    if (/<!--/.test(source)) {
      failures.push(`${filePath}: contains comment nodes`);
    }

    if (/<metadata[\s>]/i.test(source)) {
      failures.push(`${filePath}: contains metadata node`);
    }
  }
}

if (failures.length) {
  console.error("SVG validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("SVG validation passed.");
