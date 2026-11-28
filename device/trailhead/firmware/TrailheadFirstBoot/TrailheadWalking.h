#pragma once
#include "TrailheadWalkingData.h"
#include <algorithm>
#include <limits>
#include <queue>
#include <vector>

namespace fieldWalking {
constexpr auto nodeCount=sizeof(points)/sizeof(*points);

static int nearest(int x,int y,int limit){
  int best=-1, bestSquared=limit*limit+1;
  for(unsigned i=0;i<nodeCount;i++){
    if(starts[i]==starts[i+1])continue;
    int dx=x-points[i].x,dy=y-points[i].y;
    const int squared=dx*dx+dy*dy;
    if(squared<bestSquared){bestSquared=squared;best=int(i);}
  }
  return best;
}

static bool find(int startX,int startY,int endX,int endY,std::vector<Point> &route){
  route.clear();
  constexpr int snapLimit=35; // Approximately 100 meters on this field sheet.
  const int start=nearest(startX,startY,snapLimit),end=nearest(endX,endY,snapLimit);
  if(start<0||end<0)return false;
  constexpr uint32_t infinity=std::numeric_limits<uint32_t>::max();
  constexpr uint16_t noNode=std::numeric_limits<uint16_t>::max();
  using Cost=std::pair<uint32_t,uint16_t>;
  std::vector<uint32_t> distances(nodeCount,infinity);
  std::vector<uint16_t> previous(nodeCount,noNode);
  std::priority_queue<Cost,std::vector<Cost>,std::greater<Cost>> queue;
  distances[start]=0;
  queue.emplace(0,uint16_t(start));
  while(!queue.empty()){
    const auto current=queue.top();
    queue.pop();
    const auto node=current.second;
    if(current.first!=distances[node])continue;
    if(node==end)break;
    for(unsigned i=starts[node];i<starts[node+1];i++){
      const auto &edge=edges[i];
      const uint32_t cost=current.first+edge.cost;
      if(cost>=distances[edge.node])continue;
      distances[edge.node]=cost;
      previous[edge.node]=node;
      queue.emplace(cost,edge.node);
    }
  }
  if(distances[end]==infinity)return false;
  for(uint16_t node=uint16_t(end);node!=noNode;node=previous[node]){
    const auto point=points[node];
    if(route.empty()||point.x!=route.back().x||point.y!=route.back().y)route.push_back(point);
  }
  std::reverse(route.begin(),route.end());
  return true;
}
} // namespace fieldWalking
