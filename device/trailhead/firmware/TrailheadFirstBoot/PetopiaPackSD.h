#pragma once

#include "PetopiaPack.h"

namespace petopia {

struct PackRecord {
  uint32_t format, revision, size;
};

static const char *const packPaths[] = {"/petopia-a.pack", "/petopia-b.pack"};
static constexpr char pendingPackPath[] = "/petopia-download.tmp";
static const char *const packKeys[] = {"petPackA", "petPackB"};
static PackDirectory activePack;
static PackRecord activePackRecord{};
static int activePackSlot = -1;
static bool petopiaAssetsBusy = false;
static bool assetRepairRequested = false;

static bool loadPackSlot(int slot, const PackRecord &record, PackDirectory &directory) {
  if (record.format != artworkFormat || !record.revision || !record.size) return false;
  File file = SD_MMC.open(packPaths[slot], FILE_READ);
  return file && readPackDirectory(file, record.size, directory);
}

static void restoreAssetPack() {
  if (activePackSlot >= 0) return;
  PackRecord records[2]{};
  for (int slot = 0; slot < 2; ++slot) {
    if (prefs.getBytesLength(packKeys[slot]) == sizeof(PackRecord) &&
        prefs.getBytes(packKeys[slot], &records[slot], sizeof(PackRecord)) != sizeof(PackRecord))
      records[slot] = {};
  }
  const int newest = records[1].revision > records[0].revision ? 1 : 0;
  for (int attempt = 0; attempt < 2; ++attempt) {
    const int slot = attempt == 0 ? newest : 1 - newest;
    if (loadPackSlot(slot, records[slot], activePack)) {
      activePackSlot = slot;
      activePackRecord = records[slot];
      return;
    }
  }
}

static bool activateAssetPack(const PackRecord &record) {
  const int slot = activePackSlot == 0 ? 1 : 0;
  if (prefs.getBytesLength(packKeys[slot]) && !prefs.remove(packKeys[slot])) return false;
  if (SD_MMC.exists(packPaths[slot]) && !SD_MMC.remove(packPaths[slot])) return false;
  if (!SD_MMC.rename(pendingPackPath, packPaths[slot])) return false;
  PackDirectory directory;
  if (!loadPackSlot(slot, record, directory) ||
      prefs.putBytes(packKeys[slot], &record, sizeof(record)) != sizeof(record)) return false;
  activePack = directory;
  activePackRecord = record;
  activePackSlot = slot;
  return true;
}

class ArtworkFile {
 public:
  ArtworkFile(const String &name, const char *legacyDirectory, bool usePack = true) {
    if (usePack) {
      if (activePackSlot < 0) return;
      const auto *entry = activePack.find(name.c_str());
      if (!entry) return;
      file = SD_MMC.open(packPaths[activePackSlot], FILE_READ);
      if (!file || !file.seek(entry->offset)) return;
      length = entry->size;
    } else {
      file = SD_MMC.open(String(legacyDirectory) + name, FILE_READ);
      if (!file) return;
      length = file.size();
    }
    remaining = length;
  }

  explicit operator bool() const { return length != 0; }
  size_t size() const { return length; }
  size_t read(uint8_t *bytes, size_t count) {
    if (count > remaining) return 0;
    const size_t result = file.read(bytes, count);
    if (result > count) return 0;
    remaining -= result;
    return result;
  }

 private:
  File file;
  size_t length = 0;
  size_t remaining = 0;
};

}  // namespace petopia
