import React from "react";
import { createRoot } from "react-dom/client";
import { EarsApp } from "./EarsApp";
import "./ears.css";
import "../design-system.css";
import "./guided-monitor.css";
import "../stage.css";
import "../regie.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><EarsApp /></React.StrictMode>);
