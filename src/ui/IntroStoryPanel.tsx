interface IntroStoryPanelProps {
  busy: boolean;
  onComplete: () => void;
}

export function IntroStoryPanel({ busy, onComplete }: IntroStoryPanelProps) {
  return (
    <section className="story-panel intro-story-panel" aria-label="Mở đầu Kingdom 3">
      <div className="story-banner" aria-hidden="true">
        <span className="story-moon" />
        <span className="story-castle" />
        <span className="story-tower left" />
        <span className="story-tower right" />
        <span className="story-forest one" />
        <span className="story-forest two" />
      </div>
      <article className="story-copy">
        <p className="story-kicker">Biên niên sử vương quốc đứt gãy</p>
        <h1>Kingdom 3</h1>
        <p>
          Kingdom 3 là phần còn sót lại của một vương quốc từng có ba vương miện. Sau Cuộc Chiến Vương Miện Lần Ba,
          ngai vàng vỡ, thủ đô cũ chìm xuống lòng đất, và bầu trời trên biên giới không còn khép kín như trước.
        </p>
        <p>
          Những vùng đất rời rạc chỉ còn được giữ lại nhờ Mạch Giới, các mạch cổ chạy dưới đá và rễ cây.
          Trên mặt đất, các Ấn Giới đóng vai trò như đinh neo, ghim từng thôn làng vào thực tại trước khi màn sương nuốt mất chúng.
        </p>
        <p>
          Làng Khởi Nguyên là điểm neo đầu tiên còn sáng. Nếu Ấn Giới ở đây tắt, các con đường phía nam sẽ trượt khỏi bản đồ,
          còn người dân trong làng sẽ thức dậy mà không nhớ họ từng có tên.
        </p>
        <p>
          Trưởng lão Mira canh giữ những ký ức bị đặt lại. Bà nhớ các mảnh đời sau mỗi lần vương quốc sụp rồi hồi sinh,
          và bà là người đầu tiên nhận ra dấu khắc trên linh hồn bạn.
        </p>
        <p>
          Bạn là Kẻ Được Khắc Tên Lại, một kẻ ngoại giới được viết trở về sau mỗi lần cõi này reset. Khi những người khác quên,
          dấu tên của bạn vẫn cháy âm ỉ trong Mạch Giới.
        </p>
        <p>
          Vàng là đồng tiền thông dụng của vương quốc. Kim Cương Lam là tinh thể mana lam kết tụ qua Tuần Lệnh và những thử thách hiếm.
          Ruby Đỏ là huyết ngọc thần quyền, chỉ đi qua nạp đã duyệt hoặc sắc chỉ quản trị từ Thần Điện Quang Hổ.
        </p>
        <p>
          Nhật Lệnh là lời thề mỗi ngày để giữ Thần Miếu không tắt. Tuần Lệnh là lời thề lớn hơn, được viết thẳng vào Mạch Giới
          để chống lại vết mục đang lan từ dưới nền thủ đô cũ.
        </p>
        <p>
          Có thứ gì đó đang ăn mòn Ấn Giới từ bên dưới kinh thành đã mất. Hãy chọn nhịp hướng dẫn phù hợp,
          rồi bước vào Làng Khởi Nguyên trước khi mỏ neo đầu tiên vỡ thêm một lần nữa.
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
