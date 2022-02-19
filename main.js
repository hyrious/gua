// src/main.tsx
import { h, render, Component } from "preact";
var App = class extends Component {
  render() {
    return /* @__PURE__ */ h("div", null, "Hello world!");
  }
};
render(/* @__PURE__ */ h(App, null), document.getElementById("app"));
