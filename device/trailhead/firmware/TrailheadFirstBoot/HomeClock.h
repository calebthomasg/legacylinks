#pragma once
#include <esp_sntp.h>

// Store UTC in the PCF85063. Only trust dates written by this firmware after
// network sync. The oscillator-stop flag invalidates time after power loss.
static constexpr time_t firstValidClockTime=1735689600;
static constexpr uint32_t clockRetryIntervalMs=60000;
static constexpr char homeTimeZone[]="CST6CDT,M3.2.0,M11.1.0";
static std::atomic<bool> rtcSyncPending{false};
static int decodeBcd(uint8_t value){
  if((value&15)>9 || (value>>4)>9)return -1;
  return (value>>4)*10+(value&15);
}
static uint8_t encodeBcd(int value){return ((value/10)<<4)|(value%10);}
static void startHomeClock(){
  if(prefs.getBool("utcRtc",false)){
    uint8_t raw[7]={};
    Wire.beginTransmission(0x51);Wire.write(0x04);
    if(Wire.endTransmission()==0 && Wire.requestFrom(uint8_t(0x51),size_t(7))==7){
      for(auto &field:raw)field=Wire.read();
      int sec=decodeBcd(raw[0]&0x7f),min=decodeBcd(raw[1]),hr=decodeBcd(raw[2]);
      int day=decodeBcd(raw[3]),month=decodeBcd(raw[5]),year=decodeBcd(raw[6]);
      if(!(raw[0]&0x80) && sec>=0 && sec<60 && min>=0 && min<60 && hr>=0 && hr<24 &&
         day>=1 && day<=31 && month>=1 && month<=12 && year>=25){
        struct tm utc{};utc.tm_year=year+100;utc.tm_mon=month-1;utc.tm_mday=day;
        utc.tm_hour=hr;utc.tm_min=min;utc.tm_sec=sec;
        setenv("TZ","UTC0",1);tzset();
        time_t t=mktime(&utc);
        if(t>=firstValidClockTime && utc.tm_mday==day){struct timeval tv{t,0};settimeofday(&tv,nullptr);}
      }
    }
  }
  setenv("TZ",homeTimeZone,1);
  tzset();
  sntp_set_time_sync_notification_cb([](struct timeval*){rtcSyncPending.store(true);});
}
static void serviceHomeClock(uint32_t nowMs){
  static bool wasOnline=false;
  static uint32_t lastAttemptMs=0;
  const bool online=WiFi.status()==WL_CONNECTED;
  // Once the clock is set, SNTP handles periodic resyncs on its own.
  if(online && (!wasOnline ||
     (nowMs-lastAttemptMs>=clockRetryIntervalMs && time(nullptr)<firstValidClockTime))){
    configTzTime(homeTimeZone,"pool.ntp.org","time.google.com");
    lastAttemptMs=nowMs;
  }
  wasOnline=online;

  if(!rtcSyncPending.exchange(false))return;
  time_t now=time(nullptr);struct tm utc{};
  if(!gmtime_r(&now,&utc) || utc.tm_year<125 || utc.tm_year>199)return;
  uint8_t raw[]={encodeBcd(utc.tm_sec),encodeBcd(utc.tm_min),encodeBcd(utc.tm_hour),
                 encodeBcd(utc.tm_mday),uint8_t(utc.tm_wday),encodeBcd(utc.tm_mon+1),encodeBcd(utc.tm_year-100)};
  if(!I2C_Write(0x51,0x04,raw,sizeof(raw)) && !prefs.getBool("utcRtc",false))prefs.putBool("utcRtc",true);
}
