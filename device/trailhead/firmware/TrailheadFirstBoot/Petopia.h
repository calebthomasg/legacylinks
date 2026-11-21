#pragma once
#include <SD_MMC.h>
#include "PetopiaTestAssets.h"
#include "PetopiaAdoption.h"
#include "PetopiaPackSD.h"

namespace petopia {
constexpr int canvas = 240;
static const char *const coats[] = {"Sky", "Sunshine", "Midnight", "Orange Cream"};
static const char *const patterns[] = {"Spotted", "Calico", "Patched", "Stripped", "None"};
static const char *const noses[] = {"button", "triangle", "half-moon", "rounded", "nostrils", "rectangle"};
static const char *const eyes[] = {"wonder", "shock", "annoyed", "side-eye", "focused", "gleaming", "dead", "twitchy", "XD", "glee"};
static_assert(sizeof(coats) / sizeof(*coats) == coatCount &&
              sizeof(patterns) / sizeof(*patterns) == patternCount &&
              sizeof(noses) / sizeof(*noses) == noseCount &&
              sizeof(eyes) / sizeof(*eyes) == eyeCount, "Petopia artwork indices changed");
static unsigned coat, pattern, nose, eye;

// Version 1 stores the four trait indices in the order of the tables above.
static void restoreCat() {
  uint8_t data[5];
  if (prefs.getBytesLength("petCat") != sizeof(data) ||
      prefs.getBytes("petCat", data, sizeof(data)) != sizeof(data)) return;
  if (data[0] != 1 || data[1] >= sizeof(coats)/sizeof(*coats) ||
      data[2] >= sizeof(patterns)/sizeof(*patterns) ||
      data[3] >= sizeof(noses)/sizeof(*noses) || data[4] >= sizeof(eyes)/sizeof(*eyes)) return;
  coat = data[1];
  pattern = data[2];
  nose = data[3];
  eye = data[4];
}

static void saveCat(lv_event_t *event) {
  const uint8_t data[] = {1, uint8_t(coat), uint8_t(pattern), uint8_t(nose), uint8_t(eye)};
  bool saved = prefs.putBytes("petCat", data, sizeof(data)) == sizeof(data);
  auto *caption = lv_obj_get_child(lv_event_get_current_target(event), 0);
  lv_label_set_text(caption, saved ? "Cat saved" : "Retry save");
}

struct Layer {
  lv_img_dsc_t image{};
  uint8_t *pixels = nullptr;
  uint16_t x = 0, y = 0;
};

static Layer layers[4];
static bool mounted;

static bool mountCard() {
  if (mounted) return true;
  Set_EXIO(EXIO_PIN4, High);
  delay(10);
  mounted = SD_MMC.setPins(2, 1, 42, -1, -1, -1) &&
            SD_MMC.begin("/sdcard", true, false, SDMMC_FREQ_DEFAULT);
  return mounted;
}

static void releaseLayers(Layer (&catLayers)[4]) {
  for (auto &layer : catLayers) {
    if (layer.pixels) lv_img_cache_invalidate_src(&layer.image);
    heap_caps_free(layer.pixels);
    layer = Layer{};
  }
}

static uint16_t little16(const uint8_t *p) {
  return p[0] | (uint16_t(p[1]) << 8);
}

static const char *loadLayer(Layer &layer, const String &stem, bool usePack) {
  ArtworkFile file(stem + ".pet", "/trailhead/petopia/", usePack);
  if (!file) return "Layer missing or unreadable";
  uint8_t header[12];
  if (file.read(header, sizeof(header)) != sizeof(header) || memcmp(header, "PET1", 4))
    return "Invalid layer header";
  layer.x = little16(header + 4);
  layer.y = little16(header + 6);
  uint16_t w = little16(header + 8), h = little16(header + 10);
  if (!w || !h || layer.x + w > canvas || layer.y + h > canvas)
    return "Invalid layer bounds";
  size_t size = size_t(w) * h * 3;
  if (file.size() != sizeof(header) + size) return "Invalid layer size";
  layer.pixels = static_cast<uint8_t *>(heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!layer.pixels) return "Artwork memory full";
  if (file.read(layer.pixels, size) != size) return "Layer read interrupted";
  layer.image.header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA;
  layer.image.header.w = w;
  layer.image.header.h = h;
  layer.image.data_size = size;
  layer.image.data = layer.pixels;
  return nullptr;
}

static const char *loadCat(CatAppearance traits, Layer (&catLayers)[4], String &failedFile, bool usePack = true) {
  if (petopiaAssetsBusy || !mountCard()) return "Card unavailable";
  // The base coat keeps spaces. The artwork pack uses hyphens in pattern filenames.
  const char *coatName = coats[traits.coat];
  const char *patternCoat = !strcmp(coatName, "Orange Cream") ? "Orange-Cream" : coatName;
  String stems[] = {coatName, String(patterns[traits.pattern]) + "-" + patternCoat + "-on-body",
                    String(noses[traits.nose]) + "-on-body", String(eyes[traits.eye]) + "-on-body"};
  for (unsigned i = 0; i < 4; ++i) {
    if (i == 1 && !strcmp(patterns[traits.pattern], "None")) continue;
    if (const char *error = loadLayer(catLayers[i], stems[i], usePack)) {
      failedFile = stems[i] + ".pet";
      releaseLayers(catLayers);
      SD_MMC.end();
      mounted = false;
      return error;
    }
  }
  return nullptr;
}

template<size_t N>
static void choice(const char *const (&values)[N], unsigned &index, int x, int y, lv_event_cb_t next) {
  auto *control = button(!strcmp(values[index], "Stripped") ? "Striped" : values[index], y, next, 150);
  lv_obj_align(control, LV_ALIGN_TOP_MID, x, y);
}
}

