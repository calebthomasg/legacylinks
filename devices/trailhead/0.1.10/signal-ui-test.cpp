#include <lvgl.h>
#include <string>
#include <cstring>
#include <fstream>
#include <cassert>
#include <iostream>
struct String:std::string {using std::string::string;String(){}String(char c):std::string(1,c){}String(const std::string&s):std::string(s){}String(unsigned n):std::string(std::to_string(n)){} };
enum Page{DIAGNOSTIC,OPEN,DASH,SETTINGS,NETWORKS,PASSWORD,UPDATES,LOCAL_UPDATES,SIGNAL};
static Page page=DIAGNOSTIC;static bool scanRequested=false,scanning=false,connecting=false,credentialsVerified=true;static int scheduledAction=0,retryCount=0;static bool retrySaved=false;
static lv_obj_t *statusLabel=nullptr,*passwordBox=nullptr,*networkList=nullptr,*image=nullptr,*statusIcon=nullptr,*statusGlyph=nullptr;
static String selectedSSID="SpectrumSetup-AD",wifiMessage="Connection failed; reason 2\nRetry saved Wi-Fi in Settings";
static const int WL_CONNECTED=1;struct IP{String toString(){return "192.168.1.185";}};struct W{int strength=-55;int RSSI(){return strength;}int channel(){return 6;}int state=1;int status(){return state;}String SSID(){return selectedSSID;}IP localIP(){return {};}}WiFi;
static bool loadNetwork(String&a,String&b){a="different";b="";return false;}
static void showNetworks(){}static void showSettings();static void showDiagnostics(){}static void connectToNetwork(){}

#define TRAILHEAD_VERSION "0.1.8"
struct Release {const char *version="0.1.9",*notes="Hosted update test. Confirms direct download and saved Wi-Fi after restart.";}cloudRelease;
static bool cloudBusy=false,cloudAvailable=true,otaEnabled=false;static char cloudMessage[160]="New update available";
static bool startCloudJob(bool){return true;}static void showLocalUpdates(){}static void showUpdates();
static bool retryStoredNetwork(){return true;}static void cancelNetwork(){}struct Prefs{void remove(const char*){}}prefs;

#include <atomic>
using std::min;using std::max;
#include "SignalQuality.h"
static std::atomic<unsigned> disconnectReason{204};static void showDashboard(){}static void showSettings(){}
static lv_color_t blue(){return lv_color_hex(0x0a264f);}static lv_color_t sand(){return lv_color_hex(0xf5f3ea);}

static lv_obj_t* label(const char *text,int y,int width=330){auto *o=lv_label_create(lv_scr_act());lv_label_set_text(o,text);lv_obj_set_width(o,width);lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);lv_obj_set_style_text_color(o,blue(),0);lv_obj_align(o,LV_ALIGN_TOP_MID,0,y);return o;}
static lv_obj_t* button(const char *text,int y,lv_event_cb_t cb,int width=240){auto *o=lv_btn_create(lv_scr_act());lv_obj_set_size(o,width,46);lv_obj_align(o,LV_ALIGN_TOP_MID,0,y);lv_obj_set_style_bg_color(o,blue(),0);lv_obj_set_style_radius(o,23,0);auto *l=lv_label_create(o);lv_label_set_text(l,text);lv_obj_center(l);lv_obj_add_event_cb(o,cb,LV_EVENT_CLICKED,nullptr);return o;}
static void clearPage(Page next){page=next;if(next!=NETWORKS)scanRequested=false;statusIcon=statusGlyph=nullptr;statusLabel=passwordBox=networkList=image=nullptr;lv_obj_clean(lv_scr_act());lv_obj_clear_flag(lv_scr_act(),LV_OBJ_FLAG_SCROLLABLE);lv_obj_set_style_bg_color(lv_scr_act(),sand(),0);lv_obj_set_style_text_font(lv_scr_act(),&lv_font_montserrat_16,0);}
static String wifiStatus(){
 if(WiFi.status()==WL_CONNECTED)return String("Connected\n")+WiFi.SSID()+"\n"+WiFi.localIP().toString()+ (credentialsVerified?"\nSaved for next startup":"\nSettings not saved");
 if(connecting||scheduledAction==2)return String("Connecting...\nAttempt ")+String(unsigned(retryCount+1))+(retrySaved?" of 3":" of 1");
 if(scanning||scheduledAction==1)return "Scanning networks...";
 return wifiMessage;
}

