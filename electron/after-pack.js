// After electron-builder packs, copy static files needed by standalone Next.js
const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  const appDir = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources", "app");

  // Ensure the standalone server can find static assets
  const standalonePublic = path.join(appDir, ".next", "standalone", "public");
  const standaloneStatic = path.join(appDir, ".next", "standalone", ".next", "static");
  const sourcePublic = path.join(appDir, "public");
  const sourceStatic = path.join(appDir, ".next", "static");

  // Copy public/ into standalone
  if (fs.existsSync(sourcePublic) && !fs.existsSync(standalonePublic)) {
    fs.cpSync(sourcePublic, standalonePublic, { recursive: true });
  }

  // Copy .next/static into standalone/.next/static
  if (fs.existsSync(sourceStatic) && !fs.existsSync(standaloneStatic)) {
    fs.mkdirSync(path.dirname(standaloneStatic), { recursive: true });
    fs.cpSync(sourceStatic, standaloneStatic, { recursive: true });
  }

  console.log("After-pack: copied static assets to standalone");
};
