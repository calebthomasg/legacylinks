#include <lvgl.h>
#include <fstream>
#include <cassert>
#include <cstdio>
#include "OpeningArtwork.h"
enum Page {OPEN,DASH,SETTINGS,NETWORKS,PREVIEW,CONNECTION};
static Page page=OPEN;static bool scanRequested=false,cloudAvailable=true;
static lv_obj_t *statusIcon=nullptr,*statusGlyph=nullptr,*statusLabel=nullptr,*passwordBox=nullptr,*networkList=nullptr,*image=nullptr;
static void stopDialAnimation();static void showDashboard();static void showConnectionStatus();static void showDialPreview(int);static void showSettings();static void showNetworks(){}static void showUpdates(){}static void showSignal(){}static void showDiagnostics(){}static void cancelNetwork(){}struct Prefs{void remove(const char*){}}prefs;static bool credentialsVerified=false;static const char *wifiMessage="";
static lv_color_t blue(){return lv_color_hex(0x0f1d3a);}static lv_color_t sand(){return lv_color_hex(0xf5f1e6);}
static lv_obj_t* label(const char *text,int y,int width=330){auto *o=lv_label_create(lv_scr_act());lv_label_set_text(o,text);lv_obj_set_width(o,width);lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);lv_obj_set_style_text_color(o,blue(),0);lv_obj_align(o,LV_ALIGN_TOP_MID,0,y);return o;}
static lv_obj_t* button(const char *text,int y,lv_event_cb_t cb,int width=240){auto *o=lv_btn_create(lv_scr_act());lv_obj_set_size(o,width,46);lv_obj_align(o,LV_ALIGN_TOP_MID,0,y);lv_obj_set_style_bg_color(o,blue(),0);lv_obj_set_style_text_color(o,sand(),0);lv_obj_set_style_radius(o,23,0);auto *l=lv_label_create(o);lv_label_set_text(l,text);lv_obj_center(l);lv_obj_add_event_cb(o,cb,LV_EVENT_CLICKED,nullptr);return o;}
static void clearPage(Page next){stopDialAnimation();page=next;if(next!=NETWORKS)scanRequested=false;statusIcon=statusGlyph=nullptr;statusLabel=passwordBox=networkList=image=nullptr;lv_obj_clean(lv_scr_act());lv_obj_clear_flag(lv_scr_act(),LV_OBJ_FLAG_SCROLLABLE);lv_obj_set_style_bg_color(lv_scr_act(),sand(),0);lv_obj_set_style_text_font(lv_scr_act(),&lv_font_montserrat_16,0);}

static lv_img_dsc_t artwork={};
static void showImage(){artwork.header.cf=LV_IMG_CF_TRUE_COLOR;artwork.header.w=480;artwork.header.h=480;artwork.data_size=480*480*2;artwork.data=OPENING_PIXELS;image=lv_img_create(lv_scr_act());lv_img_set_src(image,&artwork);lv_obj_center(image);}
#include "Petopia.h"
#include "DialUI.h"
static void showSettings(){clearPage(SETTINGS);label("Settings",50);button("Wi-Fi",95,[](lv_event_t*){showNetworks();});auto *updates=button("Firmware updates",150,[](lv_event_t*){showUpdates();});if(cloudAvailable){auto *dot=lv_obj_create(updates);lv_obj_remove_style_all(dot);lv_obj_set_size(dot,14,14);lv_obj_align(dot,LV_ALIGN_RIGHT_MID,0,0);lv_obj_set_style_radius(dot,LV_RADIUS_CIRCLE,0);lv_obj_set_style_bg_color(dot,lv_color_hex(0xffc83d),0);lv_obj_set_style_bg_opa(dot,LV_OPA_COVER,0);}button("Wi-Fi signal",205,[](lv_event_t*){showSignal();});button("Forget Wi-Fi",260,[](lv_event_t*){
 cancelNetwork();prefs.remove("network");prefs.remove("ssid");prefs.remove("pass");credentialsVerified=false;wifiMessage="Saved network removed";showSettings();
 });button("Display check",315,[](lv_event_t*){showDiagnostics();});button("Back",375,[](lv_event_t*){showDashboard();});}

