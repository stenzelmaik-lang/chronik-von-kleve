"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const visibilityNames: Record<string, string> = {
  private: "Nur ich",
  sl: "Ich & Spielleitung",
  group: "Gesamte Spielgruppe",
};

export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, t]) => (
            <SelectItem key={v} value={v}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function safeImage(s: unknown) {
  return typeof s === "string" &&
    (/^\/images\/[a-zA-Z0-9_.-]+$/.test(s) ||
      /^\/api\/files\?id=[a-zA-Z0-9-]+$/.test(s))
    ? s
    : undefined;
}
