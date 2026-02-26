import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global safety net for unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.warn("Unhandled promise rejection caught:", event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
