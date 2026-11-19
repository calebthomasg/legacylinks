#!/bin/sh
set -eu
# Install the esp32:esp32@3.0.2 platform before running.
: "${LVGL_PATH:?Set LVGL_PATH to an LVGL 8.3.10 checkout}"
: "${PETOPIA_SDK:?Set PETOPIA_SDK to the extracted 3.0.2-h SDK directory}"
project=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
arduino-cli compile --jobs 4 \
  --fqbn esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,CDCOnBoot=default,FlashMode=qio \
  --library "$LVGL_PATH" \
  --build-property "runtime.tools.esp32-arduino-libs.path=$PETOPIA_SDK" \
  --build-property "compiler.c.extra_flags=-MMD -c -DLV_CONF_PATH=$project/lv_conf.h" \
  --build-property "compiler.cpp.extra_flags=-MMD -c -DLV_CONF_PATH=$project/lv_conf.h" \
  --build-property upload.maximum_size=4194304 \
  --output-dir "$project/rebuilt" "$project/firmware/TrailheadFirstBoot"
