// Hardware operations run on the main thread. A card is mounted only on demand.
static int brightness;
static int batteryMillivolts(){
  // Waveshare 2.8C divider and calibration from BAT_Driver.cpp.
  return lroundf(analogReadMilliVolts(4)*3.0f/0.980952f);
}
static bool batteryValid(int mv){return mv>=2800 && mv<=4350;}
static void homeValues(char *date,char *clock,char *battery){
  time_t now=time(nullptr);struct tm local{};
  if(now>=1735689600 && localtime_r(&now,&local)){
    strftime(date,40,"%a %b %d",&local);
    snprintf(clock,12,"%d:%02d",local.tm_hour%12?local.tm_hour%12:12,local.tm_min);
  }else{strcpy(date,"Waiting for time");strcpy(clock,"--:--");}
  int mv=batteryMillivolts();
  const char *level=!batteryValid(mv)?LV_SYMBOL_BATTERY_EMPTY:mv>4050?LV_SYMBOL_BATTERY_FULL:
    mv>3850?LV_SYMBOL_BATTERY_3:mv>3700?LV_SYMBOL_BATTERY_2:mv>3500?LV_SYMBOL_BATTERY_1:LV_SYMBOL_BATTERY_EMPTY;
  snprintf(battery,32,"%s%s",level,batteryValid(mv)?"":" ?");
}
static void settingsAction(unsigned i){
  if(i==0){wifiFromHome=false;networksFromStatus=false;showNetworks();return;}
  if(i==1){showUpdates();return;}
  if(i==5){showSignal();return;}
  clearPage(PREVIEW);navBackground();navTitle(4,settingsNames[i]);
  if(i==2){
    char used[64],freeSpace[64];
    if(petopia::mountCard()){
      uint64_t total=SD_MMC.totalBytes(),taken=SD_MMC.usedBytes();
      if(total && taken<=total){
        snprintf(used,sizeof(used),"%.2f GB used",double(taken)/1e9);
        snprintf(freeSpace,sizeof(freeSpace),"%.2f GB free",double(total-taken)/1e9);
        navLabel(used,193,340,&nav_row);navLabel(freeSpace,247,320,&nav_text);
      }else navLabel("Card usage unavailable",212,350,&nav_text);
    }else navLabel("Card unavailable",212,340,&nav_text);
  }else if(i==3){
    char value[12];snprintf(value,sizeof(value),"%d%%",brightness);
    auto *caption=navLabel(value,166,200,&nav_row);
    auto *slider=lv_slider_create(lv_scr_act());lv_obj_set_size(slider,245,14);lv_obj_center(slider);
    lv_slider_set_range(slider,5,100);lv_slider_set_value(slider,brightness,LV_ANIM_OFF);
    lv_obj_add_event_cb(slider,[](lv_event_t *e){
      brightness=lv_slider_get_value(lv_event_get_target(e));Set_Backlight(brightness);
      lv_label_set_text_fmt((lv_obj_t*)lv_event_get_user_data(e),"%d%%",brightness);
    },LV_EVENT_VALUE_CHANGED,caption);
    lv_obj_add_event_cb(slider,[](lv_event_t*){prefs.putUChar("brightness",brightness);},LV_EVENT_RELEASED,nullptr);
  }else if(i==4){
    int mv=batteryMillivolts();char value[40];
    if(batteryValid(mv))snprintf(value,sizeof(value),"%.2f V",mv/1000.0);
    else strcpy(value,"Reading unavailable");
    navLabel(value,193,350,&nav_row);navLabel("Battery voltage",247,300,&nav_text);
  }else if(i==6){
    navLabel("Forget this device's saved Wi-Fi?",170,345,&nav_text);
    navAction("Forget network",251,[](lv_event_t*){
      cancelNetwork();prefs.remove("network");prefs.remove("ssid");prefs.remove("pass");credentialsVerified=false;
      wifiMessage="Saved network removed";showSettings();
    });
  }
  backArrow([](lv_event_t*){showSettings();},navSand());
}
