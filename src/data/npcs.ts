import type { NpcDefinition } from "./types.js";

export const npcDefinitions: NpcDefinition[] = [
  {
    id: "elder-mira",
    name: "Elder Mira",
    x: 256,
    y: 224,
    questId: "first-steps",
    dialogue: {
      locked: ["The wall holds for now. Help the others first."],
      available: ["The outer wall has started to crack.", "Take this route and check the marker stones."],
      active: ["The marker stones will show where the ground shifted.", "Return when the slime is gone."],
      completed: ["That should keep the dusk patrol safe.", "Come back for your reward."],
      claimed: ["The wall is steadier now. Oro may have work for you."],
      default: ["Keep your eyes on the boundary."]
    }
  },
  {
    id: "blacksmith-oro",
    name: "Oro",
    x: 704,
    y: 352,
    questId: "iron-memory",
    dialogue: {
      locked: ["The forge is not ready for you yet. Speak with Mira first."],
      available: ["A good blade remembers every fight.", "Bring me ore and test your edge on a Dust Wisp."],
      active: ["Iron ore runs along the broken path.", "The Dust Wisp will not wait politely."],
      completed: ["That ore will sing in the coals.", "Take your pay before the metal cools."],
      claimed: ["The forge knows your name now."],
      default: ["Keep your gear dry and your guard high."]
    }
  },
  {
    id: "scout-lyra",
    name: "Lyra",
    x: 416,
    y: 672,
    questId: "scout-route",
    dialogue: {
      locked: ["I cannot send you south until the forge work is done."],
      available: ["Enemies are nesting near the southern trees.", "Recover our tags and bring down the Old Sentinel."],
      active: ["The scout tags should still be near the route markers.", "Do not let the Sentinel corner you."],
      completed: ["The route is ours again.", "Claim the scout purse before you head out."],
      claimed: ["The scouts can move again because of you."],
      default: ["Stay low on the southern path."]
    }
  }
];
