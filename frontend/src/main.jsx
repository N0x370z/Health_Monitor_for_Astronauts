import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fuente: Roboto empaquetada localmente (funciona offline)
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./ui/styles/index.css";
import App from "./app/App.jsx";
import { loadEcho } from "./data/echo.js";

// Primero intenta cargar la base (API del backend); si no responde, usa los CSV empaquetados.
loadEcho().finally(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
