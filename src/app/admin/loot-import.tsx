"use client"

import clsx from "clsx"
import { useActionState, useState } from "react"
import { ITEM_TYPE_LABEL, ITEM_TYPES, RARITIES, RARITY_LABEL } from "@/lib/constants"
import { parseLootList, type ItemType } from "@/lib/loot-import"
import { importLoot } from "./actions"

export function LootImport({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(importLoot, null)
  const [list, setList] = useState("")
  const [defaultType, setDefaultType] = useState<ItemType>("waffe")
  const [mode, setMode] = useState<"ersetzen" | "hinzufuegen">("ersetzen")
  const preview = list.trim() ? parseLootList(list, defaultType) : []
  const counts = ITEM_TYPES.map((t) => [t, preview.filter((p) => p.type === t).length] as const)

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (mode === "ersetzen" && !confirm(`Bisherigen Lootpool der Season durch ${preview.length} Items ersetzen?`)) e.preventDefault()
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted">
        Liste einfügen, z. B. <code className="text-white">• Pump Shotgun (Legendary)</code>. Überschriften wie „Waffen“, „Healing &amp;
        Consumables“ oder „Mobility &amp; Utility“ setzen den Typ. Seltenheit auf Englisch oder Deutsch in Klammern. Bilder bleiben
        pro Item und Seltenheit erhalten, Beschreibungen pro Item.
      </p>
      <textarea
        name="list"
        value={list}
        onChange={(e) => setList(e.target.value)}
        className="input min-h-48 font-mono text-xs"
        placeholder={"Waffen\n• Assault Rifle (Common)\n• Assault Rifle (Rare)\n\nHealing & Consumables\n• Chug Jug (Legendary)"}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="label">Typ ohne Überschrift</span>
          <select name="default_type" value={defaultType} onChange={(e) => setDefaultType(e.target.value as ItemType)} className="input py-1">
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{ITEM_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Seltenheit, falls keine angegeben</span>
          <select name="default_rarity" defaultValue="gruen" className="input py-1">
            {RARITIES.map((r) => (
              <option key={r} value={r}>{RARITY_LABEL[r]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="ersetzen" checked={mode === "ersetzen"} onChange={() => setMode("ersetzen")} />
          Pool ersetzen (neue Season)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="hinzufuegen" checked={mode === "hinzufuegen"} onChange={() => setMode("hinzufuegen")} />
          Nur hinzufügen
        </label>
      </div>
      {preview.length > 0 && (
        <p className="text-sm">
          Erkannt: <b>{preview.length} Items</b> ({counts.map(([t, n]) => `${n} ${ITEM_TYPE_LABEL[t]}`).join(", ")})
          {preview.some((p) => !p.rarity) && <span className="text-muted"> · {preview.filter((p) => !p.rarity).length} ohne Seltenheit</span>}
        </p>
      )}
      <button className="btn-primary" disabled={disabled || pending || preview.length === 0}>
        {pending ? "Übernehme…" : mode === "ersetzen" ? "Lootpool ersetzen" : "Items hinzufügen"}
      </button>
      {state && <p className={clsx("text-sm", state.ok ? "text-win" : "text-fail")}>{state.message}</p>}
    </form>
  )
}
