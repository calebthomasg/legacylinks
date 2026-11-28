#pragma once
#include "TrailheadFieldBoxes.h"
#include <strings.h>
#include <ctype.h>

namespace trailheadField {
constexpr unsigned count=sizeof(boxes)/sizeof(boxes[0]);
constexpr int size=768, screen=480;
constexpr size_t mapBytes=size*size*2;
constexpr char mapPath[]="/trailhead/field-map-1.rgb565";
constexpr char tempPath[]="/trailhead/field-map-1.part";
constexpr char mapUrl[]="https://www.legacylinks.io/firmware/trailhead/maps/field-map-1.rgb565";
constexpr char mapHash[]="d41f03490d74413a8e09b8d7107703d1092953540096e31880404d663d41dae3";
enum class View { Map, List, Details, Story, Hint, Found, Compass };
static View view=View::Map;
static int selected=-1, active=-1;
static int offsetX=0,offsetY=0,scale=160;
static lv_obj_t *mapImage=nullptr,*mapButtons[count]{},*position=nullptr,*caption=nullptr,*scanLabel=nullptr;
static lv_obj_t *compassPrompt=nullptr;
static lv_img_dsc_t mapArt{};
static uint8_t *pixels=nullptr;
static std::atomic<int> downloadResult{0};
static bool downloading=false,mapReady=false,follow=false;
static bool compassReady=false,calibrating=false,hasCalibration=false,hasNorth=false;
static uint32_t compassAt=0,renderAt=0;
static float minX,maxX,minY,maxY,centerX,centerY,radiusX=1,radiusY=1,rawAngle,northAngle;
static char message[100]="";
static void draw(View next);
static void recenter();
static void moveMap();
static void refreshMap(uint32_t now);

static void hexHash(const void *data,size_t length,char (&hex)[65]){
  uint8_t digest[32];
  mbedtls_sha256(static_cast<const unsigned char *>(data),length,digest,0);
  for(unsigned i=0;i<32;i++)snprintf(hex+i*2,3,"%02x",unsigned(digest[i]));
}
static bool validMap(){
  char hash[65];
  hexHash(pixels,mapBytes,hash);
  return strcmp(hash,mapHash)==0;
}
static bool allocateMap(){
  if(!pixels) pixels=static_cast<uint8_t*>(heap_caps_malloc(mapBytes,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT));
  return pixels!=nullptr;
}
static void loadMap(){
  if(mapReady||downloading||petopia::artworkInstallBusy()||!petopia::mountCard()||!allocateMap())return;
  File file=SD_MMC.open(mapPath,FILE_READ);
  mapReady=file&&file.size()==mapBytes&&file.read(pixels,mapBytes)==mapBytes&&validMap();
}
static void downloadWorker(void *){
  bool ready=false;
  auto http=openCloudHTTP(mapUrl);
  if(http){
    size_t received=0;
    uint32_t started=millis();
    if(esp_http_client_get_content_length(http)==mapBytes){
      while(received<mapBytes&&millis()-started<120000){
        const int chunk=esp_http_client_read(http,reinterpret_cast<char*>(pixels+received),min(size_t(4096),mapBytes-received));
        if(chunk<=0)break;
        received+=size_t(chunk);
      }
    }
    closeCloudHTTP(http);
    if(received==mapBytes&&validMap()){
      SD_MMC.remove(tempPath);
      File file=SD_MMC.open(tempPath,FILE_WRITE);
      if(file){
        const bool written=file.write(pixels,mapBytes)==mapBytes;
        file.flush();
        file.close();
        if(written){
          SD_MMC.remove(mapPath);
          ready=SD_MMC.rename(tempPath,mapPath);
        }
      }
      if(!ready)SD_MMC.remove(tempPath);
    }
  }
  downloadResult.store(ready?1:-1);
  vTaskDelete(nullptr);
}
static void downloadMap(){
  if(downloading||mapReady)return;
  if(WiFi.status()!=WL_CONNECTED)snprintf(message,sizeof(message),"Connect Wi-Fi to download the map");
  else if(time(nullptr)<firstValidClockTime)snprintf(message,sizeof(message),"Waiting for the device clock. Try again.");
  else if(cloudBusy||petopia::artworkInstallBusy()||otaEnabled||uploadAllowed)
    snprintf(message,sizeof(message),"An update is active. Try again shortly.");
  else if(!petopia::mountCard())snprintf(message,sizeof(message),"Insert the Trailhead microSD card");
  else if(!allocateMap())snprintf(message,sizeof(message),"Map memory unavailable");
  else {
    SD_MMC.mkdir("/trailhead");
    downloading=xTaskCreate(downloadWorker,"field-map",10240,nullptr,1,nullptr)==pdPASS;
    snprintf(message,sizeof(message),"%s",downloading?"Downloading test area...":"Could not start the map download");
  }
  draw(View::Map);
}

static bool hasFix(uint32_t now){
  return gpsDetected&&gpsReceivedPositionSentence&&now-gpsLastSentenceAt<3500&&gpsDiagnostic.fix&&
         isfinite(gpsDiagnostic.latitudeDegrees)&&isfinite(gpsDiagnostic.longitudeDegrees);
}
static int mapX(double lon){return int(lround((lon-west)*size/(east-west)));}
static int mapY(double lat){return int(lround((north-lat)*size/(north-south)));}
static bool inside(double lat,double lon){return lat>=south&&lat<=north&&lon>=west&&lon<=east;}
static double distanceMeters(const Box &box){
  const double lat=gpsDiagnostic.latitudeDegrees,lon=gpsDiagnostic.longitudeDegrees;
  const double y=(box.latitude-lat)*111195.0;
  const double x=(box.longitude-lon)*111195.0*cos((box.latitude+lat)*(PI/360.0));
  return hypot(x,y);
}
static double boxBearing(const Box &box){
  const double lat=gpsDiagnostic.latitudeDegrees;
  const double y=box.latitude-lat;
  const double x=(box.longitude-gpsDiagnostic.longitudeDegrees)*cos((box.latitude+lat)*(PI/360.0));
  return fmod(atan2(x,y)*180.0/PI+360.0,360.0);
}
static uint8_t foundFlags(){return prefs.getUChar("fieldFinds",0);}
static bool readingTag=false;
static void scanned(const char *value,const char *status){
  readingTag=false;
  if(active<0||page!=FIELD_TRAILHEAD)return;
  constexpr char prefix[]="https://";
  const char *token=nullptr;
  if(value&&strncmp(value,prefix,sizeof(prefix)-1)==0){
    const char *url=value+sizeof(prefix)-1;
    constexpr char host[]="legacylinks.io/n/";
    constexpr char www[]="www.legacylinks.io/n/";
    if(strncasecmp(url,host,sizeof(host)-1)==0) token=url+sizeof(host)-1;
    else if(strncasecmp(url,www,sizeof(www)-1)==0) token=url+sizeof(www)-1;
  }
  char canonical[37]{};
  if(token&&strcspn(token,"?#")==36){
    bool valid=true;
    for(unsigned i=0;i<36;i++){
      const char c=token[i];
      const bool hyphen=i==8||i==13||i==18||i==23;
      if(hyphen?c!='-':!isxdigit(static_cast<unsigned char>(c))){valid=false;break;}
      canonical[i]=char(tolower(static_cast<unsigned char>(c)));
    }
    if(!valid)canonical[0]=0;
  }
  char hash[65]{};
  if(canonical[0])hexHash(canonical,36,hash);
  if(strcmp(hash,boxes[active].tagDigest)!=0){
    snprintf(message,sizeof(message),"%s",canonical[0]?"This tag belongs to another box":value?"This tag has no Trailhead box URL":status);
    refreshMap(millis());
    return;
  }
  const auto flags=foundFlags();
  const uint8_t updated=flags|(1u<<active);
  if(updated!=flags&&prefs.putUChar("fieldFinds",updated)!=1){
    snprintf(message,sizeof(message),"Find could not be saved. Scan again.");
    refreshMap(millis());
    return;
  }
  selected=active;
  active=-1;
  message[0]=0;
  draw(View::Found);
}
static void scan(){
  if(active<0||readingTag)return;
  if(nfcI2cCheck::beginScan(scanned)){
    readingTag=true;
    snprintf(message,sizeof(message),"Hold the reader by the box tag");
    refreshMap(millis());
  }
}

static void panel(){
  lv_obj_set_style_bg_color(lv_scr_act(),lv_color_hex(0x4bbdb6),0);
  lv_obj_set_style_bg_grad_color(lv_scr_act(),lv_color_hex(0x68bef2),0);
  lv_obj_set_style_bg_grad_dir(lv_scr_act(),LV_GRAD_DIR_HOR,0);
}
static lv_obj_t *darkLabel(const char *text,int y,int width,const lv_font_t *font){
  auto *item=navLabel(text,y,width,font);
  lv_obj_set_style_text_color(item,lv_color_hex(0x112645),0);
  return item;
}
static void button(const char *text,int x,int y,int width,lv_event_cb_t cb){
  auto *b=navAction(text,y,cb,width);
  lv_obj_set_x(b,x);
}
static void scrollBody(const char *description,bool found){
  auto *scroll=lv_obj_create(lv_scr_act());
  lv_obj_remove_style_all(scroll);
  lv_obj_set_pos(scroll,70,found?174:140);
  lv_obj_set_size(scroll,340,found?224:257);
  lv_obj_set_scroll_dir(scroll,LV_DIR_VER);
  lv_obj_set_scrollbar_mode(scroll,LV_SCROLLBAR_MODE_ACTIVE);
  auto *copy=lv_label_create(scroll);
  lv_obj_set_pos(copy,4,0);
  lv_obj_set_width(copy,332);
  lv_obj_set_style_text_color(copy,navSand(),0);
  lv_obj_set_style_text_font(copy,&nav_text,0);
  lv_label_set_text(copy,description);
  if(found){
    lv_obj_update_layout(scroll);
    auto *done=target(scroll,38,lv_obj_get_height(copy)+18,260,44,[](lv_event_t*){selected=-1;draw(View::Map);});
    lv_obj_set_style_bg_color(done,lv_color_hex(0x0f1d3a),0);
    lv_obj_set_style_bg_opa(done,LV_OPA_COVER,0);
    lv_obj_set_style_radius(done,9,0);
    auto *label=lv_label_create(done);
    lv_label_set_text(label,"Back to Trailhead");
    lv_obj_set_style_text_font(label,&nav_text,0);
    lv_obj_set_style_text_color(label,navSand(),0);
    lv_obj_center(label);
  }
}

static void moveMap(){
  if(!mapImage)return;
  const int edge=size*scale/256;
  offsetX=constrain(offsetX,screen-edge,0);
  offsetY=constrain(offsetY,screen-edge,0);
  lv_img_set_zoom(mapImage,scale);
  lv_obj_set_pos(mapImage,offsetX,offsetY);
  for(unsigned i=0;i<count;i++){
    const int x=offsetX+mapX(boxes[i].longitude)*scale/256;
    const int y=offsetY+mapY(boxes[i].latitude)*scale/256;
    if(x<0||x>=480||y<0||y>=480)lv_obj_add_flag(mapButtons[i],LV_OBJ_FLAG_HIDDEN);
    else{
      lv_obj_clear_flag(mapButtons[i],LV_OBJ_FLAG_HIDDEN);
      lv_obj_set_pos(mapButtons[i],x-15,y-15);
    }
  }
  if(position){
    const double lat=gpsDiagnostic.latitudeDegrees,lon=gpsDiagnostic.longitudeDegrees;
    const int x=offsetX+mapX(lon)*scale/256;
    const int y=offsetY+mapY(lat)*scale/256;
    if(!hasFix(millis())||!inside(lat,lon)||x<0||y<0||x>=480||y>=480)
      lv_obj_add_flag(position,LV_OBJ_FLAG_HIDDEN);
    else{
      lv_obj_clear_flag(position,LV_OBJ_FLAG_HIDDEN);
      lv_obj_set_pos(position,x-6,y-6);
    }
  }
}
static void recenter(){
  if(hasFix(millis())&&inside(gpsDiagnostic.latitudeDegrees,gpsDiagnostic.longitudeDegrees)){
    offsetX=240-mapX(gpsDiagnostic.longitudeDegrees)*scale/256;
    offsetY=240-mapY(gpsDiagnostic.latitudeDegrees)*scale/256;
  }else if(selected>=0){
    offsetX=240-mapX(boxes[selected].longitude)*scale/256;
    offsetY=240-mapY(boxes[selected].latitude)*scale/256;
  }else offsetX=offsetY=(screen-size*scale/256)/2;
  moveMap();
}

static void refreshMap(uint32_t now){
  if(view!=View::Map||!mapReady||!caption)return;
  if(follow)recenter();
  else moveMap();
  if(active<0)return;
  char text[130];
  if(!hasFix(now))snprintf(text,sizeof(text),"Waiting for GPS fix");
  else {
    const auto &box=boxes[active];
    const double distance=distanceMeters(box);
    if(!compassReady||!hasNorth)snprintf(text,sizeof(text),"%.0f yd  |  Calibrate compass",distance*1.0936133);
    else{
      const double heading=fmod(rawAngle-northAngle+360.0,360.0);
      const double relative=fmod(boxBearing(box)-heading+360.0,360.0);
      constexpr const char *turn[]={"Ahead","Ahead right","Right","Back right","Behind","Back left","Left","Ahead left"};
      snprintf(text,sizeof(text),"%.0f yd  |  %s",distance*1.0936133,turn[unsigned((relative+22.5)/45.0)%8]);
    }
  }
  updateLabel(caption,text);
  if(scanLabel)updateLabel(scanLabel,message);
}
static void marker(lv_obj_t *o,lv_color_t color,int sizePx){
  lv_obj_remove_style_all(o);
  lv_obj_set_size(o,sizePx,sizePx);
  lv_obj_set_style_radius(o,LV_RADIUS_CIRCLE,0);
  lv_obj_set_style_bg_color(o,color,0);
  lv_obj_set_style_bg_opa(o,LV_OPA_COVER,0);
  lv_obj_set_style_border_width(o,2,0);
  lv_obj_set_style_border_color(o,lv_color_white(),0);
  lv_obj_clear_flag(o,LV_OBJ_FLAG_SCROLLABLE);
}
static void drawMap(){
  if(!mapReady){
    panel();
    navTitle(6,"Trailhead");
    navLabel("Treasure Box test area",139,330,&nav_text);
    navLabel(message[0]?message:"Download the map for offline hunts",190,305,&lv_font_montserrat_16);
    if(!downloading)navAction("Download test area",284,[](lv_event_t*){downloadMap();});
    if(!downloading)backArrow([](lv_event_t*){showDashboard();},navSand());
    return;
  }
  mapArt.header.cf=LV_IMG_CF_TRUE_COLOR;
  mapArt.header.w=size;
  mapArt.header.h=size;
  mapArt.data_size=mapBytes;
  mapArt.data=pixels;
  mapImage=lv_img_create(lv_scr_act());
  lv_img_set_src(mapImage,&mapArt);
  lv_img_set_pivot(mapImage,0,0);
  lv_obj_add_flag(mapImage,LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(mapImage,[](lv_event_t*){
    auto *input=lv_indev_get_act();
    if(!input)return;
    lv_point_t movement{};
    lv_indev_get_vect(input,&movement);
    if(!movement.x&&!movement.y)return;
    follow=false;
    offsetX+=movement.x;
    offsetY+=movement.y;
    moveMap();
  },LV_EVENT_PRESSING,nullptr);
  for(unsigned i=0;i<count;i++){
    auto *pin=lv_obj_create(lv_scr_act());
    mapButtons[i]=pin;
    marker(pin,lv_color_hex(int(i)==selected?0x184668:0x168d84),30);
    auto *symbol=lv_label_create(pin);
    lv_label_set_text(symbol,(foundFlags()&(1u<<i))?LV_SYMBOL_OK:LV_SYMBOL_DIRECTORY);
    lv_obj_set_style_text_color(symbol,lv_color_white(),0);
    lv_obj_center(symbol);
    lv_obj_add_event_cb(pin,[](lv_event_t *e){
      if(active>=0)return;
      selected=int(reinterpret_cast<uintptr_t>(lv_event_get_user_data(e)));
      draw(View::Map);
    },LV_EVENT_CLICKED,reinterpret_cast<void*>(uintptr_t(i)));
  }
  position=lv_obj_create(lv_scr_act());
  marker(position,lv_color_hex(0x1266ee),12);
  lv_obj_clear_flag(position,LV_OBJ_FLAG_CLICKABLE);
  backArrow([](lv_event_t*){
    if(readingTag)return;
    active=-1;selected=-1;message[0]=0;
    showDashboard();
  },lv_color_hex(0x112645));
  darkLabel("© OpenStreetMap contributors",402,300,&lv_font_montserrat_14);
  caption=darkLabel("",82,310,&nav_text);
  if(active>=0){
    scanLabel=darkLabel("",112,285,&lv_font_montserrat_14);
    button("Compass",300,181,110,[](lv_event_t*){if(!readingTag)draw(View::Compass);});
    button("Recenter",300,239,110,[](lv_event_t*){follow=true;recenter();});
    button("Exit",91,347,120,[](lv_event_t*){if(!readingTag){active=-1;message[0]=0;draw(View::Map);}});
    button("Scan tag",222,347,163,[](lv_event_t*){scan();});
  }else{
    updateLabel(caption,"Trailhead");
    button("List",309,130,93,[](lv_event_t*){draw(View::List);});
    button("+",336,186,60,[](lv_event_t*){scale=min(320,scale+40);recenter();});
    button("-",336,240,60,[](lv_event_t*){scale=max(160,scale-40);recenter();});
    if(selected>=0)navAction(boxes[selected].title,346,[](lv_event_t*){draw(View::Details);},292);
  }
  refreshMap(millis());
}
static void draw(View next){
  view=next;
  clearPage(FIELD_TRAILHEAD);
  mapImage=position=caption=scanLabel=nullptr;
  compassPrompt=nullptr;
  if(next==View::Map){drawMap();return;}
  panel();
  if(next==View::List){
    navTitle(6,"Choose an Adventure");
    for(unsigned i=0;i<count;i++){
      auto *row=navAction(boxes[i].title,134+i*57,nullptr,300);
      lv_obj_add_event_cb(row,[](lv_event_t *e){
        selected=int(reinterpret_cast<uintptr_t>(lv_event_get_user_data(e)));
        draw(View::Details);
      },LV_EVENT_CLICKED,reinterpret_cast<void*>(uintptr_t(i)));
    }
    backArrow([](lv_event_t*){draw(View::Map);},navSand());
    return;
  }
  if(next==View::Compass){
    navTitle(6,"Calibrate compass");
    compassPrompt=navLabel("Keep the mounted device flat",128,330,&nav_text);
    navAction("Start / finish turn",224,[](lv_event_t*){
      if(!calibrating){
        minX=minY=10000;maxX=maxY=-10000;
        calibrating=true;
        updateLabel(compassPrompt,"Turn one full circle, then tap again");
      }else{
        calibrating=false;
        if(maxX-minX<10||maxY-minY<10){
          updateLabel(compassPrompt,"Turn a full circle and try again");
          return;
        }
        centerX=(maxX+minX)*0.5f;centerY=(maxY+minY)*0.5f;
        radiusX=(maxX-minX)*0.5f;radiusY=(maxY-minY)*0.5f;
        hasCalibration=true;hasNorth=false;
        updateLabel(compassPrompt,"Point the top of the device toward true north");
      }
    });
    navAction("Set north",290,[](lv_event_t*){
      if(!hasCalibration||calibrating||!compassReady){
        updateLabel(compassPrompt,"Complete the flat turn first");
        return;
      }
      northAngle=rawAngle;hasNorth=true;
      updateLabel(compassPrompt,"Compass set for this test session");
    });
    backArrow([](lv_event_t*){calibrating=false;draw(View::Map);},navSand());
    return;
  }
  if(selected<0){draw(View::Map);return;}
  const auto &box=boxes[selected];
  if(next==View::Found){
    navLabel("Treasure discovered",66,285,&lv_font_montserrat_16);
    navLabel("You found it!",94,300,&nav_row);
    navLabel(box.title,132,310,&nav_text);
    scrollBody(box.story,true);
  }else if(next==View::Story||next==View::Hint){
    navTitle(6,next==View::Story?"Description & Story":"Hint");
    scrollBody(next==View::Story?box.story:box.hint[0]?box.hint:"This box has no hint",false);
    backArrow([](lv_event_t*){draw(View::Details);},navSand());
  }else{
    navTitle(6,"Box Details");
    navLabel(box.id,108,285,&lv_font_montserrat_16);
    navLabel(box.title,135,310,&nav_row);
    char text[70];
    if(hasFix(millis()))snprintf(text,sizeof(text),"%.0f yd  |  Difficulty %d/5  |  Terrain %d/5",distanceMeters(box)*1.0936133,box.difficulty,box.terrain);
    else snprintf(text,sizeof(text),"Difficulty %d/5  |  Terrain %d/5",box.difficulty,box.terrain);
    navLabel(text,200,340,&lv_font_montserrat_16);
    navAction("Begin Adventure",244,[](lv_event_t*){
      active=selected;follow=true;scale=240;message[0]=0;draw(View::Map);
    });
    navAction("Description & Story",301,[](lv_event_t*){draw(View::Story);});
    navAction("Hint",357,[](lv_event_t*){draw(View::Hint);});
    backArrow([](lv_event_t*){draw(View::Map);},navSand());
  }
}
static void show(){
  message[0]=0;
  selected=active=-1;
  scale=160;offsetX=offsetY=0;follow=false;
  resetGpsDiagnostic();
  loadMap();
  draw(View::Map);
}
static void service(uint32_t now){
  if(downloading){
    const int result=downloadResult.exchange(0);
    if(result){
      downloading=false;
      mapReady=result>0;
      snprintf(message,sizeof(message),"%s",mapReady?"":"Download failed. Try again.");
      if(page==FIELD_TRAILHEAD)draw(View::Map);
    }
  }
  if(page!=FIELD_TRAILHEAD||now-compassAt<180)return;
  compassAt=now;
  if(!compassReady)compassReady=compassDiagnostic.begin_I2C(compassAddress,&Wire);
  if(compassReady){
    sensors_event_t event{};
    compassDiagnostic.getEvent(&event);
    const float x=event.magnetic.x,y=event.magnetic.y;
    if(calibrating&&isfinite(x)&&isfinite(y)){
      minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y);
    }
    rawAngle=fmodf(atan2f((y-centerY)/radiusY,(x-centerX)/radiusX)*180.0f/PI+360.0f,360.0f);
  }
  if(now-renderAt>=250){renderAt=now;refreshMap(now);}
}
} // namespace trailheadField
