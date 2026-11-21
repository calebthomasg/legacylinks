#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace petopia {

// Indices follow the existing renderer's coat, pattern, nose, and eye tables.
struct CatAppearance {
  uint8_t coat;
  uint8_t pattern;
  uint8_t nose;
  uint8_t eye;
};

constexpr unsigned coatCount = 4;
constexpr unsigned patternCount = 5;
constexpr unsigned noseCount = 6;
constexpr unsigned eyeCount = 10;
constexpr unsigned starterCount = 5;
constexpr unsigned appearanceCount = coatCount * patternCount * noseCount * eyeCount;

inline bool validAppearance(const CatAppearance &cat) {
  return cat.coat < coatCount && cat.pattern < patternCount &&
         cat.nose < noseCount && cat.eye < eyeCount;
}

inline CatAppearance appearanceFromIndex(unsigned index) {
  const auto eye = uint8_t(index % eyeCount);
  index /= eyeCount;
  const auto nose = uint8_t(index % noseCount);
  index /= noseCount;
  const auto pattern = uint8_t(index % patternCount);
  return {uint8_t(index / patternCount), pattern, nose, eye};
}

class StarterCarousel {
 public:
  // drawBelow takes an exclusive upper bound. Draw without replacement so every
  // position shows a distinct combination, even when the random draw repeats.
  template <typename DrawBelow>
  explicit StarterCarousel(DrawBelow drawBelow) {
    unsigned chosen[starterCount]{};
    for (unsigned i = 0; i < starterCount; ++i) {
      unsigned index = drawBelow(appearanceCount - i);
      for (unsigned j = 0; j < i; ++j) {
        if (chosen[j] <= index) ++index;
      }
      unsigned insertion = i;
      while (insertion && chosen[insertion - 1] > index) {
        chosen[insertion] = chosen[insertion - 1];
        --insertion;
      }
      chosen[insertion] = index;
      candidates_[i] = appearanceFromIndex(index);
    }
  }

  unsigned position() const { return selected_; }
  const CatAppearance &visibleCat() const { return candidates_[selected_]; }
  bool confirming() const { return confirming_; }

  void move(bool next) {
    if (confirming_) return;
    selected_ = (selected_ + (next ? 1 : starterCount - 1)) % starterCount;
  }
  void openConfirmation() { confirming_ = true; }
  void keepBrowsing() { confirming_ = false; }

 private:
  CatAppearance candidates_[starterCount]{};
  unsigned selected_ = 0;
  bool confirming_ = false;
};

constexpr std::size_t nameCapacity = 24;
constexpr uint8_t starterRecordVersion = 1;

// This is separate from the preview's petCat preference. A preview selection
// does not establish ownership or grant food.
struct StarterPet {
  uint64_t id = 0;
  CatAppearance appearance{};
  char name[nameCapacity]{};
  bool hasStarterFood = false;
};

// Store explicit bytes so a firmware upgrade does not depend on struct padding.
using StarterRecord = std::array<uint8_t, 14 + nameCapacity>;

inline StarterRecord encodeStarterPet(const StarterPet &pet) {
  StarterRecord bytes{};
  bytes[0] = starterRecordVersion;
  for (unsigned i = 0; i < 8; ++i) bytes[1 + i] = uint8_t(pet.id >> (i * 8));
  bytes[9] = pet.appearance.coat;
  bytes[10] = pet.appearance.pattern;
  bytes[11] = pet.appearance.nose;
  bytes[12] = pet.appearance.eye;
  bytes[13] = pet.hasStarterFood ? 1 : 0;
  for (std::size_t i = 0; i < nameCapacity; ++i) bytes[14 + i] = uint8_t(pet.name[i]);
  return bytes;
}

inline bool decodeStarterPet(const StarterRecord &bytes, StarterPet &out) {
  if (bytes[0] != starterRecordVersion || bytes[13] > 1 ||
      !bytes[14] || bytes.back() != 0) return false;
  StarterPet pet;
  for (unsigned i = 0; i < 8; ++i) pet.id |= uint64_t(bytes[1 + i]) << (i * 8);
  pet.appearance = {bytes[9], bytes[10], bytes[11], bytes[12]};
  if (!pet.id || !validAppearance(pet.appearance)) return false;
  pet.hasStarterFood = bytes[13] == 1;
  for (std::size_t i = 0; i < nameCapacity; ++i) pet.name[i] = char(bytes[14 + i]);
  out = pet;
  return true;
}

enum class StarterAction { Saved, Unavailable, InvalidIdentity, SaveFailed };

class StarterAdoption {
 public:
  const StarterPet &pet() const { return pet_; }
  bool adopted() const { return pet_.id != 0; }
  bool restore(const StarterRecord &bytes) { return decodeStarterPet(bytes, pet_); }

  // The caller supplies device-generated identity and the randomly chosen name.
  // Persist must return true only when the complete replacement record is saved.
  template <typename Persist>
  StarterAction confirm(StarterCarousel &carousel, uint64_t id, const char *name, Persist persist) {
    if (adopted() || !carousel.confirming()) return StarterAction::Unavailable;
    if (!id || !name || !*name) return StarterAction::InvalidIdentity;
    StarterPet candidate;
    for (std::size_t i = 0; name[i]; ++i) {
      if (i + 1 == nameCapacity) return StarterAction::InvalidIdentity;
      candidate.name[i] = name[i];
    }
    candidate.id = id;
    candidate.appearance = carousel.visibleCat();
    candidate.hasStarterFood = true;
    if (!persist(encodeStarterPet(candidate))) return StarterAction::SaveFailed;
    pet_ = candidate;
    carousel.keepBrowsing();
    return StarterAction::Saved;
  }

  template <typename Persist>
  StarterAction feedStarterFood(Persist persist) {
    if (!adopted() || !pet_.hasStarterFood) return StarterAction::Unavailable;
    StarterPet candidate = pet_;
    candidate.hasStarterFood = false;
    if (!persist(encodeStarterPet(candidate))) return StarterAction::SaveFailed;
    pet_ = candidate;
    return StarterAction::Saved;
  }

 private:
  StarterPet pet_{};
};

}  // namespace petopia
