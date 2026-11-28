#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <Update.h>
#include <time.h>
#include <esp_http_client.h>
#include <esp_crt_bundle.h>
#include <esp_ota_ops.h>
#include <mbedtls/sha256.h>
#include <cJSON.h>
#include "ReleasePolicy.h"
#define TRAILHEAD_VERSION "0.1.28"
static const char *CATALOG_URL="https://www.legacylinks.io/firmware/trailhead/test.json";
struct CloudRelease { char version[24],url[200],sha256[65],notes[161];uint32_t size; };
struct CloudEvent { bool done,available,restart; char text[160];CloudRelease release; };
static CloudRelease cloudRelease={};
static bool cloudBusy=false,cloudAvailable=false,cloudRestart=false;
static char cloudMessage[160]="Ready to check for updates";
static QueueHandle_t cloudEvents=nullptr;
struct CloudJob {bool install;CloudRelease release;};
static CloudJob cloudJob;
// A length-one queue owns communication with LVGL's thread. The worker never touches UI or preferences.
static void cloudPost(const char *text,bool done=false,const CloudRelease *release=nullptr,bool restart=false){
 CloudEvent event={};event.done=done;event.available=release!=nullptr;event.restart=restart;
 snprintf(event.text,sizeof(event.text),"%s",text);if(release)event.release=*release;
 xQueueOverwrite(cloudEvents,&event);
}
static bool receiveCloudEvent(){
 CloudEvent event;if(!cloudEvents||xQueueReceive(cloudEvents,&event,0)!=pdTRUE)return false;
 snprintf(cloudMessage,sizeof(cloudMessage),"%s",event.text);
 if(event.done){cloudBusy=event.restart;cloudAvailable=event.available;if(event.available)cloudRelease=event.release;cloudRestart=event.restart;}
 return true;
}
static const char *jsonText(cJSON *o,const char *name){cJSON *v=cJSON_GetObjectItemCaseSensitive(o,name);return cJSON_IsString(v)?v->valuestring:nullptr;}
static bool parseRelease(const char *body,CloudRelease &out,bool &empty){
 empty=false;cJSON *root=cJSON_Parse(body);if(!root)return false;
 auto *schema=cJSON_GetObjectItemCaseSensitive(root,"schema");auto *release=cJSON_GetObjectItemCaseSensitive(root,"release");
 const char *channel=jsonText(root,"channel");bool ok=cJSON_IsNumber(schema)&&schema->valuedouble==1&&channel&&strcmp(channel,"test")==0;
 if(ok&&cJSON_IsNull(release)){empty=true;cJSON_Delete(root);return true;}
 const char *version=jsonText(release,"version"),*hardware=jsonText(release,"hardware"),*layout=jsonText(release,"layout"),*url=jsonText(release,"url"),*sha=jsonText(release,"sha256"),*notes=jsonText(release,"notes");
 auto *size=cJSON_GetObjectItemCaseSensitive(release,"size");unsigned parts[3];
 ok=ok&&versionParts(version,parts)&&hardware&&strcmp(hardware,"waveshare-esp32s3-touch-lcd-2.8c")==0&&layout&&strcmp(layout,"trailhead-16m-ota4m-v1")==0&&allowedFirmwareURL(url,version)&&validDigest(sha)&&notes&&strlen(notes)<=160&&cJSON_IsNumber(size)&&size->valuedouble>=32&&size->valuedouble<=4194304&&size->valuedouble==(uint32_t)size->valuedouble;
 if(ok){snprintf(out.version,sizeof(out.version),"%s",version);snprintf(out.url,sizeof(out.url),"%s",url);snprintf(out.sha256,sizeof(out.sha256),"%s",sha);snprintf(out.notes,sizeof(out.notes),"%s",notes);out.size=(uint32_t)size->valuedouble;}
 cJSON_Delete(root);return ok;
}
static esp_http_client_handle_t openCloudHTTP(const char *url){
 esp_http_client_config_t cfg={};cfg.url=url;cfg.crt_bundle_attach=esp_crt_bundle_attach;cfg.timeout_ms=15000;cfg.disable_auto_redirect=true;cfg.buffer_size=4096;cfg.user_agent="Trailhead/" TRAILHEAD_VERSION;
 auto client=esp_http_client_init(&cfg);if(!client)return nullptr;
 esp_http_client_set_header(client,"Accept-Encoding","identity");esp_http_client_set_header(client,"Cache-Control","no-cache");
 if(esp_http_client_open(client,0)!=ESP_OK){esp_http_client_cleanup(client);return nullptr;}
 if(esp_http_client_fetch_headers(client)<0||esp_http_client_get_status_code(client)!=200){esp_http_client_close(client);esp_http_client_cleanup(client);return nullptr;}
 return client;
}
static void closeCloudHTTP(esp_http_client_handle_t client){esp_http_client_close(client);esp_http_client_cleanup(client);}
static bool readCloudIndex(esp_http_client_handle_t client, char *body, size_t capacity) {
 const int64_t length = esp_http_client_get_content_length(client);
 if (length <= 0 || uint64_t(length) >= capacity) return false;
 int used = 0;
 while (used < length) {
  const int count = esp_http_client_read(client, body + used, length - used);
  if (count <= 0) return false;
  used += count;
 }
 body[used] = 0;
 return true;
}
static bool downloadCloudRelease(const CloudRelease &r){
 const esp_partition_t *next=esp_ota_get_next_update_partition(nullptr),*running=esp_ota_get_running_partition();
 if(!next||!running||next->size!=0x400000||running->size!=0x400000||!((next->address==0x10000&&running->address==0x410000)||(next->address==0x410000&&running->address==0x10000))||r.size>next->size){cloudPost("Incompatible storage layout. Use USB recovery.",true);return false;}
 cloudPost("Starting download...\nKeep power connected");auto client=openCloudHTTP(r.url);
 if(!client){cloudPost("Download unavailable. Check Wi-Fi and try again.",true,&r);return false;}
 if(esp_http_client_get_content_length(client)!=r.size){closeCloudHTTP(client);cloudPost("Download size mismatch. Update stopped.",true,&r);return false;}
 if(!Update.begin(r.size,U_FLASH)){closeCloudHTTP(client);cloudPost("Could not prepare update storage.",true,&r);return false;}
 mbedtls_sha256_context hash;mbedtls_sha256_init(&hash);mbedtls_sha256_starts(&hash,0);
 uint8_t buffer[4096];uint32_t received=0,started=millis(),lastProgress=0;bool ok=true;
 while(received<r.size){
  int count=esp_http_client_read(client,(char*)buffer,min((uint32_t)sizeof(buffer),r.size-received));
  if(count<=0||WiFi.status()!=WL_CONNECTED||millis()-started>600000){ok=false;break;}
  if(received==0&&buffer[0]!=0xe9){ok=false;break;}
  mbedtls_sha256_update(&hash,buffer,count);
  if(Update.write(buffer,count)!=(size_t)count){ok=false;break;}received+=count;
  if(millis()-lastProgress>250||received==r.size){char msg[120];snprintf(msg,sizeof(msg),"Downloading %u%%\n%lu / %lu KB\nKeep power connected",unsigned(received*100/r.size),(unsigned long)(received/1024),(unsigned long)(r.size/1024));cloudPost(msg);lastProgress=millis();}
  vTaskDelay(1);
 }
 closeCloudHTTP(client);uint8_t digest[32];mbedtls_sha256_finish(&hash,digest);mbedtls_sha256_free(&hash);
 char hex[65];for(int i=0;i<32;i++)snprintf(hex+i*2,3,"%02x",digest[i]);
 if(!ok||received!=r.size||strcmp(hex,r.sha256)!=0){Update.abort();cloudPost("Download incomplete or verification failed. Retry available.",true,&r);return false;}
 cloudPost("Verifying firmware...");
 if(!Update.end(false)){Update.abort();cloudPost("Firmware validation failed. Existing firmware retained.",true,&r);return false;}
 cloudPost("Update complete. Restarting...",true,nullptr,true);return true;
}
static void cloudWorker(void*){
 CloudJob job=cloudJob;cloudPost("Checking secure connection...");
 const uint32_t clockWaitStarted=millis();
 while(time(nullptr)<firstValidClockTime && WiFi.status()==WL_CONNECTED &&
       millis()-clockWaitStarted<20000)vTaskDelay(pdMS_TO_TICKS(100));
 if(time(nullptr)<firstValidClockTime){cloudPost("Cannot set clock for secure updates. Check internet and retry.",true);vTaskDelete(nullptr);return;}
 if(job.install){downloadCloudRelease(job.release);vTaskDelete(nullptr);return;}
 auto client=openCloudHTTP(CATALOG_URL);
 if(!client){cloudPost("Cannot reach update catalog. Check internet or try later.",true);vTaskDelete(nullptr);return;}
 char body[4097];
 const bool ok = readCloudIndex(client, body, sizeof(body));
 closeCloudHTTP(client);
 CloudRelease release={};bool empty=false;
 if(!ok||!parseRelease(body,release,empty))cloudPost("Invalid or incompatible update catalog.",true);
 else if(empty)cloudPost("No release published on test channel.",true);
 else if(newerVersion(release.version,TRAILHEAD_VERSION))cloudPost("New update available",true,&release);
 else cloudPost("You're up to date",true);
 vTaskDelete(nullptr);
}
static bool startCloudJob(bool install){
 if(cloudBusy)return false;
 if(WiFi.status()!=WL_CONNECTED){snprintf(cloudMessage,sizeof(cloudMessage),"Connect Wi-Fi in Settings first.");return false;}
 if(install&&!cloudAvailable)return false;
 if(!cloudEvents)cloudEvents=xQueueCreate(1,sizeof(CloudEvent));
 if(!cloudEvents){snprintf(cloudMessage,sizeof(cloudMessage),"Not enough memory to check updates.");return false;}
 cloudJob.install=install;cloudJob.release=cloudRelease;cloudBusy=true;snprintf(cloudMessage,sizeof(cloudMessage),"%s",install?"Preparing download...":"Checking for updates...");
 if(xTaskCreate(cloudWorker,"cloud-update",12288,nullptr,1,nullptr)!=pdPASS){cloudBusy=false;snprintf(cloudMessage,sizeof(cloudMessage),"Not enough memory. Restart and retry.");return false;}return true;
}
