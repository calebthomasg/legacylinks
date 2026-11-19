from pathlib import Path
import subprocess,tempfile
root=Path(__file__).resolve().parents[1]
header=(root/'firmware/TrailheadFirstBoot/CloudUpdate.h').read_text()
policy=(root/'firmware/TrailheadFirstBoot/ReleasePolicy.h').read_text()
struct=header[header.index('struct CloudRelease'):header.index('struct CloudEvent')]
parser=header[header.index('static const char *jsonText'):header.index('static esp_http_client_handle_t openCloudHTTP')]
download=header[header.index('static bool downloadCloudRelease'):header.index('static void cloudWorker')]
# cJSON's public declarations suffice; linked to the system's real parser.
pre=r'''
#include <cassert>
#include <cstring>
#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
#include <openssl/sha.h>
using std::min;
extern "C" {
struct cJSON {cJSON *next,*prev,*child;int type;char *valuestring;int valueint;double valuedouble;char *string;};
cJSON*cJSON_Parse(const char*);void cJSON_Delete(cJSON*);cJSON*cJSON_GetObjectItemCaseSensitive(const cJSON*,const char*);int cJSON_IsString(const cJSON*);int cJSON_IsNumber(const cJSON*);int cJSON_IsNull(const cJSON*);
}
'''
mocks=r'''
struct Partition {unsigned address,size;};using esp_partition_t=Partition;
Partition next={0x410000,0x400000},running={0x10000,0x400000};
const Partition*esp_ota_get_next_update_partition(void*){return &next;}const Partition*esp_ota_get_running_partition(){return &running;}
std::string message;bool restart=false;void cloudPost(const char*t,bool=false,const CloudRelease*r=nullptr,bool reboot=false){message=t;restart=reboot;}
std::vector<unsigned char> bytes;unsigned cursor=0,ticks=0;bool failOpen=false,failRead=false,badLength=false;
using esp_http_client_handle_t=void*;
void*openCloudHTTP(const char*){return failOpen?nullptr:(void*)1;}void closeCloudHTTP(void*){}
long esp_http_client_get_content_length(void*){return bytes.size()+(badLength?1:0);}
int esp_http_client_read(void*,char*b,int n){if(failRead)return -1;int c=min(n,int(bytes.size()-cursor));memcpy(b,bytes.data()+cursor,c);cursor+=c;return c;}
constexpr int U_FLASH=0,WL_CONNECTED=1;
struct Wifi {int state=1;int status(){return state;}}WiFi;
struct Updater {int beginCount=0,endCount=0,abortCount=0;bool failWrite=false,failEnd=false;bool begin(unsigned,int){beginCount++;return true;}size_t write(unsigned char*,size_t n){return failWrite?0:n;}bool end(bool exact){assert(!exact);endCount++;return !failEnd;}void abort(){abortCount++;}}Update;
unsigned millis(){return ticks+=20;}void vTaskDelay(int){}
using mbedtls_sha256_context=SHA256_CTX;
void mbedtls_sha256_init(SHA256_CTX*){}void mbedtls_sha256_starts(SHA256_CTX*c,int){SHA256_Init(c);}void mbedtls_sha256_update(SHA256_CTX*c,const void*b,size_t n){SHA256_Update(c,b,n);}void mbedtls_sha256_finish(SHA256_CTX*c,unsigned char*d){SHA256_Final(d,c);}void mbedtls_sha256_free(SHA256_CTX*){}
CloudRelease fixture(){Update={};next={0x410000,0x400000};running={0x10000,0x400000};cursor=ticks=0;restart=false;failOpen=failRead=badLength=false;WiFi.state=1;bytes.assign(9000,42);bytes[0]=0xe9;CloudRelease r={};r.size=bytes.size();unsigned char digest[32];SHA256(bytes.data(),bytes.size(),digest);for(int i=0;i<32;i++)snprintf(r.sha256+i*2,3,"%02x",digest[i]);return r;}
'''
post=r'''
int main(){
 assert(newerVersion("0.1.10","0.1.9"));assert(!newerVersion("0.1.9","0.1.9"));assert(!newerVersion("0.1.8","0.1.9"));assert(!newerVersion("00.1.9","0.1.8"));
 assert(!allowedFirmwareURL("https://www.legacylinks.io.evil.test/firmware.bin","0.1.9"));assert(!allowedFirmwareURL("http://www.legacylinks.io/firmware/trailhead/releases/0.1.9/trailhead-0.1.9-app.bin","0.1.9"));
 std::string valid=R"({"schema":1,"channel":"test","release":{"version":"0.1.9","hardware":"waveshare-esp32s3-touch-lcd-2.8c","layout":"trailhead-16m-ota4m-v1","url":"https://www.legacylinks.io/firmware/trailhead/releases/0.1.9/trailhead-0.1.9-app.bin","sha256":")"+std::string(64,'a')+R"(","notes":"Test","size":9000}})";
 CloudRelease r={};bool empty=false;assert(parseRelease(valid.c_str(),r,empty)&&!empty);
 for(auto text:{"{}","not json","{\"schema\":1,\"channel\":\"test\"}","{\"schema\":1,\"channel\":\"stable\",\"release\":null}"})assert(!parseRelease(text,r,empty));
 assert(parseRelease("{\"schema\":1,\"channel\":\"test\",\"release\":null}",r,empty)&&empty);
 for(auto pair:std::vector<std::pair<std::string,std::string>>{{"0.1.9","0.1.09"},{"waveshare-esp32s3-touch-lcd-2.8c","wrong-board"},{"trailhead-16m-ota4m-v1","wrong-layout"},{"9000","4194305"},{"https://","http://"}}){auto bad=valid;bad.replace(bad.find(pair.first),pair.first.size(),pair.second);assert(!parseRelease(bad.c_str(),r,empty));}
 r=fixture();assert(downloadCloudRelease(r)&&restart&&Update.endCount==1);
 r=fixture();bytes[10]^=1;assert(!downloadCloudRelease(r)&&!restart&&Update.endCount==0&&Update.abortCount==1);
 r=fixture();failRead=true;assert(!downloadCloudRelease(r)&&Update.endCount==0&&Update.abortCount==1);
 r=fixture();badLength=true;assert(!downloadCloudRelease(r)&&Update.beginCount==0);
 r=fixture();next.address=0x9000;assert(!downloadCloudRelease(r)&&Update.beginCount==0);
 r=fixture();failOpen=true;assert(!downloadCloudRelease(r)&&Update.beginCount==0);
 r=fixture();Update.failWrite=true;assert(!downloadCloudRelease(r)&&Update.endCount==0);
 r=fixture();Update.failEnd=true;assert(!downloadCloudRelease(r)&&!restart&&Update.abortCount==1);
 r=fixture();WiFi.state=0;assert(!downloadCloudRelease(r)&&Update.endCount==0);
 puts("PASS: real catalog parser/version/origin/board/layout/size checks; actual downloader with mocked transport/flash: successful verification, corruption, interrupted read, wrong length/layout, TLS-open failure, write/finalization failure, Wi-Fi loss");
}
'''
with tempfile.TemporaryDirectory() as temp:
 p=Path(temp);(p/'test.cpp').write_text(pre+policy+struct+parser+mocks+download+post)
 subprocess.run(['g++','-std=c++17','-Wno-deprecated-declarations',str(p/'test.cpp'),'-l:libcjson.so.1','-lcrypto','-o',str(p/'test')],check=True)
 subprocess.run([str(p/'test')],check=True)
