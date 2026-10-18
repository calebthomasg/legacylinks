type LocationControl = {
  trigger: () => boolean;
  setShowUserHeading: (show: boolean) => unknown;
  setFollowUserLocation: (follow: boolean) => unknown;
};

export function trackGeolocation(provider: Geolocation | undefined) {
  const watches = new Set<number>();
  const geolocation: Geolocation | undefined = provider ? {
    getCurrentPosition: (success, error, options) =>
      provider.getCurrentPosition(success, error, options),
    watchPosition: (success, error, options) => {
      const id = provider.watchPosition(success, error, options);
      watches.add(id);
      return id;
    },
    clearWatch: id => {
      provider.clearWatch(id);
      watches.delete(id);
    },
  } : undefined;

  return {
    geolocation,
    stop: (control: LocationControl) => {
      control.setShowUserHeading(false);
      // Background tracking needs one click to recenter, then one to stop.
      // Waiting/active tracking stops on the first click. Watch IDs detect both.
      for (let attempt = 0; watches.size && attempt < 2; attempt++) {
        control.trigger();
      }
      control.setFollowUserLocation(true);
      control.setShowUserHeading(true);
    },
  };
}
