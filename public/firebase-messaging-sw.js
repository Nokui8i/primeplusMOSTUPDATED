// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCl-DomeyHP8jnLnlG6XYdCzNXMZO_4gDY",
  authDomain: "primeplus-11a85.firebaseapp.com",
  projectId: "primeplus-11a85",
  storageBucket: "primeplus-11a85.appspot.com",
  messagingSenderId: "226103289373",
  appId: "1:226103289373:web:a31d88a07c8318caf108f4",
  measurementId: "G-52E3M86YXR"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/sparkles.png',
    badge: '/sparkles.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
}); 