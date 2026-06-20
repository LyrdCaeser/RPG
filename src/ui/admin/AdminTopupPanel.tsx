import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  approveAdminTopupRequest,
  getAdminTopupPackages,
  getAdminTopupRequests,
  getAdminTopupSales,
  rejectAdminTopupRequest,
  saveAdminTopupPackage,
  saveAdminTopupSale,
  toggleAdminTopupPackage,
  toggleAdminTopupSale
} from "../../api/client";
import type { AdminTopupRequest, TopupPackage, TopupRequestStatus, TopupSale } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const statusLabels: Record<TopupRequestStatus | "all", string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy"
};

const statusOptions: (TopupRequestStatus | "all")[] = ["pending", "approved", "rejected", "cancelled", "all"];

const emptyPackageForm = {
  packageId: "",
  name: "",
  priceVnd: 25000,
  redRubyAmount: 250,
  bonusRedRuby: 0,
  enabled: true,
  displayOrder: 10
};

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const tomorrowLocal = () => new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const emptySaleForm = {
  id: "",
  name: "",
  saleType: "normal_sale" as TopupSale["saleType"],
  startsAt: nowLocal(),
  endsAt: tomorrowLocal(),
  enabled: true,
  bonusPercent: 10,
  bonusRedRuby: 0,
  appliesToAll: true,
  packageIds: [] as string[]
};

