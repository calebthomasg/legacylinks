#pragma once

namespace nfcI2cCheck {
constexpr uint8_t address = 0x24;
constexpr uint32_t pollIntervalMs = 25;
constexpr uint32_t replyTimeoutMs = 500;
constexpr uint32_t scanWindowMs = 8000;
constexpr uint8_t ack[] = {0x00, 0x00, 0xff, 0x00, 0xff, 0x00};

enum class Phase { Idle, Probe, Send, Ack, Reply };
enum class Packet { Waiting, Ready, Invalid };
enum class Command : uint8_t {
  Version = 0x02, Sam = 0x14, Configure = 0x32, Poll = 0x4a, Read = 0x40
};

static lv_obj_t *reading = nullptr;
static Phase phase = Phase::Idle;
static Command command = Command::Version;
static uint32_t phaseStarted = 0;
static uint32_t lastPoll = 0;
static uint32_t scanStarted = 0;
static uint8_t target = 0;
static char uid[30]{};
using ScanResult = void (*)(const char *value, const char *status);
static ScanResult scanResult = nullptr;
static uint8_t tagData[(256 - 4) * 4]{};
static size_t tagSize = 0;
static size_t tagCapacity = 0;
static bool beginScan(ScanResult callback = nullptr) {
  if (phase != Phase::Idle) return false;
  command = Command::Sam;
  phase = Phase::Probe;
  tagSize = tagCapacity = 0;
  uid[0] = '\0';
  scanResult = callback;
  return true;
}

// Read the ready byte and a complete frame in one I2C transaction.
static Packet readFrame(uint8_t *frame, size_t size) {
  const size_t count = Wire.requestFrom(address, size + 1);
  if (count == 0) return Packet::Waiting;
  const int status = Wire.read();
  for (size_t i = 0; i < count - 1 && i < size; ++i) frame[i] = uint8_t(Wire.read());
  if (status < 0 || !(status & 1)) return Packet::Waiting;
  return count == size + 1 ? Packet::Ready : Packet::Invalid;
}

static bool decodeReply(const uint8_t *frame, size_t size, Command expected, size_t &payloadSize) {
  if (size < 9 || frame[0] != 0 || frame[1] != 0 || frame[2] != 0xff) return false;
  const size_t length = frame[3];
  if (length < 2 || length + 7 > size || uint8_t(length + frame[4]) != 0 ||
      frame[5] != 0xd5 || frame[6] != uint8_t(uint8_t(expected) + 1) ||
      frame[length + 6] != 0) return false;
  uint8_t checksum = 0;
  for (size_t i = 5; i <= length + 5; ++i) checksum += frame[i];
  payloadSize = length - 2;
  return checksum == 0;
}

static void finish(const char *message) {
  phase = Phase::Idle;
  if (auto result = scanResult) {
    scanResult = nullptr;
    result(nullptr, message);
  } else updateLabel(reading, message);
}

static void finishTag(const char *detail, bool hasValue = false) {
  if (scanResult && hasValue) {
    auto result = scanResult;
    scanResult = nullptr;
    phase = Phase::Idle;
    result(detail, "Tag detected");
    return;
  }
  char message[250];
  snprintf(message, sizeof(message), "Tag detected\nUID %s\n%s", uid, detail);
  finish(message);
}

static void next(Command nextCommand) {
  command = nextCommand;
  phase = Phase::Send;
}

static void show() {
  clearPage(NFC_I2C_CHECK);
  navBackground();
  navTitle(6, "NFC I2C Check");
  reading = navLabel("Tap Scan tag or Check reader", 130, 350, &nav_text);
  navAction("Scan tag", 290, [](lv_event_t *) {
    if (beginScan()) updateLabel(reading, "Waiting for tag...");
  });
  navAction("Check reader", 346, [](lv_event_t *) {
    if (phase != Phase::Idle) return;
    command = Command::Version;
    phase = Phase::Probe;
    updateLabel(reading, "Checking PN532...");
  });
  backArrow([](lv_event_t *) { if (phase == Phase::Idle) showSettings(); }, navSand());
}

static uint8_t writeCommand() {
  uint8_t body[5]{uint8_t(command)};
  size_t size = 1;
  switch (command) {
    case Command::Version:
      break;
    case Command::Sam:
      body[1] = 0x01; // Normal mode.
      body[2] = 0x14;
      size = 4;
      break;
    case Command::Configure:
      body[1] = 0x05; // RFConfiguration: MaxRetries.
      body[2] = 0xff;
      body[3] = 0x01;
      body[4] = 0x00; // One passive activation attempt per poll.
      size = 5;
      break;
    case Command::Poll:
      body[1] = 1;
      body[2] = 0; // One ISO/IEC 14443 Type A target.
      size = 3;
      break;
    case Command::Read:
      body[1] = target;
      body[2] = 0x30; // Type 2 READ: four pages. No tag writes.
      body[3] = tagCapacity ? uint8_t(4 + tagSize / 4) : 0;
      size = 4;
      break;
  }
  const uint8_t length = uint8_t(size + 1);
  uint8_t frame[13]{0x00, 0x00, 0xff, length, uint8_t(0 - length), 0xd4};
  uint8_t sum = 0xd4;
  for (size_t i = 0; i < size; ++i) {
    frame[6 + i] = body[i];
    sum += body[i];
  }
  frame[6 + size] = uint8_t(0 - sum);
  Wire.beginTransmission(address);
  const size_t sent = Wire.write(frame, size + 8);
  const uint8_t error = Wire.endTransmission();
  return error ? error : sent == size + 8 ? 0 : 1;
}

static bool formatRecord(const uint8_t *record, size_t size, char *value, size_t capacity) {
  size_t pos = 0;
  value[0] = '\0';
  while (size - pos >= 3) {
    const uint8_t flags = record[pos++];
    const size_t typeSize = record[pos++];
    if (flags & 0x20) return false; // Chunked NDEF records are outside this test.
    const size_t sizeBytes = flags & 0x10 ? 1 : 4;
    if (sizeBytes > size - pos) return false;
    uint32_t payloadSize = 0;
    for (size_t i = 0; i < sizeBytes; ++i) payloadSize = (payloadSize << 8) | record[pos++];
    if ((flags & 0x08) && pos == size) return false;
    const size_t idSize = flags & 0x08 ? record[pos++] : 0;
    if (typeSize + idSize > size - pos || payloadSize > size - pos - typeSize - idSize) return false;
    const uint8_t type = typeSize == 1 && (flags & 7) == 1 ? record[pos] : 0;
    pos += typeSize + idSize;
    const uint8_t *payload = record + pos;
    pos += payloadSize;
    if (payloadSize == 0) continue;
    if (type == 'U' && payload[0] <= 4) {
      constexpr const char *prefix[] = {"", "http://www.", "https://www.", "http://", "https://"};
      if (payloadSize == 1 && !payload[0]) continue;
      snprintf(value, capacity, "%s%.*s", prefix[payload[0]], int(payloadSize - 1), reinterpret_cast<const char *>(payload + 1));
      return true;
    }
    const size_t textStart = 1 + (payload[0] & 0x3f);
    if (type == 'T' && !value[0] && !(payload[0] & 0x80) && payloadSize > textStart) {
      snprintf(value, capacity, "%.*s", int(payloadSize - textStart), reinterpret_cast<const char *>(payload + textStart));
    }
    if (flags & 0x40) break;
  }
  return value[0] != '\0';
}

static void inspectTagData() {
  size_t pos = 0;
  while (pos < tagSize) {
    const uint8_t type = tagData[pos++];
    if (type == 0x00) continue;
    if (type == 0xfe) {
      finishTag("No NDEF message found");
      return;
    }
    if (pos == tagSize) break;
    size_t length = tagData[pos++];
    if (length == 0xff) {
      if (tagSize - pos < 2) break;
      length = size_t(tagData[pos]) * 256 + tagData[pos + 1];
      pos += 2;
    }
    if (length > tagSize - pos) break;
    if (type == 0x03) {
      char value[200];
      const bool hasValue = formatRecord(tagData + pos, length, value, sizeof(value));
      finishTag(hasValue ? value : "No readable NDEF URL or text", hasValue);
      return;
    }
    pos += length;
  }
  if (tagSize < tagCapacity) next(Command::Read);
  else finishTag("No complete NDEF message found");
}

static void handleReply(const uint8_t *payload, size_t size, uint32_t now) {
  switch (command) {
    case Command::Version: {
      if (size != 4 || payload[0] != 0x32) {
        finish("PN532 firmware reply invalid");
        return;
      }
      char message[80];
      snprintf(message, sizeof(message), "PN532 detected\nReader firmware %u.%u",
               unsigned(payload[1]), unsigned(payload[2]));
      finish(message);
      return;
    }
    case Command::Sam:
      next(Command::Configure);
      return;
    case Command::Configure:
      scanStarted = now;
      next(Command::Poll);
      return;
    case Command::Poll: {
      if (size == 1 && payload[0] == 0) {
        if (now - scanStarted >= scanWindowMs) finish("No tag detected");
        else next(Command::Poll);
        return;
      }
      if (size < 6 || payload[0] != 1 || (payload[5] != 4 && payload[5] != 7 && payload[5] != 10) ||
          size < size_t(6 + payload[5])) {
        finish("Invalid tag identifier reply");
        return;
      }
      for (size_t i = 0; i < payload[5]; ++i) {
        snprintf(uid + i * 3, sizeof(uid) - i * 3, i + 1 == payload[5] ? "%02X" : "%02X:", unsigned(payload[6 + i]));
      }
      target = payload[1];
      next(Command::Read);
      return;
    }
    case Command::Read:
      if (size != 17 || payload[0] != 0) {
        finishTag("Tag data could not be read");
        return;
      }
      if (tagCapacity == 0) {
        const uint8_t *cc = payload + 13; // The capability container is page 3.
        const size_t capacity = size_t(cc[2]) * 8;
        if (cc[0] != 0xe1 || (cc[1] >> 4) != 1 || (cc[3] & 0xf0) || capacity == 0 ||
            capacity > sizeof(tagData)) {
          finishTag("Type 2 NDEF data unavailable");
          return;
        }
        tagCapacity = capacity;
        next(Command::Read);
        return;
      }
      const size_t count = tagCapacity - tagSize < 16 ? tagCapacity - tagSize : 16;
      memcpy(tagData + tagSize, payload + 1, count);
      tagSize += count;
      inspectTagData();
      return;
  }
}

static void service(uint32_t now) {
  if (phase == Phase::Idle || (page != NFC_I2C_CHECK && !scanResult)) return;
  if (phase == Phase::Probe) {
    Wire.beginTransmission(address);
    const uint8_t error = Wire.endTransmission();
    if (error) {
      char message[80];
      snprintf(message, sizeof(message), "No address ACK at 0x24\nWire error %u", unsigned(error));
      finish(message);
    } else next(command);
    return;
  }
  if (phase == Phase::Send) {
    const uint8_t error = writeCommand();
    if (error) {
      char message[80];
      snprintf(message, sizeof(message), "0x24 answered\nCommand write error %u", unsigned(error));
      if (uid[0] && command == Command::Read) finishTag(message);
      else finish(message);
      return;
    }
    phase = Phase::Ack;
    phaseStarted = lastPoll = now;
    return;
  }

  if (now - phaseStarted >= replyTimeoutMs) {
    const char *message = phase == Phase::Ack ? "No PN532 command ACK" : "No PN532 reply";
    if (command == Command::Read) finishTag(message);
    else finish(message);
    return;
  }
  if (now - lastPoll < pollIntervalMs) return;
  lastPoll = now;

  if (phase == Phase::Ack) {
    uint8_t frame[sizeof(ack)]{};
    const Packet result = readFrame(frame, sizeof(frame));
    if (result == Packet::Waiting) return;
    if (result == Packet::Invalid || memcmp(frame, ack, sizeof(ack)) != 0) {
      finish("Invalid PN532 acknowledgement");
      return;
    }
    phase = Phase::Reply;
    phaseStarted = now;
    return;
  }

  // The PN532 can pad a read after the frame. The length byte marks the real end.
  uint8_t frame[31]{};
  const size_t size = command == Command::Version ? 13 : sizeof(frame);
  const Packet result = readFrame(frame, size);
  if (result == Packet::Waiting) return;
  size_t payloadSize = 0;
  if (result == Packet::Invalid || !decodeReply(frame, size, command, payloadSize)) {
    if (command == Command::Read) finishTag("Invalid tag data reply");
    else finish("Invalid PN532 reply");
    return;
  }
  handleReply(frame + 7, payloadSize, now);
}
} // namespace nfcI2cCheck
