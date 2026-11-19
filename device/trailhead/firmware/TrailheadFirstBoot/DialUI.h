#pragma once
#include "DialAssets.h"
#include "DialMotion.h"
// All UI calls remain on the main LVGL thread. Only the model angle animates.
static DialMotion dial;
static lv_obj_t *dialIcons[8]={},*dialName=nullptr,*dialBadge=nullptr;
static const char *dialNames[]={"Home","Favorites","Wi-Fi","Profile","Settings","Alarm","Explore","Pets"};
static int dialLastSelected=-1;
static void showConnectionStatus();static void showDialPreview(int);
static void paintDial(){
 if(page!=DASH)return;
 int selected=dial.selected();
 for(int i=0;i<8;i++){
  float a=(90+i*45+dial.angle)*3.14159265358979323846f/180;
  lv_obj_set_pos(dialIcons[i],int(std::lround(240+176*std::cos(a)))-26,int(std::lround(240+176*std::sin(a)))-26);
  if(selected!=dialLastSelected)lv_img_set_src(dialIcons[i],&DIAL_ICONS[i==selected][i]);
 }
 if(selected!=dialLastSelected){lv_label_set_text(dialName,dialNames[selected]);dialLastSelected=selected;}
 if(dialBadge){float a=(270+dial.angle)*3.14159265358979323846f/180;lv_obj_set_pos(dialBadge,int(std::lround(240+176*std::cos(a)))+16,int(std::lround(240+176*std::sin(a)))-26);if(cloudAvailable)lv_obj_clear_flag(dialBadge,LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(dialBadge,LV_OBJ_FLAG_HIDDEN);}
}
static void animateDial(void*,int32_t value){dial.angle=value/100.0f;paintDial();}
static void snapDial(){lv_anim_t a;lv_anim_init(&a);lv_anim_set_var(&a,&dial);lv_anim_set_exec_cb(&a,animateDial);lv_anim_set_values(&a,int(dial.angle*100),int(dial.target()*100));lv_anim_set_time(&a,180);lv_anim_set_path_cb(&a,lv_anim_path_ease_out);lv_anim_start(&a);}
static void activateDial(){int i=dial.selected();if(i==4)showSettings();else if(i==2)showConnectionStatus();else if(i==7)showPetopiaTest();else showDialPreview(i);}
static void dialInput(lv_event_t *e){
 auto code=lv_event_get_code(e);auto *indev=lv_indev_get_act();if(!indev)return;lv_point_t p;lv_indev_get_point(indev,&p);
 if(code==LV_EVENT_PRESSED){lv_anim_del(&dial,animateDial);dial.begin(p.x,p.y);}
 else if(code==LV_EVENT_PRESSING){dial.move(p.x,p.y);paintDial();}
 else if(code==LV_EVENT_RELEASED){bool center=dial.release(p.x,p.y);if(center){dial.angle=dial.target();activateDial();}else snapDial();}
 else if(code==LV_EVENT_PRESS_LOST){dial.cancel();snapDial();}
}
static void showDashboard(){
 clearPage(DASH);dial.angle=dial.target();dialLastSelected=-1;
 auto *bg=lv_img_create(lv_scr_act());lv_img_set_src(bg,&DIAL_BACKGROUND);lv_obj_set_pos(bg,0,0);
 for(int i=0;i<8;i++){dialIcons[i]=lv_img_create(lv_scr_act());lv_img_set_src(dialIcons[i],&DIAL_ICONS[0][i]);lv_obj_clear_flag(dialIcons[i],LV_OBJ_FLAG_CLICKABLE);}
 auto *word=lv_img_create(lv_scr_act());lv_img_set_src(word,&DIAL_OPEN);lv_obj_set_pos(word,170,207);
 dialName=label("",266,150);lv_obj_set_style_text_color(dialName,sand(),0);
 dialBadge=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(dialBadge);lv_obj_set_size(dialBadge,10,10);lv_obj_set_style_radius(dialBadge,LV_RADIUS_CIRCLE,0);lv_obj_set_style_bg_color(dialBadge,lv_color_hex(0xffc83d),0);lv_obj_set_style_bg_opa(dialBadge,LV_OPA_COVER,0);
 // Last child is a single transparent touch surface: icon edges cannot steal drags.
 auto *surface=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(surface);lv_obj_set_size(surface,480,480);lv_obj_clear_flag(surface,LV_OBJ_FLAG_SCROLLABLE);lv_obj_add_flag(surface,LV_OBJ_FLAG_CLICKABLE);lv_obj_add_event_cb(surface,dialInput,LV_EVENT_ALL,nullptr);
 paintDial();
}
static void showDialPreview(int index){clearPage(PREVIEW);label(dialNames[index],140);label("Page preview\nThis feature is not built yet.",215,280);button("Back to dial",335,[](lv_event_t*){showDashboard();},200);}
// Swipe opener: begin in lower half, move up at least 65px, reject sideways swipes.
static int openerX=0,openerY=0;static bool openerPressed=false;
static void openerInput(lv_event_t *e){
 auto *in=lv_indev_get_act();if(!in)return;lv_point_t p;lv_indev_get_point(in,&p);auto c=lv_event_get_code(e);
 if(c==LV_EVENT_PRESSED){openerX=p.x;openerY=p.y;openerPressed=true;}
 else if(c==LV_EVENT_PRESS_LOST)openerPressed=false;
 else if(c==LV_EVENT_RELEASED){bool swipe=openerPressed&&openerY>=260&&openerY-p.y>=65&&std::abs(p.x-openerX)<100;openerPressed=false;if(swipe)showDashboard();}
}
static void floatArrow(void *obj,int32_t y){lv_obj_set_y((lv_obj_t*)obj,y);}
static void showOpen(){
 clearPage(OPEN);showImage();
 auto *hint=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(hint);lv_obj_set_size(hint,120,50);lv_obj_set_pos(hint,180,365);lv_obj_set_style_bg_color(hint,blue(),0);lv_obj_set_style_bg_opa(hint,LV_OPA_COVER,0);lv_obj_set_style_radius(hint,25,0);
 auto *arrow=lv_label_create(hint);lv_label_set_text(arrow,LV_SYMBOL_UP);lv_obj_set_style_text_color(arrow,sand(),0);lv_obj_align(arrow,LV_ALIGN_TOP_MID,0,4);
 auto *caption=lv_label_create(hint);lv_label_set_text(caption,"Swipe up");lv_obj_set_style_text_color(caption,sand(),0);lv_obj_align(caption,LV_ALIGN_TOP_MID,0,25);
 lv_anim_t a;lv_anim_init(&a);lv_anim_set_var(&a,hint);lv_anim_set_exec_cb(&a,floatArrow);lv_anim_set_values(&a,372,362);lv_anim_set_time(&a,650);lv_anim_set_playback_time(&a,650);lv_anim_set_repeat_count(&a,LV_ANIM_REPEAT_INFINITE);lv_anim_set_path_cb(&a,lv_anim_path_ease_in_out);lv_anim_start(&a);
 auto *surface=lv_obj_create(lv_scr_act());lv_obj_remove_style_all(surface);lv_obj_set_size(surface,480,480);lv_obj_clear_flag(surface,LV_OBJ_FLAG_SCROLLABLE);lv_obj_add_flag(surface,LV_OBJ_FLAG_CLICKABLE);lv_obj_add_event_cb(surface,openerInput,LV_EVENT_ALL,nullptr);
}
static void stopDialAnimation(){lv_anim_del(&dial,animateDial);dial.cancel();}