static void showPetopiaTest() {
  using namespace petopia;
  clearPage(PREVIEW);
  label("Petopia", 24, 200);
  String failedFile;
  const char *error = loadCat({uint8_t(coat), uint8_t(pattern), uint8_t(nose), uint8_t(eye)}, layers, failedFile, false);
  if (error) {
    auto *cat = lv_img_create(lv_scr_act());
    lv_img_set_src(cat, &PETOPIA_TEST_CAT);
    lv_img_set_zoom(cat, 144);
    lv_obj_align(cat, LV_ALIGN_TOP_MID, 0, -4);
    label(error, 214, 355);
    label(failedFile.c_str(), 239, 380);
  } else {
    auto *art = lv_obj_create(lv_scr_act());
    lv_obj_remove_style_all(art);
    lv_obj_clear_flag(art, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_size(art, canvas, canvas);
    lv_obj_align(art, LV_ALIGN_TOP_MID, 0, 46);
    for (auto &layer : layers) {
      if (!layer.pixels) continue;
      auto *img = lv_img_create(art);
      lv_img_set_src(img, &layer.image);
      lv_obj_set_pos(img, layer.x, layer.y);
    }
    // Release the card buffers when this screen is torn down.
    lv_obj_add_event_cb(art, [](lv_event_t*) { releaseLayers(layers); }, LV_EVENT_DELETE, nullptr);
  }
  choice(coats, coat, -80, 283, [](lv_event_t*) { coat = (coat+1) % (sizeof(coats)/sizeof(*coats)); showPetopiaTest(); });
  choice(patterns, pattern, 80, 283, [](lv_event_t*) { pattern = (pattern+1) % (sizeof(patterns)/sizeof(*patterns)); showPetopiaTest(); });
  choice(noses, nose, -80, 334, [](lv_event_t*) { nose = (nose+1) % (sizeof(noses)/sizeof(*noses)); showPetopiaTest(); });
  choice(eyes, eye, 80, 334, [](lv_event_t*) { eye = (eye+1) % (sizeof(eyes)/sizeof(*eyes)); showPetopiaTest(); });
  if (!error) {
    char memory[72];
    snprintf(memory, sizeof(memory), "SD  |  Heap %uK  |  PSRAM %uK",
             unsigned(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / 1024),
             unsigned(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / 1024));
    label(memory, 385, 290);
    auto *save = button("Save cat", 405, saveCat, 130);
    lv_obj_align(save, LV_ALIGN_TOP_MID, -69, 405);
    auto *back = button("Back to dial", 405, [](lv_event_t*) { showDashboard(); }, 130);
    lv_obj_align(back, LV_ALIGN_TOP_MID, 69, 405);
  } else {
    auto *retry = button("Retry card", 389, [](lv_event_t*) { showPetopiaTest(); }, 134);
    lv_obj_align(retry, LV_ALIGN_TOP_MID, -72, 389);
    auto *back = button("Back to dial", 389, [](lv_event_t*) { showDashboard(); }, 134);
    lv_obj_align(back, LV_ALIGN_TOP_MID, 72, 389);
  }
}
