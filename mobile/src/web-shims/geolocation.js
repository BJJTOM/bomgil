export default {
  getCurrentPosition: (success, error, options) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(success, error, options);
    } else if (error) {
      error({ code: 1, message: 'Geolocation not available' });
    }
  },
  watchPosition: (success, error, options) => {
    if (navigator.geolocation) {
      return navigator.geolocation.watchPosition(success, error, options);
    }
    return null;
  },
  clearWatch: (id) => {
    if (navigator.geolocation && id !== null) {
      navigator.geolocation.clearWatch(id);
    }
  },
};
