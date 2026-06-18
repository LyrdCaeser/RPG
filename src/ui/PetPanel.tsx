import { equipPet, getPetsMe, savePetExp, unequipPet } from "../api/client";
import { findPetDefinition } from "../data/pets";
import { useGameStore } from "../store/useGameStore";

export function PetPanel() {
  const player = useGameStore((state) => state.player);
  const pets = useGameStore((state) => state.pets);
  const setPets = useGameStore((state) => state.setPets);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const addWarning = useGameStore((state) => state.addWarning);
  if (!player) return null;

  const activePet = pets.find((pet) => pet.active);
  const activeDefinition = findPetDefinition(activePet?.petId);
  const activeBonus = activeDefinition ? getPetBonus(activeDefinition, activePet?.level ?? 1) : null;

  const refresh = () => {
    void getPetsMe()
      .then((response) => setPets(response.pets))
      .catch(() => addWarning("Pet load failed."));
  };

  const equip = (petId: string) => {
    void equipPet(petId, player)
      .then((response) => {
        setPets(response.pets);
        setPlayer(response.player);
      })
      .catch(() => addWarning("Pet equip failed."));
  };

  const unequip = () => {
    void unequipPet(player)
      .then((response) => {
        setPets(response.pets);
        setPlayer(response.player);
      })
      .catch(() => addWarning("Pet unequip failed."));
  };

  const addExp = (petId: string) => {
    void savePetExp(petId, 20, player)
      .then((response) => {
        setPets(response.pets);
        setPlayer(response.player);
      })
      .catch(() => addWarning("Pet exp save failed."));
  };

  return (
    <section className="pet-panel" aria-label="Pets">
      <header>
        <h2>Pets</h2>
        <button type="button" onClick={refresh}>Refresh</button>
      </header>
      {activePet && activeDefinition && (
        <div className="pet-active">
          <strong>{activeDefinition.icon} {activeDefinition.name}</strong>
          <span>Active · Lv {activePet.level}</span>
          <small>
            Bonus atk {activeBonus?.attack ?? 0}, def {activeBonus?.defense ?? 0}, hp {activeBonus?.maxHp ?? 0}
          </small>
          <button type="button" onClick={unequip}>Unequip</button>
        </div>
      )}
      <div className="pet-list">
        {pets.map((pet) => {
          const definition = findPetDefinition(pet.petId);
          if (!definition) return null;
          return (
            <article key={pet.petId} data-active={pet.active}>
              <strong>{definition.icon} {definition.name}</strong>
              <span>{definition.rarity} · {definition.type}</span>
              <small>Lv {pet.level} · EXP {pet.exp}</small>
              <p>{definition.description}</p>
              <div>
                <button type="button" disabled={pet.active} onClick={() => equip(pet.petId)}>Equip</button>
                <button type="button" onClick={() => addExp(pet.petId)}>+EXP</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getPetBonus(definition: NonNullable<ReturnType<typeof findPetDefinition>>, level: number) {
  const growth = Math.max(0, level - 1);
  return {
    attack: (definition.baseStats.attack ?? 0) + (definition.growthPerLevel.attack ?? 0) * growth,
    defense: (definition.baseStats.defense ?? 0) + (definition.growthPerLevel.defense ?? 0) * growth,
    maxHp: (definition.baseStats.maxHp ?? 0) + (definition.growthPerLevel.maxHp ?? 0) * growth
  };
}
