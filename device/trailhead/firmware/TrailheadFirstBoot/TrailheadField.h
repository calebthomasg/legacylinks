#pragma once
#include "TrailheadFieldBoxes.h"
#include "TrailheadFieldIcons.h"
#include "TrailheadWalking.h"
#include <strings.h>
#include <cmath>
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
static lv_obj_t *userHeading=nullptr,*targetNeedle=nullptr,*distanceReadout=nullptr,*cardinalReadout=nullptr;
static lv_obj_t *routeLine=nullptr,*routeShadow=nullptr;
static std::vector<fieldWalking::Point> walkingRoute;
static std::vector<lv_point_t> routeScreen;
static int routeScale=0,lastRouteBox=-1,lastRouteX=0,lastRouteY=0,listOffset=0,gestureStartY=480;
static uint32_t routeAt=0;
static bool animateBottom=false,firstLocation=false,bearingOnly=false,compassFromSettings=false;
static lv_point_t startLink[2]{},endLink[2]{};
static lv_obj_t *startGuide=nullptr,*endGuide=nullptr;
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
static lv_obj_t *icon(lv_obj_t *parent,const lv_img_dsc_t *asset){
  auto *obj=lv_img_create(parent);
  lv_img_set_src(obj,asset);
  lv_obj_clear_flag(obj,LV_OBJ_FLAG_CLICKABLE);
  return obj;
}
static lv_obj_t *copy(lv_obj_t *parent,const char *text,const lv_font_t *font,lv_color_t color){
  auto *obj=lv_label_create(parent);
  lv_label_set_text(obj,text);
  lv_obj_set_style_text_font(obj,font,0);
  lv_obj_set_style_text_color(obj,color,0);
  lv_obj_clear_flag(obj,LV_OBJ_FLAG_CLICKABLE);
  return obj;
}
static lv_obj_t *darkLabel(const char *text,int y,int width,const lv_font_t *font){
  auto *obj=navLabel(text,y,width,font);
  lv_obj_set_style_text_color(obj,lv_color_hex(0x0f1d3a),0);
  return obj;
}
static lv_obj_t *surface(lv_obj_t *parent,int x,int y,int w,int h,lv_color_t color,lv_opa_t opa=LV_OPA_COVER){
  auto *obj=lv_obj_create(parent);
  lv_obj_remove_style_all(obj);
  lv_obj_set_pos(obj,x,y);
  lv_obj_set_size(obj,w,h);
  lv_obj_set_style_bg_color(obj,color,0);
  lv_obj_set_style_bg_opa(obj,opa,0);
  lv_obj_clear_flag(obj,LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_CLICKABLE);
  return obj;
}
static void detailsHeader(){
  auto *glyph=icon(lv_scr_act(),&fieldBox);
  lv_obj_align(glyph,LV_ALIGN_TOP_MID,-75,60);
  auto *title=copy(lv_scr_act(),"Box Details",&nav_text,navSand());
  lv_obj_align(title,LV_ALIGN_TOP_MID,20,65);
}
static void slideIn(lv_obj_t *obj,int x,int y){
  lv_anim_t a;
  lv_anim_init(&a);
  lv_anim_set_var(&a,obj);
  lv_anim_set_time(&a,235);
  lv_anim_set_path_cb(&a,lv_anim_path_ease_out);
  if(y){
    lv_anim_set_values(&a,y,0);
    lv_anim_set_exec_cb(&a,[](void *p,int32_t v){lv_obj_set_style_translate_y(static_cast<lv_obj_t*>(p),v,0);});
  }else{
    lv_anim_set_values(&a,x,0);
    lv_anim_set_exec_cb(&a,[](void *p,int32_t v){lv_obj_set_style_translate_x(static_cast<lv_obj_t*>(p),v,0);});
  }
  lv_anim_start(&a);
}
static void slideScreen(View next,int x){
  draw(next);
  for(unsigned i=0;i<lv_obj_get_child_cnt(lv_scr_act());i++)
    if(auto *child=lv_obj_get_child(lv_scr_act(),i))slideIn(child,x,0);
}

