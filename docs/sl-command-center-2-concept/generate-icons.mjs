// Uses the project's established icon system; no new dependency or remote assets.
import { writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpen, UserRound, MapPinned, Images, PenLine, History, Search, PanelsTopLeft, CircleHelp, Pin, Plus, X, Ellipsis, Maximize2, Minimize2, Compass, ShieldCheck, Send, Mail } from "lucide-react";
const icons = { book: BookOpen, person: UserRound, map: MapPinned, media: Images, pen: PenLine, history: History, search: Search, windows: PanelsTopLeft, help: CircleHelp, pin: Pin, plus: Plus, close: X, more: Ellipsis, maximize: Maximize2, minimize: Minimize2, compass: Compass, shield: ShieldCheck, send: Send, letter: Mail };
const markup = Object.fromEntries(Object.entries(icons).map(([name, Icon]) => [name, renderToStaticMarkup(createElement(Icon, { size: 18, strokeWidth: 1.5, "aria-hidden": true, focusable: false }))]));
await writeFile(new URL("./prototype/icons.mjs", import.meta.url), `// Generated from the installed lucide-react package.\nexport const iconMarkup = ${JSON.stringify(markup, null, 2)};\n`);
