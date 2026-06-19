import type { GuidanceLevel } from "../data/types";

interface GuidanceLevelPanelProps {
  busyLevel: GuidanceLevel | null;
  onChoose: (level: GuidanceLevel) => void;
}

const guidanceLevels: {
  id: GuidanceLevel;
  title: string;
  subtitle: string;
  detail: string;
  mandatory: boolean;
}[] = [
  {
    id: "newbie",
    title: "Người Mới",
    subtitle: "Hướng dẫn bắt buộc",
    detail: "Dành cho người lần đầu vào game. Trò chơi sẽ dẫn từng bước cơ bản và không có nút bỏ qua.",
    mandatory: true
  },
  {
    id: "trainer",
    title: "Luyện Sư",
    subtitle: "Có thể bỏ qua hướng dẫn",
    detail: "Dành cho người đã quen RPG. Bạn vẫn nhận gợi ý, nhưng có thể bỏ qua khi muốn vào game nhanh.",
    mandatory: false
  },
  {
    id: "master_cg",
    title: "Thành Thạo CG",
    subtitle: "Có thể bỏ qua hướng dẫn",
    detail: "Dành cho người chơi thành thạo. Hệ thống chỉ giữ các nhắc nhở quan trọng và để bạn tự do khám phá.",
    mandatory: false
  }
];

export function GuidanceLevelPanel({ busyLevel, onChoose }: GuidanceLevelPanelProps) {
  return (
    <section className="story-panel guidance-panel" aria-label="Chọn cấp hướng dẫn">
      <header className="story-copy compact">
        <p className="story-kicker">Bước chuẩn bị cuối</p>
        <h1>Chọn cấp hướng dẫn</h1>
        <p>Cấp hướng dẫn sẽ được lưu vào tài khoản. Khi tải lại trang, lựa chọn này vẫn được giữ nguyên.</p>
      </header>
      <div className="guidance-grid">
        {guidanceLevels.map((level) => (
          <article className="guidance-card" key={level.id} data-required={level.mandatory}>
            <span className="guidance-icon" aria-hidden="true">
              {level.mandatory ? "Ⅰ" : level.id === "trainer" ? "Ⅱ" : "Ⅲ"}
            </span>
            <h2>{level.title}</h2>
            <strong>{level.subtitle}</strong>
            <p>{level.detail}</p>
            <button type="button" onClick={() => onChoose(level.id)} disabled={Boolean(busyLevel)}>
              {busyLevel === level.id ? "Đang lưu..." : "Chọn cấp này"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