// Diagnostics reads existing station data; it never scans or changes radio settings.
static lv_obj_t *signalBars[4]={};static lv_obj_t *signalReading=nullptr,*signalDetails=nullptr;
static int signalMin=0,signalMax=-127;static unsigned signalSamples=0;
static void refreshSignal(){
 if(page!=SIGNAL)return;
 bool online=WiFi.status()==WL_CONNECTED;
 int rssi=online?WiFi.RSSI():0;bool valid=online&&validSignal(rssi);
 if(valid){if(!signalSamples){signalMin=signalMax=rssi;}else {signalMin=min(signalMin,rssi);signalMax=max(signalMax,rssi);}signalSamples++;}
 char text[190];
 if(valid)snprintf(text,sizeof(text),"%d dBm - %s",rssi,signalQuality(rssi));
 else snprintf(text,sizeof(text),"%s",online?"Signal reading unavailable":"Wi-Fi disconnected");
 lv_label_set_text(signalReading,text);
 int bars=valid?signalBarCount(rssi):0;
 for(int i=0;i<4;i++)lv_obj_set_style_bg_color(signalBars[i],lv_color_hex(i<bars?(bars<=1?0xf97370:0x36bfaf):0xd7d9d8),0);
 if(valid)snprintf(text,sizeof(text),"Channel %d\nThis visit: %d to %d dBm\nCloser to 0 means stronger",WiFi.channel(),signalMin,signalMax);
 else snprintf(text,sizeof(text),"%s\nLast disconnect reason: %u",(connecting||scheduledAction==2)?"Reconnecting...":"Use Retry saved Wi-Fi below",disconnectReason.load());
 lv_label_set_text(signalDetails,text);
}
static void showSignal(){
 clearPage(SIGNAL);signalSamples=0;label("Wi-Fi signal",52);
 auto *ssid=label(WiFi.status()==WL_CONNECTED?WiFi.SSID().c_str():"Not connected",82,290);lv_label_set_long_mode(ssid,LV_LABEL_LONG_DOT);lv_obj_set_height(ssid,22);
 for(int i=0;i<4;i++){auto *bar=lv_obj_create(lv_scr_act());signalBars[i]=bar;lv_obj_remove_style_all(bar);lv_obj_set_size(bar,26,14+i*12);lv_obj_set_pos(bar,170+i*36,178-(14+i*12));lv_obj_set_style_radius(bar,4,0);lv_obj_set_style_bg_opa(bar,LV_OPA_COVER,0);lv_obj_clear_flag(bar,LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE);}
 signalReading=label("",195,340);signalDetails=label("",230,320);
 label("Signal levels are approximate",302,300);
 button("Retry saved Wi-Fi",337,[](lv_event_t*){if(!retryStoredNetwork())wifiMessage="No saved network";showDashboard();},230);
 button("Back",397,[](lv_event_t*){showSettings();},140);refreshSignal();
}
static uint16_t pixels[480*480];
void flush(lv_disp_drv_t*d,const lv_area_t*a,lv_color_t*c){for(int y=a->y1;y<=a->y2;y++)for(int x=a->x1;x<=a->x2;x++)pixels[y*480+x]=(c++)->full;lv_disp_flush_ready(d);}
void shot(const char*name){lv_obj_update_layout(lv_scr_act());lv_refr_now(nullptr);std::ofstream o(name,std::ios::binary);o<<"P6\n480 480\n255\n";for(auto v:pixels){char rgb[3]={char(((v>>11)&31)*255/31),char(((v>>5)&63)*255/63),char((v&31)*255/31)};o.write(rgb,3);}}
int main(){lv_init();static lv_color_t buf[480*40];static lv_disp_draw_buf_t db;lv_disp_draw_buf_init(&db,buf,nullptr,480*40);static lv_disp_drv_t d;lv_disp_drv_init(&d);d.hor_res=480;d.ver_res=480;d.draw_buf=&db;d.flush_cb=flush;lv_disp_drv_register(&d);


showSignal();shot("signal-strong.ppm");assert(signalSamples==1);assert(signalMin==-55&&signalMax==-55);
WiFi.strength=-83;refreshSignal();shot("signal-weak.ppm");assert(signalMin==-83&&signalMax==-55);
WiFi.state=0;refreshSignal();shot("signal-offline.ppm");assert(signalSamples==2);
assert(signalBarCount(0)==0);assert(signalBarCount(-60)==4);assert(signalBarCount(-61)==3);assert(signalBarCount(-70)==3);assert(signalBarCount(-71)==2);assert(signalBarCount(-80)==2);assert(signalBarCount(-81)==1);assert(!validSignal(-128));
for(unsigned i=0;i<lv_obj_get_child_cnt(lv_scr_act());i++){auto *o=lv_obj_get_child(lv_scr_act(),i);if(lv_obj_check_type(o,&lv_btn_class)){lv_area_t a;lv_obj_get_coords(o,&a);for(int x:{a.x1,a.x2})for(int y:{a.y1,a.y2})assert((x-240)*(x-240)+(y-240)*(y-240)<240*240);}}
puts("PASS: RSSI boundaries, invalid readings, visit min/max, disconnected readings excluded, circular button bounds; real LVGL strong/weak/offline renders");}
