/**********************************************************************
 * Copyright 2020 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const webpush = require("web-push");

module.exports = class Webpush {

  constructor(options={}, debug) {
    if (debug) debug("Webpush.constructor(%s)...", JSON.stringify(options));
    this.options = options;
    this.debug = debug;
  }
  
  /**
   * properties can contain any of the following:
   * .privateKey - VAPID private key
   * .publicKey - VAPID public key
   * .subject - VAPID subject
   */
  setVapid(properties = {}) {
    if (this.debug) this.debug("Webpush.setVapid(%s)...", JSON.stringify(properties));
    if (!this.options.vapid) this.options.vapid = {};
    if (properties.privateKey) this.options.vapid.privateKey = properties.privateKey;
    if (properties.publicKey) this.options.vapid.publicKey = properties.publicKey;
    if (properties.subject) this.options.vapid.subject = properties.subject;
  }

  getVapid() {
    if (this.debug) this.debug("Webpush.getVapid()...");
    return(this.options.vapid);
  }

  send(pushNotification, subscriptions, onFailure) {
    if (this.debug) this.debug("Webpush.send(%s, %s)...", JSON.stringify(pushNotification), JSON.stringify(subscribers));
    if ((pushNotification) && (subscriptions) && (Array.isArray(subscriptions))) {
      subscriptions.forEach(subscription => {
        const subscriberId = subscription.endpoint.slice(-8);
        try {
          webpush.sendNotification(
            subscription,
            JSON.stringify(pushNotification),
            { TTL: 10000, vapidDetails: this.options.vapid }
          ).then(r => {
            switch (r.statusCode) {
              case 201:
                break;
              default:
                if (this.debug) this.debug("Webpush.send: push to user '%s' failed (%s)", subscriberId, r.statusCode);
                if (onFailure) onFailure(subscriberId);
               break;
            }
          }).catch((e) => {
            if (this.debug) this.debug("Webpush.send: push to user '%s' failed (%s)", subscriberId, e);
          });
        } catch(e) {
          if (this.debug) this.debug("Webpush.send: push to user '%s' failed (%s)", subscriberId, e.message);
        }
      })
    }
  }

}
