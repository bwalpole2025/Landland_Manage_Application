"use client";

import { useState } from "react";
import { Modal } from "@/components/ds/Modal";
import { Button } from "@/components/ui";
import { Labeled, StatusLine } from "@/components/settings/parts";
import { PROPERTY_TYPE_LABELS } from "@/lib/labels";
import type { PropertyType } from "@/lib/types";
import { createPropertyAction } from "@/app/(app)/properties/actions";

const TYPES = Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][];

export interface AddedProperty {
  id: string;
  nickname: string;
  line1: string;
  city: string;
  postcode: string;
  type: PropertyType;
  bedrooms: number;
  portfolioId: string;
}

export function AddPropertyModal({
  open,
  onClose,
  portfolios,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  portfolios: { id: string; name: string }[];
  onAdded: (p: AddedProperty) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [type, setType] = useState<PropertyType>("flat");
  const [bedrooms, setBedrooms] = useState(1);
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setNickname("");
    setLine1("");
    setCity("");
    setPostcode("");
    setType("flat");
    setBedrooms(1);
    setStatus(null);
  }

  async function submit() {
    setStatus(null);
    setSaving(true);
    try {
      const result = await createPropertyAction({ nickname, line1, city, postcode, type, bedrooms, portfolioId });
      if (!result.ok) {
        setStatus({ kind: "err", message: result.error });
        return;
      }
      onAdded({ id: result.id, nickname, line1, city, postcode, type, bedrooms, portfolioId });
      reset();
      onClose();
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "Could not add property." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add property"
      description="Add a property to your portfolio."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <StatusLine status={status} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !nickname.trim()}>
              {saving ? "Adding…" : "Add property"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Labeled label="Property name">
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Oakfield Road" />
        </Labeled>
        <Labeled label="Address line 1">
          <input className="input" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="e.g. 12 Oakfield Road" />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="City">
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bristol" />
          </Labeled>
          <Labeled label="Postcode">
            <input className="input" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="e.g. BS6 7AA" />
          </Labeled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
              {TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Bedrooms">
            <input
              className="input"
              type="number"
              min={0}
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
            />
          </Labeled>
        </div>
        {portfolios.length > 1 ? (
          <Labeled label="Portfolio">
            <select className="input" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Labeled>
        ) : null}
      </div>
    </Modal>
  );
}
