const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ヘルパー: FCMトークン取得 → 通知送信
async function sendPushToUser(uid, title, body) {
  if (!uid) return;
  try {
    const tokenDoc = await db.doc(`users/${uid}/tokens/fcm`).get();
    const token = tokenDoc.data()?.token;
    if (!token) return;

    await getMessaging().send({
      token,
      notification: { title, body },
      webpush: {
        notification: { title, body, icon: "/logo192.png" },
        fcmOptions: { link: "https://swapru.vercel.app/" }
      },
    });
    console.log(`✅ 通知送信 → ${uid}: ${title}`);
  } catch (e) {
    console.error(`❌ 通知失敗 (${uid}):`, e.message);
  }
}

// 1. チャットメッセージ受信通知
exports.onNewMessage = onDocumentCreated(
  "chats/{chatId}/messages/{msgId}",
  async (event) => {
    const msg = event.data.data();
    const { chatId } = event.params;

    if (msg.from === "system") return;

    const chatDoc = await db.doc(`chats/${chatId}`).get();
    const chat = chatDoc.data();
    if (!chat) return;

    // 送信者の反対側に通知
    const receiverUid = msg.from === chat.ownerUid ? chat.applicantUid : chat.ownerUid;
    const senderName = msg.from === chat.ownerUid ? chat.ownerName : chat.applicantName;

    await sendPushToUser(
      receiverUid,
      `💬 ${senderName}さんからメッセージ`,
      msg.text?.slice(0, 60) || "📷 写真が届きました"
    );
  }
);

// 2. 交換申し込み通知
exports.onNewApplication = onDocumentCreated(
  "applications/{appId}",
  async (event) => {
    const app = event.data.data();
    await sendPushToUser(
      app.itemOwnerUid,
      `🔁 ${app.applicant}さんから交換申し込み`,
      `「${app.itemTitle}」への申し込みが届きました`
    );
  }
);

// 3. トレードステータス変更通知
exports.onTradeStatusChanged = onDocumentUpdated(
  "chats/{chatId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.tradeStatus === after.tradeStatus) return;

    const STATUS_MESSAGES = {
      発送中: { title: "📦 スワプる成立！", body: "お互い発送の準備をしましょう" },
      受取確認: { title: "📬 発送しました！", body: "商品が届いたら受取確認を押してください" },
      評価: { title: "✅ 受取完了！", body: "取引相手を評価しましょう⭐" },
      完了: { title: "🎉 スワプる完了！", body: "取引が正常に完了しました" },
    };

    const msg = STATUS_MESSAGES[after.tradeStatus];
    if (!msg) return;

    await Promise.all([
      sendPushToUser(after.ownerUid, msg.title, msg.body),
      sendPushToUser(after.applicantUid, msg.title, msg.body),
    ]);
  }
);