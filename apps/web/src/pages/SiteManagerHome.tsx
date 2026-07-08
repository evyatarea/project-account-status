import { useEffect, useMemo, useState } from "react";
import {
  createResourceRow,
  listDailyLogs,
  listItems,
  listResourceRows,
  type DailyLog,
  type Item,
  type ResourceRow,
  type ResourceType,
} from "../lib/api";

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  material: "חומר",
  labor: "עבודה",
  equipment: "ציוד",
  service: "שירות",
};

export function SiteManagerHome() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openLogs = useMemo(() => logs.filter((l) => l.status === "open"), [logs]);
  const itemsForType = useMemo(
    () => items.filter((i) => i.resourceType === resourceType),
    [items, resourceType],
  );

  useEffect(() => {
    listDailyLogs().then(setLogs).catch((e) => setError(String(e)));
    listItems().then(setItems).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!selectedLogId) return;
    listResourceRows(selectedLogId).then(setRows).catch((e) => setError(String(e)));
  }, [selectedLogId]);

  useEffect(() => {
    if (openLogs.length === 1 && !selectedLogId) setSelectedLogId(openLogs[0].id);
  }, [openLogs, selectedLogId]);

  async function handleSave() {
    if (!selectedLogId || !resourceType || !quantity) return;
    setSaving(true);
    setError(null);
    try {
      const row = await createResourceRow({
        dailyLogId: selectedLogId,
        resourceType,
        itemId: itemId || undefined,
        quantityReported: Number(quantity),
        unit: items.find((i) => i.id === itemId)?.unit ?? "יחידה",
        deliveryTicketNumber: ticketNumber || undefined,
      });
      setRows((prev) => [row, ...prev]);
      setResourceType(null);
      setItemId("");
      setQuantity("");
      setTicketNumber("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (openLogs.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-center">
        <p className="text-lg text-slate-600">אין יומנים פתוחים שהוקצו לך כרגע. פנה למהנדס.</p>
      </div>
    );
  }

  return (
    <div className="pb-32">
      {openLogs.length > 1 && (
        <select
          value={selectedLogId ?? ""}
          onChange={(e) => setSelectedLogId(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 p-4 text-lg"
        >
          <option value="" disabled>
            בחר יומן
          </option>
          {openLogs.map((log) => (
            <option key={log.id} value={log.id}>
              {log.logDate}
            </option>
          ))}
        </select>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3">
        {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((type) => (
          <button
            key={type}
            onClick={() => {
              setResourceType(type);
              setItemId("");
            }}
            className={`rounded-2xl p-6 text-xl font-bold shadow ${
              resourceType === type ? "bg-blue-600 text-white" : "bg-white text-slate-700"
            }`}
          >
            {RESOURCE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {resourceType && (
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-4 text-lg"
          >
            <option value="">בחר פריט</option>
            {itemsForType.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description}
              </option>
            ))}
          </select>

          <input
            type="number"
            inputMode="decimal"
            placeholder="כמות"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-4 text-lg"
          />

          <input
            type="text"
            placeholder="מספר תעודת משלוח (אופציונלי)"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-4 text-lg"
          />

          <button
            onClick={handleSave}
            disabled={!quantity || saving}
            className="w-full rounded-xl bg-green-600 p-5 text-xl font-bold text-white disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור שורה"}
          </button>
        </div>
      )}

      <h2 className="mt-8 mb-2 text-lg font-bold text-slate-700">שורות שנרשמו היום</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl bg-white p-3 shadow-sm">
            <span className="font-semibold">{RESOURCE_TYPE_LABELS[row.resourceType]}</span>
            {" · "}
            {row.quantityReported} {row.unit}
            {row.deliveryTicketNumber && ` · תעודה ${row.deliveryTicketNumber}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