static void showConnectionStatus(){page=CONNECTION;}
static uint16_t pixels[480*480];
static lv_point_t touchPoint;static bool down=false;
void readTouch(lv_indev_drv_t*,lv_indev_data_t*d){d->point=touchPoint;d->state=down?LV_INDEV_STATE_PR:LV_INDEV_STATE_REL;}
void flush(lv_disp_drv_t*d,const lv_area_t*a,lv_color_t*c){for(int y=a->y1;y<=a->y2;y++)for(int x=a->x1;x<=a->x2;x++)pixels[y*480+x]=(c++)->full;lv_disp_flush_ready(d);}
void step(int x,int y,bool pressed,int time=40){touchPoint={lv_coord_t(x),lv_coord_t(y)};down=pressed;for(int i=0;i<time;i+=5){lv_tick_inc(5);lv_timer_handler();}}
void shot(const char*name){lv_obj_update_layout(lv_scr_act());lv_refr_now(nullptr);std::ofstream o(name,std::ios::binary);o<<"P6\n480 480\n255\n";for(auto v:pixels){char rgb[3]={char(((v>>11)&31)*255/31),char(((v>>5)&63)*255/63),char((v&31)*255/31)};o.write(rgb,3);}}
int main(){lv_init();static lv_color_t buf[480*40];static lv_disp_draw_buf_t db;lv_disp_draw_buf_init(&db,buf,nullptr,480*40);static lv_disp_drv_t d;lv_disp_drv_init(&d);d.hor_res=480;d.ver_res=480;d.draw_buf=&db;d.flush_cb=flush;lv_disp_drv_register(&d);static lv_indev_drv_t in;lv_indev_drv_init(&in);in.type=LV_INDEV_TYPE_POINTER;in.read_cb=readTouch;lv_indev_drv_register(&in);
 showOpen();step(240,400,false);shot("opener.ppm");step(240,400,true);step(240,300,true);step(240,300,false);assert(page==DASH);shot("dial-home.ppm");
 step(240,416,true);for(int i=1;i<=20;i++){float a=(90+i*4.5f)*3.14159265f/180;step(240+176*cos(a),240+176*sin(a),true);}step(64,240,false,300);assert(page==DASH);assert(dial.selected()==6);assert(std::abs(dial.angle-90)<.1);shot("dial-explore.ppm");
 step(240,240,true);step(240,240,false);assert(page==PREVIEW);shot("preview.ppm");
 showDashboard();step(240,240,false);dial.angle=-180;paintDial();step(240,240,true);step(240,240,false);assert(page==SETTINGS);shot("settings.ppm");
 showDashboard();step(240,240,false);dial.angle=-90;paintDial();step(240,240,true);step(240,240,false);assert(page==CONNECTION);
 showDashboard();step(240,416,false);step(240,416,true);step(240,240,true);step(240,240,false,250);assert(page==DASH);
 showDashboard();dial.angle=45;paintDial();activateDial();assert(page==PREVIEW && allocated==4);
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
 dial.angle=45;paintDial();activateDial();assert(page==PREVIEW && allocated==0);
 step(168,411,true);step(168,411,false);assert(!allocated);
 step(160,306,true);step(160,306,false);assert(petopia::coat==3 && allocated==4);
 assert(std::rename(backup.c_str(),path.c_str())==0);
 step(240,430,true);step(240,430,false);assert(page==DASH && allocated==0);
 petopia::mounted=false; SD_MMC.present=false;showPetopiaTest();assert(!allocated);
 SD_MMC.present=true;step(168,411,true);step(168,411,false);assert(allocated==4);
 for(int i=0;i<100;i++){showPetopiaTest();showDashboard();assert(allocated==0);}
 for(int i=0;i<100;i++){showOpen();showDashboard();}lv_mem_monitor_t m;lv_mem_monitor(&m);assert(m.free_size>8000);printf("PASS: real LVGL swipe, rotation, snap, preview, Settings/Wi-Fi routes, drag guard, 100 screen cycles; %u bytes free\n",unsigned(m.free_size));
}
