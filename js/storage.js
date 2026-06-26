/**
 * js/storage.js
 * 資料讀取層
 * 目前功能：
 * 1. 優先從 Firestore 讀取 appConfig/main
 * 2. 如果 Firestore 沒資料，退回讀 data/projects.json
 */

(function (global) {
  "use strict";

  const LOCAL_JSON_PATH = "data/projects.json";

  async function loadProjectData() {
    try {
      if (global.FirebaseApp && global.FirebaseApp.db) {
        const db = global.FirebaseApp.db;

        const doc = await db
          .collection("appConfig")
          .doc("main")
          .get();

        if (doc.exists) {
          console.log("資料來源：Firestore appConfig/main");
          return doc.data();
        }
      }
    } catch (err) {
      console.warn("Firestore 讀取失敗，改讀本機 JSON：", err);
    }

    console.log("資料來源：本機 data/projects.json");

    const res = await fetch(LOCAL_JSON_PATH, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`讀取 ${LOCAL_JSON_PATH} 失敗`);
    }

    return await res.json();
  }

  async function saveProjectData(data) {
    if (!global.FirebaseApp || !global.FirebaseApp.db) {
      throw new Error("Firebase 尚未初始化，無法儲存資料。");
    }

    const db = global.FirebaseApp.db;

    await db
      .collection("appConfig")
      .doc("main")
      .set(data, { merge: false });

    return true;
  }

  global.StorageService = {
    loadProjectData,
    saveProjectData
  };

})(typeof window !== "undefined" ? window : globalThis);