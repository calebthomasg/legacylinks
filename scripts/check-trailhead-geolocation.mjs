import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../utils/trailheadGeolocation.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { trackGeolocation } = context.exports;

for (const initialState of ['WAITING_ACTIVE', 'ACTIVE_LOCK', 'ACTIVE_ERROR', 'BACKGROUND', 'BACKGROUND_ERROR']) {
  let nextId = 0;
  const active = new Set();
  const options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };
  const provider = {
    getCurrentPosition(success, error, received) { assert.equal(received, options); },
    watchPosition(success, error, received) {
      assert.equal(received, options);
      const id = nextId++;
      active.add(id);
      return id;
    },
    clearWatch(id) { assert(active.delete(id)); },
  };
  const tracker = trackGeolocation(provider);
  tracker.geolocation.getCurrentPosition(() => {}, undefined, options);
  let id = tracker.geolocation.watchPosition(() => {}, undefined, options);
  assert.equal(id, 0);
  let state = initialState;
  let clicks = 0;
  const settings = {};
  const control = {
    setShowUserHeading(show) { settings.heading = show; },
    setFollowUserLocation(follow) { settings.follow = follow; },
    trigger() {
      clicks++;
      if (state === 'BACKGROUND') state = 'ACTIVE_LOCK';
      else {
        state = 'OFF';
        tracker.geolocation.clearWatch(id);
      }
      return true;
    },
  };
  tracker.stop(control);
  assert.equal(state, 'OFF');
  assert.equal(active.size, 0);
  assert.equal(clicks, initialState === 'BACKGROUND' ? 2 : 1);
  assert.equal(settings.heading, true);
  assert.equal(settings.follow, true);
  tracker.stop(control);
  assert.equal(clicks, initialState === 'BACKGROUND' ? 2 : 1);
  id = tracker.geolocation.watchPosition(() => {}, undefined, options);
  state = 'WAITING_ACTIVE';
  tracker.stop(control);
  assert.equal(active.size, 0);
}
assert.equal(trackGeolocation(undefined).geolocation, undefined);
console.log('Passed: delegation, watch ID zero, all tracking states, repeated stop/restart, heading/follow restoration, unavailable geolocation.');

if (process.argv[2]) {
  const mapboxSource = fs.readFileSync(process.argv[2], 'utf8');
  const mapboxContext = {
    exports: {}, navigator: { geolocation: {} }, window: {},
    require(name) {
      if (name.endsWith('/evented')) return { Evented: class { fire() {} }, Event: class {} };
      if (name.endsWith('/util/util')) return {
        bindAll(names, object) { names.forEach(key => { object[key] = object[key].bind(object); }); },
        warnOnce() {},
      };
      if (name.endsWith('/throttle')) return { default: fn => fn };
      return { default: class {} };
    },
  };
  vm.runInNewContext(ts.transpileModule(mapboxSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, mapboxContext);
  const Control = mapboxContext.exports.default;
  for (const state of ['WAITING_ACTIVE', 'ACTIVE_LOCK', 'ACTIVE_ERROR', 'BACKGROUND', 'BACKGROUND_ERROR']) {
    const active = new Set();
    const tracker = trackGeolocation({
      getCurrentPosition() {},
      watchPosition() { active.add(0); return 0; },
      clearWatch(id) { assert(active.delete(id)); },
    });
    const control = new Control({ geolocation: tracker.geolocation, trackUserLocation: true, showUserHeading: true });
    Object.assign(control, {
      _setup: true, _watchState: state, _numberOfWatches: 1,
      _geolocationWatchID: tracker.geolocation.watchPosition(() => {}),
      _geolocateButton: { classList: { remove() {} }, setAttribute() {} },
      _setWatchState(next) { this._watchState = next; },
      _clearRequestTimeout() {}, _removeDeviceOrientationListener() {},
      _updateMarker() {}, _updateCamera() {},
    });
    tracker.stop(control);
    assert.equal(active.size, 0);
    assert.equal(control._watchState, 'OFF');
    assert.equal(control._geolocationWatchID, undefined);
  }
  console.log('Passed: cleanup against actual Mapbox source public trigger/setter implementation in all tracking states.');
}
