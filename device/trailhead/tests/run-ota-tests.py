from pathlib import Path
import subprocess,tempfile
r=Path(__file__).resolve().parents[1]
s=(r/'firmware/TrailheadFirstBoot/TrailheadFirstBoot.ino').read_text()
code=s[s.index('static bool authenticated(){'):s.index('static lv_obj_t *cloudProgress=')]
pre=r'''
#include <string>
#include <functional>
#include <cstdint>
#include <cstdio>
#include <cassert>
#include <iostream>
struct String:std::string{using std::string::string;String(){}String(const std::string&s):std::string(s){}};
constexpr int WL_CONNECTED=1,HTTP_GET=0,HTTP_POST=1,UPLOAD_FILE_START=0,UPLOAD_FILE_WRITE=1,UPLOAD_FILE_END=2,UPLOAD_FILE_ABORTED=3,U_FLASH=0;constexpr size_t UPDATE_SIZE_UNKNOWN=0xffffffff;
struct WIFI{int state=WL_CONNECTED;int status(){return state;}}WiFi;
struct Upload{int status=0;uint8_t buf[4]={0xe9,1,2,3};size_t currentSize=4;}u;
struct Server{bool auth=true;String token;int response=0;std::function<void()>get,post,file;bool authenticate(const char*,const char*){return auth;}String header(const char*){return token;}void collectHeaders(const char**,int){}void requestAuthentication(){response=401;}void send(int code,const char*,const String&){response=code;}void sendHeader(const char*,const char*){}Upload&upload(){return u;}void begin(){}void on(const char*,int,std::function<void()>f){get=f;}void on(const char*,int,std::function<void()>p,std::function<void()>f){post=p;file=f;}}server;
struct Updater{int begins=0,writes=0,ends=0,aborts=0;bool failBegin=false,failWrite=false,failEnd=false;bool begin(size_t,int){begins++;return !failBegin;}size_t write(uint8_t*,size_t n){writes++;return failWrite?0:n;}bool end(bool){ends++;return !failEnd;}void abort(){aborts++;}bool hasError(){return failBegin||failWrite||failEnd;}}Update;
static bool cloudBusy=false;
static bool otaEnabled=false,uploadAllowed=false,uploadOK=false,uploadComplete=false,rebootPending=false;
static uint32_t rebootAt=0;static String otaPassword,otaToken;
uint32_t esp_random(){return 42;}uint32_t millis(){return 1000;}void suspendDisplay(){}void resumeDisplay(){}
'''
post=r'''
void reset(){Update={};server={};otaEnabled=false;uploadAllowed=uploadOK=uploadComplete=rebootPending=false;WiFi.state=WL_CONNECTED;initOTA();server.token=otaToken;}
void part(int status){u.status=status;server.file();}
int main(){
 reset();server.get();assert(server.response==403);part(UPLOAD_FILE_START);assert(Update.begins==0);
 reset();otaEnabled=true;server.auth=false;server.get();assert(server.response==401);part(UPLOAD_FILE_START);assert(Update.begins==0);
 reset();otaEnabled=true;server.token="wrong";part(UPLOAD_FILE_START);server.post();assert(Update.begins==0&&server.response==403&&!rebootPending);
 reset();otaEnabled=true;part(UPLOAD_FILE_START);part(UPLOAD_FILE_WRITE);part(UPLOAD_FILE_END);server.post();assert(Update.begins==1&&Update.writes==1&&Update.ends==1&&server.response==200&&rebootPending&&rebootAt==2200);
 reset();otaEnabled=true;part(UPLOAD_FILE_START);server.post();assert(server.response==400&&!rebootPending); // No completed file: cannot report success.
 reset();otaEnabled=true;Update.failBegin=true;part(UPLOAD_FILE_START);part(UPLOAD_FILE_END);server.post();assert(server.response==400&&!rebootPending);
 reset();otaEnabled=true;Update.failWrite=true;part(UPLOAD_FILE_START);part(UPLOAD_FILE_WRITE);part(UPLOAD_FILE_END);server.post();assert(Update.aborts==1&&server.response==400&&!rebootPending);
 reset();otaEnabled=true;Update.failEnd=true;part(UPLOAD_FILE_START);part(UPLOAD_FILE_WRITE);part(UPLOAD_FILE_END);server.post();assert(server.response==400&&!rebootPending);
 reset();otaEnabled=true;part(UPLOAD_FILE_START);part(UPLOAD_FILE_ABORTED);server.post();assert(Update.aborts==1&&!rebootPending&&server.response==403);
 std::cout<<"PASS: OTA disabled/auth/token gates; completed upload/reboot; missing END, begin/write/end failures and abort do not report success or reboot\n";
}
'''
with tempfile.TemporaryDirectory() as temp:
 p=Path(temp);(p/'test.cpp').write_text(pre+code+post)
 subprocess.run(['g++','-std=c++17',str(p/'test.cpp'),'-o',str(p/'test')],check=True)
 subprocess.run([str(p/'test')],check=True)
