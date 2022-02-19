/**
 * Dead-simple HMR implementation, in-complete and buggy.
 *
 * Here's how it works:
 * 1. Look for refresh boundary (files) by scanning "import.meta.hot.accept".
 * 2. Watch file changes and tell browser to execute the boundary file again.
 *
 * Caveats:
 * 1. No HMR Propagation (find the closed boundary file) and Module Graph.
 * 2. Only self-accept is allowed.
 */

import { Plugin } from "esbuild";
import { dirname, join, resolve, sep } from "path";
import { readFile, watch } from "fs/promises";
import { createServer, ServerResponse } from "http";
import { existsSync } from "fs";

export interface HMRPlugin {
  filter: RegExp;
  transform(args: {
    path: string;
    contents: string;
  }): string | null | void | Promise<string | null | void>;
}

// We will use `Function.toString` to capture the contents of these functions
// and inject them to the client. So don't put any node vars in it.
declare var disposeMap: Map<string, () => void>;
declare interface HotModule {
  path: string;
  callbacks: (() => void)[];
}
declare var hotModulesMap: Map<string, HotModule>;
async function fetchUpdate(path: string) {
  const mod = hotModulesMap.get(path);
  if (!mod) return;
  const dispose = disposeMap.get(path);
  if (dispose) dispose();
  try {
    await import(
      // @ts-expect-error
      `http://localhost:30000/${path}?timestamp=${performance.now()}`
    );
    console.log("[hmr] updated", path);
  } catch (err) {
    console.error(err);
  }
}
function createHot(path: string) {
  return {
    dispose(cb: () => void) {
      disposeMap.set(path, cb);
    },
    accept(cb: () => void) {
      const mod = hotModulesMap.get(path) || { path, callbacks: [] };
      mod.callbacks.push(cb);
      hotModulesMap.set(path, mod);
    },
  };
}
function onUpdate({ data }: { data: string }) {
  fetchUpdate(data);
}

interface HMROptions {
  disable?: boolean;
  plugins?: HMRPlugin[];
  signal?: AbortSignal;
  __fork?: { hot_boundary: Set<string> };
}

export function hmr(options?: HMROptions): Plugin {
  const { disable, plugins = [], signal, __fork } = options || {};

  return {
    name: "hmr",
    setup({ onResolve, onLoad, initialOptions, esbuild }) {
      if (disable) {
        initialOptions.define ||= {};
        initialOptions.define["import.meta.hot"] = "false";
        return;
      }

      let hot_boundary = __fork?.hot_boundary || new Set();
      initialOptions.plugins ||= [];
      initialOptions.plugins = initialOptions.plugins.map(e => {
        if (e.name === "hmr") return hmr({ plugins, __fork: { hot_boundary } });
        return e;
      });

      let workingDir = "";
      if (Array.isArray(initialOptions.entryPoints)) {
        workingDir = dirname(initialOptions.entryPoints[0]);
      }
      if (!workingDir) return;
      workingDir = resolve(workingDir);

      const hot_domain = "http://localhost:30000";

      const hot_runtime = `
        const hotModulesMap = new Map()
        const disposeMap = new Map()
        export var fetchUpdate = ${fetchUpdate.toString()}
        export var createHot = ${createHot.toString()}
        new EventSource('${hot_domain}/__source')
            .addEventListener('message', ${onUpdate.toString()});
        console.log('[hmr] connected')
      `;

      if (!__fork) {
        const clients = new Set<ServerResponse>();
        const server = createServer((req, res) => {
          const url = new URL(req.url || "", hot_domain);
          if (url.pathname === "/__source") {
            clients.add(res);
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "http://localhost:3000",
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });
            res.write(": hello\n\n");
          } else if (url.pathname === "/@hmr/client") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "http://localhost:3000",
              "Content-Type": "text/javascript",
            });
            res.end(hot_runtime);
          } else {
            const file = join(workingDir, url.pathname.slice(1));
            if (existsSync(file)) {
              const p = esbuild.build({
                ...initialOptions,
                entryPoints: [file],
                bundle: true,
                format: "esm",
                write: false,
              });
              p.then(({ outputFiles }) => {
                res.writeHead(200, {
                  "Access-Control-Allow-Origin": "http://localhost:3000",
                  "Content-Type": "text/javascript",
                });
                res.end(outputFiles[0].contents);
              });
            } else {
              res.writeHead(404, {
                "Access-Control-Allow-Origin": "http://localhost:3000",
              });
              res.end("Not found");
            }
          }
        });
        server.listen(30000, () => {
          console.log(`[hmr] serving ${hot_domain}`);
        });
        (async () => {
          try {
            const watcher = watch(workingDir, { signal });
            const send_update = (filename: string) => {
              clients.forEach(e => e.write(`data: ${filename}\n\n`));
              console.log("[hmr] update", filename);
            };
            for await (const { filename } of watcher) {
              if (hot_boundary.has(filename)) {
                debounce(send_update, filename);
              } else {
                console.log(
                  "[hmr] not implemented hmr propagation, " +
                    `requesting file: ${filename}`
                );
              }
            }
          } catch (err) {
            if (err.name === "AbortError") return;
            throw err;
          }
        })();
        // @ts-expect-error miss node typing
        signal?.addEventListener("abort", () => {
          server.close();
        });
      }

      const filter = new RegExp(`^${escape(workingDir)}${sep}.*`);

      const hot_id = `__esbuild_hmr_hot__`;
      const prelude = `
        import { createHot as __esbuild_hmr_createHot } from "/@hmr/client";
        const ${hot_id} = __esbuild_hmr_createHot(/* path */);
      `.replace(/^\s+|\n+\s*/gm, "");
      const import_hot = /\bimport\.meta\.hot\b/g;
      const import_hot_accept = /\bimport\.meta\.hot\.accept\(/g;

      onLoad({ filter }, async args => {
        let { path } = args;
        let contents = await readFile(path, "utf8");
        path = path.slice(workingDir.length + 1);
        for (const plugin of plugins) {
          if (plugin.filter.test(path)) {
            const result = await plugin.transform({ path, contents });
            if (result) contents = result;
          }
        }
        if (import_hot.test(contents)) {
          if (import_hot_accept.test(contents)) {
            hot_boundary.add(path);
          }
          contents =
            prelude.replace("/* path */", JSON.stringify(path)) +
            contents.replace(import_hot, hot_id);
          return { contents, loader: "default" };
        }
      });

      onResolve({ filter: /^\/@hmr\/client$/ }, args => {
        return { path: hot_domain + args.path, external: true };
      });
    },
  };
}

// https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escape(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let timer: NodeJS.Timeout | null = null;
function debounce(fn: (...args: any[]) => void, ...args: any[]) {
  timer && clearTimeout(timer);
  timer = setTimeout(fn.bind(null, ...args), 100);
}
