import React from "react";
import { createRoot } from "react-dom/client";
import { EarsApp } from "./EarsApp";
import "./ears.css";
import "../design-system.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><EarsApp /></React.StrictMode>);
