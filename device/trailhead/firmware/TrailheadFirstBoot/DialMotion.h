#pragma once
#include <cmath>
// Screen coordinates: positive angle is clockwise, bottom is 90 degrees.
struct DialMotion {
 float angle=0,previous=0,startX=0,startY=0;bool active=false,moved=false,center=false,tracking=false;
 static float bearing(float x,float y){return std::atan2(y-240,x-240)*180.0f/3.14159265358979323846f;}
 static float wrap(float a){while(a>180)a-=360;while(a<=-180)a+=360;return a;}
 static float radius(float x,float y){return std::hypot(x-240,y-240);}
 int selected()const {int n=int(std::lround(-angle/45))%8;return n<0?n+8:n;}
 float target()const{return std::round(angle/45)*45;}
 void begin(float x,float y){active=true;moved=false;center=radius(x,y)<88;startX=x;startY=y;previous=bearing(x,y);tracking=radius(x,y)>=110;}
 void move(float x,float y){if(!active)return;if(std::hypot(x-startX,y-startY)>10)moved=true;
  if(center)return;if(radius(x,y)<110){tracking=false;return;}
  float current=bearing(x,y);float delta=tracking?wrap(current-previous):0;previous=current;tracking=true;
  if(moved)angle=wrap(angle+delta);
 }
 // Caller opens only on an unmoved center tap; drags can never activate Open.
 bool release(float x,float y){move(x,y);bool open=active&&center&&!moved&&radius(x,y)<88;active=false;return open;}
 void cancel(){active=false;moved=false;}
};
