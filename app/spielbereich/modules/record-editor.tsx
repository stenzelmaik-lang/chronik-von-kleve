"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock } from "lucide-react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { KnowledgeGrants } from "./knowledge-grants";
import { CharacterFields } from "./character";
import { personal } from "./navigation";
import { Choice, visibilityNames } from "./shared";

import type { Dispatch, SetStateAction } from "react";
export function RecordEditor({
  edit,
  setEdit,
  a,
  saving,
  formError,
  save,
  setRemove,
}: {
  edit: Entry | null;
  setEdit: Dispatch<SetStateAction<Entry | null>>;
  a: Actor;
  saving: boolean;
  formError: string;
  save: () => Promise<void>;
  setRemove: (r: { id: string; version?: number }) => void;
}) {
  function patchBody(key: string, value: unknown) {
    setEdit((e) => (e ? { ...e, body: { ...e.body, [key]: value } } : e));
  }
  function field(label: string, key: string, large = false, type = "text") {
    return (
      <label className={"field " + (large ? "wide" : "")} key={key}>
        <span>{label}</span>
        {large ? (
          <textarea
            value={String(edit?.body[key] ?? "")}
            onChange={(e) => patchBody(key, e.target.value)}
            rows={6}
            disabled={!edit?.canEdit}
          />
        ) : (
          <input
            value={String(edit?.body[key] ?? "")}
            onChange={(e) =>
              patchBody(
                key,
                type === "number" ? Number(e.target.value) : e.target.value,
              )
            }
            type={type}
            min={0}
            max={type === "number" ? 99999 : undefined}
            disabled={!edit?.canEdit}
          />
        )}
      </label>
    );
  }
  return (
    <Dialog
      open={!!edit}
      onOpenChange={(open) => {
        if (!open && !saving) setEdit(null);
      }}
    >
      <DialogContent
        className={`!max-w-5xl max-h-[90vh] overflow-y-auto ${edit?.kind === "charaktere" ? "character-editor-dialog" : ""}`}
        onInteractOutside={(e) => {
          if (edit?.canEdit) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="!font-serif !text-3xl">
            {edit?.id ? edit.title : "Neuer Eintrag"}
          </DialogTitle>
          <DialogDescription>
            {edit?.canEdit
              ? "Änderungen werden mit „Speichern“ dauerhaft übernommen."
              : "Für dich freigegebene Inhalte der Chronik."}
          </DialogDescription>
        </DialogHeader>
        {edit && (
          <form
            className={edit.kind === "charaktere" ? "character-editor-form" : undefined}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>
                  {edit.kind === "charaktere" ? "Name des Charakters" : "Titel"}
                </span>
                <input
                  required
                  maxLength={200}
                  value={edit.title}
                  disabled={!edit.canEdit}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </label>
              {edit.canEdit ? (
                <Choice
                  label="Sichtbarkeit"
                  value={edit.visibility}
                  onChange={(s) =>
                    setEdit({ ...edit, visibility: s as Entry["visibility"] })
                  }
                  options={Object.entries(visibilityNames).map(([v, t]) => [
                    v,
                    a.gm && v === "sl" && !personal.includes(edit.kind)
                      ? "Nur Spielleitung"
                      : t,
                  ])}
                />
              ) : (
                <p className="field">
                  <span>Sichtbarkeit</span>
                  {visibilityNames[edit.visibility]}
                </p>
              )}
              {edit.kind === "charaktere" ? (
                <CharacterFields
                  edit={edit}
                  patchBody={patchBody}
                  field={field}
                  campaignId={a.campaignId}
                  isGm={a.gm}
                />
              ) : (
                <>
                  {field(
                    edit.kind === "termine" ? "Datum" : "Datum (optional)",
                    "date",
                    false,
                    "date",
                  )}
                  {field("Kurzbeschreibung", "summary")}
                  {field("Lesetext", "text", true)}
                </>
              )}
              {a.gm && !personal.includes(edit.kind) && (
                <label className="field wide gm-field">
                  <span>
                    <Lock size={15} /> Spielleitertext · wird niemals an Spieler
                    ausgeliefert
                  </span>
                  <textarea
                    rows={9}
                    value={edit.gmBody || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, gmBody: e.target.value })
                    }
                    disabled={!edit.canEdit}
                  />
                </label>
              )}
            </div>
            {a.gm && edit.id && !personal.includes(edit.kind) && (
              <KnowledgeGrants key={edit.id} entityId={edit.id} />
            )}
            {formError && (
              <p className="error-box" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              {edit.canEdit && (
                <>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={saving}
                  >
                    {saving ? "Wird gespeichert …" : "Speichern"}
                  </button>
                  {edit.id && (
                    <button
                      type="button"
                      className="danger-link"
                      disabled={saving}
                      onClick={() =>
                        setRemove({ id: edit.id!, version: edit.version })
                      }
                    >
                      Eintrag löschen
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                className="button"
                disabled={saving}
                onClick={() => setEdit(null)}
              >
                {edit.canEdit ? "Abbrechen" : "Schließen"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
