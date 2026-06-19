import type { CharacterClassId, SkillDefinition } from "./types.js";

export const skillDefinitions: SkillDefinition[] = [
  {
    skillId: "normal-attack",
    classId: "warrior",
    name: "Đòn tập trung",
    description: "Đòn đánh cơ bản nâng cấp, không tốn nội lực.",
    mpCost: 0,
    cooldownMs: 650,
    range: 58,
    damageType: "physical",
    scalingStat: "attack",
    unlockLevel: 1,
    icon: "!"
  },
  {
    skillId: "warrior-slash",
    classId: "warrior",
    name: "Chém mạnh",
    description: "Đòn cận chiến nặng, tăng sức mạnh theo chỉ số tấn công.",
    mpCost: 5,
    cooldownMs: 1800,
    range: 68,
    damageType: "physical",
    scalingStat: "strength",
    unlockLevel: 1,
    icon: "/"
  },
  {
    skillId: "mage-fireball",
    classId: "mage",
    name: "Cầu lửa",
    description: "Phóng một quả cầu lửa tồn tại ngắn về phía mục tiêu.",
    mpCost: 8,
    cooldownMs: 2200,
    range: 220,
    damageType: "magical",
    scalingStat: "intelligence",
    unlockLevel: 1,
    icon: "*"
  },
  {
    skillId: "ranger-arrow-shot",
    classId: "ranger",
    name: "Bắn tên",
    description: "Một phát bắn tầm xa chính xác.",
    mpCost: 4,
    cooldownMs: 1500,
    range: 240,
    damageType: "physical",
    scalingStat: "agility",
    unlockLevel: 1,
    icon: ">"
  },
  {
    skillId: "priest-heal",
    classId: "priest",
    name: "Hồi phục",
    description: "Hồi máu dựa trên sức mạnh phép thuật.",
    mpCost: 9,
    cooldownMs: 3500,
    range: 0,
    damageType: "healing",
    scalingStat: "intelligence",
    unlockLevel: 1,
    icon: "+"
  },
  {
    skillId: "assassin-shadow-strike",
    classId: "assassin",
    name: "Đòn bóng tối",
    description: "Đòn đánh nhanh được cộng thêm sức mạnh theo may mắn.",
    mpCost: 6,
    cooldownMs: 1700,
    range: 72,
    damageType: "physical",
    scalingStat: "luck",
    unlockLevel: 1,
    icon: "x"
  }
];

export function getSkillsForClass(classId?: CharacterClassId) {
  return skillDefinitions.filter((skill) => skill.skillId === "normal-attack" || skill.classId === classId);
}

export function findSkillDefinition(skillId: string) {
  return skillDefinitions.find((skill) => skill.skillId === skillId);
}
