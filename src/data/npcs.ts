import type { NpcDefinition } from "./types.js";

export const npcDefinitions: NpcDefinition[] = [
  {
    id: "elder-mira",
    name: "Trưởng lão Mira",
    role: "Người giữ ký ức đặt lại",
    x: 256,
    y: 224,
    questId: "first-steps",
    tutorialDialogue: [
      "Con vừa tỉnh lại đúng lúc Ấn Giới phía nam rung chuyển.",
      "Ta là Mira, người còn nhớ vài mảnh ký ức sau mỗi lần Kingdom 3 sụp rồi hồi sinh.",
      "Trước hết hãy hít thở, bước vài bước, rồi đến gần ta. Mạch Giới cần biết tên con vẫn còn được khắc lại.",
      "Khi đã sẵn sàng, hãy nhận việc đầu tiên. Làng Khởi Nguyên cần một người dám đi qua sương trắng."
    ],
    dialogue: {
      locked: [
        "Bức tường đá vẫn đứng vững, nhưng vết nứt trên Ấn Giới đang lan nhanh.",
        "Hãy giúp những người khác trước khi con đi sâu hơn."
      ],
      available: [
        "Ta là Mira, người giữ ký ức đặt lại của Làng Khởi Nguyên.",
        "Đêm qua, các mốc đá trên Mạch Giới dịch chuyển, còn Slime xanh tụ lại gần cổng như bị ai đó gọi tên.",
        "Con hãy kiểm tra mốc đá, dọn bọn slime yếu và quay về báo cho ta. Nếu tên con thật sự được khắc lại, Ấn Giới sẽ đáp lời."
      ],
      active: [
        "Đá mốc sẽ cho thấy Mạch Giới đã lệch khỏi lòng đất ở đâu.",
        "Nếu gặp Slime xanh, đừng hoảng. Chúng yếu, nhưng đi thành đàn thì rất phiền.",
        "Trở lại khi con đã kiểm tra đủ dấu vết."
      ],
      completed: [
        "Ta thấy bụi đường trên áo choàng của con. Tốt lắm.",
        "Những mốc đá đã được ghi lại, Ấn Giới ở rìa làng sẽ đứng vững thêm một đêm.",
        "Hãy nhận phần thưởng, rồi đến gặp Oro ở lò rèn."
      ],
      claimed: [
        "Bức tường đã yên hơn, nhưng kim loại trong làng đang hát một điềm lạ từ dưới kinh thành cũ.",
        "Oro có đôi tai nghe được tiếng của sắt. Hãy đến chỗ ông ấy."
      ],
      default: ["Hãy để mắt tới ranh giới. Mỗi vết nứt trên Ấn Giới đều là một ký ức chưa chịu chết."]
    }
  },
  {
    id: "blacksmith-oro",
    name: "Oro",
    role: "Thợ rèn già của làng",
    x: 704,
    y: 352,
    questId: "iron-memory",
    dialogue: {
      locked: [
        "Lò rèn chưa sẵn sàng cho con.",
        "Hãy nghe Mira trước. Người già thường nói dài, nhưng lần này bà ấy đúng."
      ],
      available: [
        "Ta là Oro. Sắt tốt biết nhớ bàn tay từng cầm nó.",
        "Gần rừng trắng có quặng lạ đang lạnh đi rất nhanh.",
        "Mang quặng về cho ta và thử lưỡi kiếm với Ma trơi bụi. Nếu nó chịu được, ta sẽ biết hướng rèn tiếp."
      ],
      active: [
        "Quặng sắt nằm dọc con đường vỡ ngoài đồng và trong rừng.",
        "Ma trơi bụi thích bám vào ánh lửa. Đánh nhanh, đừng để chúng kéo dài trận đấu.",
        "Khi đủ quặng và bụi ma trơi tan đi, hãy quay lại lò."
      ],
      completed: [
        "Nghe này... quặng đang kêu trong than hồng.",
        "Nó nhớ tiếng bước chân dưới rừng trắng. Điều đó không bình thường.",
        "Nhận tiền công đi, rồi Lyra sẽ cần con cho tuyến trinh sát."
      ],
      claimed: [
        "Giờ lò rèn đã biết tên con.",
        "Nếu thấy Borin bên cổng, bảo cậu ấy đừng đốt hết củi trăng trong một đêm."
      ],
      default: ["Giữ trang bị khô ráo. Một lưỡi kiếm hoen gỉ phản bội rất nhanh."]
    }
  },
  {
    id: "scout-lyra",
    name: "Lyra",
    role: "Trinh sát rừng trắng",
    x: 416,
    y: 672,
    questId: "scout-route",
    dialogue: {
      locked: [
        "Tôi chưa thể đưa bạn xuống tuyến nam.",
        "Khi lò rèn của Oro xác nhận vũ khí ổn, chúng ta sẽ nói chuyện."
      ],
      available: [
        "Tôi là Lyra. Tôi nhớ từng lối mòn trong rừng, kể cả những lối từng biến mất sau mỗi lần Ấn Giới run lên.",
        "Đội trinh sát mất vài thẻ đánh dấu gần hàng cây phía nam.",
        "Thu hồi thẻ và hạ Hộ vệ cổ đang chặn tuyến đường. Chúng ta cần biết ai đã đánh thức nó từ dưới bóng kinh thành cũ."
      ],
      active: [
        "Thẻ trinh sát thường nằm gần các mốc tuyến đường.",
        "Hộ vệ cổ chậm nhưng rất lì. Đừng để nó dồn bạn vào góc.",
        "Khi tuyến đường sạch, quay lại báo với tôi."
      ],
      completed: [
        "Tuyến đường lại thuộc về chúng ta.",
        "Những vết chân bạn tìm thấy hướng về cổng làng, không phải sâu trong rừng. Có thứ đang lần theo Mạch Giới để tìm Làng Khởi Nguyên.",
        "Nhận túi thưởng trinh sát, rồi hỏi Borin vì sao đêm nào cổng cũng sáng."
      ],
      claimed: [
        "Nhờ bạn mà đội trinh sát có thể di chuyển trở lại.",
        "Nếu đi vào rừng trắng, hãy nhớ: tiếng lá im lặng mới là thứ đáng sợ."
      ],
      default: ["Đi thấp người trên đường phía nam. Rừng trắng nhìn thấy nhiều hơn ta tưởng."]
    }
  },
  {
    id: "blacksmith-borin",
    name: "Thợ rèn Borin",
    role: "Người giữ lửa bên cổng",
    x: 1008,
    y: 704,
    questId: "gate-fire",
    dialogue: {
      locked: [
        "Tôi đang giữ lửa cho cổng làng.",
        "Hãy giúp Lyra mở lại tuyến trinh sát trước, rồi chúng ta sẽ cần đến củi trăng."
      ],
      available: [
        "Tôi là Borin. Oro rèn kiếm, còn tôi rèn những thứ không ai nhớ tới: bản lề, chốt cổng và đèn canh.",
        "Gió trắng đang thổi tắt đuốc gác. Nếu cổng tối, Ấn Giới sẽ mất một vòng sáng và làng sẽ không thấy thứ đang đến.",
        "Mang cho tôi thảo dược hoang và gỗ trăng. Tôi sẽ trộn dầu đèn chống sương."
      ],
      active: [
        "Thảo dược mọc ngay gần làng, còn gỗ trăng nằm trong rừng trắng.",
        "Đừng đi quá sâu nếu đèn trên cổng bắt đầu nhấp nháy."
      ],
      completed: [
        "Mùi nhựa gỗ trăng đây rồi.",
        "Đèn cổng sẽ cháy qua đêm, nhưng dấu chân ngoài bìa rừng vẫn chưa biến mất. Chúng đi ngược xuống phía thủ đô cũ.",
        "Hãy nhận phần của bạn và nói chuyện với Người gác cổng."
      ],
      claimed: [
        "Lửa đã đứng vững.",
        "Người gác cổng nhìn thấy nhiều thứ hơn anh ta chịu kể."
      ],
      default: ["Một cổng làng tốt không chỉ ngăn kẻ địch, nó còn nhắc người trong làng rằng họ có nhà để trở về."]
    }
  },
  {
    id: "gate-warden",
    name: "Người gác cổng",
    role: "Vệ binh rìa làng",
    x: 1144,
    y: 784,
    questId: "white-forest-trace",
    dialogue: {
      locked: [
        "Cổng chưa mở cho điều tra sâu.",
        "Borin cần giữ lửa trước đã. Không ai bước vào rừng trắng trong bóng tối."
      ],
      available: [
        "Tôi gác cổng này từ khi còn thấp hơn ngọn giáo.",
        "Đêm qua, có dấu kéo lê từ rừng trắng đến tận đá mốc. Không phải dấu người, cũng không phải thứ còn thuộc về mặt đất này.",
        "Tìm pha lê trắng, hạ Ma trơi bụi quanh vệt sáng và quay về. Đừng đuổi theo tiếng gọi trong sương."
      ],
      active: [
        "Pha lê trắng thường mọc nơi sương dày nhất.",
        "Ma trơi bụi tụ lại quanh dấu vết. Nếu chúng tan mà ánh sáng vẫn còn, nghĩa là chúng ta còn rắc rối lớn."
      ],
      completed: [
        "Pha lê vẫn còn lạnh... và vết nứt bên trong có hình như một con mắt. Có kẻ đang nhìn qua Ấn Giới từ bên dưới thủ đô cũ.",
        "Bạn đã làm đủ cho đêm nay. Ta sẽ khóa cổng đến khi Mira đọc được dấu này.",
        "Nhận phần thưởng, rồi nghỉ ngơi trước khi rừng gọi lần nữa."
      ],
      claimed: [
        "Cổng vẫn mở cho bạn, nhưng đừng nhầm điều đó với an toàn.",
        "Khi Mira gọi, câu chuyện thật sự sẽ bắt đầu."
      ],
      default: ["Giữ mắt trên đường, giữ tai trong gió. Cổng là nơi mọi tin xấu ghé qua đầu tiên."]
    }
  }
];
