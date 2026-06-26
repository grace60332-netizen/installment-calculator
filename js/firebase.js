/**
 * js/firebase.js
 * Firebase 初始化設定
 */

(function (global) {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyCwgfuobGokyry-9MUI-zF-bWzFE7oaZ-w",
    authDomain: "installment-calculator-f2f67.firebaseapp.com",
    projectId: "installment-calculator-f2f67",
    storageBucket: "installment-calculator-f2f67.firebasestorage.app",
    messagingSenderId: "166922410430",
    appId: "1:166922410430:web:27a35b26509f3ff47041ef",
    measurementId: "G-VD17SP6C9X"
  };

  firebase.initializeApp(firebaseConfig);

  const db = firebase.firestore();
  const auth = firebase.auth();

  global.FirebaseApp = {
    db,
    auth,
    firebase
  };

})(typeof window !== "undefined" ? window : globalThis);