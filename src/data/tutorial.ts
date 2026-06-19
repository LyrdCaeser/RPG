import type { TutorialStepId } from "./types.js";

export const tutorialStepOrder: TutorialStepId[] = [
  "move",
  "talk_to_mira",
  "accept_first_quest",
  "collect_item",
  "defeat_green_slime",
  "open_inventory",
  "use_first_skill",
  "save_progress",
  "complete_newbie"
];

export function getCurrentTutorialStep(completedSteps: TutorialStepId[] = []) {
  return tutorialStepOrder.find((stepId) => !completedSteps.includes(stepId)) ?? "complete_newbie";
}

export function isTutorialStepId(value: unknown): value is TutorialStepId {
  return typeof value === "string" && tutorialStepOrder.includes(value as TutorialStepId);
}
