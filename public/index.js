var VAPID_PUBLIC_KEY = null;

window.onload = function() {
  const emailForm = document.getElementById('email-form');
  const emailSubscribeButton = document.getElementById('email-subscribe-button');
  const emailUnsubscribeButton = document.getElementById('email-unsubscribe-button');
  const emailTestButton = document.getElementById('email-test-button');
  const emailPanel = document.getElementById('email-panel')

  const webpushForm = document.getElementById('webpush-form');
  const webpushSubscribeButton = document.getElementById('webpush-subscribe-button');
  const webpushUnsubscribeButton = document.getElementById('webpush-unsubscribe-button');
  const webpushTestButton = document.getElementById('webpush-test-button')
  const webpushPanel = document.getElementById('webpush-panel');
 
  emailSubscribeButton.addEventListener('click', emailSubscribeButtonHandler);
  emailUnsubscribeButton.addEventListener('click', emailUnsubscribeButtonHandler);
  emailTestButton.addEventListener('click', emailTestButtonHandler);
  webpushSubscribeButton.addEventListener('click', webpushSubscribeButtonHandler);
  webpushUnsubscribeButton.addEventListener('click', webpushUnsubscribeButtonHandler);
  webpushTestButton.addEventListener('click', webpushTestButtonHandler);

  var options = null;

  try {
    fetch('/plugins/push-notifier/config', { method: 'GET' }).then((response) => {
      if ((response) && (response.status == 200)) {
        response.json().then((responseJSON) => {
          options = responseJSON.configuration;
          console.log(options);

          if (!options.services.email) {
            emailForm.disabled = true;
            emailPanel.className = "dimmed";
          } else {
            ;
          }

          if (!options.services.webpush) {
            webpushForm.disabled = true;
            webpushPanel.className = "dimmed";
          } else {
            fetch('/plugins/push-notifier/vapid', { method: 'GET' }).then((response) => {
              if ((response) && (response.status == 200)) {
                response.json().then((responseObject) => {
                  if (responseObject) {
                    VAPID_PUBLIC_KEY = responseObject.publicKey;
                    console.log(VAPID_PUBLIC_KEY);
                    if (registerServiceWorker()) {
                      webpushEnable(true);
                      webpushSubscribeButton.disabled = false;
                    } else throw new Error("error registering service worker");
                  } else throw new Error("invalid response object");
                })
              } else throw new Error("invalid server response");
            });
          }
        });
      }
    });
  } catch(e) {
    
  }
};

async function emailSubscribeButtonHandler() {
  const emailSubscribeButton = document.getElementById('email-subscribe-button');
  const emailAddress1Text = document.getElementById('email-address1-text');
  const emailAddress2Text = document.getElementById('email-address2-text');

  emailSubscribeButton.disabled = true;
  try {
    const subscriberId = validateEmailAddresses(emailAddress1Text.value, emailAddress2Text.value);
    const subscription = { address: subscriberId };
    await subscribe(subscriberId, subscription);
    emailAddress1Text.value = emailAddress2Text.value = "";
  } catch(e) {
    alert(e.message);
  }
  emailSubscribeButton.disabled = false;
}

async function emailUnsubscribeButtonHandler() {
  const emailUnsubscribeButton = document.getElementById('email-subscribe-button');
  const emailAddress1Text = document.getElementById('email-address1-text');
  const emailAddress2Text = document.getElementById('email-address2-text');
 
  emailUnsubscribeButton.disabled = true;
  try {
    const subscriberId = validateEmailAddresses(emailAddress1Text.value, emailAddress2Text.value);
    await unsubscribe(subscriberId);
  } catch(e) {
    alert(e.message);
  }
  emailUnsubscribeButton.disabled = false;
}

async function emailTestButtonHandler() {
  const emailTestButton = document.getElementById('email-test-button');
  const emailAddress1Text = document.getElementById('email-address1-text');
  const emailAddress2Text = document.getElementById('email-address2-text');
 
  emailTestButton.disabled = true;
  const subscriberId = validateEmailAddresses(emailAddress1Text.value, emailAddress2Text.value);
  const notification = { state: "normal", method: [], message: "Test notification for push-notifier" };
  await test(subscriberId, notification);
  emailTestButton.disabled = false;
}

