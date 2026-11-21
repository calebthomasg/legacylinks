#pragma once

#include <new>

namespace petopia {

constexpr int displaySize = 480;
constexpr size_t sceneSize = displaySize * displaySize * sizeof(lv_color_t);
static_assert(sizeof(lv_color_t) == 2, "Petopia scenes use RGB565");
constexpr char starterKey[] = "starterPet";
static StarterAdoption adoption;
static StarterCarousel carousel([](unsigned) { return 0; });
static lv_obj_t *caption;
static lv_obj_t *progress;
static lv_obj_t *catViewport;
static lv_obj_t *displayedCat;
static lv_obj_t *outgoingCat;
static lv_obj_t *confirmation;
static lv_obj_t *carouselControls;
static lv_obj_t *starterFoodButton;
static unsigned lineIndex;

static void showAssets();
static void showWelcome();
static void showOverview();
static void showCarousel();
static void showPetHome();

static bool saveStarter(const StarterRecord &record) {
  return prefs.putBytes(starterKey, record.data(), record.size()) == record.size();
}

static lv_obj_t *surface(lv_obj_t *parent, int x, int y, int w, int h) {
  auto *object = lv_obj_create(parent);
  lv_obj_remove_style_all(object);
  lv_obj_clear_flag(object, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_pos(object, x, y);
  lv_obj_set_size(object, w, h);
  return object;
}

static void panel(lv_obj_t *object, uint32_t color, int radius) {
  lv_obj_set_style_bg_color(object, lv_color_hex(color), 0);
  lv_obj_set_style_bg_opa(object, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(object, radius, 0);
}

static lv_obj_t *control(lv_obj_t *parent, const char *text, int x, int y, int w,
                         lv_event_cb_t action, uint32_t color = 0x0f1d3a, void *data = nullptr) {
  auto *key = surface(parent, x, y, w, 48);
  lv_obj_add_flag(key, LV_OBJ_FLAG_CLICKABLE);
  panel(key, color, 24);
  auto *title = lv_label_create(key);
  lv_obj_set_style_text_color(title, navSand(), 0);
  lv_obj_set_style_text_font(title, &lv_font_montserrat_16, 0);
  lv_label_set_text(title, text);
  lv_obj_center(title);
  lv_obj_add_event_cb(key, action, LV_EVENT_CLICKED, data);
  return key;
}

static lv_obj_t *message(lv_obj_t *parent, const char *text, int x, int y, int width) {
  auto *out = lv_label_create(parent);
  lv_obj_set_pos(out, x, y);
  lv_obj_set_width(out, width);
  lv_label_set_long_mode(out, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(out, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_font(out, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(out, navSand(), 0);
  lv_label_set_text(out, text);
  return out;
}

static void errorScreen(const char *text, void (*retry)(), bool cardRelated) {
  clearPage(PETOPIA_PLAY);
  navBackground();
  navTitle(7, "Petopia");
  message(lv_scr_act(), text, 86, 154, 308);
  static void (*retryAction)();
  retryAction = retry;
  control(lv_scr_act(), "Retry", 176, 234, 128, [](lv_event_t *) { retryAction(); });
  if (cardRelated)
    control(lv_scr_act(), "Artwork updates", 153, 297, 174, [](lv_event_t *) {
      assetRepairRequested = true;
      showAssets();
    });
  backArrow([](lv_event_t *) { showDashboard(); }, navSand());
}

struct SceneImage {
  lv_img_dsc_t image{};
  uint8_t *pixels = nullptr;
};

static bool background(const char *fileName, void (*retry)()) {
  clearPage(PETOPIA_PLAY);
  bool loaded = false;
  auto *scene = new (std::nothrow) SceneImage;
  if (scene && mountCard()) {
    ArtworkFile file(String(fileName) + ".rgb565", "/trailhead/petopia/scenes/");
    if (file && file.size() == sceneSize) {
      scene->pixels = static_cast<uint8_t *>(heap_caps_malloc(sceneSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
      loaded = scene->pixels && file.read(scene->pixels, sceneSize) == sceneSize;
    }
  }
  if (!loaded) {
    if (scene) {
      heap_caps_free(scene->pixels);
      delete scene;
    }
    if (mounted) SD_MMC.end();
    mounted = false;
    errorScreen("Petopia artwork could not be read. Open Artwork updates to retry.",
                retry, true);
    return false;
  }
  scene->image.header.cf = LV_IMG_CF_TRUE_COLOR;
  scene->image.header.w = displaySize;
  scene->image.header.h = displaySize;
  scene->image.data_size = sceneSize;
  scene->image.data = scene->pixels;
  auto *image = lv_img_create(lv_scr_act());
  lv_img_set_src(image, &scene->image);
  lv_obj_add_event_cb(image, [](lv_event_t *event) {
    auto *scene = static_cast<SceneImage *>(lv_event_get_user_data(event));
    lv_img_cache_invalidate_src(&scene->image);
    heap_caps_free(scene->pixels);
    delete scene;
  }, LV_EVENT_DELETE, scene);
  return true;
}

struct CatImages { Layer layers[4]; };

static lv_obj_t *drawCat(lv_obj_t *parent, CatAppearance appearance, int x, int y, int size) {
  auto *art = new (std::nothrow) CatImages;
  if (!art) return nullptr;
  String failedFile;
  if (loadCat(appearance, art->layers, failedFile)) {
    delete art;
    return nullptr;
  }
  auto *group = surface(parent, x, y, size, size);
  // Layer image bounds are unscaled inside their objects. The parent still
  // clips the group to its scaled canvas and the carousel viewport.
  for (auto &layer : art->layers) {
    if (!layer.pixels) continue;
    auto *image = lv_img_create(group);
    lv_img_set_src(image, &layer.image);
    lv_img_set_pivot(image, 0, 0);
    lv_img_set_zoom(image, (size * 256 + canvas / 2) / canvas);
    lv_obj_set_pos(image, (layer.x * size + canvas / 2) / canvas,
                   (layer.y * size + canvas / 2) / canvas);
  }
  lv_obj_add_event_cb(group, [](lv_event_t *event) {
    auto *art = static_cast<CatImages *>(lv_event_get_user_data(event));
    releaseLayers(art->layers);
    delete art;
  }, LV_EVENT_DELETE, art);
  return group;
}

static void addBack() {
  control(lv_scr_act(), LV_SYMBOL_LEFT, 32, 206, 48, [](lv_event_t *) { showDashboard(); });
}

static void animate(lv_obj_t *target, lv_anim_exec_xcb_t update, int start, int end,
                    unsigned ms, unsigned delay = 0, lv_anim_ready_cb_t ready = nullptr) {
  lv_anim_t motion;
  lv_anim_init(&motion);
  lv_anim_set_var(&motion, target);
  lv_anim_set_exec_cb(&motion, update);
  lv_anim_set_values(&motion, start, end);
  lv_anim_set_time(&motion, ms);
  lv_anim_set_delay(&motion, delay);
  lv_anim_set_path_cb(&motion, lv_anim_path_ease_in_out);
  lv_anim_set_ready_cb(&motion, ready);
  lv_anim_start(&motion);
}

static void coverOpacity(void *object, int32_t opacity) {
  lv_obj_set_style_bg_opa(static_cast<lv_obj_t *>(object), opacity, 0);
}

static lv_obj_t *fadeCover() {
  auto *cover = surface(lv_scr_act(), 0, 0, displaySize, displaySize);
  panel(cover, 0x0f1d3a, 0);
  lv_obj_add_flag(cover, LV_OBJ_FLAG_CLICKABLE);
  return cover;
}

static void showTitle() {
  if (!background("title", showTitle)) return;
  auto *cover = fadeCover();
  animate(cover, coverOpacity, 255, 0, 340, 0, [](lv_anim_t *fade) {
    animate(static_cast<lv_obj_t *>(fade->var), coverOpacity, 0, 255, 300, 900, [](lv_anim_t *) {
      showWelcome();
    });
  });
}

static const char *const welcomeLines[] = {
  "Welcome to Petopia, baby. I'm Minnie, and this is my Pet Shop.",
  "Go on, pick one of these little fuzz balls to take home.",
  "I dare you to pick a favorite. I'm down to five.",
  "Whoever you pick can come treasure hunting with you.",
  "Keep an eye on those treasure boxes. You might find another pet or a variation you haven't seen before.",
  "I'm still looking for a few myself.",
  "Use the arrows to meet my babies. When one steals your heart, tap theirs.",
};

static lv_obj_t *speech(const char *line, int y, int height = 92, int width = 292) {
  auto *box = surface(lv_scr_act(), (displaySize - width) / 2, y, width, height);
  panel(box, 0x0f1d3a, 16);
  auto *words = message(box, line, 10, 7, width - 20);
  lv_obj_center(words);
  return words;
}

static void showWelcome() {
  if (!background("shop", showWelcome)) return;
  lineIndex = 0;
  caption = speech(welcomeLines[0], 80);
  control(lv_scr_act(), "Continue", 169, 345, 142, [](lv_event_t *) {
    if (++lineIndex == sizeof(welcomeLines) / sizeof(*welcomeLines)) showOverview();
    else lv_label_set_text(caption, welcomeLines[lineIndex]);
  });
  addBack();
  animate(fadeCover(), coverOpacity, 255, 0, 300, 0, [](lv_anim_t *fade) {
    lv_obj_del_async(static_cast<lv_obj_t *>(fade->var));
  });
}

static void showOverview() {
  if (!background("overview", showOverview)) return;
  if (!drawCat(lv_scr_act(), carousel.visibleCat(), 275, 348, 75)) {
    errorScreen("Cat artwork unavailable. Open Artwork updates to retry.", showOverview, true);
    return;
  }
  control(lv_scr_act(), "Meet the cats", 155, 245, 170, [](lv_event_t *) { showCarousel(); });
  addBack();
}

static void moveX(void *cat, int32_t x) { lv_obj_set_x(static_cast<lv_obj_t *>(cat), x); }

static void browse(bool next) {
  if (outgoingCat || carousel.confirming()) return;
  constexpr int center = 137;
  constexpr int travel = 350;
  const int distance = next ? travel : -travel;
  carousel.move(next);
  auto *incoming = drawCat(catViewport, carousel.visibleCat(), center + distance, 0, 220);
  if (!incoming) {
    carousel.move(!next);
    lv_label_set_text(progress, "Cat artwork unavailable. Tap an arrow to retry.");
    return;
  }
  lv_label_set_text_fmt(progress, "%u / %u", carousel.position() + 1, starterCount);
  outgoingCat = displayedCat;
  displayedCat = incoming;
  animate(outgoingCat, moveX, center, center - distance, 225);
  animate(incoming, moveX, center + distance, center, 225, 0, [](lv_anim_t *) {
    lv_obj_del(outgoingCat);
    outgoingCat = nullptr;
  });
}

static void showAdopted() {
  // Keep the cat and close-up scene in place throughout the reveal.
  caption = speech("", 37, 64, 238);
  lv_label_set_text_fmt(caption, "Well, look at you two! This is %s.", adoption.pet().name);
  control(lv_scr_act(), "Continue", 169, 346, 142, [](lv_event_t *event) {
    lv_obj_del(lv_event_get_target(event));
    lv_label_set_text(caption, "First snack's on me! Come back for food or something for dress-up.");
    char goTo[nameCapacity + 7];
    snprintf(goTo, sizeof(goTo), "Go to %s", adoption.pet().name);
    control(lv_scr_act(), goTo, 130, 346, 220, [](lv_event_t *) { showPetHome(); });
  });
}

static void showConfirmation() {
  if (outgoingCat || carousel.confirming() || adoption.adopted()) return;
  carousel.openConfirmation();
  lv_obj_add_flag(carouselControls, LV_OBJ_FLAG_HIDDEN);
  confirmation = surface(lv_scr_act(), 0, 0, displaySize, displaySize);
  lv_obj_add_flag(confirmation, LV_OBJ_FLAG_CLICKABLE);
  auto *box = surface(confirmation, 94, 328, 292, 53);
  panel(box, 0x0f1d3a, 14);
  auto *prompt = message(box, "Take this little one home?", 8, 0, 276);
  lv_obj_center(prompt);
  control(confirmation, LV_SYMBOL_CLOSE, 161, 390, 48, [](lv_event_t *) {
    carousel.keepBrowsing();
    lv_obj_clear_flag(carouselControls, LV_OBJ_FLAG_HIDDEN);
    lv_obj_del(confirmation);
    confirmation = nullptr;
  }, 0xc44850);
  control(confirmation, LV_SYMBOL_OK, 271, 390, 48, [](lv_event_t *event) {
    static const char *const names[] = {"Biscuit", "Pepper", "Juniper", "Maple", "Pebble", "Clover", "Pippin", "Mochi",
                                         "Fig", "Bean", "Pickle", "Waffles", "Dumpling", "Olive", "Sprout", "Poppy"};
    const uint64_t high = esp_random();
    const uint64_t id = (high << 32) | esp_random();
    const char *name = names[esp_random() % (sizeof(names) / sizeof(*names))];
    if (adoption.confirm(carousel, id ? id : 1, name, saveStarter) != StarterAction::Saved) {
      auto *text = static_cast<lv_obj_t *>(lv_event_get_user_data(event));
      lv_label_set_text(text, "Couldn't save. Tap the check to retry.");
      return;
    }
    // The overlay blocks browsing up to the handoff. Keep it as the backdrop
    // for the reveal and remove its controls once adoption is committed.
    lv_obj_clean(confirmation);
    showAdopted();
  }, 0x087d70, prompt);
}

static void showCarousel() {
  if (!background("carousel", showCarousel)) return;
  outgoingCat = nullptr;
  catViewport = surface(lv_scr_act(), 0, 97, displaySize, 220);
  displayedCat = drawCat(catViewport, carousel.visibleCat(), 137, 0, 220);
  if (!displayedCat) {
    errorScreen("Cat artwork unavailable. Open Artwork updates to retry.", showCarousel, true);
    return;
  }
  carouselControls = surface(lv_scr_act(), 0, 0, displaySize, displaySize);
  progress = message(carouselControls, "", 116, 69, 248);
  lv_label_set_text_fmt(progress, "%u / %u", carousel.position() + 1, starterCount);
  control(carouselControls, LV_SYMBOL_LEFT, 58, 184, 48, [](lv_event_t *) { browse(false); });
  control(carouselControls, LV_SYMBOL_RIGHT, 374, 184, 48, [](lv_event_t *) { browse(true); });
  auto *heart = control(carouselControls, "", 216, 340, 48, [](lv_event_t *) { showConfirmation(); }, 0xc44850);
  static const lv_point_t heartShape[] = {
    {0, 6}, {2, 2}, {6, 0}, {10, 2}, {12, 5}, {14, 2}, {18, 0},
    {22, 2}, {24, 6}, {23, 10}, {12, 21}, {1, 10}, {0, 6}
  };
  auto *mark = lv_line_create(heart);
  lv_line_set_points(mark, heartShape, sizeof(heartShape) / sizeof(*heartShape));
  lv_obj_set_style_line_color(mark, navSand(), 0);
  lv_obj_set_style_line_width(mark, 3, 0);
  lv_obj_center(mark);
  control(carouselControls, LV_SYMBOL_LEFT, 104, 91, 48, [](lv_event_t *) { showOverview(); });
}

static void showPetHome() {
  if (!background("home", showPetHome)) return;
  const auto &pet = adoption.pet();
  if (!drawCat(lv_scr_act(), pet.appearance, 154, 305, 114)) {
    errorScreen("Cat artwork unavailable. Open Artwork updates to retry.", showPetHome, true);
    return;
  }
  auto *title = speech(pet.name, 135, 48);
  lv_obj_set_style_text_font(title, &lv_font_montserrat_24, 0);
  if (pet.hasStarterFood) {
    caption = message(lv_scr_act(), "1 starter snack", 110, 220, 260);
    lv_obj_set_style_text_color(caption, blue(), 0);
    starterFoodButton = control(lv_scr_act(), "Feed", 176, 246, 128, [](lv_event_t *) {
      if (adoption.feedStarterFood(saveStarter) == StarterAction::Saved) {
        lv_label_set_text_fmt(caption, "%s enjoyed the snack!", adoption.pet().name);
        lv_obj_del(starterFoodButton);
        starterFoodButton = nullptr;
      } else {
        lv_label_set_text(caption, "Couldn't save. Tap Feed to retry.");
      }
    }, 0x087d70);
  }
  addBack();
}

}  // namespace petopia

static void showPetopia() {
  using namespace petopia;
  if (petopiaAssetsBusy || !mountCard()) {
    showAssets();
    return;
  }
  restoreAssetPack();
  if (activePackSlot < 0) {
    showAssets();
    return;
  }
  StarterRecord record{};
  const size_t length = prefs.getBytesLength(starterKey);
  if (length) {
    if (length != record.size() ||
        prefs.getBytes(starterKey, record.data(), record.size()) != record.size() ||
        !adoption.restore(record)) {
      errorScreen("Couldn't read your saved pet. Try reopening Petopia.", showPetopia, false);
      return;
    }
    showPetHome();
    return;
  }
  carousel = StarterCarousel([](unsigned bound) { return esp_random() % bound; });
  showTitle();
}
