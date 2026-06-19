interface IntroStoryPanelProps {
  busy: boolean;
  onComplete: () => void;
}

export function IntroStoryPanel({ busy, onComplete }: IntroStoryPanelProps) {
  return (
    <section className="story-panel intro-story-panel" aria-label="Mở đầu RPG Phiêu Lưu">
      <div className="story-banner" aria-hidden="true">
        <span className="story-moon" />
        <span className="story-castle" />
        <span className="story-tower left" />
        <span className="story-tower right" />
        <span className="story-forest one" />
        <span className="story-forest two" />
      </div>
      <article className="story-copy">
        <p className="story-kicker">Biên niên sử vương quốc</p>
        <h1>RPG Phiêu Lưu</h1>
        <p>
          Lục địa Asteria từng được bảo hộ bởi những tinh linh cổ xưa. Khi các cổng bóng tối thức tỉnh,
          quái vật tràn qua rừng sâu, hầm ngục và những pháo đài bị lãng quên.
        </p>
        <p>
          Bạn là một lữ khách vừa đặt chân tới làng khởi đầu. Từ đây, hành trình săn quái, nhận nhiệm vụ,
          thu thập trang bị và khám phá bí mật của vương quốc chính thức bắt đầu.
        </p>
        <p>
          Hãy chọn nhịp hướng dẫn phù hợp để bước vào thế giới. Mọi tiến trình sau lựa chọn này sẽ được lưu
          bằng tài khoản và cơ sở dữ liệu.
        </p>
      </article>
      <footer>
        <button type="button" onClick={onComplete} disabled={busy}>
          {busy ? "Đang lưu..." : "Bắt đầu hành trình"}
        </button>
      </footer>
    </section>
  );
}
