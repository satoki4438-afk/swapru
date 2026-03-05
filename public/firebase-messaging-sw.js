importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAVvVXYMT7oaDIXUfQk1of0Jnj-RnAWUHU",
  authDomain: "swapru.firebaseapp.com",
  projectId: "swapru",
  storageBucket: "swapru.firebasestorage.app",
  messagingSenderId: "310180077020",
  appId: "1:310180077020:web:8b56e30aeb60e85f9bc319"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  });
});