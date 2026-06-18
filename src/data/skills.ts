import type { CharacterClassId, SkillDefinition } from "./types.js";

export const skillDefinitions: SkillDefinition[] = [
  {
    skillId: "normal-attack",
    classId: "warrior",
    name: "Focused Strike",
    description: "A basic attack upgrade that costs no MP.",
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
    name: "Slash",
    description: "A heavy melee strike with strong attack scaling.",
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
    name: "Fireball",
    description: "Launches a short-lived flame projectile at a target.",
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
    name: "Arrow Shot",
    description: "A precise ranged shot.",
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
    name: "Heal",
    description: "Restores HP based on magic attack.",
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
    name: "Shadow Strike",
    description: "A fast strike with bonus luck scaling.",
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
