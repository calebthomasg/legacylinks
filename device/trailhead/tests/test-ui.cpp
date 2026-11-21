#include <lvgl.h>
#include <fstream>
#include <cassert>
#include <cstdio>
#include <array>
#include "OpeningArtwork.h"
enum Page {OPEN,DASH,SETTINGS,NETWORKS,PREVIEW,CONNECTION,CLOCK_VIEW};
static Page page=OPEN;static bool scanRequested=false,cloudAvailable=true;
static lv_obj_t *statusIcon=nullptr,*statusGlyph=nullptr,*statusLabel=nullptr,*passwordBox=nullptr,*networkList=nullptr,*image=nullptr;
static void showPetopia();
static void showDashboard();static void showConnectionStatus();static void showDialPreview(int);static void showSettings();static void showNetworks(){}static void showUpdates(){}static void showSignal(){}static void showDiagnostics(){}static void cancelNetwork(){}struct Prefs {
 uint8_t stored[5]{};
 size_t length=0;
 std::array<uint8_t,38> starter{};
 size_t starterLength=0;
 bool failWrite=false;
 void remove(const char*){}
 size_t getBytesLength(const char *key){return strcmp(key,"petCat") ? starterLength : length;}
 size_t getBytes(const char *key,void *dst,size_t n){assert(n==getBytesLength(key));memcpy(dst,strcmp(key,"petCat") ? starter.data() : stored,n);return n;}
 size_t putBytes(const char *key,const void *src,size_t n){
   if(failWrite)return 0;
   if(!strcmp(key,"starterPet")){
     assert(n==starter.size());memcpy(starter.data(),src,n);starterLength=n;return n;
   }
   assert(!strcmp(key,"petCat") && n==sizeof(stored));
   memcpy(stored,src,n);length=n;return n;
 }
} prefs;static bool credentialsVerified=false;static const char *wifiMessage="";
static lv_color_t blue(){return lv_color_hex(0x0f1d3a);}static lv_color_t sand(){return lv_color_hex(0xf5f1e6);}
static lv_obj_t* label(const char *text,int y,int width=330){auto *o=lv_label_create(lv_scr_act());lv_label_set_text(o,text);lv_obj_set_width(o,width);lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);lv_obj_set_style_text_color(o,blue(),0);lv_obj_align(o,LV_ALIGN_TOP_MID,0,y);return o;}
static lv_obj_t* button(const char *text,int y,lv_event_cb_t cb,int width=240){auto *o=lv_btn_create(lv_scr_act());lv_obj_set_size(o,width,46);lv_obj_align(o,LV_ALIGN_TOP_MID,0,y);lv_obj_set_style_bg_color(o,blue(),0);lv_obj_set_style_text_color(o,sand(),0);lv_obj_set_style_radius(o,23,0);auto *l=lv_label_create(o);lv_label_set_text(l,text);lv_obj_center(l);lv_obj_add_event_cb(o,cb,LV_EVENT_CLICKED,nullptr);return o;}
static void clearPage(Page next){page=next;if(next!=NETWORKS)scanRequested=false;statusIcon=statusGlyph=nullptr;statusLabel=passwordBox=networkList=image=nullptr;lv_obj_clean(lv_scr_act());lv_obj_clear_flag(lv_scr_act(),LV_OBJ_FLAG_SCROLLABLE);lv_obj_set_style_bg_color(lv_scr_act(),sand(),0);lv_obj_set_style_text_font(lv_scr_act(),&lv_font_montserrat_16,0);}

