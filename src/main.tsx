import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Listener from "./components/Listener";
import "./styles.css";
const isListener = new URLSearchParams(location.search).has("listener");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isListener ? <Listener /> : <App />}</React.StrictMode>,
);
