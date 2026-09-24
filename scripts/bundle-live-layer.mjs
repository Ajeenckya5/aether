import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveTs(abs) {
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    if (fs.existsSync(abs + ext)) return abs + ext;
  }
  for (const ext of [".ts", ".tsx"]) {
    const index = path.join(abs, `index${ext}`);
    if (fs.existsSync(index)) return index;
  }
  return abs;
}

/** Browser bundles for Today. They are not part of the React homepage graph. */
export function bundleLiveLayer() {
  return esbuild.build({
    entryPoints: {
      "hr-ring": path.join(root, "src/live-layer/hr-ring.ts"),
      "live-layer": path.join(root, "src/live-layer/boot.ts"),
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    outdir: path.join(root, "public"),
    legalComments: "none",
    plugins: [
      {
        name: "aether-alias",
        setup(build) {
          build.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveTs(path.join(root, "src", args.path.slice(2))),
          }));
          build.onResolve({ filter: /^@ajeenckya\/engine$/ }, () => ({
            path: path.join(root, "packages/engine/src/index.ts"),
          }));
        },
      },
    ],
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await bundleLiveLayer();
}
