#include "../firmware/TrailheadFirstBoot/PetopiaAdoption.h"

#include <cassert>
#include <cstring>

using namespace petopia;

static unsigned appearanceIndex(const CatAppearance &cat) {
  return ((cat.coat * patternCount + cat.pattern) * noseCount + cat.nose) * eyeCount + cat.eye;
}

int main() {
  for (unsigned draw = 0; draw < appearanceCount; ++draw) {
    StarterCarousel carousel([draw](unsigned bound) { return draw % bound; });
    bool seen[appearanceCount]{};
    for (unsigned i = 0; i < starterCount; ++i) {
      const auto &cat = carousel.visibleCat();
      assert(validAppearance(cat));
      unsigned index = appearanceIndex(cat);
      assert(!seen[index]);
      seen[index] = true;
      carousel.move(true);
    }
    assert(carousel.position() == 0);
    carousel.move(false);
    assert(carousel.position() == starterCount - 1);
  }

  StarterCarousel carousel([](unsigned bound) { return bound - 1; });
  StarterAdoption adoption;
  StarterRecord stored{};
  unsigned writes = 0;
  const auto save = [&](const StarterRecord &bytes) {
    stored = bytes;
    ++writes;
    return true;
  };
  const auto fail = [](const StarterRecord &) { return false; };

  carousel.move(true);
  assert(adoption.confirm(carousel, 1, "Biscuit", save) == StarterAction::Unavailable);
  carousel.openConfirmation();
  carousel.move(true);
  carousel.keepBrowsing();
  assert(carousel.position() == 1 && !adoption.adopted());
  carousel.openConfirmation();
  assert(adoption.confirm(carousel, 0, "Biscuit", save) == StarterAction::InvalidIdentity);
  assert(adoption.confirm(carousel, 1, "A name that is much too long", save) == StarterAction::InvalidIdentity);
  assert(adoption.confirm(carousel, 1, "Biscuit", fail) == StarterAction::SaveFailed);
  assert(carousel.confirming() && !adoption.adopted() && writes == 0);

  const uint64_t id = UINT64_C(0x89562312001100ff);
  assert(adoption.confirm(carousel, id, "Biscuit", save) == StarterAction::Saved);
  carousel.openConfirmation();
  assert(adoption.confirm(carousel, 2, "Pepper", save) == StarterAction::Unavailable);
  assert(writes == 1);

  StarterAdoption reopened;
  assert(reopened.restore(stored));
  assert(reopened.pet().id == id && std::strcmp(reopened.pet().name, "Biscuit") == 0);
  assert(appearanceIndex(reopened.pet().appearance) == appearanceIndex(carousel.visibleCat()));
  assert(reopened.pet().hasStarterFood);
  assert(reopened.feedStarterFood(fail) == StarterAction::SaveFailed);
  assert(reopened.pet().hasStarterFood);
  assert(reopened.feedStarterFood(save) == StarterAction::Saved);
  assert(reopened.feedStarterFood(save) == StarterAction::Unavailable);

  StarterAdoption afterFeeding;
  assert(afterFeeding.restore(stored));
  assert(afterFeeding.pet().id == id && !afterFeeding.pet().hasStarterFood && writes == 2);
  stored[9] = coatCount;
  assert(!afterFeeding.restore(stored));
  assert(afterFeeding.pet().id == id && !afterFeeding.pet().hasStarterFood);
}
