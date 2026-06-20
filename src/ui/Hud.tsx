import { useGameStore } from "../store/useGameStore";
import { findTitleDefinition } from "../data/titles";

export function Hud() {
  const player = useGameStore((state) => state.player);
  const nearbyNpc = useGameStore((state) => state.nearbyNpc);
  const wallet = useGameStore((state) => state.wallet);

  if (!player) return null;
  const activeTitle = findTitleDefinition(player.activeTitleId);

  return (
    <section className="hud" aria-label="Trạng thái nhân vật">
      <div className="hud-stat">
        <span>Máu</span>
        <strong>
          {player.hp}/{player.maxHp}
        </strong>
      </div>
      <div className="hud-stat">
        <span>Nội lực</span>
        <strong>
          {player.mp}/{player.maxMp}
        </strong>
      </div>
      <div className="hud-stat">
        <span>Cấp</span>
        <strong>{player.level}</strong>
      </div>
      <div className="hud-stat">
        <span>Kinh nghiệm</span>
        <strong>{player.exp}</strong>
      </div>
      <div className="hud-stat">
        <span>Vàng nhân vật</span>
        <strong>{player.gold}</strong>
      </div>
      <div className="hud-stat hud-wallet" data-currency="ruby">
        <span>Ruby Đỏ</span>
        <strong>{wallet ? formatCurrency(wallet.balances.redRuby) : "-"}</strong>
      </div>
      <div className="hud-stat hud-wallet" data-currency="gold">
        <span>Ví Vàng</span>
        <strong>{wallet ? formatCurrency(wallet.balances.gold) : "-"}</strong>
      </div>
      <div className="hud-stat hud-wallet" data-currency="diamond">
        <span>Kim Cương Lam</span>
        <strong>{wallet ? formatCurrency(wallet.balances.blueDiamond) : "-"}</strong>
      </div>
      <div className="hud-stat">
        <span>Lớp</span>
        <strong>{player.classId ?? "-"}</strong>
      </div>
      <div className="hud-map">{displayMapName(player.mapId)}</div>
      {activeTitle && <div className="hud-title">{activeTitle.name}</div>}
      {nearbyNpc && <div className="interact-prompt">E: {nearbyNpc.name}</div>}
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function displayMapName(mapId: string) {
  if (mapId === "starter_village") return "Làng Khởi Nguyên";
  return mapId.replace(/[_-]/g, " ");
}
