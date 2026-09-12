const { withEntitlementsPlist } = require('expo/config-plugins');

// The notifications package defaults to an APNs entitlement. HandBack only
// schedules on-device notifications, which do not need remote-push signing.
module.exports = function withLocalNotifications(config) {
  return withEntitlementsPlist(config, (next) => {
    delete next.modResults['aps-environment'];
    return next;
  });
};
