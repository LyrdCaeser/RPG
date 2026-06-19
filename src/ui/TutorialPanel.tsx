import type { GuidanceLevel, PlayerOnboarding, TutorialStepId } from "../data/types";
import { tutorialStepOrder } from "../data/tutorial";

interface TutorialPanelProps {
  onboarding: PlayerOnboarding;
  collapsed: boolean;
  busyStep: TutorialStepId | "skip" | null;
  onSkip: () => void;
  onFinish: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}

const guidanceLabels: Record<GuidanceLevel, string> = {
  newbie: "Người Mới",
  trainer: "Luyện Sư",
  master_cg: "Thành Thạo CG"
};

const stepCopy: Record<TutorialStepId, { title: string; body: string; goal: string }> = {
  move: {
    title: "Di chuyển",
    body: "Dùng WASD hoặc phím mũi tên để đi quanh làng và làm quen với bản đồ.",
    goal: "Di chuyển nhân vật một đoạn ngắn."
  },
  talk_to_mira: {
    title: "Nói chuyện NPC",
    body: "Tìm Trưởng lão Mira trong làng. Khi đứng gần NPC, mở hội thoại để nghe chỉ dẫn.",
    goal: "Nói chuyện với Trưởng lão Mira."
  },
  accept_first_quest: {
    title: "Nhận nhiệm vụ",
    body: "Trong khung hội thoại của Mira, nhận nhiệm vụ đầu tiên để bắt đầu hành trình tân thủ.",
    goal: "Nhận nhiệm vụ Những bước đầu."
  },
  collect_item: {
    title: "Thu thập vật phẩm",
    body: "Ra khu vực được đánh dấu và thu thập đá mốc hoặc thảo mộc có sẵn trên bản đồ.",
    goal: "Nhặt hoặc thu thập một vật phẩm."
  },
  defeat_green_slime: {
    title: "Đánh Slime xanh",
    body: "Tiếp cận Slime xanh yếu ngoài đồng và hạ nó bằng đòn đánh hoặc kỹ năng hiện có.",
    goal: "Đánh bại một Slime xanh."
  },
  open_inventory: {
    title: "Mở Hành trang",
    body: "Bấm phím I hoặc nút Hành trang để xem vật phẩm đã nhặt được.",
    goal: "Mở Hành trang."
  },
  use_first_skill: {
    title: "Dùng kỹ năng đầu tiên",
    body: "Dùng kỹ năng có sẵn trên thanh phím tắt khi đang chiến đấu hoặc khi kỹ năng cho phép sử dụng.",
    goal: "Dùng một kỹ năng hiện có."
  },
  save_progress: {
    title: "Lưu tiến trình",
    body: "Game tự động lưu lên cơ sở dữ liệu. Bạn cũng có thể bấm Lưu ở góc phải để lưu thủ công.",
    goal: "Đợi tự động lưu hoặc bấm Lưu thủ công."
  },
  complete_newbie: {
    title: "Hoàn thành tân thủ",
    body: "Bạn đã nắm các thao tác cơ bản. Xác nhận để kết thúc hướng dẫn và tiếp tục phiêu lưu.",
    goal: "Bấm Hoàn thành hướng dẫn."
  }
};

export function TutorialPanel({ onboarding, collapsed, busyStep, onSkip, onFinish, onExpand, onCollapse }: TutorialPanelProps) {
  const guidanceLevel = onboarding.guidanceLevel ?? "newbie";
  const completedSteps = onboarding.tutorialCompletedSteps ?? [];
  const currentStep = onboarding.tutorialStepId ?? "move";
  const copy = stepCopy[currentStep];
  const canSkip = guidanceLevel !== "newbie";
  const progress = Math.min(completedSteps.length, tutorialStepOrder.length);

  if (collapsed) {
    return (
      <button type="button" className="tutorial-pill" onClick={onExpand}>
        Hướng dẫn: {copy.title}
      </button>
    );
  }

  return (
    <aside className="tutorial-panel" aria-label="Hướng dẫn tân thủ">
      <header>
        <div>
          <span>{guidanceLabels[guidanceLevel]}</span>
          <h2>{copy.title}</h2>
        </div>
        <button type="button" onClick={onCollapse} aria-label="Thu gọn hướng dẫn">
          Thu gọn
        </button>
      </header>
      <p>{copy.body}</p>
      <strong>{copy.goal}</strong>
      <div className="tutorial-progress" aria-label="Tiến trình hướng dẫn">
        {tutorialStepOrder.map((stepId, index) => (
          <span
            key={stepId}
            data-active={stepId === currentStep}
            data-complete={completedSteps.includes(stepId)}
            title={stepCopy[stepId].title}
          >
            {index + 1}
          </span>
        ))}
      </div>
      <footer>
        <small>
          {progress}/{tutorialStepOrder.length} bước đã lưu
        </small>
        {currentStep === "complete_newbie" && (
          <button type="button" disabled={busyStep === "complete_newbie"} onClick={onFinish}>
            {busyStep === "complete_newbie" ? "Đang lưu..." : "Hoàn thành hướng dẫn"}
          </button>
        )}
        {canSkip && (
          <button type="button" className="ghost-button" disabled={busyStep === "skip"} onClick={onSkip}>
            {busyStep === "skip" ? "Đang bỏ qua..." : "Bỏ qua hướng dẫn"}
          </button>
        )}
      </footer>
    </aside>
  );
}
