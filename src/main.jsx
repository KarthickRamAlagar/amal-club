import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import "@/styles/index.css";
import { recordVisit } from "@/lib/visitor";

recordVisit(); // localStorage: amal.visited = "true", visit count, first/last visit time

function Toasts() { const { theme } = useTheme(); return <Toaster theme={theme} position="top-center" richColors closeButton />; }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
          <Toasts />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
