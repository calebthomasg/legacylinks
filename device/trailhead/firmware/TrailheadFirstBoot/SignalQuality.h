#pragma once
// Heuristic UI categories, not a connection guarantee. Reject disconnected/invalid RSSI.
static bool validSignal(int rssi){return rssi<0&&rssi>=-127;}
static int signalBarCount(int rssi){return !validSignal(rssi)?0:rssi>=-60?4:rssi>=-70?3:rssi>=-80?2:1;}
static const char *signalQuality(int rssi){return !validSignal(rssi)?"Unavailable":rssi>=-60?"Strong":rssi>=-70?"Good":rssi>=-80?"Weak":"Very weak";}
