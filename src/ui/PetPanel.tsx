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
      .catch(() => addWarning("Tải thú cưng thất bại."));
  };

  const equip = (petId: string) => {
    void equipPet(petId, player)
      .then((response) => {
        setPets(response.pets);
        setPlayer(response.player);
      })
      .catch(() => addWarning("Trang bị thú cưng thất bại."));
  };

  const unequip = () => {
    void unequipPet(player)
      .then((response) => {
        setPets(response.pets);
        setPlayer(response.player);
      })
      .catch(() => addWarning("Gỡ thú cưng thất bại."));
  };

  const addExp = (petId: string) => {
    void savePetExp(petId, 20, player)
      .then((response) => {
        setPets(response.pets);
        setPlayer(response.player);
      })
      .catch(() => addWarning("Lưu kinh nghiệm thú cưng thất bại."));
  };

  return (
    <section className="pet-panel" aria-label="Thú cưng">
      <header>
        <h2>Thú cưng</h2>
        <button type="button" onClick={refresh}>Làm mới</button>
      </header>
      {activePet && activeDefinition && (
        <div className="pet-active">
          <strong>{activeDefinition.icon} {activeDefinition.name}</strong>
          <span>Đang dùng - Cấp {activePet.level}</span>
          <small>
            Cộng công {activeBonus?.attack ?? 0}, thủ {activeBonus?.defense ?? 0}, máu {activeBonus?.maxHp ?? 0}
          </small>
          <button type="button" onClick={unequip}>Gỡ</button>
        </div>
      )}
      <div className="pet-list">
        {pets.map((pet) => {
          const definition = findPetDefinition(pet.petId);
          if (!definition) return null;
          return (
            <article key={pet.petId} data-active={pet.active}>
              <strong>{definition.icon} {definition.name}</strong>
              <span>{definition.rarity} - {definition.type}</span>
              <small>Cấp {pet.level} - Kinh nghiệm {pet.exp}</small>
              <p>{definition.description}</p>
              <div>
                <button type="button" disabled={pet.active} onClick={() => equip(pet.petId)}>Trang bị</button>
                <button type="button" onClick={() => addExp(pet.petId)}>+Kinh nghiệm</button>
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
