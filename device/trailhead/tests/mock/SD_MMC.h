#pragma once
#include <fstream>
#include <cstdlib>
#include <cstdint>
#include <string>

using String = std::string;
constexpr int FILE_READ=0, SDMMC_FREQ_DEFAULT=20000, EXIO_PIN4=4, High=1;
constexpr int MALLOC_CAP_SPIRAM=1, MALLOC_CAP_8BIT=2, MALLOC_CAP_INTERNAL=4;
static int allocated;
static void *heap_caps_malloc(size_t n,int) { auto *p=malloc(n); if(p) ++allocated; return p; }
static void heap_caps_free(void *p) { if(p) --allocated; free(p); }
static size_t heap_caps_get_free_size(int) { return 123456; }
static void Set_EXIO(int,int) {}
static void delay(int) {}
class File {
  std::ifstream input;
public:
  explicit File(const String &path):input(path,std::ios::binary){}
  explicit operator bool() const {return bool(input);}
  size_t read(uint8_t *p,size_t n){input.read(reinterpret_cast<char*>(p),n);return input.gcount();}
  size_t size(){auto pos=input.tellg();input.seekg(0,std::ios::end);auto length=input.tellg();input.seekg(pos);return length;}
};
static struct {
  bool present=true;
  bool setPins(int clk,int cmd,int d0,int d1,int d2,int d3){return clk==2 && cmd==1 && d0==42 && d1==-1 && d2==-1 && d3==-1;}
  bool begin(const char*,bool narrow,bool format,int){return present && narrow && !format;}
  void end(){}
  File open(const String &path,int){return File(String(getenv("PETOPIA_TEST_CARD"))+path);}
} SD_MMC;
