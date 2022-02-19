// https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js

import { HMRPlugin } from "./hmr";
import { transformAsync } from "@babel/core";
import prefreshBabelPlugin from "@prefresh/babel-plugin";

const transform = (code: string, path: string, plugins: any[]) =>
  transformAsync(code, {
    plugins: [[prefreshBabelPlugin, { skipEnvCheck: true }]],
    parserOpts: { plugins },
    ast: false,
    sourceMaps: true,
    sourceFileName: path,
    configFile: false,
    babelrc: false,
  });

const sourcemap = (map: any) => {
  const encoded = Buffer.from(JSON.stringify(map)).toString("base64");
  return `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encoded}`;
};

export function prefresh(): HMRPlugin {
  return {
    filter: /\.[tj]sx?$/,
    async transform({ path, contents }) {
      const parserPlugins = [
        "jsx",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        /\.tsx?$/.test(path) && "typescript",
      ].filter(Boolean);

      const result = await transform(contents, path, parserPlugins);
      if (!result) return;

      const hasReg = result.code && /\$RefreshReg\$\(/.test(result.code);
      const hasSig = result.code && /\$RefreshSig\$\(/.test(result.code);

      if (!hasSig && !hasReg) return contents;

      const prelude = `
        import "@prefresh/core";
        import { flush as flushUpdates } from "@prefresh/utils";
        let prevRefreshReg;
        let prevRefreshSig;
        if (import.meta.hot) {
          prevRefreshReg = self.$RefreshReg$ || (() => {});
          prevRefreshSig = self.$RefreshSig$ || (() => (type) => type);
          self.$RefreshReg$ = (type, id) => {
            self.__PREFRESH__.register(type, ${JSON.stringify(
              path
            )} + " " + id);
          };
          self.$RefreshSig$ = () => {
            let status = 'begin';
            let savedType;
            return (type, key, forceReset, getCustomHooks) => {
              if (!savedType) savedType = type;
              status = self.__PREFRESH__.sign(type || savedType, key, forceReset, getCustomHooks, status);
              return type;
            };
          };
        }`.replace(/^\s+|[\n]+\s*/gm, "");

      if (hasSig && !hasReg) {
        return `${prelude}${result.code}${sourcemap(result.map)}`;
      }

      return `${prelude}${result.code}
        if (import.meta.hot) {
          self.$RefreshReg$ = prevRefreshReg;
          self.$RefreshSig$ = prevRefreshSig;
          import.meta.hot.accept((m) => {
            try {
              flushUpdates();
            } catch (e) {
              self.location.reload();
            }
          });
        }
      ${sourcemap(result.map)}`;
    },
  };
}
