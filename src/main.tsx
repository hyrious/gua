import { h, render, Component } from "preact";

class App extends Component {
  render() {
    return <div>Hello, world!</div>;
  }
}

render(<App />, document.getElementById("app")!);
