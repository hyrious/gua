import { prefresh } from "./prefresh";

const p = prefresh().transform({
  path: "a.tsx",
  contents: `
    import { h } from "preact";
    export function App() {
      return <div>Hello</div>;
    }
    export function App2() {
      return <div>world!</div>;
    }
  `,
});

Promise.resolve(p).then(console.log);
