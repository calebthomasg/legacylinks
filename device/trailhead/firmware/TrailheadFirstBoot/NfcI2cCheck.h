#pragma once

namespace nfcI2cCheck {
constexpr uint8_t address = 0x24;
constexpr uint32_t pollIntervalMs = 25;
constexpr uint32_t replyTimeoutMs = 500;
constexpr uint8_t request[] = {0x00, 0x00, 0xff, 0x02, 0xfe, 0xd4, 0x02, 0x2a, 0x00};
constexpr uint8_t ack[] = {0x00, 0x00, 0xff, 0x00, 0xff, 0x00};

enum class Phase { Idle, Send, Ack, Reply };
enum class Packet { Waiting, Ready, Invalid };

static lv_obj_t *reading = nullptr;
static Phase phase = Phase::Idle;
static uint32_t phaseStarted = 0;
static uint32_t lastPoll = 0;

static bool validReply(const uint8_t (&frame)[13]) {
  constexpr uint8_t header[] = {0x00, 0x00, 0xff, 0x06, 0xfa, 0xd5, 0x03, 0x32};
  if (memcmp(frame, header, sizeof(header)) != 0 || frame[12] != 0) return false;
  uint8_t checksum = 0;
  for (size_t i = 5; i < 12; ++i) checksum += frame[i];
  return checksum == 0;
}

// Read the ready byte and the entire expected frame in one I2C transaction.
static Packet readFrame(uint8_t *frame, size_t size) {
  const size_t count = Wire.requestFrom(address, size + 1);
  if (count == 0) return Packet::Waiting;
  const int status = Wire.read();
  const bool ready = status >= 0 && (status & 1);
  for (size_t i = 0; i < count - 1; ++i) {
    const int byte = Wire.read();
    if (i < size) frame[i] = uint8_t(byte);
  }
  if (!ready) return Packet::Waiting;
  return count == size + 1 ? Packet::Ready : Packet::Invalid;
}

static void finish(const char *message) {
  phase = Phase::Idle;
  updateLabel(reading, message);
}

static void show() {
  clearPage(NFC_I2C_CHECK);
  navBackground();
  navTitle(6, "NFC I2C Check");
  reading = navLabel("Tap Check reader", 139, 340, &nav_text);
  navAction("Check reader", 294, [](lv_event_t *) {
    if (phase == Phase::Idle) {
      phase = Phase::Send;
      updateLabel(reading, "Checking PN532...");
    }
  });
  backArrow([](lv_event_t *) { phase = Phase::Idle; showSettings(); }, navSand());
}

static void service(uint32_t now) {
  if (page != NFC_I2C_CHECK || phase == Phase::Idle) return;
  if (phase == Phase::Send) {
    Wire.beginTransmission(address);
    const size_t sent = Wire.write(request, sizeof(request));
    const uint8_t error = Wire.endTransmission();
    if (error || sent != sizeof(request)) {
      char message[80];
      snprintf(message, sizeof(message), "I2C write failed at 0x24\nWire error %u", unsigned(error));
      finish(message);
      return;
    }
    phase = Phase::Ack;
    phaseStarted = lastPoll = now;
    return;
  }

  if (now - phaseStarted >= replyTimeoutMs) {
    finish(phase == Phase::Ack ? "No PN532 acknowledgement" : "No PN532 firmware reply");
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

  uint8_t frame[13]{};
  const Packet result = readFrame(frame, sizeof(frame));
  if (result == Packet::Waiting) return;
  if (result == Packet::Invalid || !validReply(frame)) {
    finish("PN532 firmware reply invalid");
    return;
  }
  char message[80];
  snprintf(message, sizeof(message), "PN532 detected\nReader firmware %u.%u",
           unsigned(frame[8]), unsigned(frame[9]));
  finish(message);
}
} // namespace nfcI2cCheck
