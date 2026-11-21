#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>

namespace petopia {

constexpr uint32_t artworkFormat = 1;
constexpr uint32_t maximumPackSize = 8 * 1024 * 1024;
constexpr unsigned maximumPackEntries = 64;
constexpr unsigned packNameBytes = 40;
constexpr uint32_t packHeaderBytes = 12;
constexpr uint32_t packEntryBytes = packNameBytes + 8;

inline uint32_t packNumber(const uint8_t *p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

struct PackEntry {
  char name[packNameBytes];
  uint32_t offset, size;
};

struct PackDirectory {
  unsigned count = 0;
  PackEntry entries[maximumPackEntries];

  const PackEntry *find(const char *name) const {
    for (unsigned i = 0; i < count; ++i) {
      if (!std::strcmp(entries[i].name, name)) return &entries[i];
    }
    return nullptr;
  }
};

template <typename Reader>
bool readPackDirectory(Reader &file, uint32_t expectedSize, PackDirectory &out) {
  out.count = 0;
  if (expectedSize > maximumPackSize || expectedSize != file.size()) return false;
  uint8_t header[packHeaderBytes];
  if (file.read(header, sizeof(header)) != sizeof(header) || std::memcmp(header, "PTPK", 4) ||
      packNumber(header + 4) != artworkFormat) return false;
  const auto count = packNumber(header + 8);
  if (!count || count > maximumPackEntries) return false;
  uint32_t end = packHeaderBytes + count * packEntryBytes;
  for (unsigned i = 0; i < count; ++i) {
    uint8_t bytes[packEntryBytes];
    if (file.read(bytes, sizeof(bytes)) != sizeof(bytes) || !bytes[0] ||
        bytes[packNameBytes - 1] != 0) return false;
    auto &entry = out.entries[i];
    std::memcpy(entry.name, bytes, packNameBytes);
    entry.offset = packNumber(bytes + packNameBytes);
    entry.size = packNumber(bytes + packNameBytes + 4);
    for (unsigned j = 0; j < i; ++j) {
      if (!std::strcmp(out.entries[j].name, entry.name)) return false;
    }
    if (entry.offset != end || end > expectedSize || !entry.size || entry.size > expectedSize - end)
      return false;
    end += entry.size;
  }
  if (end != expectedSize) return false;
  out.count = count;
  return true;
}

// The same bounded copy runs with HTTPS and microSD in firmware and with fault
// injection on the host. Activation is separate from writing these bytes.
template <typename Read, typename Write, typename Progress>
bool copyPack(uint32_t size, Read read, Write write, Progress progress) {
  uint8_t chunk[4096];
  uint32_t received = 0;
  while (received < size) {
    const size_t remaining = size - received;
    const size_t wanted = remaining < sizeof(chunk) ? remaining : sizeof(chunk);
    const int count = read(chunk, wanted);
    if (count <= 0 || size_t(count) > wanted || write(chunk, count) != size_t(count)) return false;
    received += count;
    progress(received);
  }
  return true;
}

}  // namespace petopia