static lv_obj_t *fadeHint=nullptr;
static void updateFade(lv_event_t *event){
  auto *scroll=lv_event_get_target(event);
  if(!fadeHint)return;
  if(lv_obj_get_scroll_bottom(scroll)>4)lv_obj_clear_flag(fadeHint,LV_OBJ_FLAG_HIDDEN);
  else lv_obj_add_flag(fadeHint,LV_OBJ_FLAG_HIDDEN);
}
static void scrollBody(const char *description,bool found){
  auto *scroll=lv_obj_create(lv_scr_act());
  lv_obj_remove_style_all(scroll);
  const int y=found?174:146, height=found?228:248;
  lv_obj_set_pos(scroll,68,y);
  lv_obj_set_size(scroll,344,height);
  lv_obj_set_scroll_dir(scroll,LV_DIR_VER);
  lv_obj_set_scrollbar_mode(scroll,LV_SCROLLBAR_MODE_OFF);
  auto *body=copy(scroll,description,&nav_text,navSand());
  lv_obj_set_pos(body,5,0);
  lv_obj_set_width(body,334);
  lv_obj_update_layout(scroll);
  if(found){
    auto *done=target(scroll,42,lv_obj_get_height(body)+18,260,44,[](lv_event_t*){selected=-1;draw(View::Map);});
    lv_obj_set_style_bg_color(done,lv_color_hex(0x0f1d3a),0);
    lv_obj_set_style_bg_opa(done,LV_OPA_COVER,0);
    lv_obj_set_style_radius(done,4,0);
    lv_obj_center(copy(done,"Back to Trailhead",&nav_text,navSand()));
  }
  constexpr int bands=18,step=5;
  fadeHint=surface(lv_scr_act(),67,y+height-bands*step,346,bands*step+20,lv_color_black(),LV_OPA_TRANSP);
  for(int i=0;i<bands;i++){
    auto *band=surface(fadeHint,0,step*i,346,step,lv_color_hex(0x4fbdbf),lv_opa_t(255*i/(bands-1)));
    lv_obj_set_style_bg_grad_color(band,lv_color_hex(0x64bee9),0);
    lv_obj_set_style_bg_grad_dir(band,LV_GRAD_DIR_HOR,0);
  }
  auto *down=copy(fadeHint,LV_SYMBOL_DOWN,&lv_font_montserrat_24,navSand());
  lv_obj_align(down,LV_ALIGN_BOTTOM_MID,0,0);
  lv_obj_add_event_cb(scroll,updateFade,LV_EVENT_SCROLL,nullptr);
  lv_obj_update_layout(scroll);
  if(lv_obj_get_scroll_bottom(scroll)<=4)lv_obj_add_flag(fadeHint,LV_OBJ_FLAG_HIDDEN);
}

