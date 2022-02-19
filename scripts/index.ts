import { build, BuildOptions, serve } from "esbuild";
import { hmr } from "./hmr";
import { prefresh } from "./prefresh";

const options: BuildOptions = {
  bundle: true,
  entryPoints: ["./src/main.tsx"],
  format: "esm",
  outfile: "./main.js",
  jsxFactory: "h",
  external: ["preact"],
  target: "chrome85",
};

const args = process.argv.slice(2);

if (args[0] === "build") {
  build({ ...options, plugins: [hmr({ disable: true })] }).catch(() =>
    process.exit(1)
  );
}

if (args[0] === "dev") {
  const a = new AbortController();
  const p = serve(
    { host: "localhost", port: 3000, servedir: "." },
    {
      ...options,
      sourcemap: "inline",
      plugins: [hmr({ plugins: [prefresh()], signal: a.signal })],
    }
  );
  p.then(server => {
    console.log("serving on http://localhost:3000");
    process.on("SIGINT", () => {
      process.exit();
    });
    process.on("SIGTERM", () => {
      process.exit();
    });
    process.on("exit", () => {
      console.log("bye bye");
      a.abort();
      server.stop();
    });
  }); //.catch(() => process.exit(1));
}
