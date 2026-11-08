// ChroniPlay-Way icon set (docs/design/CHRONIPLAY-WAY.md, rule 4): 24-unit grid, stroke 1.5, square caps, mitred
// corners, no fill. For menus, tabs and empty states. Small functional symbols (close, arrows) stay with lucide-react.
import type { SVGProps } from "react";

const paths = {
  notebook: "M7 3h13v18H7z M4 6h5 M4 10h5 M4 14h5 M4 18h5 M11 8h6 M11 11h6 M11 14h4",
  file: "M3 6h6l2 2h10v12H3z M7 13h7 M7 16h4",
  place: "M12 21 6 12V7l6-4 6 4v5z M10 8h4v4h-4z",
  character: "M9 4h6v7H9z M4 21v-3l4-4h8l4 4v3",
  dice: "M12 3 20 10 12 21 4 10z M4 10l8 3 8-3 M12 13v8",
  letter: "M3 6h18v12H3z M3 6l9 7 9-7",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14",
  codex: "M5 4h12v16H5z M8 4v16 M17 9h2v4h-2",
  inventory: "M4 9h16v11H4z M9 9V6h6v3 M4 13h16 M11 13v3h2v-3",
  vitals: "M12 3 18 12v3l-3 4H9l-3-4v-3z M10 14h4",
  archive: "M3 8h18v12H3z M5 8V4h14v4 M9 13h6",
  info: "M4 4h16v16H4z M12 11v6 M12 7v1",
  scenes: "M3 10h18v10H3z M3 10 5 5h16l-2 5 M9 5 7 10 M15 5l-2 5",
  regie: "M2 12 7 7h10l5 5-5 5H7z M10 10h4v4h-4z",
  draw: "M4 20l1-4L16 5l3 3L8 19z M14 7l3 3",
  sticky: "M5 4h14v11l-5 5H5z M14 20v-5h5",
  pocket: "M5 4h14v8l-7 8-7-8z M5 8h14",
} as const;

export type CpIconName = keyof typeof paths;
export const cpIconNames = Object.keys(paths) as CpIconName[];

export function CpIcon({ name, size = 22, ...rest }: { name: CpIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false" {...rest}><path d={paths[name]} /></svg>;
}
