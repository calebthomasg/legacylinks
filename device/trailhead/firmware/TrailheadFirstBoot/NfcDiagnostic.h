#pragma once
#include <PN532.h>
#include <PN532_HSU.h>

namespace nfcDiagnostic {
constexpr uint8_t rxPin = 44;
constexpr uint8_t txPin = 43;
constexpr uint32_t scanWindowMs = 12000;
constexpr size_t maxTagBytes = 224;

enum class Status {
  Missing, SetupFailed, Ready, NoTag, TagOnly, OtherLink, LegacyLink
};
struct Result {
  Status status;
  char uid[30];
};
static QueueHandle_t results = nullptr;
static bool running = false;
static lv_obj_t *reading = nullptr;

// Type 2 user memory consists of TLVs. Inspect complete NDEF messages only.
static bool hasUri(const uint8_t *data, size_t size, bool &legacy) {
  for (size_t offset = 0; offset < size;) {
    const uint8_t type = data[offset++];
    if (type == 0) continue;
    if (type == 0xfe || offset == size) break;
    size_t length = data[offset++];
    if (length == 0xff) {
      if (size - offset < 2) break;
      length = (size_t(data[offset]) << 8) | data[offset + 1];
      offset += 2;
    }
    if (length > size - offset) break;
    const size_t end = offset + length;
    if (type != 3) {
      offset = end;
      continue;
    }
    while (end - offset >= 3) {
      const uint8_t flags = data[offset++];
      const uint8_t typeLength = data[offset++];
      const unsigned lengthBytes = (flags & 0x10) ? 1 : 4;
      if (end - offset < lengthBytes || (flags & 0x20)) break;
      uint32_t payloadLength = 0;
      for (unsigned i = 0; i < lengthBytes; ++i)
        payloadLength = (payloadLength << 8) | data[offset++];
      if ((flags & 0x08) && offset == end) break;
      const size_t idLength = (flags & 0x08) ? data[offset++] : 0;
      const size_t overhead = typeLength + idLength;
      if (overhead > end - offset || payloadLength > end - offset - overhead) break;
      const uint8_t *payload = data + offset + overhead;
      if ((flags & 7) == 1 && typeLength == 1 && data[offset] == 'U' && payloadLength >= 2) {
        const uint8_t prefix = payload[0];
        const uint8_t *uri = payload + 1;
        const size_t uriLength = payloadLength - 1;
        const auto startsWith = [uri, uriLength](const char *value) {
          const size_t n = strlen(value);
          return uriLength > n && memcmp(uri, value, n) == 0;
        };
        legacy = ((prefix == 1 || prefix == 2 || prefix == 3 || prefix == 4) &&
                  startsWith("legacylinks.io/n/")) ||
                 ((prefix == 3 || prefix == 4) && startsWith("www.legacylinks.io/n/")) ||
                 (prefix == 0 && (startsWith("https://www.legacylinks.io/n/") ||
                                  startsWith("https://legacylinks.io/n/") ||
                                  startsWith("http://www.legacylinks.io/n/") ||
                                  startsWith("http://legacylinks.io/n/")));
        return true;
      }
      offset += overhead + payloadLength;
    }
    return false;
  }
  return false;
}

static bool readPages(PN532_HSU &link, uint8_t target, uint8_t page, uint8_t (&data)[17]) {
  const uint8_t request[] = {PN532_COMMAND_INDATAEXCHANGE, target, MIFARE_CMD_READ, page};
  return link.writeCommand(request, sizeof(request)) == 0 &&
         link.readResponse(data, sizeof(data), 220) == sizeof(data) &&
         (data[0] & 0x7f) == 0;
}

static Status readTag(PN532_HSU &link, uint8_t target) {
  uint8_t chunk[17]{};
  if (!readPages(link, target, 3, chunk) || chunk[1] != 0xe1) return Status::TagOnly;
  const size_t capacity = size_t(chunk[3]) * 8;
  const size_t limit = capacity < maxTagBytes ? capacity : maxTagBytes;
  uint8_t memory[maxTagBytes]{};
  for (size_t used = 0; used < limit; used += 16) {
    if (!readPages(link, target, uint8_t(4 + used / 4), chunk)) break;
    const size_t count = limit - used < 16 ? limit - used : 16;
    memcpy(memory + used, chunk + 1, count);
    bool legacy = false;
    if (hasUri(memory, used + count, legacy))
      return legacy ? Status::LegacyLink : Status::OtherLink;
  }
  return Status::TagOnly;
}

static Result scan() {
  Serial0.begin(115200, SERIAL_8N1, rxPin, txPin);
  PN532_HSU link(Serial0);
  link.wakeup();
  vTaskDelay(pdMS_TO_TICKS(20));
  PN532 reader(link);
  const uint32_t firmware = reader.getFirmwareVersion();
  if ((firmware >> 24) != 0x32) return {Status::Missing, {}};
  if (!reader.SAMConfig() || !reader.setPassiveActivationRetries(1))
    return {Status::SetupFailed, {}};

  const Result ready{Status::Ready, {}};
  xQueueOverwrite(results, &ready);
  const uint32_t started = millis();
  const uint8_t request[] = {PN532_COMMAND_INLISTPASSIVETARGET, 1, PN532_MIFARE_ISO14443A};
  while (millis() - started < scanWindowMs) {
    uint8_t response[48]{};
    if (link.writeCommand(request, sizeof(request)) == 0) {
      const int length = link.readResponse(response, sizeof(response), 220);
      if (length >= 6 && response[0] == 1) {
        const unsigned uidLength = response[5];
        if ((uidLength == 4 || uidLength == 7 || uidLength == 10) &&
            unsigned(length) >= 6 + uidLength) {
          Result found{readTag(link, response[1]), {}};
          static const char hex[] = "0123456789ABCDEF";
          for (unsigned i = 0; i < uidLength; ++i) {
            const uint8_t byte = response[6 + i];
            found.uid[3 * i] = hex[byte >> 4];
            found.uid[3 * i + 1] = hex[byte & 0xf];
            if (i + 1 < uidLength) found.uid[3 * i + 2] = ':';
          }
          return found;
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(80));
  }
  return {Status::NoTag, {}};
}

static void worker(void *) {
  const Result result = scan();
  xQueueOverwrite(results, &result);
  vTaskDelete(nullptr);
}

static void start() {
  if (running) return;
  if (!results) results = xQueueCreate(1, sizeof(Result));
  if (results && xTaskCreate(worker, "nfc-check", 6144, nullptr, 1, nullptr) == pdPASS) {
    running = true;
    updateLabel(reading, "Checking for NFC reader...");
  } else {
    updateLabel(reading, "Could not start the test");
  }
}

static void show() {
  clearPage(NFC_DIAGNOSTIC);
  navBackground();
  navTitle(6, "NFC Diagnostic");
  reading = navLabel(running ? "Scanning..." : "Tap Start scan to test.", 130, 342, &nav_text);
  navAction("Start scan", 321, [](lv_event_t *) { start(); });
  backArrow([](lv_event_t *) { showSettings(); }, navSand());
}

static void service() {
  Result result{};
  if (!results || xQueueReceive(results, &result, 0) != pdTRUE) return;
  running = result.status == Status::Ready;
  if (page != NFC_DIAGNOSTIC) return;

  const char *message = nullptr;
  switch (result.status) {
    case Status::Missing: message = "Reader not detected\nCheck UART and HSU switches"; break;
    case Status::SetupFailed: message = "PN532 detected\nReader setup failed"; break;
    case Status::Ready: message = "PN532 detected\nHold a tag against the reader"; break;
    case Status::NoTag: message = "PN532 detected\nNo tag read. Try again."; break;
    case Status::TagOnly: message = "Tag detected\nNo stored URL read"; break;
    case Status::OtherLink: message = "Tag detected\nURL read"; break;
    case Status::LegacyLink: message = "Tag detected\nLegacyLink URL read"; break;
  }
  char text[128];
  snprintf(text, sizeof(text), "%s%s%s", message, result.uid[0] ? "\nUID " : "", result.uid);
  updateLabel(reading, text);
}
} // namespace nfcDiagnostic
