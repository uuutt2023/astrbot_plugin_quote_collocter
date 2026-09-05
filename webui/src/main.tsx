// 应用入口
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("#root element not found");
}
const root = createRoot(container);
// 先清掉 SSR 占位内容
container.innerHTML = "";
root.render(<App />);
