/**
 * Copyright 2020 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const _ = require('lodash');
const bonjour = require('bonjour')();
const myApp = require('./lib/signalk-libapp/App.js');
const Log = require('./lib/signalk-liblog/Log.js');
const Webpush = require('./Webpush.js');
const Email = require('./Email.js');

const NOTIFICATION_STATES = [ "normal", "alert", "warn", "alarm", "emergency" ];

const PLUGIN_ID = "push-notifier";
const PLUGIN_NAME = "pdjr-skplugin-push-notifier";
const PLUGIN_DESCRIPTION = "Push notifications over email and/or web-push.";
const PLUGIN_SCHEMA = {
  "type": "object",
  "properties": {
    "credentials": {
      "title": "Signal K credentials",
      "description": "'username:password' for accessing Signal K",
      "type": "string",
      "default": "push-notifier:"
    },
    "paths": {
      "title": "Monitor these paths",
      "description": "Paths of notifications that will be monitored",
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "subscriberDatabase": {
      "title": "Subscriber database",
      "description": "Database used to persist push notification subscribers",
      "type": "object",
      "properties": {
        "resourceProviderId": {
          "title": "Resource provider",
          "description": "Resource provider used to persist notification subscriptions",
          "type": "string"
        },
        "resourceType": {
          "title": "Resource type",
          "description": "Resource type used to persist notification subscriptions",
          "type": "string"
        }
      },
      "default": { "resourceProviderId": "resources-provider", "resourceType": "push-notifier" }
    },
    "services": {
      "type": "object",
      "properties" : {
        "email": {
          "type": "object",
          "properties": {
            "states": {
              "title": "Trigger on these notification states",
              "description": "Comma-separated list of notification states that will trigger a push",
              "type": "array",
              "items": {
                "type": "string",
                "enum": NOTIFICATION_STATES
              },
              "uniqueItems": true,
              "default": [ "alarm", "emergency" ]
            },
            "transportOptions": {
              "title": "Nodemailer transport options",
              "type": "string"
            },
            "messageOptions": {
              "title": "Nodemailer message options",
              "type": "string"
            },
            "connectionCheckInterval": {
              "title": "Connection check interval (m)",
              "type": "number"
            }
          }
        },
        "webpush" : {
          "type": "object",
          "properties": {
            "states": {
              "title": "Trigger on these notification states",
              "description": "Comma-separated list of notification states that will trigger a push",
              "type": "array",
              "items": {
                "type": "string",
                "enum": NOTIFICATION_STATES
              },
              "uniqueItems": true,
              "default": [ "alarm", "emergency" ]
            },
             "transportOptions": {
              "title": "Webpush transport options",
              "type": "string"
            },
          }
        }
      },
      "default": {}
    }
  }
};
const PLUGIN_UISCHEMA = {};
const VERIFY_WAN_CONNECTION_INTERVAL = 60;

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var timeoutId = undefined;
  var connectionState = 'unknowable';

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uiSchema = PLUGIN_UISCHEMA;

  const App = new myApp(app)
  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });
  
  plugin.start = function(options, restartPlugin) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

    // Make plugin.options to get scope outside of just start(),
    // populating defaults and saving to configuration.
    plugin.options = {};
    plugin.options.credentials = options.credentials || plugin.schema.properties.credentials.default;
    plugin.options.paths = options.paths || plugin.schema.properties.paths.default;
    plugin.options.subscriberDatabase = { ...plugin.schema.properties.subscriberDatabase.default, ...options.subscriberDatabase };
    plugin.options.services = options.services || plugin.schema.properties.services.default;
    app.debug("using configuration: %s", JSON.stringify(plugin.options, null, 2));

    try {
      App.findServerAddress(app.getSelfPath('uuid')).then((serverAddress) => {
        if (serverAddress) {
          fetch(`${serverAddress}/signalk`, { method: 'GET' })
          .then((response) => {
            response.json()
            .then((signalk) => {
              console.log(JSON.stringify(signalk));
              const serverEndpoint = Object.keys(signalk.endpoints)[0];
              app.debug(`server endpoint = '${serverEndpoint}'`)
              const [ username, password ] = plugin.options.credentials.split(':');   
              fetch(`${serverAddress}/signalk/${serverEndpoint}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username, password: password })})
              .then((response) => {
              if (response.status == 200) {
                // We got an authentication token and can do things.
                response.json()
                .then((authentication) => {
                  log.N(`authenticated with server as user ${username}`, false);
                  plugin.token = authentication.token;

                  // Web-push requires HTTPS...
                  if ((plugin.options.services.webpush) && (!serverAddress.startsWith('https:'))) {
                    log.W("disabling web-push service (server not running SSL)", false);
                    delete plugin.options.services.webpush;
                  }
          
                  // Register listeners for any 'restart:' paths.
                  plugin.options.paths.filter(path => (path.startsWith("restart:"))).forEach(path => {
                    [label, notificationPath] = path.split(":");
                    log.N("registering restart listener on '%s'", notificationPath, false);
                    const stream = app.streambundle.getSelfStream(notificationPath);
                    unsubscribes.push(stream.onValue((notification) => {
                      log.N("restarting because of rule '%s'", path);
                      restartPlugin(options);
                    }));
                  });

                  // Attempt to create Email instance used to send emails.
                  if (plugin.options.services.email) {
                    app.debug('configuring email service');
                    try {
                      const transportOptions = JSON.parse(plugin.options.services.email.transportOptions);
                      const messageOptions = (plugin.options.services.email.messageOptions)?JSON.parse(plugin.options.services.email.messageOptions):null;
                      plugin.email = new Email(transportOptions, messageOptions, app.debug);
                    } catch(e) { app.debug(`email service configuration failed (${e.message})`); }
                  }

                  // Attempt to create Webpush instance used to send web-push notifications.
                  if (plugin.options.services.webpush) {
                    app.debug('configuring web-push service');
                    try {
                      var transportOptions = null;
                      if (plugin.options.services.webpush.transportOptions) {
                        transportOptions = JSON.parse(plugin.options.services.email.transportOptions);
                      } else {
                        transportOptions = { vapid: { privateKey: process.env.VAPID_PRIVATE_KEY, publicKey: process.env.VAPID_PUBLIC_KEY, subject: process.env.VAPID_SUBJECT } };
                      }
                      plugin.webpush = new Webpush(transportOptions, app.debug);
                    } catch(e) { app.debug(`web-push service configuration failed (${e.message})`); }
                  }

                  // We must have at least one service.
                  if ((plugin.email) || (plugin.webpush)) {
                    // Expand and clean up our list of paths to be monitored.
                    sanitizePaths(plugin.options.paths, serverAddress).then((expandedPaths) => {

                      // Announce entering production
                      log.N("listening on %d notification path%s (WAN state is '%s')", expandedPaths.length, ((expandedPaths.length == 0)?"s":""), connectionState);
                      app.debug(JSON.stringify(expandedPaths));

                      // Maybe keep checking WAN connection
                      if ((plugin.email) && (plugin.options.services.email.connectionCheckInterval) && (plugin.options.services.email.connectionCheckInterval > 0)) {
                        connectionState = 'unknown';
                        (function loop() {
                          plugin.email.getTransporter().verify((e,s) => {
                            connectionState = (e)?"down":"up";
                            log.N(`listening on ${expandedPaths.length} notification path${((expandedPaths.length)?'':'s')} (WAN state is '${connectionState}'`);
                          });
                          timeoutId = setTimeout(() => { loop(); }, (plugin.options.services.email.connectionCheckInterval * 60000));
                        })();
                      }

                      // Register a listener on each notification path.
                      expandedPaths.forEach(path => {
                        const stream = app.streambundle.getSelfStream("notifications." + path);
                        unsubscribes.push(stream.onValue((notification) => {
                          // Handle any received notifications.
                          if ((notification) && (notification.state)) {

                            // Get the subscriber list and separate out email and web-push subscribers.
                            app.resourcesApi.listResources(plugin.options.subscriberDatabase.resourceType, {}, plugin.options.subscriberDatabase.resourceProviderId).then((resources) => {
                              const subscribers = Object.keys(resources).reduce((a,k) => { if (k.includes('@')) a.email.push(k); if (!k.includes('@')) a.webpush.push(resources[k]); return(a); }, { email: [], webpush: [] });

                              // If email is configured and we have subscribers then maybe we send a message.
                              if ((plugin.email) && (plugin.email.getMessageOptions()) && (subscribers.email.length > 0)) {
                                // But only if the notification state is of interest.
                                if (plugin.options.services.email.states.includes(notification.state)) {
                                  app.debug("sending message to email subscribers");
                                  plugin.email
                                  .send({ ...createMessageFromNotification(notification, path), ...{ to: subscribers.email } })
                                  .then((r) => { if (plugin.emailState == 1) { plugin.emailState = 0; log.W("email network connection has come up") }})
                                  .catch((e) => { if (plugin.emailState == 0) { plugin.emailState = 1; log.W("email network connection has gone down") }});
                                }
                              }

                              // If web-push is configured and we have subscribers then maybe send a push notification.
                              if ((plugin.webpush) && (subscribers.webpush.length > 0)) {
                                // But only if the notification state is of interest.
                                if (plugin.options.services.webpush.states.includes(notification.state)) {
                                  app.debug("sending notification to web-push subscribers");
                                  try {
                                    plugin.webpush.send(
                                      createPushNotificationFromNotification(notification, path),
                                      subscribers.webpush.map(subscriber => subscriber.subscription),
                                      (sid) => handleWebpushFalure(sid, subscribers.webpush)
                                    );
                                  } catch(e) { log.W("web-push send failure (%s)", e.message); }
                                }
                              }
                            }).catch((e) => { log.E("error recovering subscriber resources (%s)", e,false); });
                          } else log.W(`received invalid notification '${notification}'`);
                        }));
                      });
                    }).catch((e) => { log.E('stopped: could not sanitize paths'); })
                  } else log.E("stopped: no services have been configured");
                });
              } else log.E(`stopped: could not authenticate as user ${username}`);
              }).catch((e) => { log.E('stopped: unable to contact host authentication service'); })
            }).catch((e) => { log.E('stopped: unable to recover server endpoint(s)'); })
          }).catch((e) => {})
        } else log.E('stopped: mdns failed to acquire server address');
      }).catch((e) => { log.E(`stopped: mdns internal error (${e})`); })
    } catch(e) { log.E(`stopped: internal error '${e}'`); }
  }

  plugin.stop = function() {
    clearTimeout(timeoutId);
	  unsubscribes.forEach(f => f());
    unsubscribes = [];
  } 

  plugin.registerWithRouter = function(router) {
    router.get('/status', handleRoutes);
    router.get('/keys', handleRoutes);
    router.post('/subscribe/:subscriberId', handleRoutes);
    router.delete('/unsubscribe/:subscriberId', handleRoutes);
    router.get('/vapid', handleRoutes);
    router.patch('/push/:subscriberId', handleRoutes);
  }

  plugin.getOpenApi = function() {
    require("./resources/openApi.json");
  }

  async function findServerAddress(uuid, timeout=5) {
    var serverAddress = null;
    return(await new Promise((resolve, reject) => {
      bonjour.find({ type: 'https' }, (service) => {
        if (service.txt.self === uuid) serverAddress = "https://" + service.addresses[0] + ":" + service.port;
      });
  
      setTimeout(() => {                                  // wait for 5 seconds, then...
        if (serverAddress != null) {
          resolve(serverAddress);
        } else {
          bonjour.find({ type: "http" }, (service) => {
            if (service.txt.self === uuid) serverAddress = "http://" + service.addresses[0] + ":" + service.port;
          });
          setTimeout(() => {                              // wait for 5 seconds, then...
            bonjour.destroy();
            resolve(serverAddress);                            // destroy bonjour instance
          }, timeout * 1000);    
        }
      }, (timeout * 1000));
    }).then(() => {
      return(serverAddress);
    }));
  }

  async function handleWebpushFalure(subscriberId, subscription) {
    app.debug("handleWebpushFailure(%s,%s)...", subscriberId, subscription);
    if (subscription.sendFailureCount > WEBPUSH_SEND_FAILURE_LIMIT) {
      app.debug("handleWebpushFailure: deleting subscription for subscriber '%s' (too many send failures)", subscriberId);
      await app.resourcesApi.deleteResource(plugin.options.subscriberDatabase.resourceType, subscriberId, plugin.options.subscriberDatabase.resourceProviderId);
    } else {
      app.debug("handleWebpushFailure: bumping send failure count for subscriber '%s' (new send failure)", sid);
      subscription.sendFailureCount++;
      await app.resourcesApi.setResource(plugin.options.subscriberDatabase.resourceType, subscriberId, subscription, plugin.options.subscriberDatabase.resourceProviderId);
    }
  }

  /**
   * Clean up a mixed array of Signal K paths, API URLs and restart
   * directives into an array of just paths by deleting all restart
   * directives and expanding all API URLs.
   * @param {*} paths - mixed array from plugin configuration.
   * @returns - an array of Signal K paths.
   */
  async function sanitizePaths(paths, serverAddress) {
    console.log(">>>>> %s %s", paths, serverAddress);
    var retval = [];
    for (var i = 0; i < paths.length; i++) {
      if (paths[i].startsWith('/')) {
        console.log(`${serverAddress}${paths[i]}`);
        const response = await fetch(`${serverAddress}${paths[i]}`, { method: 'GET', headers: { 'Authorization': `Bearer ${plugin.token}` } });
        if (response.status == 200) {
          var responsePaths = await response.json();
          if (responsePaths) responsePaths.forEach(p => retval.push(p));
        }
      } else if (!paths[i].includes(":")) {
        retval.push(paths[i]);
      }
    };
    return(retval);
  }
 
  function createPushNotificationFromNotification(notification, path) {
    var pushNotification = null;
    const timestamp = Math.floor(new Date().getTime() / 1000)
    if (notification) {
      pushNotification = {
        title: notification.state.toUpperCase() + " notification" + ((path)?(" on " + path):""),
        options: {
          id: path || "",
          body: notification.message + "\nIssued on " + (new Date()),
          timestamp: Date.now()
        }
      }
    }
    return(pushNotification);
  }

  /**
   * Create a nodemailer message options object from a Signal K
   * notification
   * @param {*} notification - Signal K notification object.
   * @param {*} path - the Signal K path on which <notification> appeared.
   * @returns - nodemailer message options object.
   */
  function createMessageFromNotification(notification, path) {
    app.debug("createMessageFromNotification(%s,%s)...", notification, path);
    return({
      subject: notification.state.toUpperCase() + " notification" + ((path)?(" on " + path):""),
      text: notification.message
    })
  }

  function handleRoutes(req, res) {
    app.debug("received %s request on %s", req.method, req.path);
    var subscriberId;
    try {
      switch (req.path.slice(0, (req.path.indexOf('/', 1) == -1)?undefined:req.path.indexOf('/', 1))) {
        case '/status': 
          var services = [].concat(((plugin.email) && (plugin.email.getMessageOptions()))?["email"]:[], (plugin.webpush)?["webpush"]:[]);
          var reason = "Email transport is not configured.";
          if (plugin.email) {
            plugin.email.getTransporter().verify((e,s) => {
              if (e) {
                expressSend(res, 200, { connection: "down", services: services, reason: e }, req.path);
              } else {
                expressSend(res, 200, { connection: "up", services: services }, req.path);
              }
            });
          } else {
            expressSend(res, 200, { connection: 'unknown', services: services }, req.path);
          }
          break;
        case '/keys':
          sanitizePaths(plugin.options.paths).then((expandedPaths) => {
            expressSend(res, 200, expandedPaths, req.path);
          }).catch((e) => {
            throw new Error("500");
          })
          break;
        case '/subscribe':
          subscriberId = req.params.subscriberId;
          var subscription = req.body;
          if ((typeof subscription === 'object') && (!Array.isArray(subscription)) && (subscriberId)) {
            app.resourcesApi.setResource(
              plugin.options.subscriberDatabase.resourceType,
              subscriberId,
              { subscription: subscription, sendFailureCount: 0 },
              plugin.options.subscriberDatabase.resourceProviderId
            ).then(() => {
              expressSend(res, 200, null, req.path);
            }).catch((e) => {
              expressSend(res, 503, "503: cannot save subscription", req.path);
            });
          } else {
            expressSend(res, 400, "400: invalid request", req.path);
          }
          break;
        case '/unsubscribe':
          subscriberId = req.params.subscriberId;
          if (subscriberId) {
            app.resourcesApi.deleteResource(
              plugin.options.subscriberDatabase.resourceType,
              subscriberId,
              plugin.options.subscriberDatabase.resourceProviderId
            ).then(() => {
              expressSend(res, 200, null, req.path);
            }).catch((e) => {
              expressSend(res, 404, "404: unknown subscriber", req.path);
            });
          } else {
            expressSend(res, 400, "400: invalid request", req.path);
          }
          break;
        case '/vapid':
          if (plugin.webpush) {
            var vapid = plugin.webpush.getVapid();
            if ((vapid) && (vapid.publicKey) && (vapid.subject)) {
              expressSend(res, 200, { "publicKey": vapid.publicKey, "subject": vapid.subject }, res.path);
            } else throw new Error("404");
          } else throw new Error("500");
          break;
        case '/push':
          subscriberId = req.params.subscriberId;
          notification = req.body;
          // If we have a valid notification...
          if ((typeof notification === 'object') && (notification.state) && (notification.method) && (notification.message)) {            app.resourcesApi.listResources(plugin.options.subscriberDatabase.resourceType, {}, plugin.options.subscriberDatabase.resourceProviderId).then((resources) => {
              // Try to get subscription (email address or web-push subscription) for specified subscriber...
              const subscriptions = Object.keys(resources).filter(key => (key == subscriberId)).map(key => ((subscriberId.includes("@"))?key:resources[key].subscription));
              if (subscriptions.length == 1) {
                if (subscriberId.includes("@")) {
                  plugin.email.send({ ...createMessageFromNotification(notification, null), ...{ to: subscriptions } });
                } else {
                  plugin.webpush.send(createPushNotificationFromNotification(notification), subscriptions);  
                }
                expressSend(res, 200, null, req.path);
              } else throw new Error("404");
            }).catch((e) => { throw new Error("500"); });
          } else throw new Error("400");
          break;
      }
    } catch(e) {
      app.debug(e.message);
      expressSend(res, ((/^\d+$/.test(e.message))?parseInt(e.message):500), null, req.path);
    }

    function expressSend(res, code, body = null, debugPrefix = null) {
      const FETCH_RESPONSES = { 200: null, 201: null, 400: "bad request", 403: "forbidden", 404: "not found", 503: "service unavailable (try again later)", 500: "internal server error" };
      res.status(code).send((body)?body:((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null));
      if (debugPrefix) app.debug("%s: %d %s", debugPrefix, code, ((body)?JSON.stringify(body):((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null)));
      return(false);
    }
  }
 
  return(plugin);
}
