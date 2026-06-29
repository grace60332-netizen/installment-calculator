/**
 * js/auth.js
 * 管理後台登入與權限檢查
 */

(function (global) {
  "use strict";

  async function signIn(email, password) {
    if (!global.FirebaseApp || !global.FirebaseApp.auth) {
      throw new Error("Firebase Auth 尚未初始化。");
    }

    return await global.FirebaseApp.auth.signInWithEmailAndPassword(email, password);
  }

  async function signOut() {
    return await global.FirebaseApp.auth.signOut();
  }

  function onAuthStateChanged(callback) {
    return global.FirebaseApp.auth.onAuthStateChanged(callback);
  }

  async function getAdminProfile(uid) {
    const db = global.FirebaseApp.db;

    const doc = await db
      .collection("admins")
      .doc(uid)
      .get();

    if (!doc.exists) return null;

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  async function requireAdmin(user) {
    if (!user) {
      return {
        ok: false,
        reason: "not_logged_in"
      };
    }

    const profile = await getAdminProfile(user.uid);

    if (!profile || profile.active !== true) {
      return {
        ok: false,
        reason: "not_admin"
      };
    }

    return {
      ok: true,
      user,
      profile
    };
  }

  global.AuthService = {
    signIn,
    signOut,
    onAuthStateChanged,
    getAdminProfile,
    requireAdmin
  };

})(typeof window !== "undefined" ? window : globalThis);