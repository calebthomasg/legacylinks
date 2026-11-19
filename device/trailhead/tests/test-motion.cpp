#include "DialMotion.h"
#include <cassert>
#include <cstdio>
int main(){DialMotion d;
 for(int i=0;i<8;i++){d.angle=-45*i;assert(d.selected()==i);assert(d.target()==-45*i);}
 assert(DialMotion::wrap(358)==-2);assert(DialMotion::wrap(-358)==2);
 d.angle=0;d.begin(240,416);d.move(64,240);assert(d.moved);assert(!d.release(240,240));assert(d.selected()==6);
 d.begin(240,240);assert(d.release(240,240));
 d.begin(240,240);d.move(260,240);assert(!d.release(240,240));
 d.begin(240,416);d.cancel();assert(!d.release(240,240));
 d.angle=179;d.begin(64,241);d.move(64,239);assert(std::abs(d.angle-179)<2 || d.angle < -179);
 puts("PASS: eight selections, seam wrap, clockwise drag, center tap, drag-open guard, cancellation");
}