async function webpushSubscribeButtonHandler() {
  webpushSubscribeButton.disabled = true;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      console.info('The user accepted the permission request.');
      const registration = await navigator.serviceWorker.getRegistration();
      var subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
      }
      if (subscription) {
        webpushUnsubscribeButton.disabled = false;
        webpushTestButton.disabled = false;
        const subscriberId = subscription.endpoint.slice(-8);
        console.log("The user has been subscribed for push notifications as subscriber '" + subscriberId + "'");
        await subscribe(subscriberId, subscription);          
      } else console.info("The user could not be subscribed for push notifications");
    } else console.error('The user explicitly denied the push notification permission request');
  } catch(e) {
    console.error(e.message);
  }
}

async function webpushUnsubscribeButtonHandler() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    const subscriberId = subscription.endpoint.slice(-8);
    await unsubscribe(subscriberId);
    const unsubscribed = await subscription.unsubscribe();
    if (unsubscribed) {
      console.info("User '" + subscriberId + "' has been unsubscribed from push notifications");
      unsubscribeButton.disabled = true;
      subscribeButton.disabled = false;
      testButton.disabled = true;
    }
  } catch(e) {
    console.error(e.message);
  }
}

async function webpushTestButtonHandler() {
  const webpushTestButton = document.getElementById('webpush-test-button');
  webpushTestButton.disabled = true;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const subscriberId = subscription.endpoint.slice(-8);
  const notification = { state: "normal", method: [], message: "Test notification for push-notifier" };
  await test(subscriberId, notification);
  webpushTestButton.disabled = false;
}

function validateEmailAddresses(addr1, addr2) {
  addr1 = addr1.trim();
  addr2 = addr2.trim();
  const regex = new RegExp("^(?:[A-Z0-9-]+\.)@(?:[A-Z0-9-]+\.)+[A-Z]{2,6}$");
  if ((addr1 != "") && (addr2 != "")) {
    if (addr1 == addr2) {
      //if (regex.test(addr1)) {
        return(addr1);
      //} else throw new Error("email address is invalid");
    } else throw new Error("email addresses do not match");
  } else throw new Error("please enter your email address into both fields");
}

function webpushEnable(state) {
  const webPushEnabledText = document.getElementById('webpush-enabled-text');
  const webPushDisabledText = document.getElementById('webpush-disabled-text');

  webPushEnabledText.style = (state)?'display: block;':'display: none;';
  webPushDisabledText.style = (state)?'display: none;':'display: block;';
}

async function subscribe(subscriberId, subscription) {
  fetch('/plugins/push-notifier/subscribe/' + subscriberId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription)}).then((r) => {
    if (r.status == 200) {
      console.info("User '" + subscriberId +"' is subscribed on the server");
    } else {
      throw new Error("User '" + subscriberId + "' could not be subcribed on the server (" + r.status + "%s)");
    }
  });          
}

async function unsubscribe(subscriberId) {
  fetch('/plugins/push-notifier/unsubscribe/' + subscriberId, { method: 'DELETE' }).then((r) => {
    if (r.status === 200) {
      console.info("User '" + subscriberId + "' has been unsubscribed from the server");
    } else {
      throw new Error("User '" + subscriberId + "' could not be unsubscribed from the server (" + r.status + ")");
    }
  });
}

async function test(subscriberId, notification) {
  fetch('/plugins/push-notifier/push/' + subscriberId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notification) }).then((r) => {
    console.info("Server accepted push request");
  }).catch((e) => {
    throw new Error("Server rejected push request");
  });
}

function registerServiceWorker() {
  var retval = false;

  if (('serviceWorker' in navigator) && ('PushManager' in window)) {
    navigator.serviceWorker.register('./service-worker.js').then(serviceWorkerRegistration => {
      ;
    }).catch(error => {
      console.error("An error occurred while registering the service worker (" + error + ")");
    });
    retval = true;
  } else {
    console.error("Browser does not support service workers or push messages");
  }
  return(retval);
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray; 
}