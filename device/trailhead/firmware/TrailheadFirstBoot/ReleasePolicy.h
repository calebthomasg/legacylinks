#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string.h>
static bool versionParts(const char *s,unsigned v[3]){
 char tail; if(!s||sscanf(s,"%u.%u.%u%c",&v[0],&v[1],&v[2],&tail)!=3)return false;
 char canonical[40];snprintf(canonical,sizeof(canonical),"%u.%u.%u",v[0],v[1],v[2]);
 return strcmp(s,canonical)==0&&v[0]<10000&&v[1]<10000&&v[2]<10000;
}
static bool newerVersion(const char *candidate,const char *current){
 unsigned a[3],b[3];if(!versionParts(candidate,a)||!versionParts(current,b))return false;
 for(int i=0;i<3;i++){if(a[i]!=b[i])return a[i]>b[i];}return false;
}
static bool validDigest(const char *s){if(!s||strlen(s)!=64)return false;for(int i=0;i<64;i++)if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return false;return true;}
static bool allowedFirmwareURL(const char *url,const char *version){
 char expected[200];snprintf(expected,sizeof(expected),"https://www.legacylinks.io/firmware/trailhead/releases/%s/trailhead-%s-app.bin",version,version);
 return url&&strcmp(url,expected)==0;
}
