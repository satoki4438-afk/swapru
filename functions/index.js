const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

// 新しいメッセージが来たとき通知
exports.sendMessageNotification = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data.data();
    if (message.from === "me") return;

    const recipientUid = message.recipientUid;
    if (!recipientUid) return;

    const tokenDoc = await admin.firestore()
      .doc(`users/${recipientUid}/tokens/fcm`)
      .get();

    if (!tokenDoc.exists) return;
    const { token } = tokenDoc.data();

    await admin.messaging().send({
      token,
      notification: {
        title: "新しいメッセージ",
        body: message.text || "📷 写真が届きました",
      },
      webpush: {
        fcmOptions: { link: "https://swapru.vercel.app/" }
      }
    });
  }
);

// 取引ステータス変更時通知
exports.sendTradeNotification = onDocumentUpdated(
  "chats/{chatId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.tradeStatus === after.tradeStatus) return;

    const recipientUid = after.partnerUid;
    if (!recipientUid) return;

    const tokenDoc = await admin.firestore()
      .doc(`users/${recipientUid}/tokens/fcm`)
      .get();

    if (!tokenDoc.exists) return;
    const { token } = tokenDoc.data();

    const messages = {
      "スワプる！": "🔁 スワプる申請が届きました！",
      "発送中": "📦 相手が発送しました！",
      "受取確認": "✅ 受け取り確認をお願いします",
      "評価": "⭐ 評価をお願いします",
      "完了": "🎉 スワプる完了！",
    };

    const body = messages[after.tradeStatus];
    if (!body) return;

    await admin.messaging().send({
      token,
      notification: { title: "Swapru", body },
      webpush: {
        fcmOptions: { link: "https://swapru.vercel.app/" }
      }
    });
  }
);