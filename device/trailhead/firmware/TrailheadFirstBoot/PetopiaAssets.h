#pragma once

namespace petopia {

constexpr char assetCatalog[] = "https://www.legacylinks.io/firmware/trailhead/petopia/test.json";
constexpr uint32_t assetPollInterval = 6UL * 60 * 60 * 1000;
constexpr uint32_t assetRetryDelay = 30UL * 1000;

enum class AssetResult { Working, Current, Verified, Failed };

struct AssetEvent {
  AssetResult result;
  PackRecord pack;
  char message[112];
};

struct AssetJob {
  uint32_t installedRevision;
  bool repair;
};

static QueueHandle_t assetEvents;
static AssetJob assetJob;
static uint32_t assetCheckAt;
static bool assetCheckScheduled;
static bool assetRetryRequested;
static bool assetFailed;
static lv_obj_t *assetProgress;
static char assetStatus[112] = "Waiting to check for Petopia artwork.";

static void assetPost(AssetResult result, const char *text, PackRecord pack = {}) {
  AssetEvent event{};
  event.result = result;
  event.pack = pack;
  snprintf(event.message, sizeof(event.message), "%s", text);
  xQueueOverwrite(assetEvents, &event);
}

static bool getArtworkRelease(PackRecord &pack, char (&digest)[65]) {
  auto client = openCloudHTTP(assetCatalog);
  if (!client) return false;
  char json[1025];
  bool got = readCloudIndex(client, json, sizeof(json));
  closeCloudHTTP(client);
  if (!got) return false;

  cJSON *root = cJSON_Parse(json);
  if (!root) return false;
  auto *schema = cJSON_GetObjectItemCaseSensitive(root, "schema");
  auto *revision = cJSON_GetObjectItemCaseSensitive(root, "revision");
  auto *size = cJSON_GetObjectItemCaseSensitive(root, "size");
  const char *minimum = jsonText(root, "minimum_firmware");
  const char *sha = jsonText(root, "sha256");
  unsigned version[3];
  const bool valid = cJSON_IsNumber(schema) && schema->valuedouble == artworkFormat &&
    cJSON_IsNumber(revision) && revision->valuedouble >= 1 &&
    revision->valuedouble <= INT32_MAX && revision->valuedouble == uint32_t(revision->valuedouble) &&
    cJSON_IsNumber(size) && size->valuedouble > packHeaderBytes &&
    size->valuedouble <= maximumPackSize && size->valuedouble == uint32_t(size->valuedouble) &&
    versionParts(minimum, version) && !newerVersion(minimum, TRAILHEAD_VERSION) && validDigest(sha);
  if (valid) {
    pack = {artworkFormat, uint32_t(revision->valuedouble), uint32_t(size->valuedouble)};
    snprintf(digest, sizeof(digest), "%s", sha);
  }
  cJSON_Delete(root);
  return valid;
}

static bool validateArtworkDirectory(File &file, uint32_t size) {
  PackDirectory directory;
  if (!readPackDirectory(file, size, directory)) return false;
  for (const char *name : {"title.rgb565", "shop.rgb565", "overview.rgb565", "carousel.rgb565", "home.rgb565"}) {
    const auto *entry = directory.find(name);
    if (!entry || entry->size != sceneSize) return false;
  }
  for (const auto *coatName : coats) {
    char name[packNameBytes];
    snprintf(name, sizeof(name), "%s.pet", coatName);
    if (!directory.find(name)) return false;
    for (unsigned i = 0; i + 1 < patternCount; ++i) {
      snprintf(name, sizeof(name), "%s-%s-on-body.pet", patterns[i],
               strcmp(coatName, "Orange Cream") ? coatName : "Orange-Cream");
      if (!directory.find(name)) return false;
    }
  }
  for (const char *const *variants : {noses, eyes}) {
    const unsigned count = variants == noses ? noseCount : eyeCount;
    for (unsigned i = 0; i < count; ++i) {
      char name[packNameBytes];
      snprintf(name, sizeof(name), "%s-on-body.pet", variants[i]);
      if (!directory.find(name)) return false;
    }
  }
  return true;
}

static bool verifySavedArtwork(const PackRecord &pack, const char *expected) {
  File file = SD_MMC.open(pendingPackPath, FILE_READ);
  if (!file || !validateArtworkDirectory(file, pack.size) || !file.seek(0)) return false;
  mbedtls_sha256_context hash;
  mbedtls_sha256_init(&hash);
  bool ok = mbedtls_sha256_starts(&hash, 0) == 0;
  if (ok) {
    ok = copyPack(pack.size, [&](uint8_t *buffer, size_t wanted) { return int(file.read(buffer, wanted)); },
      [&](const uint8_t *buffer, size_t count) {
        return mbedtls_sha256_update(&hash, buffer, count) == 0 ? count : size_t(0);
      }, [](uint32_t) { vTaskDelay(1); });
  }
  uint8_t digest[32];
  if (ok) ok = mbedtls_sha256_finish(&hash, digest) == 0;
  mbedtls_sha256_free(&hash);
  if (!ok) return false;
  char hex[65];
  for (unsigned i = 0; i < sizeof(digest); ++i) snprintf(hex + 2 * i, 3, "%02x", digest[i]);
  return strcmp(expected, hex) == 0;
}

static bool downloadArtwork(const PackRecord &pack, const char *digest) {
  if (SD_MMC.exists(pendingPackPath) && !SD_MMC.remove(pendingPackPath)) {
    assetPost(AssetResult::Failed, "Couldn't clear the incomplete download. Retrying shortly.");
    return false;
  }
  const uint64_t total = SD_MMC.totalBytes(), used = SD_MMC.usedBytes();
  if (used > total || total - used < pack.size) {
    assetPost(AssetResult::Failed, "The microSD card is out of space for Petopia.");
    return false;
  }
  char url[150];
  snprintf(url, sizeof(url), "https://www.legacylinks.io/firmware/trailhead/petopia/releases/petopia-%lu.pack",
           static_cast<unsigned long>(pack.revision));
  auto client = openCloudHTTP(url);
  if (!client) {
    assetPost(AssetResult::Failed, "Couldn't download Petopia artwork. Retrying shortly.");
    return false;
  }
  File file;
  if (esp_http_client_get_content_length(client) == pack.size)
    file = SD_MMC.open(pendingPackPath, FILE_WRITE);
  const uint32_t start = millis();
  unsigned lastPercent = 0;
  const bool copied = file && copyPack(pack.size, [&](uint8_t *buffer, size_t wanted) {
    if (WiFi.status() != WL_CONNECTED || millis() - start >= 180000) return -1;
    return esp_http_client_read(client, reinterpret_cast<char *>(buffer), wanted);
  }, [&](const uint8_t *buffer, size_t count) { return file.write(buffer, count); },
  [&](uint32_t received) {
    const unsigned percent = received * 100 / pack.size;
    if (percent != lastPercent) {
      lastPercent = percent;
      char progress[65];
      snprintf(progress, sizeof(progress), "Downloading Petopia artwork: %u%%", percent);
      assetPost(AssetResult::Working, progress);
    }
    vTaskDelay(1);
  });
  closeCloudHTTP(client);
  if (file) {
    if (copied) file.flush();
    file.close();
  }
  if (!copied) {
    assetPost(AssetResult::Failed, "Artwork download interrupted. Retrying shortly.");
    return false;
  }
  assetPost(AssetResult::Working, "Verifying Petopia artwork...");
  if (!verifySavedArtwork(pack, digest)) {
    assetPost(AssetResult::Failed, "Artwork verification failed. Retrying shortly.");
    return false;
  }
  return true;
}

static void assetWorker(void *) {
  const AssetJob job = assetJob;
  PackRecord pack{};
  char digest[65];
  assetPost(AssetResult::Working, "Checking for Petopia artwork...");
  if (!getArtworkRelease(pack, digest)) {
    assetPost(AssetResult::Failed, "Couldn't check for Petopia artwork. Retrying shortly.");
  } else if (pack.revision < job.installedRevision ||
             (pack.revision == job.installedRevision && !job.repair)) {
    assetPost(AssetResult::Current, "Petopia artwork is ready.");
  } else if (downloadArtwork(pack, digest)) {
    assetPost(AssetResult::Verified, "Petopia artwork is ready.", pack);
  }
  vTaskDelete(nullptr);
}

static bool artworkInstallBusy() { return petopiaAssetsBusy; }
static void checkArtworkNow() { assetRetryRequested = true; }

static const char *artworkUpdateSummary() {
  if (petopiaAssetsBusy) return "Petopia artwork: updating";
  if (assetFailed && activePackSlot < 0) return "Petopia artwork: retry pending";
  return activePackSlot < 0 ? "Petopia artwork: preparing" : "Petopia artwork: ready";
}

static void showAssets() {
  clearPage(PETOPIA_ASSETS);
  navBackground();
  navTitle(7, "Petopia artwork");
  assetProgress = navLabel(assetStatus, 154, 300, &nav_text);
  if (activePackSlot >= 0 && !petopiaAssetsBusy)
    navAction("Open Petopia", 256, [](lv_event_t *) { showPetopia(); });
  if (!petopiaAssetsBusy)
    navAction("Check now", 317, [](lv_event_t *) { assetRetryRequested = true; });
  backArrow([](lv_event_t *) { showDashboard(); }, navSand());
}

static void serviceAssetUpdates(uint32_t now, bool otherUpdateBusy) {
  AssetEvent event;
  if (assetEvents && xQueueReceive(assetEvents, &event, 0) == pdTRUE) {
    snprintf(assetStatus, sizeof(assetStatus), "%s", event.message);
    if (event.result != AssetResult::Working) {
      petopiaAssetsBusy = false;
      assetFailed = event.result == AssetResult::Failed;
      if (event.result == AssetResult::Verified && !activateAssetPack(event.pack)) {
        snprintf(assetStatus, sizeof(assetStatus), "Couldn't activate the artwork. Retrying shortly.");
        assetFailed = true;
      }
      if (!assetFailed) assetRepairRequested = false;
      assetCheckAt = now + (assetFailed ? assetRetryDelay : assetPollInterval);
      if (page == PETOPIA_ASSETS) {
        if (event.result == AssetResult::Verified && !assetFailed) showPetopia();
        else showAssets();
      }
    } else if (page == PETOPIA_ASSETS) {
      lv_label_set_text(assetProgress, assetStatus);
    }
  }

  static bool wasOnline;
  const bool online = WiFi.status() == WL_CONNECTED;
  if (online && !wasOnline) {
    assetCheckAt = now + 2000 + esp_random() % 6000;
    assetCheckScheduled = true;
  }
  wasOnline = online;
  if (assetRetryRequested && !petopiaAssetsBusy) {
    assetRetryRequested = false;
    assetCheckAt = now;
    assetCheckScheduled = true;
  }
  if (!online || time(nullptr) < firstValidClockTime || otherUpdateBusy ||
      petopiaAssetsBusy || page == PETOPIA_PLAY || !assetCheckScheduled ||
      int32_t(now - assetCheckAt) < 0) return;

  if (!mountCard()) {
    snprintf(assetStatus, sizeof(assetStatus), "Petopia needs a readable microSD card.");
  } else {
    restoreAssetPack();
    if (!assetEvents) assetEvents = xQueueCreate(1, sizeof(AssetEvent));
    if (assetEvents) {
      assetJob = {activePackRecord.revision, assetRepairRequested};
      petopiaAssetsBusy = true;
      if (xTaskCreate(assetWorker, "petopia-assets", 16384, nullptr, 1, nullptr) == pdPASS) {
        snprintf(assetStatus, sizeof(assetStatus), "Checking for Petopia artwork...");
        if (page == PETOPIA_ASSETS) showAssets();
        return;
      }
      petopiaAssetsBusy = false;
    }
    snprintf(assetStatus, sizeof(assetStatus), "Couldn't start the artwork update. Retrying shortly.");
  }
  assetFailed = true;
  assetCheckAt = now + assetRetryDelay;
  if (page == PETOPIA_ASSETS) showAssets();
}

}  // namespace petopia
