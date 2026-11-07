import {AppErrorBoundary} from './AppErrorBoundary';
import {installErrorReporting} from './diagnostics';
import React from "react";
import {tx} from "./i18n";
import { createRoot } from "react-dom/client";
import {AuthGate} from "./StudioControl";
import App from "./App";
import "./style.css";

// In the desktop app, confirmations use the selected language in a native window with the app icon.
const desktopDialog = (window as unknown as { xr18DesktopDialog?: { confirm: (m: string) => boolean; alert: (m: string) => void } }).xr18DesktopDialog;
const confirmDialog = desktopDialog?.confirm ?? window.confirm.bind(window);
const alertDialog = desktopDialog?.alert ?? window.alert.bind(window);
window.confirm = (message?: string) => confirmDialog(tx(message ?? ""));
window.alert = (message?: string) => alertDialog(tx(message ?? ""));
installErrorReporting();
createRoot(document.getElementById("root")!).render(<React.StrictMode><AuthGate><AppErrorBoundary><App /></AppErrorBoundary></AuthGate></React.StrictMode>);

