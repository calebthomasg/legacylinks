#pragma once
#include "DialAssets.h"

static lv_color_t navSand(){return lv_color_hex(0xf5f2e8);}
static const char *const destinations[]={"Home","Friends","Wi-Fi","Account","Settings","Clock","Trailhead","Petopia"};
static const char *const greetings[]={
  "Have a fantastic day!","Take the scenic route.","Glad you're here, Trailblazer.","What will you discover today?",
  "There's more around the bend.","Make a little time for wonder.","Take someone along.","Follow your curiosity.",
  "A good day to explore.","Look for the little things.","Start with one small step.","Enjoy the way there.",
  "You have a story to tell.","Make a memory today.","See where the trail leads.","Say hello along the way.",
  "Something good is ahead.","Keep your eyes open.","Your next adventure awaits.","Leave a little kindness."
};
static unsigned greetingIndex;
static lv_obj_t *dateText,*timeText,*batteryText,*homeBadge;
static int settingsOffset=112;
static bool wifiFromHome;
static void settingsAction(unsigned index);
static void homeValues(char *date,char *clock,char *battery);
static void navBackground(){
  auto *bg=lv_img_create(lv_scr_act());lv_img_set_src(bg,&NAV_BACKGROUND);
  lv_obj_set_size(bg,480,480);lv_obj_set_pos(bg,0,0);
}
static lv_obj_t *navLabel(const char *text,int y,int width,const lv_font_t *font){
  auto *o=label(text,y,width);lv_obj_set_style_text_font(o,font,0);lv_obj_set_style_text_color(o,navSand(),0);return o;
}
static lv_obj_t *navIcon(lv_obj_t *parent,unsigned id,int opacity){
  auto *icon=lv_img_create(parent);lv_img_set_src(icon,&NAV_ICONS[id]);lv_obj_set_style_img_recolor(icon,navSand(),0);
  lv_obj_set_style_img_recolor_opa(icon,255,0);lv_obj_set_style_img_opa(icon,opacity,0);return icon;
}
static lv_obj_t *target(lv_obj_t *parent,int x,int y,int w,int h,lv_event_cb_t cb,void *data=nullptr){
  auto *o=lv_obj_create(parent);lv_obj_remove_style_all(o);lv_obj_set_pos(o,x,y);lv_obj_set_size(o,w,h);
  lv_obj_clear_flag(o,LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_ON_FOCUS);
  if(cb) lv_obj_add_event_cb(o,cb,LV_EVENT_CLICKED,data);
  return o;
}
static void backArrow(lv_event_cb_t cb,lv_color_t color){
  auto *o=target(lv_scr_act(),3,201,52,78,cb);auto *l=lv_label_create(o);lv_label_set_text(l,LV_SYMBOL_LEFT);
  lv_obj_set_style_text_font(l,&lv_font_montserrat_24,0);lv_obj_set_style_text_color(l,color,0);lv_obj_center(l);
}
static void navTitle(unsigned id,const char *title){
  auto *header=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(header);lv_obj_set_size(header,LV_SIZE_CONTENT,48);
  lv_obj_set_flex_flow(header,LV_FLEX_FLOW_ROW);lv_obj_set_flex_align(header,LV_FLEX_ALIGN_CENTER,LV_FLEX_ALIGN_CENTER,LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(header,8,0);lv_obj_clear_flag(header,LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_CLICKABLE);
  navIcon(header,id,255);
  auto *l=lv_label_create(header);lv_label_set_text(l,title);lv_obj_set_style_text_font(l,&nav_text,0);
  lv_obj_set_style_text_color(l,navSand(),0);lv_obj_align(header,LV_ALIGN_TOP_MID,0,29);
}
static lv_obj_t *updateDot(lv_obj_t *parent,int x,int y){
  auto *d=lv_obj_create(parent);lv_obj_remove_style_all(d);lv_obj_set_pos(d,x,y);lv_obj_set_size(d,10,10);
  lv_obj_clear_flag(d,LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE);lv_obj_set_style_radius(d,LV_RADIUS_CIRCLE,0);
  lv_obj_set_style_bg_color(d,lv_color_hex(0xffc83d),0);lv_obj_set_style_bg_opa(d,255,0);return d;
}
static void updateLabel(lv_obj_t *o,const char *s){if(strcmp(lv_label_get_text(o),s))lv_label_set_text(o,s);}
static void paintDial(){
  if(page!=DASH && page!=CLOCK_VIEW)return;
  char date[40],clock[12],battery[32];homeValues(date,clock,battery);
  updateLabel(dateText,date);updateLabel(timeText,clock);if(page==CLOCK_VIEW)return;
  updateLabel(batteryText,battery);
  if(cloudAvailable)lv_obj_clear_flag(homeBadge,LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(homeBadge,LV_OBJ_FLAG_HIDDEN);
}
static void showDemoMenu(unsigned destination);

static void homeTap(lv_event_t *e){
  unsigned i=(uintptr_t)lv_event_get_user_data(e);
  if(i==0)return;
  if(i==4){settingsOffset=112;wifiFromHome=false;showSettings();return;}
  if(i==2){wifiFromHome=true;showConnectionStatus();return;}
  if(i==7){showPetopia();return;}
  if(i==1 || i==3 || i==5) {
    showDemoMenu(i);
    return;
  }
  clearPage(PREVIEW);navBackground();navTitle(i,destinations[i]);
  navLabel("Page preview",215,280,&nav_text);
  backArrow([](lv_event_t*){showDashboard();},navSand());
}
static void showDashboard(){
  clearPage(DASH);navBackground();
  static const int centers[][2]={{240,438},{98,382},{40,240},{98,98},{240,40},{382,98},{440,240},{382,382}};
  for(unsigned i=0;i<8;i++){
    auto *o=target(lv_scr_act(),centers[i][0]-34,centers[i][1]-34,68,68,homeTap,(void*)(uintptr_t)i);
    lv_obj_center(navIcon(o,i,i?166:255));
  }
  homeBadge=updateDot(lv_scr_act(),259,20);
  dateText=navLabel("",145,230,&nav_text);lv_obj_align(dateText,LV_ALIGN_TOP_MID,-38,145);
  timeText=navLabel("",174,265,&nav_time);lv_obj_align(timeText,LV_ALIGN_TOP_MID,-32,174);
  batteryText=navLabel("",147,82,&lv_font_montserrat_16);lv_obj_align(batteryText,LV_ALIGN_TOP_MID,92,147);
  navLabel(greetings[greetingIndex],265,350,&nav_text);paintDial();
}
static const char *const settingsNames[]={"Wi-Fi","Firmware Updates","Storage","Brightness","Battery","Wi-Fi Signal","Forget Wi-Fi"};
static constexpr int rowHeight=56, menuWidth=342, menuInset=112;

static void fadeRows(lv_obj_t *list){
  const int offset=lv_obj_get_scroll_y(list);
  for(unsigned i=0;i<lv_obj_get_child_cnt(list);i++){
    auto *row=lv_obj_get_child(list,i);
    int distance=std::abs(int(i)*rowHeight-offset);
    int opacity=255-distance*134/112;
    lv_obj_set_style_text_opa(lv_obj_get_child(row,0),opacity<58?58:opacity,0);
  }
}
static lv_obj_t *navMenu(int *offset=nullptr){
  auto *list=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(list);
  lv_obj_set_pos(list,69,100);lv_obj_set_size(list,menuWidth,280);
  lv_obj_set_scroll_dir(list,LV_DIR_VER);lv_obj_set_scrollbar_mode(list,LV_SCROLLBAR_MODE_OFF);
  lv_obj_set_scroll_snap_y(list,LV_SCROLL_SNAP_CENTER);
  lv_obj_set_style_pad_bottom(list,menuInset,0);
  lv_obj_add_event_cb(list,[](lv_event_t *e){
    auto *menu=lv_event_get_target(e);
    auto *position=(int*)lv_event_get_user_data(e);
    if(position)*position=lv_obj_get_scroll_y(menu);
    fadeRows(menu);
  },LV_EVENT_SCROLL,offset);
  for(int y:{212,268}){
    auto *line=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(line);
    lv_obj_set_size(line,324,1);lv_obj_set_pos(line,78,y);
    lv_obj_set_style_bg_opa(line,115,0);lv_obj_set_style_bg_color(line,navSand(),0);
    lv_obj_clear_flag(line,LV_OBJ_FLAG_CLICKABLE);
  }
  return list;
}
static lv_obj_t *navMenuRow(lv_obj_t *list,const char *text,lv_event_cb_t cb,
                            void *data=nullptr,const lv_font_t *font=&nav_row){
  unsigned i=lv_obj_get_child_cnt(list);
  auto *row=target(list,0,menuInset+i*rowHeight,menuWidth,rowHeight,cb,data);
  lv_obj_add_flag(row,LV_OBJ_FLAG_SNAPPABLE);
  auto *l=lv_label_create(row);lv_obj_set_width(l,menuWidth-28);
  lv_label_set_long_mode(l,LV_LABEL_LONG_DOT);lv_label_set_text(l,text);
  lv_obj_set_style_text_font(l,font,0);lv_obj_set_style_text_color(l,navSand(),0);
  lv_obj_set_style_text_align(l,LV_TEXT_ALIGN_CENTER,0);lv_obj_center(l);
  return row;
}
static void positionMenu(lv_obj_t *list,int offset=0){
  lv_obj_update_layout(list);lv_obj_scroll_to_y(list,offset,LV_ANIM_OFF);fadeRows(list);
}
static lv_obj_t *navAction(const char *text,int y,lv_event_cb_t cb,int width=230){
  auto *o=target(lv_scr_act(),(480-width)/2,y,width,48,cb);
  lv_obj_set_style_radius(o,12,0);
  lv_obj_set_style_bg_color(o,lv_color_hex(0x0f1d3a),0);
  lv_obj_set_style_bg_opa(o,90,0);
  lv_obj_set_style_bg_opa(o,150,LV_STATE_PRESSED);
  auto *l=lv_label_create(o);lv_label_set_text(l,text);
  lv_obj_set_style_text_font(l,&nav_text,0);lv_obj_set_style_text_color(l,navSand(),0);
  lv_obj_center(l);
  return o;
}
static void showSettings(){
  const int offset=settingsOffset;
  clearPage(SETTINGS);navBackground();navTitle(4,"Settings");
  auto *list=navMenu(&settingsOffset);
  for(unsigned i=0;i<sizeof(settingsNames)/sizeof(*settingsNames);i++){
    auto *row=navMenuRow(list,settingsNames[i],[](lv_event_t *e){
      settingsAction((uintptr_t)lv_event_get_user_data(e));
    },(void*)(uintptr_t)i);
    if(i==1 && cloudAvailable)updateDot(row,310,23);
  }
  positionMenu(list,offset);
  backArrow([](lv_event_t*){showDashboard();},navSand());
}
static void showAlarmPreview() {
  clearPage(PREVIEW);
  navBackground();
  navTitle(5, "Clock");
  auto *list = navMenu();
  static const char *const times[] = {"2:59am", "3:00am", "6:45am", "6:15am", "7:00am"};
  for(unsigned i=0; i<5; ++i) {
    auto *row = navMenuRow(list, times[i], nullptr);
    auto *label = lv_obj_get_child(row, 0);
    lv_obj_align(label, LV_ALIGN_CENTER, -30, 0);

    auto *toggle = lv_obj_create(row);
    lv_obj_remove_style_all(toggle);
    lv_obj_clear_flag(toggle, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_size(toggle, 66, 30);
    lv_obj_align(toggle, LV_ALIGN_RIGHT_MID, -24, 0);
    lv_obj_set_style_radius(toggle, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(toggle, navSand(), 0);
    lv_obj_set_style_bg_opa(toggle, i==2 ? LV_OPA_COVER : LV_OPA_50, 0);

    auto *knob = lv_obj_create(toggle);
    lv_obj_remove_style_all(knob);
    lv_obj_clear_flag(knob, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_size(knob, 22, 22);
    lv_obj_align(knob, i==2 ? LV_ALIGN_RIGHT_MID : LV_ALIGN_LEFT_MID, i==2 ? -4 : 4, 0);
    lv_obj_set_style_radius(knob, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(knob, lv_color_hex(0x27b6a9), 0);
    lv_obj_set_style_bg_opa(knob, LV_OPA_COVER, 0);
  }
  positionMenu(list, 2*rowHeight);
  backArrow([](lv_event_t *) { showDemoMenu(5); }, navSand());
}

static void showClockTime() {
  clearPage(CLOCK_VIEW);
  navBackground();
  navTitle(5, "Clock");
  dateText = navLabel("", 177, 300, &nav_text);
  timeText = navLabel("", 210, 270, &nav_time);
  paintDial();
  backArrow([](lv_event_t *) { showDemoMenu(5); }, navSand());
}

static void showDemoMenu(unsigned destination) {
  clearPage(PREVIEW);
  navBackground();
  navTitle(destination, destinations[destination]);
  auto *list = navMenu();
  if(destination==1) {
    for(const char *name : {"Pops", "Mom", "Atticus", "Carmen", "Dad"}) {
      auto *row = navMenuRow(list, name, nullptr);
      auto *label = lv_obj_get_child(row, 0);
      lv_obj_set_width(label, 198);
      lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_LEFT, 0);
      lv_obj_align(label, LV_ALIGN_LEFT_MID, 105, 0);
      auto *avatar = navIcon(row, 3, LV_OPA_70);
      lv_obj_align(avatar, LV_ALIGN_LEFT_MID, 59, 0);
    }
  } else if(destination==3) {
    for(const char *item : {"Profile", "Connected Account", "Parental Settings", "Sync to LegacyLink"}) {
      navMenuRow(list, item, nullptr);
    }
  } else {
    navMenuRow(list, "World Clocks", nullptr);
    navMenuRow(list, "Time", [](lv_event_t *) { showClockTime(); });
    navMenuRow(list, "Alarm Clock", [](lv_event_t *) { showAlarmPreview(); });
    navMenuRow(list, "Timer", nullptr);
    navMenuRow(list, "Stopwatch", nullptr);
  }
  positionMenu(list, 2*rowHeight);
  backArrow([](lv_event_t *) { showDashboard(); }, navSand());
}

static constexpr int openerSize = 480;
static constexpr int openerStartY = 260;
static constexpr int openerSwipeDistance = 65;
static constexpr int openerHorizontalLimit = 100;
static lv_point_t openerStart;
static bool openerDragging;
static bool openerSettling;

static void moveOpener(void *object, int32_t y) {
  lv_obj_set_y(static_cast<lv_obj_t *>(object), y);
}

static void finishOpening(lv_anim_t *animation) {
  auto *artworkLayer = static_cast<lv_obj_t *>(animation->var);
  lv_obj_del_async(lv_obj_get_parent(artworkLayer));
  page = DASH;
  paintDial();
}

static void settleOpener(lv_obj_t *layer, bool open) {
  const int destination = open ? -openerSize : 0;
  lv_obj_update_layout(layer);
  const int current = lv_obj_get_y(layer);
  openerDragging = false;
  if (current == destination) return;

  openerSettling = true;
  lv_anim_t animation;
  lv_anim_init(&animation);
  lv_anim_set_var(&animation, layer);
  lv_anim_set_exec_cb(&animation, moveOpener);
  lv_anim_set_values(&animation, current, destination);
  lv_anim_set_time(&animation, open ? 240 : 160);
  lv_anim_set_path_cb(&animation, lv_anim_path_ease_out);
  lv_anim_set_ready_cb(&animation, open ? finishOpening : +[](lv_anim_t *) {
    openerSettling = false;
  });
  lv_anim_start(&animation);
}

static void openerInput(lv_event_t *event) {
  auto *input = lv_indev_get_act();
  if (!input || openerSettling) return;
  lv_point_t point;
  lv_indev_get_point(input, &point);
  const auto code = lv_event_get_code(event);
  if (code == LV_EVENT_PRESSED) {
    openerStart = point;
    openerDragging = point.y >= openerStartY;
    return;
  }
  if (!openerDragging) return;

  auto *layer = lv_obj_get_child(lv_event_get_target(event), 0);
  const int rise = openerStart.y - point.y;
  const bool vertical = std::abs(point.x - openerStart.x) < openerHorizontalLimit;
  if (code == LV_EVENT_PRESSING) {
    lv_obj_set_y(layer, vertical && rise > 0 ? -rise : 0);
  } else if (code == LV_EVENT_RELEASED || code == LV_EVENT_PRESS_LOST) {
    settleOpener(layer, code == LV_EVENT_RELEASED && vertical && rise >= openerSwipeDistance);
  }
}

static void showOpen() {
  showDashboard();
  page = OPEN;
  openerDragging = openerSettling = false;

  auto *surface = lv_obj_create(lv_scr_act());
  lv_obj_remove_style_all(surface);
  lv_obj_set_size(surface, openerSize, openerSize);
  lv_obj_clear_flag(surface, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(surface, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_PRESS_LOCK);
  lv_obj_add_event_cb(surface, openerInput, LV_EVENT_ALL, nullptr);

  auto *layer = lv_obj_create(surface);
  lv_obj_remove_style_all(layer);
  lv_obj_set_size(layer, openerSize, openerSize);
  lv_obj_clear_flag(layer, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
  showImage(layer);

  auto *hint = lv_obj_create(layer);
  lv_obj_remove_style_all(hint);
  lv_obj_set_size(hint, 120, 52);
  lv_obj_set_pos(hint, 180, 372);
  lv_obj_clear_flag(hint, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);

  auto *arrow = lv_label_create(hint);
  lv_label_set_text(arrow, LV_SYMBOL_UP);
  lv_obj_set_style_text_color(arrow, blue(), 0);
  lv_obj_align(arrow, LV_ALIGN_TOP_MID, 0, 4);

  auto *caption = lv_label_create(hint);
  lv_label_set_text(caption, "Swipe up");
  lv_obj_set_style_text_color(caption, blue(), 0);
  lv_obj_set_style_text_font(caption, &nav_text, 0);
  lv_obj_align(caption, LV_ALIGN_TOP_MID, 0, 23);

  lv_anim_t animation;
  lv_anim_init(&animation);
  lv_anim_set_var(&animation, hint);
  lv_anim_set_exec_cb(&animation, moveOpener);
  lv_anim_set_values(&animation, 372, 362);
  lv_anim_set_time(&animation, 650);
  lv_anim_set_playback_time(&animation, 650);
  lv_anim_set_repeat_count(&animation, LV_ANIM_REPEAT_INFINITE);
  lv_anim_set_path_cb(&animation, lv_anim_path_ease_in_out);
  lv_anim_start(&animation);

}