export function AdminTopupPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [status, setStatus] = useState<TopupRequestStatus | "all">("pending");
  const [requests, setRequests] = useState<AdminTopupRequest[]>([]);
  const [selected, setSelected] = useState<AdminTopupRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [sales, setSales] = useState<TopupSale[]>([]);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadRequests = () => {
    setBusy(true);
    setMessage("");
    void getAdminTopupRequests(status)
      .then((response) => {
        setRequests(response.requests);
        if (selected && !response.requests.some((request) => request.id === selected.id)) {
          setSelected(null);
          setAdminNote("");
        }
      })
      .catch((error) => showError(error, "Không tải được yêu cầu nạp."))
      .finally(() => setBusy(false));
  };

  const loadManagement = () => {
    setBusy(true);
    setMessage("");
    void Promise.all([getAdminTopupPackages(), getAdminTopupSales()])
      .then(([packageResponse, saleResponse]) => {
        setPackages(packageResponse.packages);
        setSales(saleResponse.sales);
      })
      .catch((error) => showError(error, "Không tải được cấu hình gói/sale."))
      .finally(() => setBusy(false));
  };

  useEffect(loadRequests, [status]);
  useEffect(loadManagement, []);

  const showError = (error: unknown, fallback: string) => {
    const text = error instanceof Error ? error.message : fallback;
    setMessage(text);
    addWarning(text);
  };

  const chooseRequest = (request: AdminTopupRequest) => {
    setSelected(request);
    setAdminNote(request.adminNote ?? "");
    setMessage("");
  };

  const approve = () => {
    if (!selected) return;
    if (!window.confirm("Duyệt yêu cầu nạp này và cộng Ruby Đỏ qua ledger?")) return;
    setBusy(true);
    setMessage("");
    void approveAdminTopupRequest({ requestId: selected.id, adminNote: adminNote.trim() || undefined })
      .then((response) => {
        setSelected(response.request);
        setAdminNote(response.request.adminNote ?? "");
        setMessage("Đã duyệt yêu cầu và cộng Ruby Đỏ qua ví/ledger.");
        return getAdminTopupRequests(status);
      })
      .then((response) => setRequests(response.requests))
      .catch((error) => showError(error, "Duyệt yêu cầu nạp thất bại."))
      .finally(() => setBusy(false));
  };

  const reject = () => {
    if (!selected) return;
    if (!window.confirm("Từ chối yêu cầu nạp này? Ruby Đỏ sẽ không được cộng.")) return;
    setBusy(true);
    setMessage("");
    void rejectAdminTopupRequest({ requestId: selected.id, adminNote: adminNote.trim() || undefined })
      .then((response) => {
        setSelected(response.request);
        setAdminNote(response.request.adminNote ?? "");
        setMessage("Đã từ chối yêu cầu nạp. Không cộng Ruby Đỏ.");
        return getAdminTopupRequests(status);
      })
      .then((response) => setRequests(response.requests))
      .catch((error) => showError(error, "Từ chối yêu cầu nạp thất bại."))
      .finally(() => setBusy(false));
  };

  const savePackage = () => {
    setBusy(true);
    setMessage("");
    void saveAdminTopupPackage(packageForm)
      .then(() => getAdminTopupPackages())
      .then((response) => {
        setPackages(response.packages);
        setMessage("Đã lưu gói nạp.");
      })
      .catch((error) => showError(error, "Lưu gói nạp thất bại."))
      .finally(() => setBusy(false));
  };

  const togglePackage = (item: TopupPackage) => {
    setBusy(true);
    setMessage("");
    void toggleAdminTopupPackage(item.packageId, !item.enabled)
      .then(() => getAdminTopupPackages())
      .then((response) => {
        setPackages(response.packages);
        setMessage(item.enabled ? "Đã tắt gói nạp." : "Đã bật gói nạp.");
      })
      .catch((error) => showError(error, "Bật/tắt gói nạp thất bại."))
      .finally(() => setBusy(false));
  };

  const editPackage = (item: TopupPackage) => {
    setPackageForm({
      packageId: item.packageId,
      name: item.name,
      priceVnd: item.priceVnd,
      redRubyAmount: item.redRubyAmount,
      bonusRedRuby: item.bonusRedRuby,
      enabled: item.enabled,
      displayOrder: item.displayOrder
    });
  };

  const saveSale = () => {
    setBusy(true);
    setMessage("");
    void saveAdminTopupSale({
      ...saleForm,
      id: saleForm.id || undefined,
      startsAt: new Date(saleForm.startsAt).toISOString(),
      endsAt: new Date(saleForm.endsAt).toISOString()
    })
      .then(() => getAdminTopupSales())
      .then((response) => {
        setSales(response.sales);
        setMessage("Đã lưu sale Ruby Đỏ.");
      })
      .catch((error) => showError(error, "Lưu sale thất bại."))
      .finally(() => setBusy(false));
  };

  const toggleSale = (sale: TopupSale) => {
    setBusy(true);
    setMessage("");
    void toggleAdminTopupSale(sale.id, !sale.enabled)
      .then(() => getAdminTopupSales())
      .then((response) => {
        setSales(response.sales);
        setMessage(sale.enabled ? "Đã tắt sale." : "Đã bật sale.");
      })
      .catch((error) => showError(error, "Bật/tắt sale thất bại."))
      .finally(() => setBusy(false));
  };

  const editSale = (sale: TopupSale) => {
    setSaleForm({
      id: sale.id,
      name: sale.name,
      saleType: sale.saleType,
      startsAt: toInputDateTime(sale.startsAt),
      endsAt: toInputDateTime(sale.endsAt),
      enabled: sale.enabled,
      bonusPercent: sale.bonusPercent,
      bonusRedRuby: sale.bonusRedRuby,
      appliesToAll: sale.appliesToAll,
      packageIds: sale.packageIds
    });
  };

  const toggleSalePackage = (packageId: string) => {
    setSaleForm((current) => ({
      ...current,
      packageIds: current.packageIds.includes(packageId)
        ? current.packageIds.filter((value) => value !== packageId)
        : [...current.packageIds, packageId]
    }));
  };

  return (
    <div className="admin-tool admin-topup-tool">
      <div className="admin-table-header">
        <h3>Duyệt nạp Ruby Đỏ</h3>
        <span>Người chơi chỉ tạo yêu cầu. Ruby Đỏ chỉ cộng sau khi ADMIN duyệt qua ledger.</span>
      </div>
      {message && <p className="admin-wallet-message">{message}</p>}

      <section className="admin-topup-config">
        <PackageManager
          packages={packages}
          form={packageForm}
          busy={busy}
          setForm={setPackageForm}
          onSave={savePackage}
          onEdit={editPackage}
          onToggle={togglePackage}
        />
        <SaleManager
          packages={packages}
          sales={sales}
          form={saleForm}
          busy={busy}
          setForm={setSaleForm}
          onSave={saveSale}
          onEdit={editSale}
          onToggle={toggleSale}
          onTogglePackage={toggleSalePackage}
        />
      </section>

      <div className="admin-search">
        <select value={status} onChange={(event) => setStatus(event.target.value as TopupRequestStatus | "all")}>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {statusLabels[option]}
            </option>
          ))}
        </select>
        <button type="button" onClick={loadRequests} disabled={busy}>
          Làm mới yêu cầu
        </button>
      </div>

      <div className="admin-columns">
        <div className="admin-list">
          {requests.length === 0 ? (
            <span>Không có yêu cầu nạp nào từ truy vấn hiện tại.</span>
          ) : (
            requests.map((request) => (
              <button type="button" key={request.id} data-active={selected?.id === request.id} onClick={() => chooseRequest(request)}>
                <strong>
                  {request.displayName} · {formatVnd(request.priceVnd)}
                </strong>
                <span>
                  {statusLabels[request.status]} · {formatNumber(request.finalRedRubyAmount)} Ruby Đỏ
                </span>
              </button>
            ))
          )}
        </div>

        <section className="admin-detail">
          {selected ? (
            <>
              <h3>{selected.displayName}</h3>
              <code>{selected.userId}</code>
              <div className="admin-stat-grid">
                <span>Gói {selected.packageName ?? selected.packageId}</span>
                <span>Giá {formatVnd(selected.priceVnd)}</span>
                <span>Ruby gốc {formatNumber(selected.redRubyAmount)}</span>
                <span>Thưởng gói {formatNumber(selected.bonusRedRuby)}</span>
                <span>Thưởng sale {formatNumber(selected.saleBonusRedRuby)}</span>
                <span>Tổng duyệt {formatNumber(selected.finalRedRubyAmount)}</span>
                <span>Sale {selected.saleName ?? "Không có"}</span>
                <span>Trạng thái {statusLabels[selected.status]}</span>
                <span>Tạo lúc {formatDate(selected.createdAt)}</span>
              </div>
              {selected.playerNote && <p className="admin-wallet-message">Ghi chú người chơi: {selected.playerNote}</p>}
              {selected.walletTransactionId && <p className="admin-wallet-message">Ledger: {selected.walletTransactionId}</p>}

              <label className="admin-note-field">
                Ghi chú ADMIN
                <textarea maxLength={240} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
              </label>

              <div className="admin-actions">
                <button type="button" onClick={approve} disabled={busy || selected.status !== "pending"}>
                  Duyệt
                </button>
                <button type="button" onClick={reject} disabled={busy || selected.status !== "pending"}>
                  Từ chối
                </button>
              </div>
            </>
          ) : (
            <p>Chọn một yêu cầu nạp để xem chi tiết.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function PackageManager({
  packages,
  form,
  busy,
  setForm,
  onSave,
  onEdit,
  onToggle
}: {
  packages: TopupPackage[];
  form: typeof emptyPackageForm;
  busy: boolean;
  setForm: Dispatch<SetStateAction<typeof emptyPackageForm>>;
  onSave: () => void;
  onEdit: (item: TopupPackage) => void;
  onToggle: (item: TopupPackage) => void;
}) {
  return (
    <section className="admin-topup-card">
      <h3>Gói Ruby Đỏ</h3>
      <div className="admin-form-grid">
        <label>
          Mã gói
          <input value={form.packageId} onChange={(event) => setForm((current) => ({ ...current, packageId: event.target.value }))} />
        </label>
        <label>
          Tên hiển thị
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <NumberField label="Giá VND" value={form.priceVnd} onChange={(priceVnd) => setForm((current) => ({ ...current, priceVnd }))} />
        <NumberField label="Ruby Đỏ" value={form.redRubyAmount} onChange={(redRubyAmount) => setForm((current) => ({ ...current, redRubyAmount }))} />
        <NumberField label="Ruby thưởng" value={form.bonusRedRuby} onChange={(bonusRedRuby) => setForm((current) => ({ ...current, bonusRedRuby }))} />
        <NumberField label="Thứ tự" value={form.displayOrder} onChange={(displayOrder) => setForm((current) => ({ ...current, displayOrder }))} />
        <label className="settings-toggle">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
          Đang bật
        </label>
      </div>
      <div className="admin-actions">
        <button type="button" onClick={onSave} disabled={busy}>
          Lưu gói
        </button>
        <button type="button" onClick={() => setForm(emptyPackageForm)} disabled={busy}>
          Tạo mới
        </button>
      </div>
      <div className="admin-topup-list">
        {packages.map((item) => (
          <article key={item.packageId} data-disabled={!item.enabled}>
            <strong>{item.name}</strong>
            <span>
              {formatVnd(item.priceVnd)} · {formatNumber(item.redRubyAmount + item.bonusRedRuby)} Ruby · {item.enabled ? "Đang bật" : "Đang tắt"}
            </span>
            <div>
              <button type="button" onClick={() => onEdit(item)} disabled={busy}>
                Sửa
              </button>
              <button type="button" onClick={() => onToggle(item)} disabled={busy}>
                {item.enabled ? "Tắt" : "Bật"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SaleManager({
  packages,
  sales,
  form,
  busy,
  setForm,
  onSave,
  onEdit,
  onToggle,
  onTogglePackage
}: {
  packages: TopupPackage[];
  sales: TopupSale[];
  form: typeof emptySaleForm;
  busy: boolean;
  setForm: Dispatch<SetStateAction<typeof emptySaleForm>>;
  onSave: () => void;
  onEdit: (sale: TopupSale) => void;
  onToggle: (sale: TopupSale) => void;
  onTogglePackage: (packageId: string) => void;
}) {
  return (
    <section className="admin-topup-card">
      <h3>Sale Ruby Đỏ</h3>
      <div className="admin-form-grid">
        <label>
          Tên sale
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label>
          Loại sale
          <select value={form.saleType} onChange={(event) => setForm((current) => ({ ...current, saleType: event.target.value as TopupSale["saleType"] }))}>
            <option value="normal_sale">SALE Bình Thường</option>
            <option value="big_sale">SALE BIG</option>
          </select>
        </label>
        <label>
          Bắt đầu
          <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
        </label>
        <label>
          Kết thúc
          <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
        </label>
        <NumberField label="% thưởng" value={form.bonusPercent} onChange={(bonusPercent) => setForm((current) => ({ ...current, bonusPercent }))} />
        <NumberField label="Ruby sale cố định" value={form.bonusRedRuby} onChange={(bonusRedRuby) => setForm((current) => ({ ...current, bonusRedRuby }))} />
        <label className="settings-toggle">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
          Đang bật
        </label>
        <label className="settings-toggle">
          <input type="checkbox" checked={form.appliesToAll} onChange={(event) => setForm((current) => ({ ...current, appliesToAll: event.target.checked }))} />
          Áp dụng tất cả gói
        </label>
      </div>
      {!form.appliesToAll && (
        <div className="admin-package-checks">
          {packages.map((item) => (
            <label key={item.packageId}>
              <input type="checkbox" checked={form.packageIds.includes(item.packageId)} onChange={() => onTogglePackage(item.packageId)} />
              {item.name}
            </label>
          ))}
        </div>
      )}
      <div className="admin-actions">
        <button type="button" onClick={onSave} disabled={busy}>
          Lưu sale
        </button>
        <button type="button" onClick={() => setForm(emptySaleForm)} disabled={busy}>
          Tạo sale mới
        </button>
      </div>
      <div className="admin-topup-list">
        {sales.length === 0 ? (
          <p>Chưa có sale nào từ cơ sở dữ liệu.</p>
        ) : (
          sales.map((sale) => (
            <article key={sale.id} data-disabled={!sale.enabled}>
              <strong>
                {sale.saleType === "big_sale" ? "SALE BIG" : "SALE Bình Thường"} · {sale.name}
              </strong>
              <span>
                {formatSaleState(sale)} · {sale.bonusPercent > 0 ? `+${sale.bonusPercent}%` : ""}
                {sale.bonusPercent > 0 && sale.bonusRedRuby > 0 ? " và " : ""}
                {sale.bonusRedRuby > 0 ? `+${formatNumber(sale.bonusRedRuby)} Ruby` : ""}
              </span>
              <small>
                {formatDate(sale.startsAt)} - {formatDate(sale.endsAt)} · {sale.appliesToAll ? "Tất cả gói" : `${sale.packageIds.length} gói`}
              </small>
              <div>
                <button type="button" onClick={() => onEdit(sale)} disabled={busy}>
                  Sửa
                </button>
                <button type="button" onClick={() => onToggle(sale)} disabled={busy}>
                  {sale.enabled ? "Tắt" : "Bật"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" step="1" value={value} onChange={(event) => onChange(Math.trunc(Number(event.target.value)))} />
    </label>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatVnd(value: number) {
  return `${formatNumber(value)}đ`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function toInputDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatSaleState(sale: TopupSale) {
  const now = Date.now();
  if (!sale.enabled) return "Đang tắt";
  if (new Date(sale.startsAt).getTime() > now) return "Sắp diễn ra";
  if (new Date(sale.endsAt).getTime() <= now) return "Đã hết hạn";
  return "Đang chạy";
}