static lv_img_dsc_t artwork={};
static void showImage(lv_obj_t *parent){artwork.header.cf=LV_IMG_CF_TRUE_COLOR;artwork.header.w=480;artwork.header.h=480;artwork.data_size=480*480*2;artwork.data=OPENING_PIXELS;image=lv_img_create(parent);lv_img_set_src(image,&artwork);lv_obj_center(image);}
#include "Petopia.h"
#include "DialUI.h"
static uint32_t esp_random() {
  static uint32_t deterministic = 41;
  return deterministic = deterministic * 1664525U + 1013904223U;
}
#include "PetopiaFirstVisit.h"
static void homeValues(char *date,char *clock,char *battery){strcpy(date,"Thu Nov 19");strcpy(clock,"11:45");strcpy(battery,LV_SYMBOL_BATTERY_3);}
static int visitedRow=-1;
static void settingsAction(unsigned index){visitedRow=index;clearPage(PREVIEW);}
static void showConnectionStatus(){page=CONNECTION;}
static uint16_t pixels[480*480];
static lv_point_t touchPoint;static bool down=false;
void readTouch(lv_indev_drv_t*,lv_indev_data_t*d){d->point=touchPoint;d->state=down?LV_INDEV_STATE_PR:LV_INDEV_STATE_REL;}
void flush(lv_disp_drv_t*d,const lv_area_t*a,lv_color_t*c){for(int y=a->y1;y<=a->y2;y++)for(int x=a->x1;x<=a->x2;x++)pixels[y*480+x]=(c++)->full;lv_disp_flush_ready(d);}
void step(int x,int y,bool pressed,int time=40){touchPoint={lv_coord_t(x),lv_coord_t(y)};down=pressed;for(int i=0;i<time;i+=5){lv_tick_inc(5);lv_timer_handler();}}
void shot(const char*name){lv_obj_update_layout(lv_scr_act());lv_refr_now(nullptr);std::ofstream o(name,std::ios::binary);o<<"P6\n480 480\n255\n";for(auto v:pixels){char rgb[3]={char(((v>>11)&31)*255/31),char(((v>>5)&63)*255/63),char((v&31)*255/31)};o.write(rgb,3);}}
static void tap(int x, int y) { step(x,y,true,75); step(x,y,false,75); }

static void testFirstVisit() {
 using namespace petopia;
 showDashboard();
 tap(382,382);
 step(382,382,false,2000);
 assert(!adoption.adopted() && lineIndex==0 && allocated==1);
 shot("petopia-welcome.ppm");
 for(unsigned i=0;i<sizeof(welcomeLines)/sizeof(*welcomeLines);++i) tap(240,367);
 assert(allocated==4 || allocated==5);
 shot("petopia-overview.ppm");
 tap(240,268);
 shot("petopia-carousel.ppm");
 const auto initialPosition=carousel.position();
 const auto *scene=lv_obj_get_child(lv_scr_act(),0);
 tap(397,207);
 step(397,207,false,300);
 assert(carousel.position()==initialPosition+1 && !outgoingCat);
 assert(scene==lv_obj_get_child(lv_scr_act(),0));
 tap(82,207);
 step(82,207,false,300);
 assert(carousel.position()==initialPosition);
 tap(240,362); assert(carousel.confirming());
 shot("petopia-confirm.ppm");
 tap(184,414); assert(!carousel.confirming() && carousel.position()==initialPosition);
 tap(240,362); assert(carousel.confirming());
 prefs.failWrite=true;
 tap(294,414); assert(carousel.confirming() && !adoption.adopted() && !prefs.starterLength);
 prefs.failWrite=false;
 tap(294,414); assert(adoption.adopted() && adoption.pet().hasStarterFood);
 const auto savedId=adoption.pet().id;
 char savedName[nameCapacity];
 strcpy(savedName,adoption.pet().name);
 shot("petopia-adopted.ppm");
 tap(240,370);
 tap(240,370);
 shot("petopia-home.ppm");
 showDashboard();
 assert(allocated==0);
 adoption=StarterAdoption{};
 tap(382,382);
 assert(adoption.pet().id==savedId && !strcmp(adoption.pet().name,savedName) &&
        adoption.pet().hasStarterFood);
 prefs.failWrite=true;
 tap(240,270); assert(adoption.pet().hasStarterFood);
 prefs.failWrite=false;
 tap(240,270); assert(!adoption.pet().hasStarterFood);
 tap(240,270); assert(!adoption.pet().hasStarterFood);
 showDashboard();
 adoption=StarterAdoption{};
 tap(382,382);
 assert(adoption.pet().id==savedId && !adoption.pet().hasStarterFood);
 tap(56,229);
 assert(page==DASH && allocated==0);
 printf("PASS: first visit, two-way carousel, cancellation, save retry, first feeding and restart persistence\n");
}

