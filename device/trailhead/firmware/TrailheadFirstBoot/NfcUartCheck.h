#pragma once

#include <driver/uart.h>

namespace nfcUartCheck {
constexpr uart_port_t port = UART_NUM_0;
constexpr int transmitPin = 43;
constexpr int receivePin = 44;
constexpr uint8_t wake[] = {0x55, 0x55, 0x00, 0x00, 0x00};
constexpr uint8_t request[] = {0x00, 0x00, 0xff, 0x02, 0xfe, 0xd4, 0x02, 0x2a, 0x00};
constexpr uint8_t ack[] = {0x00, 0x00, 0xff, 0x00, 0xff, 0x00};

enum class Status { UartBusy, UartError, NoAck, BadReply, Detected };
struct Result {
  Status status;
  uint8_t major;
  uint8_t minor;
};

static QueueHandle_t results = nullptr;
static lv_obj_t *label = nullptr;
static bool running = false;

static bool validFirmwareReply(const uint8_t (&reply)[13]) {
  constexpr uint8_t header[] = {0x00, 0x00, 0xff, 0x06, 0xfa, 0xd5, 0x03, 0x32};
  if (memcmp(reply, header, sizeof(header)) != 0 || reply[12] != 0) return false;
  uint8_t sum = 0;
  for (size_t i = 5; i < 12; ++i) sum += reply[i];
  return sum == 0;
}

static Result exchange() {
  uart_config_t config{};
  config.baud_rate = 115200;
  config.data_bits = UART_DATA_8_BITS;
  config.parity = UART_PARITY_DISABLE;
  config.stop_bits = UART_STOP_BITS_1;
  config.flow_ctrl = UART_HW_FLOWCTRL_DISABLE;
  config.source_clk = UART_SCLK_DEFAULT;
  if (uart_param_config(port, &config) != ESP_OK ||
      uart_set_pin(port, transmitPin, receivePin, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE) != ESP_OK ||
      uart_flush_input(port) != ESP_OK) return {Status::UartError, 0, 0};

  if (uart_write_bytes(port, wake, sizeof(wake)) != sizeof(wake) ||
      uart_wait_tx_done(port, pdMS_TO_TICKS(100)) != ESP_OK) return {Status::UartError, 0, 0};
  vTaskDelay(pdMS_TO_TICKS(30));
  if (uart_flush_input(port) != ESP_OK ||
      uart_write_bytes(port, request, sizeof(request)) != sizeof(request))
    return {Status::UartError, 0, 0};

  uint8_t acknowledgement[sizeof(ack)]{};
  if (uart_read_bytes(port, acknowledgement, sizeof(acknowledgement), pdMS_TO_TICKS(350)) != sizeof(acknowledgement) ||
      memcmp(acknowledgement, ack, sizeof(ack)) != 0) return {Status::NoAck, 0, 0};

  uint8_t reply[13]{};
  if (uart_read_bytes(port, reply, sizeof(reply), pdMS_TO_TICKS(350)) != sizeof(reply) ||
      !validFirmwareReply(reply)) return {Status::BadReply, 0, 0};
  return {Status::Detected, reply[8], reply[9]};
}

static void worker(void *) {
  Result result{Status::UartBusy, 0, 0};
  if (!uart_is_driver_installed(port)) {
    result.status = Status::UartError;
    if (uart_driver_install(port, 512, 0, 0, nullptr, 0) == ESP_OK) {
      result = exchange();
      uart_driver_delete(port);
    }
  }
  xQueueOverwrite(results, &result);
  vTaskDelete(nullptr);
}

static void start() {
  if (running) return;
  if (!results) results = xQueueCreate(1, sizeof(Result));
  if (!results || xTaskCreate(worker, "nfc-uart-check", 4096, nullptr, 1, nullptr) != pdPASS) {
    updateLabel(label, "Could not start the test");
    return;
  }
  running = true;
  updateLabel(label, "Checking PN532...");
}

static void show() {
  clearPage(NFC_UART_CHECK);
  navBackground();
  navTitle(6, "NFC UART Check");
  label = navLabel(running ? "Checking PN532..." : "Tap Check reader", 139, 330, &nav_text);
  navAction("Check reader", 294, [](lv_event_t *) { start(); });
  backArrow([](lv_event_t *) { showSettings(); }, navSand());
}

static void service() {
  Result result{};
  if (!results || xQueueReceive(results, &result, 0) != pdTRUE) return;
  running = false;
  if (page != NFC_UART_CHECK) return;

  char text[80];
  switch (result.status) {
    case Status::UartBusy:
      updateLabel(label, "UART already in use");
      break;
    case Status::UartError:
      updateLabel(label, "Could not open UART");
      break;
    case Status::NoAck:
      updateLabel(label, "No PN532 acknowledgement");
      break;
    case Status::BadReply:
      updateLabel(label, "PN532 responded\nFirmware reply invalid");
      break;
    case Status::Detected:
      snprintf(text, sizeof(text), "PN532 detected\nReader firmware %u.%u",
               unsigned(result.major), unsigned(result.minor));
      updateLabel(label, text);
      break;
  }
}
} // namespace nfcUartCheck