static float facing(){return fmodf(rawAngle-northAngle+360.0f,360.0f);}
static void moveRoute(){
  if(!routeLine||!routeShadow)return;
  if(walkingRoute.size()<2){
    lv_obj_add_flag(startGuide,LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(endGuide,LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(routeLine,LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(routeShadow,LV_OBJ_FLAG_HIDDEN);
    return;
  }
  if(routeScreen.size()!=walkingRoute.size()||routeScale!=scale){
    routeScreen.resize(walkingRoute.size());
    for(size_t i=0;i<walkingRoute.size();i++){
      routeScreen[i].x=walkingRoute[i].x*scale/256;
      routeScreen[i].y=walkingRoute[i].y*scale/256;
    }
    for(auto *line:{routeLine,routeShadow})lv_line_set_points(line,routeScreen.data(),routeScreen.size());
    routeScale=scale;
  }
  for(auto *line:{routeLine,routeShadow}){
    if(bearingOnly)lv_obj_add_flag(line,LV_OBJ_FLAG_HIDDEN);
    else lv_obj_clear_flag(line,LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_pos(line,offsetX,offsetY);
  }
  auto atScale=[](int x,int y){return lv_point_t{lv_coord_t(x*scale/256),lv_coord_t(y*scale/256)};};
  const auto &box=boxes[active];
  startLink[0]=atScale(mapX(gpsDiagnostic.longitudeDegrees),mapY(gpsDiagnostic.latitudeDegrees));
  startLink[1]=routeScreen.front();
  endLink[0]=routeScreen.back();
  endLink[1]=atScale(mapX(box.longitude),mapY(box.latitude));
  if(bearingOnly)startLink[1]=endLink[1];
  lv_line_set_points(startGuide,startLink,2);
  lv_obj_set_pos(startGuide,offsetX,offsetY);
  lv_obj_clear_flag(startGuide,LV_OBJ_FLAG_HIDDEN);
  if(bearingOnly)lv_obj_add_flag(endGuide,LV_OBJ_FLAG_HIDDEN);
  else{
    lv_line_set_points(endGuide,endLink,2);
    lv_obj_set_pos(endGuide,offsetX,offsetY);
    lv_obj_clear_flag(endGuide,LV_OBJ_FLAG_HIDDEN);
  }
}
static void moveMap(){
  if(!mapImage)return;
  const int edge=size*scale/256;
  if(!follow){
    offsetX=constrain(offsetX,screen-edge,0);
    offsetY=constrain(offsetY,screen-edge,0);
  }
  lv_img_set_zoom(mapImage,scale);
  lv_obj_set_pos(mapImage,offsetX,offsetY);
  moveRoute();
  for(unsigned i=0;i<count;i++){
    const int x=offsetX+mapX(boxes[i].longitude)*scale/256;
    const int y=offsetY+mapY(boxes[i].latitude)*scale/256;
    if(x<0||x>=480||y<0||y>=480)lv_obj_add_flag(mapButtons[i],LV_OBJ_FLAG_HIDDEN);
    else{
      lv_obj_clear_flag(mapButtons[i],LV_OBJ_FLAG_HIDDEN);
      lv_obj_set_pos(mapButtons[i],x-22,y-22);
    }
  }
  const double lat=gpsDiagnostic.latitudeDegrees,lon=gpsDiagnostic.longitudeDegrees;
  if(!hasFix(millis())||!inside(lat,lon)){
    lv_obj_add_flag(position,LV_OBJ_FLAG_HIDDEN);
    return;
  }
  const int x=offsetX+mapX(lon)*scale/256,y=offsetY+mapY(lat)*scale/256;
  lv_obj_set_pos(position,x-24,y-24);
  lv_obj_clear_flag(position,LV_OBJ_FLAG_HIDDEN);
  if(hasNorth&&compassReady){
    lv_img_set_angle(userHeading,int(lroundf(facing()*10)));
    lv_obj_clear_flag(userHeading,LV_OBJ_FLAG_HIDDEN);
  }else lv_obj_add_flag(userHeading,LV_OBJ_FLAG_HIDDEN);
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
  const bool fix=hasFix(now);
  const bool onMap=fix&&inside(gpsDiagnostic.latitudeDegrees,gpsDiagnostic.longitudeDegrees);
  if(active>=0&&onMap){
    const int x=mapX(gpsDiagnostic.longitudeDegrees),y=mapY(gpsDiagnostic.latitudeDegrees);
    if(lastRouteBox!=active||((abs(x-lastRouteX)+abs(y-lastRouteY)>=7)&&now-routeAt>=2500)){
      lastRouteBox=active;lastRouteX=x;lastRouteY=y;routeAt=now;
      const int bx=mapX(boxes[active].longitude),by=mapY(boxes[active].latitude);
      bearingOnly=!fieldWalking::find(x,y,bx,by,walkingRoute)||walkingRoute.size()<2;
      if(bearingOnly)walkingRoute={{int16_t(x),int16_t(y)},{int16_t(bx),int16_t(by)}};
      routeScale=0;
    }
  }else{
    walkingRoute.clear();
    lastRouteBox=-1;
  }
  if(firstLocation&&onMap){
    firstLocation=false;
    if(follow&&active<0)scale=240;
  }
  if(follow)recenter();
  else moveMap();
  if(active<0){
    updateLabel(caption,!fix?"Waiting for GPS":!onMap?"Outside downloaded area":"");
    return;
  }
  char distance[36]="-- yd",direction[44]="";
  if(fix){
    snprintf(distance,sizeof(distance),"%.0f yd",distanceMeters(boxes[active])*1.0936133);
    if(hasNorth&&compassReady){
      const double bearing=boxBearing(boxes[active]);
      const double relative=fmod(bearing-facing()+360.0,360.0);
      constexpr const char *cardinal[]={"N","NE","E","SE","S","SW","W","NW"};
      snprintf(direction,sizeof(direction),"%s",cardinal[unsigned((bearing+22.5)/45.0)%8]);
      lv_img_set_angle(targetNeedle,int(lround(relative*10)));
      lv_obj_clear_flag(targetNeedle,LV_OBJ_FLAG_HIDDEN);
    }else lv_obj_add_flag(targetNeedle,LV_OBJ_FLAG_HIDDEN);
  }else lv_obj_add_flag(targetNeedle,LV_OBJ_FLAG_HIDDEN);
  updateLabel(distanceReadout,distance);
  updateLabel(cardinalReadout,direction);
  updateLabel(caption,!fix?"Waiting for GPS":!onMap?"Outside downloaded area":bearingOnly?"Bearing only · no mapped route":"");
  if(scanLabel)updateLabel(scanLabel,message);
}
static void marker(lv_obj_t *obj,lv_color_t color,int diameter){
  lv_obj_set_size(obj,diameter,diameter);
  lv_obj_set_style_radius(obj,LV_RADIUS_CIRCLE,0);
  lv_obj_set_style_bg_color(obj,color,0);
  lv_obj_set_style_bg_opa(obj,LV_OPA_COVER,0);
  lv_obj_set_style_border_width(obj,2,0);
  lv_obj_set_style_border_color(obj,lv_color_white(),0);
}
static void userMarker(){
  const auto blue=lv_color_hex(0x2998e9);
  position=surface(lv_scr_act(),0,0,48,48,blue,LV_OPA_TRANSP);
  auto *halo=surface(position,6,6,36,36,blue,51);
  lv_obj_set_style_radius(halo,LV_RADIUS_CIRCLE,0);
  lv_obj_set_style_border_width(halo,1,0);
  lv_obj_set_style_border_color(halo,blue,0);
  lv_obj_set_style_border_opa(halo,115,0);
  auto *dot=surface(position,15,15,18,18,blue);
  marker(dot,blue,18);
  lv_obj_set_style_border_width(dot,3,0);
  userHeading=icon(position,&fieldHeading);
  lv_img_set_pivot(userHeading,24,24);
}
static void panelAction(lv_obj_t *parent,const char *title,int x,int y,int width,
                        lv_event_cb_t cb,lv_color_t color){
  auto *hit=target(parent,x,y,width,34,cb);
  lv_obj_center(copy(hit,title,&lv_font_montserrat_16,color));
}
static void drawMap(){
  if(!mapReady){
    panel();
    navTitle(6,"Trailhead");
    navLabel("Treasure Box test area",139,330,&nav_text);
    navLabel(message[0]?message:"Download the map for offline hunts",190,305,&lv_font_montserrat_16);
    if(!downloading){
      navAction("Download test area",284,[](lv_event_t*){downloadMap();});
      backArrow([](lv_event_t*){showDashboard();},navSand());
    }
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
    if(auto *input=lv_indev_get_act()){
      lv_point_t point{};
      lv_indev_get_point(input,&point);
      gestureStartY=point.y;
    }
  },LV_EVENT_PRESSED,nullptr);
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
  routeShadow=lv_line_create(lv_scr_act());
  routeLine=lv_line_create(lv_scr_act());
  lv_obj_set_style_line_color(routeShadow,lv_color_hex(0x95782e),0);
  lv_obj_set_style_line_width(routeShadow,7,0);
  lv_obj_set_style_line_color(routeLine,lv_color_hex(0xffc943),0);
  lv_obj_set_style_line_width(routeLine,4,0);
  for(auto *line:{routeLine,routeShadow}){
    lv_obj_clear_flag(line,LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_line_rounded(line,true,0);
  }
  startGuide=lv_line_create(lv_scr_act());
  endGuide=lv_line_create(lv_scr_act());
  for(auto *line:{startGuide,endGuide}){
    lv_obj_clear_flag(line,LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_line_color(line,lv_color_hex(0x9a7324),0);
    lv_obj_set_style_line_width(line,3,0);
    lv_obj_set_style_line_dash_width(line,4,0);
    lv_obj_set_style_line_dash_gap(line,5,0);
  }
  const uint8_t found=foundFlags();
  for(unsigned i=0;i<count;i++){
    auto *pin=target(lv_scr_act(),0,0,44,44,[](lv_event_t *e){
      if(active>=0)return;
      selected=int(reinterpret_cast<uintptr_t>(lv_event_get_user_data(e)));
      animateBottom=true;
      draw(View::Map);
    },reinterpret_cast<void*>(uintptr_t(i)));
    mapButtons[i]=pin;
    lv_obj_center(icon(pin,&fieldPin));
    if(found&(1u<<i)){
      auto *check=copy(pin,LV_SYMBOL_OK,&lv_font_montserrat_14,lv_color_hex(0x0f1d3a));
      lv_obj_align(check,LV_ALIGN_TOP_RIGHT,-1,0);
    }
  }
  userMarker();
  backArrow([](lv_event_t*){
    if(readingTag)return;
    active=-1;selected=-1;message[0]=0;
    showDashboard();
  },lv_color_hex(0x0f1d3a));
  darkLabel("© OpenStreetMap contributors",active>=0||selected>=0?344:404,270,&lv_font_montserrat_14);
  caption=darkLabel("",active>=0?96:71,280,&lv_font_montserrat_14);
  if(active>=0){
    auto *pin=icon(lv_scr_act(),&fieldDistance);
    lv_obj_set_style_img_recolor(pin,lv_color_hex(0x0f1d3a),0);
    lv_obj_set_style_img_recolor_opa(pin,LV_OPA_COVER,0);
    lv_obj_set_pos(pin,122,57);
    distanceReadout=copy(lv_scr_act(),"-- yd",&nav_text,lv_color_hex(0x0f1d3a));
    lv_obj_set_pos(distanceReadout,153,60);
    targetNeedle=icon(lv_scr_act(),&fieldNeedle);
    lv_obj_set_pos(targetNeedle,257,53);
    cardinalReadout=copy(lv_scr_act(),"",&nav_text,lv_color_hex(0x0f1d3a));
    lv_obj_set_pos(cardinalReadout,290,60);
    scanLabel=darkLabel("",126,270,&lv_font_montserrat_14);
    auto *scanHit=target(lv_scr_act(),157,296,166,39,[](lv_event_t*){scan();});
    lv_obj_set_style_bg_color(scanHit,lv_color_hex(0x0f1d3a),0);
    lv_obj_set_style_bg_opa(scanHit,LV_OPA_80,0);
    lv_obj_set_style_radius(scanHit,4,0);
    lv_obj_center(copy(scanHit,"Scan tag",&nav_text,navSand()));
    if(!hasNorth){
      auto *cal=target(lv_scr_act(),303,164,110,38,[](lv_event_t*){if(!readingTag){compassFromSettings=false;draw(View::Compass);}});
      lv_obj_center(copy(cal,"Calibrate",&lv_font_montserrat_14,lv_color_hex(0x0f1d3a)));
    }
    auto *actions=surface(lv_scr_act(),0,369,480,112,lv_color_hex(0x0f1d3a),LV_OPA_80);
    panelAction(actions,"Recenter",130,5,220,[](lv_event_t*){follow=true;recenter();},navSand());
    panelAction(actions,"Exit Adventure",130,40,220,[](lv_event_t*){
      if(readingTag)return;
      active=-1;selected=-1;message[0]=0;draw(View::Map);
    },lv_color_hex(0xf28e80));
    if(animateBottom)slideIn(actions,0,110);
  }else if(selected>=0){
    auto *sheet=surface(lv_scr_act(),0,371,480,110,lv_color_hex(0x0f1d3a),LV_OPA_80);
    auto *hit=target(sheet,109,0,262,77,[](lv_event_t*){slideScreen(View::Details,105);});
    auto *id=copy(hit,boxes[selected].id,&lv_font_montserrat_14,navSand());
    lv_obj_align(id,LV_ALIGN_TOP_MID,-12,11);
    auto *name=copy(hit,boxes[selected].title,&nav_text,navSand());
    lv_obj_set_width(name,229);
    lv_obj_set_style_text_align(name,LV_TEXT_ALIGN_CENTER,0);
    lv_obj_align(name,LV_ALIGN_TOP_MID,-10,32);
    auto *forward=copy(hit,LV_SYMBOL_RIGHT,&lv_font_montserrat_16,navSand());
    lv_obj_align(forward,LV_ALIGN_RIGHT_MID,0,-6);
    if(animateBottom)slideIn(sheet,0,110);
  }
  animateBottom=false;
  refreshMap(millis());
}
static void metric(const lv_img_dsc_t *image,const char *text,int x,int width){
  auto *group=surface(lv_scr_act(),x,197,width,33,lv_color_black(),LV_OPA_TRANSP);
  lv_obj_align(icon(group,image),LV_ALIGN_LEFT_MID,0,0);
  lv_obj_align(copy(group,text,&nav_text,navSand()),LV_ALIGN_LEFT_MID,29,0);
}
static void gesture(lv_event_t*){
  if(page!=FIELD_TRAILHEAD||readingTag)return;
  auto *input=lv_indev_get_act();
  if(!input)return;
  const auto direction=lv_indev_get_gesture_dir(input);
  if(view==View::Map&&direction==LV_DIR_BOTTOM&&gestureStartY<158&&active<0){
    draw(View::List);
    lv_indev_wait_release(input);
  }else if(view==View::Map&&direction==LV_DIR_LEFT&&active>=0){
    selected=active;
    slideScreen(View::Details,110);
    lv_indev_wait_release(input);
  }else if(direction==LV_DIR_RIGHT){
    if(view==View::Story||view==View::Hint)slideScreen(View::Details,-110);
    else if(view==View::Details||view==View::List)draw(View::Map);
    else return;
    lv_indev_wait_release(input);
  }
}
static void draw(View next){
  view=next;
  clearPage(FIELD_TRAILHEAD);
  lv_obj_remove_event_cb(lv_scr_act(),gesture);
  lv_obj_add_event_cb(lv_scr_act(),gesture,LV_EVENT_GESTURE,nullptr);
  mapImage=position=caption=scanLabel=fadeHint=nullptr;
  compassPrompt=routeShadow=routeLine=startGuide=endGuide=nullptr;
  routeScale=0;
  if(next==View::Map){drawMap();return;}
  panel();
  if(next==View::List){
    navLabel("Choose an Adventure",70,320,&nav_text);
    auto *list=navMenu(&listOffset);
    for(unsigned i=0;i<count;i++){
      auto *row=navMenuRow(list,boxes[i].title,[](lv_event_t *e){
        selected=int(reinterpret_cast<uintptr_t>(lv_event_get_user_data(e)));
        slideScreen(View::Details,105);
      },reinterpret_cast<void*>(uintptr_t(i)));
      auto *text=lv_obj_get_child(row,0);
      lv_obj_set_width(text,249);
      lv_obj_set_style_text_align(text,LV_TEXT_ALIGN_LEFT,0);
      lv_obj_align(text,LV_ALIGN_LEFT_MID,66,0);
      auto *disc=surface(row,24,9,38,38,lv_color_hex(0x16425e),LV_OPA_70);
      lv_obj_set_style_radius(disc,LV_RADIUS_CIRCLE,0);
      auto *glyph=icon(disc,&fieldBox);
      lv_img_set_zoom(glyph,158);
      lv_obj_center(glyph);
    }
    positionMenu(list,listOffset);
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
      northAngle=rawAngle;
      hasNorth=true;
      const float calibration[]={centerX,centerY,radiusX,radiusY,northAngle};
      prefs.putBytes("fieldCompass",calibration,sizeof(calibration));
      updateLabel(compassPrompt,"Compass calibration saved");
    });
    backArrow([](lv_event_t*){
      calibrating=false;
      if(compassFromSettings)showSettings();
      else draw(View::Map);
    },navSand());
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
    detailsHeader();
    navLabel(next==View::Story?"Description & Story":"Hint",106,310,&nav_row);
    scrollBody(next==View::Story?box.story:box.hint[0]?box.hint:"This box has no hint",false);
    backArrow([](lv_event_t*){slideScreen(View::Details,-105);},navSand());
  }else{
    detailsHeader();
    navLabel(box.id,109,285,&lv_font_montserrat_16);
    navLabel(box.title,136,320,&nav_row);
    char distance[26]="-- yd",difficulty[12],terrain[12];
    if(hasFix(millis()))snprintf(distance,sizeof(distance),"%.0f yd",distanceMeters(box)*1.0936133);
    snprintf(difficulty,sizeof(difficulty),"%d/5",box.difficulty);
    snprintf(terrain,sizeof(terrain),"%d/5",box.terrain);
    metric(&fieldDistance,distance,87,109);
    metric(&fieldDifficulty,difficulty,207,82);
    metric(&fieldTerrain,terrain,308,82);
    if(active<0){
      auto *begin=navAction("Begin Adventure",243,[](lv_event_t*){
        active=selected;follow=true;scale=240;message[0]=0;animateBottom=true;draw(View::Map);
      },289);
      lv_obj_set_style_radius(begin,4,0);
      lv_obj_set_style_bg_opa(begin,LV_OPA_COVER,0);
      lv_obj_align(icon(begin,&fieldBegin),LV_ALIGN_LEFT_MID,24,0);
      lv_obj_align(lv_obj_get_child(begin,0),LV_ALIGN_CENTER,13,0);
    }
    auto *story=target(lv_scr_act(),77,active<0?302:259,326,45,[](lv_event_t*){slideScreen(View::Story,120);});
    lv_obj_center(copy(story,"Description & Story",&nav_text,navSand()));
    auto *rule=surface(lv_scr_act(),99,active<0?346:303,282,1,navSand(),LV_OPA_50);
    lv_obj_clear_flag(rule,LV_OBJ_FLAG_CLICKABLE);
    auto *hint=target(lv_scr_act(),105,active<0?349:306,270,45,[](lv_event_t*){slideScreen(View::Hint,120);});
    lv_obj_center(copy(hint,"Hint",&nav_text,navSand()));
    backArrow([](lv_event_t*){draw(View::Map);},navSand());
  }
}
static void showCompass(){
  compassFromSettings=true;
  draw(View::Compass);
}
static void show(){
  message[0]=0;
  selected=active=-1;
  scale=160;offsetX=offsetY=0;follow=true;firstLocation=true;
  float calibration[5]{};
  if(!hasNorth&&prefs.getBytesLength("fieldCompass")==sizeof(calibration)&&
     prefs.getBytes("fieldCompass",calibration,sizeof(calibration))==sizeof(calibration)&&
     std::all_of(calibration,calibration+5,[](float x){return std::isfinite(x);})&&
     calibration[2]>5&&calibration[3]>5){
    centerX=calibration[0];centerY=calibration[1];radiusX=calibration[2];radiusY=calibration[3];
    northAngle=calibration[4];hasCalibration=hasNorth=true;
  }
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
