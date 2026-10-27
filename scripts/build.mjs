// Injects the shared header and footer partials into every page in the site root.
// Pages are matched by filename: about.html gets the "about" nav link marked current.
// Run with: npm run build

import { readFile, writeFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Keep only the element itself, dropping the editor comments at the top of each partial.
const readPartial = async (name, tag) => {
  const text = await readFile(join(root, "partials", name), "utf8");
  return text.slice(text.indexOf(`<${tag}`), text.lastIndexOf(`</${tag}>`) + tag.length + 3).trim();
};

const header = await readPartial("header.html", "header");
const footer = await readPartial("footer.html", "footer");

const headerRegex = /<header class="site-header">[\s\S]*?<\/header>/;
const footerRegex = /<footer class="site-footer">[\s\S]*?<\/footer>/;

const files = (await readdir(root)).filter((f) => f.endsWith(".html"));

for (const file of files) {
  const path = join(root, file);
  const name = basename(file, ".html");
  const original = await readFile(path, "utf8");

  const activeHeader = header.replace(/\{\{current:(\w+)\}\}/g, (_, key) =>
    key === name ? ' aria-current="page"' : ""
  );

  if (!headerRegex.test(original) || !footerRegex.test(original)) {
    console.warn(`Skipped ${file}: no header or footer block found.`);
    continue;
  }

  const updated = original
    .replace(headerRegex, () => activeHeader)
    .replace(footerRegex, () => footer);

  await writeFile(path, updated);
  console.log(`Built ${file}`);
}