int main(){lv_init();static lv_color_t buf[480*40];static lv_disp_draw_buf_t db;lv_disp_draw_buf_init(&db,buf,nullptr,480*40);static lv_disp_drv_t d;lv_disp_drv_init(&d);d.hor_res=480;d.ver_res=480;d.draw_buf=&db;d.flush_cb=flush;lv_disp_drv_register(&d);static lv_indev_drv_t in;lv_indev_drv_init(&in);in.type=LV_INDEV_TYPE_POINTER;in.read_cb=readTouch;lv_indev_drv_register(&in);
 showOpen();
 step(240,400,false);
 auto *openerSurface = lv_obj_get_child(lv_scr_act(), -1);
 auto *openerLayer = lv_obj_get_child(openerSurface, 0);
 shot("opener.ppm");
 auto original = pixels[460*480+240];
 step(240,400,true); step(240,370,true);
 shot("opener-partial.ppm");
 assert(page==OPEN && lv_obj_get_y(openerLayer)==-30);
 assert(pixels[460*480+240]!=original);
 step(240,370,false,250);
 assert(page==OPEN && lv_obj_get_y(openerLayer)==0);
 step(240,400,true); step(365,300,true); step(365,300,false,250);
 assert(page==OPEN && lv_obj_get_y(openerLayer)==0);
 step(240,400,true); step(240,400,false,250);
 assert(page==OPEN);
 step(240,400,true); step(240,300,true); step(240,300,false);
 assert(page==OPEN);
 step(240,300,false,350);
 assert(page==DASH && !lv_obj_is_valid(openerSurface));
 shot("dial-home.ppm");
 for(const auto &shortcut : {lv_point_t{98,382}, lv_point_t{98,98}}) {
   step(shortcut.x,shortcut.y,true); step(shortcut.x,shortcut.y,false);
   assert(page==PREVIEW);
   auto *rows=lv_obj_get_child(lv_scr_act(),2);
   assert(lv_obj_get_child_cnt(rows)==(shortcut.y==382 ? 5 : 4));
   step(30,239,true); step(30,239,false);
   assert(page==DASH);
 }
 step(382,98,true); step(382,98,false);
 assert(page==PREVIEW);
 step(240,240,true); step(240,240,false);
 assert(page==PREVIEW);
 auto *alarms=lv_obj_get_child(lv_scr_act(),2);
 assert(strcmp(lv_label_get_text(lv_obj_get_child(lv_obj_get_child(alarms,2),0)), "6:45am")==0);
 shot("alarm-preview.ppm");
 step(30,239,true); step(30,239,false);
 assert(page==PREVIEW);
 step(240,184,true); step(240,184,false);
 assert(page==CLOCK_VIEW && strcmp(lv_label_get_text(timeText),"11:45")==0);
 step(30,239,true); step(30,239,false); assert(page==PREVIEW);
 step(30,239,true); step(30,239,false); assert(page==DASH);
 step(240,40,true);step(240,40,false);assert(page==SETTINGS);shot("settings.ppm");
 auto *list=lv_obj_get_child(lv_scr_act(),2);
 assert(lv_obj_get_style_text_opa(lv_obj_get_child(lv_obj_get_child(list,2),0),0)>lv_obj_get_style_text_opa(lv_obj_get_child(lv_obj_get_child(list,1),0),0));
 step(240,184,true);step(240,184,false);assert(visitedRow==1 && page==PREVIEW);
 showSettings();step(240,295,true);step(240,262,true);step(240,226,true);step(240,199,true);step(240,199,false,450);assert(page==SETTINGS && settingsOffset>112);
 int offset=settingsOffset;showSettings();assert(settingsOffset==offset);
 step(30,239,false,120);
 step(30,239,true);step(30,239,false);assert(page==DASH);
 step(40,240,true);step(40,240,false);assert(page==CONNECTION);
 showDashboard();showPetopiaTest();assert(page==PREVIEW && allocated==4);
 shot("petopia.ppm");step(160,306,true);step(160,306,false);assert(petopia::coat==1 && allocated==4);
 for(unsigned i=0;i<5;i++){step(320,306,true);step(320,306,false);assert(petopia::pattern==(i+1)%5);assert(allocated==(petopia::pattern==4?3:4));}
 // Exercise every packaged coat/pattern combination, including wraparound.
 for(unsigned c=0;c<4;c++){
   step(160,306,true);step(160,306,false);
   assert(petopia::coat==(2+c)%4 && allocated==4);
   for(unsigned p=0;p<5;p++){
     step(320,306,true);step(320,306,false);
     assert(petopia::pattern==(p+1)%5 && allocated==(p==3?3:4));
   }
 }
 // Remove exactly one pattern and recover via the coat control after re-entry.
 String path=String(getenv("PETOPIA_TEST_CARD"))+"/trailhead/petopia/Spotted-Midnight-on-body.pet";
 String backup=path+".bak";
 assert(std::rename(path.c_str(),backup.c_str())==0);
 step(160,306,true);step(160,306,false);assert(petopia::coat==2 && allocated==0);
 step(312,411,true);step(312,411,false);assert(page==DASH);
 showPetopiaTest();assert(page==PREVIEW && allocated==0);
 step(168,411,true);step(168,411,false);assert(!allocated);
 step(160,306,true);step(160,306,false);assert(petopia::coat==3 && allocated==4);
 assert(std::rename(backup.c_str(),path.c_str())==0);
 step(320,306,true);step(320,306,false);
 step(160,356,true);step(160,356,false);
 step(320,356,true);step(320,356,false);
 step(171,428,true);step(171,428,false);
 assert(prefs.length==5 && petopia::coat==3 && petopia::pattern==1 && petopia::nose==1 && petopia::eye==1);
 step(160,306,true);step(160,306,false);
 prefs.failWrite=true;
 step(171,428,true);step(171,428,false);
 prefs.failWrite=false;
 step(309,428,true);step(309,428,false);assert(page==DASH && allocated==0);
 petopia::coat=petopia::pattern=petopia::nose=petopia::eye=0;
 petopia::restoreCat();
 assert(petopia::coat==3 && petopia::pattern==1 && petopia::nose==1 && petopia::eye==1);
 petopia::mounted=false; SD_MMC.present=false;showPetopiaTest();assert(!allocated);
 SD_MMC.present=true;step(168,411,false,120);step(168,411,true);step(168,411,false);assert(allocated==4);
 assert(petopia::coat==3 && petopia::pattern==1 && petopia::nose==1 && petopia::eye==1);
 prefs.stored[4]=255;
 petopia::coat=petopia::pattern=petopia::nose=petopia::eye=0;
 petopia::restoreCat();assert(!petopia::coat && !petopia::pattern && !petopia::nose && !petopia::eye);
 for(int i=0;i<100;i++){showPetopiaTest();showDashboard();assert(allocated==0);}
 if(getenv("PETOPIA_SCENES")) testFirstVisit();
 for(int i=0;i<100;i++){showOpen();showDashboard();}lv_mem_monitor_t m;lv_mem_monitor(&m);assert(m.free_size>8000);printf("PASS: fixed Home shortcuts, off-center row tap, swipe, center fade, back position, Wi-Fi and Petopia, 100 screen cycles; %u bytes free\n",unsigned(m.free_size));
}
