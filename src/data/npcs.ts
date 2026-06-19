import type { NpcDefinition } from "./types.js";

export const npcDefinitions: NpcDefinition[] = [
  {
    id: "elder-mira",
    name: "Trưởng lão Mira",
    x: 256,
    y: 224,
    questId: "first-steps",
    dialogue: {
      locked: ["Bức tường vẫn trụ được lúc này. Hãy giúp những người khác trước."],
      available: ["Bức tường ngoài đã bắt đầu nứt.", "Đi theo tuyến này và kiểm tra các viên đá mốc."],
      active: ["Đá mốc sẽ cho thấy mặt đất đã dịch chuyển ở đâu.", "Trở lại khi slime đã bị dọn sạch."],
      completed: ["Như vậy đội tuần tra chiều sẽ an toàn hơn.", "Hãy quay lại nhận thưởng."],
      claimed: ["Bức tường đã vững hơn. Oro có thể có việc cho con."],
      default: ["Hãy để mắt tới ranh giới."]
    }
  },
  {
    id: "blacksmith-oro",
    name: "Oro",
    x: 704,
    y: 352,
    questId: "iron-memory",
    dialogue: {
      locked: ["Lò rèn chưa sẵn sàng cho cậu. Hãy nói chuyện với Mira trước."],
      available: ["Một lưỡi kiếm tốt nhớ mọi trận chiến.", "Mang quặng về cho ta và thử lưỡi kiếm với Ma trơi bụi."],
      active: ["Quặng sắt nằm dọc con đường vỡ.", "Ma trơi bụi sẽ không lịch sự chờ đâu."],
      completed: ["Số quặng đó sẽ hát trong than hồng.", "Nhận tiền công trước khi kim loại nguội đi."],
      claimed: ["Giờ lò rèn đã biết tên cậu."],
      default: ["Giữ trang bị khô ráo và luôn đề phòng."]
    }
  },
  {
    id: "scout-lyra",
    name: "Lyra",
    x: 416,
    y: 672,
    questId: "scout-route",
    dialogue: {
      locked: ["Tôi chưa thể đưa bạn xuống phía nam cho đến khi việc ở lò rèn xong."],
      available: ["Kẻ địch đang làm tổ gần hàng cây phía nam.", "Thu hồi thẻ của chúng tôi và hạ Hộ vệ cổ."],
      active: ["Thẻ trinh sát vẫn nên ở gần các mốc tuyến đường.", "Đừng để Hộ vệ dồn bạn vào góc."],
      completed: ["Tuyến đường lại thuộc về chúng ta.", "Nhận túi thưởng trinh sát trước khi lên đường."],
      claimed: ["Nhờ bạn mà đội trinh sát có thể di chuyển trở lại."],
      default: ["Đi thấp người trên đường phía nam."]
    }
  }
];
