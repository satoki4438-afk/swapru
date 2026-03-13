import { useState, useRef, useEffect, useCallback } from "react";
import { auth, provider, db, storage, messaging, getToken, onMessage } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, onSnapshot, query, orderBy, where, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── AFFILIATE ADS ───────────────────────────────────────────────────────────

const AFFILIATE_ADS = [
  { id: "af1", brand: "Amazon", tag: "PR", title: "Amazonで関連商品をチェック", desc: "交換できなかったものは買い足しで解決！", image: "📦", cta: "Amazonで見る →", url: "https://www.amazon.co.jp/?tag=satoki7700-22", color: ["#FF9900", "#e07800"], category: null },
];

const CATEGORIES = ["すべて", "📷 カメラ・映像", "🎵 音楽・楽器", "🎮 ゲーム", "💻 スマホ・PC・家電", "👕 ファッション", "⛺ アウトドア・スポーツ", "📚 本・CD・メディア", "🧸 ホビー・コレクション", "🍳 キッチン・日用品", "🎁 お中元・お歳暮", "📦 その他"];
const SUB_CATEGORIES = {
  "📷 カメラ・映像": ["フィルムカメラ", "デジカメ", "ミラーレス", "一眼レフ", "レンズ", "三脚・アクセサリー", "ドローン", "その他"],
  "🎵 音楽・楽器": ["ギター（エレキ）", "ギター（アコ）", "ベース", "キーボード・シンセ", "ドラム・打楽器", "管楽器", "DJ機材", "その他"],
  "🎮 ゲーム": ["本体・周辺機器", "ソフト", "レトロゲーム", "その他"],
  "💻 スマホ・PC・家電": ["スマホ", "タブレット", "ノートPC", "イヤホン・ヘッドホン", "スピーカー", "周辺機器", "その他"],
  "👕 ファッション": ["メンズ", "レディース", "スニーカー", "バッグ", "時計・アクセ", "その他"],
  "⛺ アウトドア・スポーツ": ["キャンプ用品", "登山", "釣り", "自転車", "サーフィン・ウィンタースポーツ", "その他"],
  "📚 本・CD・メディア": ["漫画・小説", "専門書", "雑誌", "CD・レコード", "DVD・Blu-ray", "その他"],
  "🧸 ホビー・コレクション": ["プラモデル", "フィギュア・グッズ", "トレカ", "アート・工芸", "手芸・ソーイング", "その他"],
  "🍳 キッチン・日用品": ["調理器具", "食器", "収納", "掃除用品", "その他"],
  "🎁 お中元・お歳暮": ["食品・飲料", "お酒", "スイーツ", "日用品ギフト", "その他"],
  "📦 その他": ["その他"],
};
const CONDITIONS = ["新品・未使用", "ほぼ新品", "良好", "目立つ傷あり", "傷・汚れあり"];
const PREFECTURES = ["東京都", "神奈川県", "大阪府", "愛知県", "福岡県", "北海道", "宮城県", "埼玉県", "千葉県", "京都府", "兵庫県", "広島県", "長野県"];

function getAdsForCategory() { return AFFILIATE_ADS; }
function getMatchReasons(item, myItems, wantKeywords = []) {
  const reasons = [];
  for (const mi of myItems) for (const w of item.wantItems || [])
    if (mi.keywords?.some(k => w.includes(k) || k.includes(w))) {
      const safeImg = mi.image?.startsWith?.("http") ? "📦" : (mi.image || "📦");
      reasons.push({ myItem: mi.title, myImage: safeImg, want: w });
    }
  for (const kw of wantKeywords.filter(Boolean)) {
    if (item.title?.includes(kw) || item.category?.includes(kw) || item.wantItems?.some(w => w.includes(kw))) {
      if (!reasons.some(r => r.want === kw)) reasons.push({ myItem: "欲しいもの", myImage: "🙋", want: kw });
    }
  }
  return reasons;
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

function AffiliateCard({ ad, compact }) {
  const click = () => window.open(ad.url, "_blank");
  if (compact) return (
    <div onClick={click} className="bp" style={{ background: `linear-gradient(135deg,${ad.color[0]},${ad.color[1]})`, borderRadius: 11, padding: "10px 13px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 7 }}>
      <span style={{ fontSize: 22 }}>{ad.image}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 1 }}>
          <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 4, padding: "1px 5px", fontSize: 8, fontWeight: 700, color: "#fff" }}>{ad.tag}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.75)", fontWeight: 600 }}>{ad.brand}</span>
        </div>
        <p style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{ad.title}</p>
      </div>
      <span style={{ color: "rgba(255,255,255,.15)", fontSize: 13, fontWeight: 700 }}>→</span>
    </div>
  );
  return (
    <div onClick={click} className="bp" style={{ background: `linear-gradient(135deg,${ad.color[0]},${ad.color[1]})`, borderRadius: 14, padding: 14, cursor: "pointer", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: "#fff" }}>{ad.tag}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.75)", fontWeight: 600 }}>{ad.brand}</span>
        </div>
        <span style={{ fontSize: 22 }}>{ad.image}</span>
      </div>
      <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{ad.title}</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,.75)", marginBottom: 10 }}>{ad.desc}</p>
      <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{ad.cta}</span>
      </div>
    </div>
  );
}

function ItemCard({ item, liked, onLike, onClick, delay = 0 }) {
  return (
    <div className="ph" onClick={onClick} style={{ background: "#1e2130", borderRadius: 13, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.4)", animation: `up .34s ease ${delay}ms both` }}>
      <div style={{ background: "linear-gradient(135deg,#1a1d27,#252836)", height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, position: "relative", overflow: "hidden" }}>
        {item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(item.image, 48)}
        <button onClick={e => onLike(item.id, e)} style={{ position: "absolute", top: 5, right: 5, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 26, height: 26, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {liked ? "❤️" : "🤍"}
        </button>
      </div>
      <div style={{ padding: "8px 9px 10px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#e8eaf0", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</p>
        <div style={{ background: "#0f1117", borderRadius: 6, padding: "3px 7px" }}>
          <p style={{ fontSize: 9, color: "#6a58f0", fontWeight: 700 }}>⟳ {item.wantItems?.[0]} など</p>
        </div>
      </div>
    </div>
  );
}

function imgSafe(src, size = 36) {
  if (!src) return <span style={{ fontSize: size * 0.7 }}>📦</span>;
  if (typeof src === "string" && src.startsWith("http")) return <img src={src} style={{ width: size, height: size, objectFit: "cover", borderRadius: 6, display: "block" }} />;
  return <span style={{ fontSize: size * 0.7 }}>{src}</span>;
}

export default function SwapApp() {
  // Auth
  const [authState, setAuthState] = useState("landing");
  const [loginMethod, setLoginMethod] = useState(null);
  const [user, setUser] = useState(null);

  // Navigation
  const [view, setView] = useState("home");
  const [listTab, setListTab] = useState("offer");
  const [mypageTab, setMypageTab] = useState("listings");

  // Data
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerReviews, setOwnerReviews] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [likedItems, setLikedItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [threads, setThreads] = useState([]);
  const [openThread, setOpenThread] = useState(null);
  const openThreadRef = useRef(null);
  useEffect(() => { openThreadRef.current = openThread; }, [openThread]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  // Modals
  const [showPostModal, setShowPostModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [postType, setPostType] = useState("offer");
  const [showTradeModal, setShowTradeModal] = useState(null);
  const [selectedMyItem, setSelectedMyItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showReportModal, setShowReportModal] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reports, setReports] = useState([]);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [applications, setApplications] = useState([]);
  const [cancelCount, setCancelCount] = useState(0);
  const [myReviews, setMyReviews] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const ADMIN_EMAIL = "satoki4438@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Profile settings state
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", location: "東京都", locationPrivate: false, notify_message: true, notify_match: true, notify_news: false, avatarUrl: null, avatarEmoji: null, preferredCategories: [], wantKeywords: ["", "", ""] });

  // Post form
  const [postForm, setPostForm] = useState({ title: "", category: "📷 カメラ・映像", subCategory: "", condition: "良好", detail: "", wantItems: "", image: "📷", imageUrls: [], uploading: false, expiryDate: "", shippingNote: "常温OK" });

  const [toast, setToast] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  const [shareCount, setShareCount] = useState(0);
  const [boostCredits, setBoostCredits] = useState(0);
  const [boostedItemId, setBoostedItemId] = useState(null);
  const [boostExpiry, setBoostExpiry] = useState(null);
  const [legalModal, setLegalModal] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleCancelChat = useCallback(async () => {
    const thread = openThreadRef.current;
    if (!thread) return;
    try {
      const fid = thread.firestoreId;
      if (fid) {
        await updateDoc(doc(db, "chats", fid), { tradeStatus: "キャンセル", updatedAt: serverTimestamp() });
        await addDoc(collection(db, "chats", fid, "messages"), { from: "system", text: "🚫 交渉がキャンセルされました", time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }), createdAt: serverTimestamp() });
      }
    } catch(e) { console.error("cancel error:", e); }
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    if (window._chatUnsub) { window._chatUnsub(); window._chatUnsub = null; }
    setOpenThread(null);
    setView("messages");
    showToast("キャンセルしました");
  }, []);

  const submitApplication = async (item, myItem, message) => {
    if (!myItem) { showToast("⚠️ 提供するアイテムを選んでください"); return; }
    if (item.ownerUid === user?.uid || item.owner === user?.name) { showToast("⚠️ 自分の出品には申し込めません"); return; }
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const itemOwnerUid = item.ownerUid && item.ownerUid !== "seed" ? item.ownerUid : item.firestoreOwnerUid || "";
    const app = {
      itemId: item.firestoreId || item.id, itemTitle: item.title, itemOwner: item.owner, itemImage: item.image,
      itemOwnerUid,
      myItemId: myItem.firestoreId || myItem.id, myItemTitle: myItem.title, myItemImage: myItem.image || "📦",
      applicant: user?.name || "匿名", applicantUid: user?.uid, applicantAvatar: user?.avatar || "U",
      message, status: "申し込み中",
      deadline: deadline.toISOString(),
      createdAt: serverTimestamp(),
    };
    try {
      const docRef = await addDoc(collection(db, "applications"), app);
      setApplications(prev => [...prev, { ...app, id: docRef.id, createdAt: now.toISOString() }]);
    } catch(e) {
      setApplications(prev => [...prev, { ...app, id: Date.now(), createdAt: now.toISOString() }]);
    }
    setShowTradeModal(null);
    showToast("✅ 申し込みました！24時間以内に返答があります");
    setTimeout(() => setView("messages"), 800);
  };

  const respondToApplication = async (appId, response) => {
    if (response === "交渉する") {
      const app = applications.find(a => a.id === appId);
      const safeItemImage = app?.itemImage?.startsWith("http") ? "📦" : (app?.itemImage || "📦");
      const safeMyItemImage = app?.myItemImage?.startsWith("http") ? "📦" : (app?.myItemImage || "📦");
      try {
        const chatData = {
          applicantUid: app?.applicantUid, applicantName: app?.applicant, applicantAvatar: app?.applicantAvatar,
          applicantItemTitle: app?.myItemTitle, applicantItemImage: safeMyItemImage, applicantItemId: app?.myItemId || null,
          ownerUid: user.uid, ownerName: user.name, ownerAvatar: user.avatar,
          ownerItemTitle: app?.itemTitle, ownerItemImage: safeItemImage, ownerItemId: app?.itemId || null,
          tradeStatus: "交渉中", lastMsg: "交渉が開始されました", updatedAt: serverTimestamp(),
          messages: [], unreadCount: { [app?.applicantUid]: 1 }
        };
        const chatRef = await addDoc(collection(db, "chats"), chatData);
        await updateDoc(doc(db, "applications", appId), { status: "交渉中" });
      } catch(e) {
        console.error(e);
      }
      showToast("🤝 交渉を開始しました！チャットで詳細を決めましょう");
    } else if (response === "保留") {
      const holdCount = applications.filter(a => a.status === "保留中").length;
      if (holdCount >= 3) { showToast("⚠️ 保留は最大3件までです"); return; }
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: "保留中" } : a));
      try { await updateDoc(doc(db, "applications", appId), { status: "保留中" }); } catch(e) {}
      showToast("📋 保留にしました（最大3件・48時間）");
    } else if (response === "ごめんなさい") {
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: "お断り" } : a));
      try { await updateDoc(doc(db, "applications", appId), { status: "お断り" }); } catch(e) {}
      showToast("🙏 お断りしました。相手に通知が届きます");
    }
  };

  const cancelApplication = async (appId) => {
    const newCount = cancelCount + 1;
    setCancelCount(newCount);
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: "キャンセル" } : a));
    try {
      const app = applications.find(a => a.id === appId);
      if (app?.firestoreId) {
        await updateDoc(doc(db, "applications", app.firestoreId), { status: "キャンセル", updatedAt: serverTimestamp() });
      }
    } catch(e) { console.error("cancelApplication error:", e); }
    if (newCount >= 3) showToast("⚠️ キャンセルが多いです。警告バッジが付く場合があります");
    else showToast("キャンセルしました");
  };

  const blockUser = async (userName, uid) => {
    if (blockedUsers.includes(userName)) { showToast("すでにブロック済みです"); return; }
    setBlockedUsers(prev => [...prev, userName]);
    try {
      await setDoc(doc(db, "users", user.uid, "blocks", uid || userName), { userName, blockedAt: new Date().toISOString() });
    } catch(e) {}
    setSelectedOwner(null);
    showToast(`🚫 ${userName} をブロックしました`);
  };

  const submitReport = async () => {
    if (!reportReason) { showToast("⚠️ 通報理由を選択してください"); return; }
    const report = { id: Date.now(), itemId: showReportModal.id, itemTitle: showReportModal.title, itemOwner: showReportModal.owner, reason: reportReason, reportedBy: user?.email || "匿名", createdAt: new Date().toISOString(), status: "未対応" };
    try {
      await addDoc(collection(db, "reports"), report);
      setReports(prev => [...prev, report]);
    } catch(e) { console.error(e); }
    setShowReportModal(null);
    setReportReason("");
    showToast("🚨 通報を受け付けました。確認後対応します。");
  };

  const adminDeleteItem = async (item, reason) => {
    try {
      await addDoc(collection(db, "notifications"), { uid: item.ownerUid, type: "deletion", message: `⚠️ ご出品の「${item.title}」は利用規約違反（${reason}）のため削除されました。ご不明な点はお問い合わせください。`, createdAt: new Date().toISOString(), read: false });
      showToast(`🗑️ 「${item.title}」を削除しました`);
    } catch(e) { showToast("❌ 削除に失敗しました"); }
  };

  const adminBanUser = async (userEmail, ownerUid) => {
    try {
      await addDoc(collection(db, "notifications"), { uid: ownerUid, type: "ban", message: "🚫 利用規約違反が確認されたため、アカウントを停止しました。お問い合わせはcontact@swapru.appまで。", createdAt: new Date().toISOString(), read: false });
      await addDoc(collection(db, "bans"), { email: userEmail, uid: ownerUid, bannedAt: new Date().toISOString() });
      showToast(`🚫 ${userEmail} をBANしました`);
    } catch(e) { showToast("❌ BANに失敗しました"); }
  };

  const handleShare = async (item) => {
    const url = `https://swapru.vercel.app/`;
    const text = `【Swapru】${item.title} を交換したい！\n交換希望：${item.wantItems?.join("・") || "相談"}\n`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text, url });
      } else {
        await navigator.clipboard.writeText(text + url);
        showToast("📋 リンクをコピーしました！");
      }
      const newCount = shareCount + 1;
      setShareCount(newCount);
      if (newCount % 3 === 0 && boostCredits < 2) {
        setBoostCredits(c => c + 1);
        showToast("🎉 シェア3回達成！検索上位権利を獲得しました🚀");
      } else {
        const remaining = 3 - (newCount % 3);
        showToast(`📤 シェアしました！あと${remaining}回で上位表示権利GET`);
      }
    } catch(e) { if (e.name !== "AbortError") showToast("❌ シェアに失敗しました"); }
  };

  const handleBoost = (itemId) => {
    if (boostCredits <= 0) { showToast("⚠️ 上位表示権利がありません（シェア3回でGET！）"); return; }
    if (boostedItemId === itemId) { showToast("⚠️ すでに上位表示中です"); return; }
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
    setBoostedItemId(itemId);
    setBoostExpiry(expiry);
    setBoostCredits(c => c - 1);
    showToast("🚀 48時間の検索上位表示を開始しました！");
  };

  const toggleLike = async (id, e) => {
    e.stopPropagation();
    const isLiked = likedItems.includes(id);
    setLikedItems(p => isLiked ? p.filter(i => i !== id) : [...p, id]);
    if (!user) return;
    try {
      if (isLiked) {
        await deleteDoc(doc(db, "users", user.uid, "likes", String(id)));
      } else {
        const item = allItems.find(i => i.id == id) || allItems.find(i => String(i.id) === String(id));
        await setDoc(doc(db, "users", user.uid, "likes", String(id)), { itemId: id, title: item?.title || "", image: item?.image || "📦", imageUrls: item?.imageUrls || [], savedAt: serverTimestamp() });
      }
    } catch(e) { console.log("like error:", e); }
  };

  const loadLikes = async (uid) => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "likes"));
      setLikedItems(snap.docs.map(d => d.data().itemId));
    } catch(e) {}
  };

  const openDetail = (item) => { if (!item) return; setSelectedItem(item); setView("detail"); setSelectedMyItem(null); window.scrollTo(0, 0); };
  const matchedItems = allItems.filter(item => getMatchReasons(item, myItems, profileForm.wantKeywords).length > 0);
  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  const filteredItems = allItems.filter(item => item.status !== "交換済み").filter(item => !blockedUsers.includes(item.owner)).filter(item => item.ownerUid !== user?.uid && item.owner !== user?.name).filter(item => {
    const mc = selectedCategory === "すべて" || item.category === selectedCategory;
    const ms = !searchQuery || item.title.includes(searchQuery) || item.wantItems?.some(w => w.includes(searchQuery));
    return mc && ms;
  }).sort((a, b) => {
    if (a.id === boostedItemId) return -1;
    if (b.id === boostedItemId) return 1;
    return 0;
  });

  // Androidバックボタン横取り
  useEffect(() => {
    const handleBack = () => {
      if (view === "chat") { if (window._chatUnsub) { window._chatUnsub(); window._chatUnsub = null; } setConfirmDialog(null); setView("messages"); }
      else if (view === "messages" || view === "list" || view === "mypage") { setView("home"); }
      else if (selectedItem) { setSelectedItem(null); }
      else if (selectedOwner) { setSelectedOwner(null); }
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [view, selectedItem, selectedOwner]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [openThread]);

  // FCM通知セットアップ
  useEffect(() => {
    if (!user) return;
    const setupFCM = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const token = await getToken(messaging, { vapidKey: "BEdUq87Qs4gWdyw4psTHk8goAJn-znUGzZ3nQ3F_SWVo97QXyPo_GkhZJvHE8lSqyfWcnzUBfbSOLdkUyzY-ZZM" });
        if (token) {
          setFcmToken(token);
          await setDoc(doc(db, "users", user.uid, "tokens", "fcm"), { token, updatedAt: new Date().toISOString() });
        }
      } catch(e) { console.log("FCM setup failed:", e); }
    };
    setupFCM();
    const unsubscribe = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (title) showToast(`🔔 ${title}：${body}`);
    });
    return () => unsubscribe();
  }, [user]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !openThread) return;
    const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const newMsg = { id: Date.now(), from: "me", text: chatInput.trim(), time: now, read: true };
    setThreads(prev => prev.map(t => t.id === openThread.id ? { ...t, messages: [...t.messages, newMsg], lastMsg: newMsg.text, lastTime: now, unread: 0 } : t));
    setOpenThread(prev => ({ ...prev, messages: [...prev.messages, newMsg] }));
    setChatInput("");
    if (openThread.firestoreId) {
      try {
        await addDoc(collection(db, "chats", openThread.firestoreId, "messages"), {
          from: user.uid, text: newMsg.text, createdAt: serverTimestamp(), read: false
        });
        const partnerUid = openThread.partnerUid;
        await updateDoc(doc(db, "chats", openThread.firestoreId), {
          lastMsg: newMsg.text, updatedAt: serverTimestamp(),
          ...(partnerUid ? { [`unreadCount.${partnerUid}`]: (openThread.unread || 0) + 1 } : {})
        });
      } catch(e) { console.error("メッセージ保存失敗:", e); }
    }
  };

  const openChat = async (thread) => {
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: 0 } : t));
    setOpenThread({ ...thread, unread: 0 });
    setView("chat");
    if (thread.firestoreId && user) {
      try {
        await updateDoc(doc(db, "chats", thread.firestoreId), {
          [`unreadCount.${user.uid}`]: 0
        });
      } catch(e) {}
      const q = query(collection(db, "chats", thread.firestoreId, "messages"), orderBy("createdAt", "asc"));
      const unsub = onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(d => ({
          id: d.id,
          from: d.data().from === user.uid ? "me" : (d.data().from === "system" ? "system" : "them"),
          text: d.data().text,
          time: d.data().createdAt ? new Date(d.data().createdAt.toDate()).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "今",
          read: d.data().read || false
        }));
        setOpenThread(prev => prev ? { ...prev, messages: msgs } : prev);
      });
      const unsub2 = onSnapshot(doc(db, "chats", thread.firestoreId), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setOpenThread(prev => prev ? { ...prev, tradeStatus: data.tradeStatus || prev.tradeStatus, status: data.tradeStatus || prev.status, swapruBy: data.swapruBy || prev.swapruBy || [], reviewedBy: data.reviewedBy || prev.reviewedBy || [] } : prev);
        setThreads(prev => prev.map(t => t.firestoreId === thread.firestoreId ? { ...t, tradeStatus: data.tradeStatus || t.tradeStatus, status: data.tradeStatus || t.status, swapruBy: data.swapruBy || t.swapruBy || [], reviewedBy: data.reviewedBy || t.reviewedBy || [] } : t));
      });
      window._chatUnsub = () => { unsub(); unsub2(); };
    }
  };

  // Firestore: 出品データ読み込み
  const loadMyItems = async (uid) => {
    if (!uid) return;
    setLoadingItems(true);
    try {
      const snap = await getDocs(collection(db, "users", uid, "items"));
      const items = snap.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
      setMyItems(items);
    } catch(e) { console.error(e); }
    setLoadingItems(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid, "profile", "main"), {
        name: profileForm.name,
        bio: profileForm.bio,
        location: profileForm.location,
        locationPrivate: profileForm.locationPrivate,
        wantKeywords: profileForm.wantKeywords,
        preferredCategories: profileForm.preferredCategories,
        updatedAt: serverTimestamp()
      });
      showToast("✅ プロフィールを保存しました");
    } catch(e) { showToast("❌ 保存に失敗しました"); }
  };

  const loadMyReviews = async (uid) => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "reviews"));
      const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyReviews(reviews);
    } catch(e) { console.error("loadMyReviews error:", e); }
  };

  const loadProfile = async (uid) => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "profile"));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setProfileForm(f => ({ ...f, ...data, wantKeywords: data.wantKeywords || ["", "", ""] }));
      }
    } catch(e) {}
  };

  const deleteMyItem = async (item) => {
    try {
      if (item.firestoreId && user) {
        await deleteDoc(doc(db, "users", user.uid, "items", item.firestoreId));
        try { await deleteDoc(doc(db, "posts", String(item.id))); } catch(e) {}
      }
      setMyItems(prev => prev.filter(i => i.id !== item.id));
      setAllItems(prev => prev.filter(i => i.id !== item.id));
      showToast("🗑️ 削除しました");
    } catch(e) { showToast("❌ 削除に失敗しました"); }
  };

  const toggleItemStatus = async (item) => {
    const newStatus = item.status === "出品中" ? "非公開" : "出品中";
    try {
      if (item.firestoreId && user) {
        await updateDoc(doc(db, "users", user.uid, "items", item.firestoreId), { status: newStatus });
      }
      setMyItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      showToast("✅ ステータスを変更しました");
    } catch(e) { showToast("❌ 変更に失敗しました"); }
  };

  const handleLogin = async () => {
    try {
      setAuthState("logging_in");
      const result = await signInWithPopup(auth, provider);
      const u = {
        uid: result.user.uid,
        name: result.user.displayName,
        email: result.user.email,
        avatar: result.user.displayName?.charAt(0) || "U",
        method: "google"
      };
      setUser(u);
      setProfileForm(f => ({ ...f, name: u.name, location: "東京都" }));
      setAuthState("app");
      showToast("✅ Googleでログインしました");
      loadMyItems(result.user.uid);
      loadLikes(result.user.uid);
      loadProfile(result.user.uid);
      loadMyReviews(result.user.uid);
    } catch (e) {
      setAuthState("landing");
      showToast("❌ ログインに失敗しました");
    }
  };

  // ログイン状態を永続化
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          avatar: firebaseUser.displayName?.charAt(0) || "U",
          method: "google"
        };
        setUser(u);
        setProfileForm(f => ({ ...f, name: u.name || f.name, location: f.location || "東京都" }));
        setAuthState("app");
        loadMyItems(firebaseUser.uid);
        loadLikes(firebaseUser.uid);
        loadProfile(firebaseUser.uid);
        loadMyReviews(firebaseUser.uid);
      } else {
        setAuthState("landing");
      }
    });
    return () => unsub();
  }, []);

  // 全出品をFirestoreからリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), firestoreId: d.id })).filter(i => i.ownerUid !== "seed");
      setAllItems(items);
    }, (err) => {
      console.log("posts読み込みエラー:", err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const chats = snap.docs
        .map(d => ({ ...d.data(), firestoreId: d.id }))
        .filter(c => c.ownerUid === user.uid || c.applicantUid === user.uid);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const mapped = chats.filter(c => {
        if (c.tradeStatus === "完了" && c.updatedAt?.toDate?.() < thirtyDaysAgo) return false;
        return true;
      }).map(c => ({
        id: c.firestoreId,
        firestoreId: c.firestoreId,
        partner: c.ownerUid === user.uid ? c.applicantName : c.ownerName,
        partnerAvatar: c.ownerUid === user.uid ? c.applicantAvatar : c.ownerAvatar,
        partnerUid: c.ownerUid === user.uid ? c.applicantUid : c.ownerUid,
        partnerItem: c.ownerUid === user.uid ? c.applicantItemTitle : c.ownerItemTitle,
        partnerItemId: c.ownerUid === user.uid ? c.applicantItemId : c.ownerItemId,
        partnerItemImage: (() => { const img = c.ownerUid === user.uid ? c.applicantItemImage : c.ownerItemImage; return img?.startsWith?.("http") ? "📦" : (img || "📦"); })(),
        myItem: c.ownerUid === user.uid ? c.ownerItemTitle : c.applicantItemTitle,
        myItemId: c.ownerUid === user.uid ? c.ownerItemId : c.applicantItemId,
        myItemImage: (() => { const img = c.ownerUid === user.uid ? c.ownerItemImage : c.applicantItemImage; return img?.startsWith?.("http") ? "📦" : (img || "📦"); })(),
        status: c.tradeStatus || "交渉中",
        tradeStatus: c.tradeStatus || "交渉中",
        ownerUid: c.ownerUid,
        swapruBy: c.swapruBy || [],
        reviewedBy: c.reviewedBy || [],
        unread: c.unreadCount?.[user.uid] || 0,
        lastMsg: c.lastMsg || "",
        lastTime: c.updatedAt ? new Date(c.updatedAt.toDate()).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "",
        messages: c.messages || [],
      }));
      setThreads(mapped.sort((a, b) => { if (b.unread !== a.unread) return b.unread - a.unread; return (b.lastTime || "").localeCompare(a.lastTime || ""); }));
    });
    return () => unsub();
  }, [user]);

  // 申し込みのリアルタイム連携
  useEffect(() => {
    if (!user) return;
    const qReceived = query(collection(db, "applications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qReceived, (snap) => {
      const apps = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter(a =>
          (a.itemOwnerUid === user.uid || a.applicantUid === user.uid) &&
          a.status !== "キャンセル"
        );
      setApplications(apps);
    });
    return () => unsub();
  }, [user]);

  // ── LANDING ──
  if (authState !== "app") return (
    <div style={{ fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", background: "linear-gradient(160deg,#1a1208 0%,#2d1f0e 50%,#1a1208 100%)", minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} .bp:active{transform:scale(.96)}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .au{animation:up .4s ease both}
      `}</style>
      <div style={{ position: "absolute", top: -60, left: -60, width: 250, height: 250, background: "radial-gradient(circle,rgba(124,106,255,.12) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div className="au" style={{ animationDelay: "0ms", textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 72, height: 72, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(124,106,255,.35)" }}>⟳</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 38, color: "#f5f0e8", letterSpacing: -1 }}>Swap<span style={{ color: "#d4a574" }}>ru</span></h1>
        <p style={{ color: "#c4a882", fontSize: 13, marginTop: 8 }}>お金を使わない、新しい交換体験</p>
      </div>
      <div className="au" style={{ animationDelay: "80ms", width: "100%", marginBottom: 36 }}>
        {[["⟳", "手数料ゼロ", "出品・交換・メッセージすべて無料"], ["🎯", "ザッピングして発見", "AIに頼らず、自分で探す楽しさ"], ["🙋", "欲しいも投稿できる", "「これ頂戴」リクエスト機能つき"]].map(([icon, ttl, desc]) => (
          <div key={ttl} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, background: "rgba(124,106,255,.12)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
            <div><p style={{ color: "#0f1117", fontSize: 13, fontWeight: 700 }}>{ttl}</p><p style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>{desc}</p></div>
          </div>
        ))}
      </div>
      {authState === "landing" ? (
        <div className="au" style={{ animationDelay: "160ms", width: "100%" }}>
          <button onClick={() => handleLogin()} className="bp" style={{ width: "100%", background: "#1e2130", border: "none", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 11, boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0", flex: 1, textAlign: "center" }}>Googleでログイン</span>
          </button>
          <p style={{ color: "#8892aa", fontSize: 10, textAlign: "center", lineHeight: 1.7 }}>ログインで<span onClick={() => setLegalModal("terms")} style={{ color: "#7c6aff", cursor: "pointer" }}>利用規約</span>・<span onClick={() => setLegalModal("privacy")} style={{ color: "#7c6aff", cursor: "pointer" }}>プライバシーポリシー</span>に同意</p>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "3px solid #7c6aff", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 12px", animation: "spin .8s linear infinite" }} />
          <p style={{ color: "#7c6aff", fontWeight: 700, fontSize: 14 }}>Googleで認証中...</p>
        </div>
      )}
    </div>
  );

  // ── CHAT SCREEN (full screen) ──
  if (view === "chat" && openThread) {
    const thread = openThread;
    const ts = openThread.tradeStatus || "交渉中";
    const TRADE_STEPS = ["申し込み", "交渉中", "発送中", "受取確認", "評価", "完了"];
    const stepIdx = TRADE_STEPS.indexOf(ts);

    const updateTradeStatus = async (newStatus, extraMsg) => {
      const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      const sysMsg = { id: Date.now(), from: "system", text: extraMsg, time: now, read: true };
      setOpenThread(prev => ({ ...prev, tradeStatus: newStatus, status: newStatus, messages: [...prev.messages, sysMsg] }));
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, tradeStatus: newStatus, status: newStatus } : t));
      if (thread.firestoreId) {
        try {
          await updateDoc(doc(db, "chats", thread.firestoreId), { tradeStatus: newStatus, lastMsg: extraMsg, updatedAt: serverTimestamp() });
        } catch(e) {}
      }
    };

    return (
      <div style={{ fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", background: "#0a0c14", height: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
          *{box-sizing:border-box;margin:0;padding:0} .bp:active{transform:scale(.96)}
          @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
          @keyframes fi{from{opacity:0}to{opacity:1}}
          @keyframes spin{to{transform:rotate(360deg)}}
          input,textarea{outline:none}
        `}</style>

        {/* Chat header */}
        <div style={{ background: "#1a1208", padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, boxShadow: "0 2px 20px rgba(0,0,0,.6)" }}>
          <button onClick={() => { if (window._chatUnsub) { window._chatUnsub(); window._chatUnsub = null; } setConfirmDialog(null); setView("messages"); }} style={{ background: "none", border: "none", color: "#7c6aff", fontSize: 20, cursor: "pointer", padding: "4px 8px 4px 0" }}>←</button>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 14, flexShrink: 0, cursor: "pointer" }} onClick={() => setSelectedOwner({ name: thread.partner, avatar: thread.partnerAvatar, uid: thread.partnerUid || "" })}>{thread.partnerAvatar}</div>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setSelectedOwner({ name: thread.partner, avatar: thread.partnerAvatar, uid: thread.partnerUid || "" })}>
            <p style={{ color: "#0f1117", fontWeight: 700, fontSize: 14 }}>{thread.partner}</p>
            <p style={{ color: "#6b7280", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.partnerItemImage} {thread.partnerItem}</p>
          </div>
          <button onClick={() => { if (window.confirm(`${thread.partner} をブロックしますか？`)) blockUser(thread.partner, ""); }} style={{ background: "none", border: "none", color: "#8892aa", fontSize: 11, cursor: "pointer", padding: "4px 6px" }}>🚫</button>
        </div>

        {/* ステータスレール */}
        <div style={{ background: "#1e2130", borderBottom: "1px solid #252836", padding: "10px 12px", flexShrink: 0, overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: "max-content", gap: 0 }}>
            {TRADE_STEPS.map((step, i) => {
              const done = i < stepIdx;
              const current = i === stepIdx;
              return (
                <div key={step} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "#7c6aff" : current ? "#7c6aff" : "#252836", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: done || current ? "#fff" : "#4a5068", fontWeight: 700, flexShrink: 0 }}>
                      {done ? "✓" : i + 1}
                    </div>
                    <p style={{ fontSize: 8, fontWeight: current ? 700 : 400, color: current ? "#e8eaf0" : done ? "#7c6aff" : "#4a5068", whiteSpace: "nowrap" }}>{step}</p>
                  </div>
                  {i < TRADE_STEPS.length - 1 && <div style={{ width: 18, height: 2, background: done ? "#7c6aff" : "#252836", marginBottom: 11, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade context bar */}
        <div style={{ background: "#1e2130", padding: "10px 14px", borderBottom: "1px solid #252836", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#1a1d27,#252836)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{thread.myItemImage}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 9, color: "#6b7280" }}>あなたが提供</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#e8eaf0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.myItem}</p>
            </div>
          </div>
          <span style={{ color: "#6a58f0", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>⟳</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <p style={{ fontSize: 9, color: "#6b7280" }}>相手が提供</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#e8eaf0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.partnerItem}</p>
            </div>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#1a1d27,#252836)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{thread.partnerItemImage}</div>
          </div>
        </div>

        {/* アクションバー（ステータス別） */}
        {ts === "交渉中" && (
          <div style={{ background: "#fffbeb", borderBottom: "1px solid #fcd34d", padding: "9px 14px", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <p style={{ fontSize: 11, color: "#92400e", flex: 1 }}>💬 条件が合ったら「スワプる！」を押しましょう</p>
              <button onClick={() => setConfirmDialog({ message: "交渉をキャンセルしますか？\nチャットは非表示になります。", onOk: handleCancelChat })} className="bp" style={{ background: "none", border: "1px solid #f97316", borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#f97316", cursor: "pointer", flexShrink: 0 }}>🚫 やめる</button>
              <button onClick={async () => {
                const myUid = user.uid;
                const currentThread = openThreadRef.current;
                const swapruBy = currentThread?.swapruBy || [];
                if (swapruBy.includes(myUid)) { showToast("すでにスワプる！を押しています。相手の返答を待ちましょう"); return; }
                const newSwapruBy = [...new Set([...swapruBy, myUid])];
                const bothPressed = newSwapruBy.length >= 2;
                if (thread.firestoreId) await updateDoc(doc(db, "chats", thread.firestoreId), { swapruBy: newSwapruBy, updatedAt: serverTimestamp() });
                if (bothPressed) {
                  await updateTradeStatus("発送中", "🎉 両者スワプる成立！お互い発送の準備をしましょう");
                } else {
                  if (thread.firestoreId) await addDoc(collection(db, "chats", thread.firestoreId, "messages"), { from: "system", text: `🔁 ${user.name}さんがスワプる！を押しました`, time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }), createdAt: serverTimestamp() });
                  showToast("🔁 スワプる！を押しました。相手も押したら発送へ進みます");
                }
              }} className="bp" style={{ background: (thread.swapruBy || []).includes(user.uid) ? "#252836" : "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 9, padding: "7px 13px", color: "#e8eaf0", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
                {(thread.swapruBy || []).includes(user.uid) ? "⏳ 相手待ち" : "🔁 スワプる！"}
              </button>
            </div>
          </div>
        )}
        {ts === "発送中" && (
          <div style={{ background: "#0d1829", borderBottom: "1px solid #1e3a5f", padding: "9px 14px", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: "#60a5fa", flex: 1 }}>📦 発送が完了したら押してください</p>
              <button onClick={() => setConfirmDialog({ message: "交渉をキャンセルしますか？\nチャットは非表示になります。", onOk: handleCancelChat })} className="bp" style={{ background: "none", border: "1px solid #f97316", borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#f97316", cursor: "pointer", flexShrink: 0 }}>🚫 やめる</button>
              <button onClick={() => updateTradeStatus("受取確認", "📦 発送しました！相手の受取確認を待ちましょう")} className="bp" style={{ background: "#3b82f6", border: "none", borderRadius: 9, padding: "7px 13px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>📦 発送しました</button>
            </div>
            <div style={{ background: "rgba(30,33,48,.7)", borderRadius: 9, padding: 9 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#7e22ce", marginBottom: 5 }}>🔒 住所を教えずに送る方法（匿名配送）</p>
              {[
                ["📮 郵便局留め","相手に「◯◯郵便局留め・名前」だけ教えれば住所不要。全国どこでもOK"],
                ["📦 営業所止め（ヤマト）","ヤマト営業所を送り先に指定。相手が最寄り営業所で受け取り"],
                ["🟡 PUDOロッカー","駅・コンビニの宅配ロッカーを受取先に。住所非公開で受け取れる"],
              ].map(([name, desc]) => (
                <div key={name} style={{ display: "flex", gap: 6, marginBottom: 4, background: "#f5f0ff", borderRadius: 6, padding: "4px 7px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#7e22ce", whiteSpace: "nowrap" }}>{name}</p>
                  <p style={{ fontSize: 10, color: "#a0a8c0" }}>{desc}</p>
                </div>
              ))}
              <p style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", marginBottom: 4, marginTop: 6 }}>📮 通常の発送方法</p>
              {[["📦 ヤマト宅急便","コンビニ・営業所から。追跡あり。翌日〜2日"],["📮 ゆうパック","郵便局・コンビニから。追跡・補償あり"],["✉️ ゆうメール","1kg以内 300円〜。小型向き"],["📬 クリックポスト","全国一律185円。ポスト投函。1kgまで"]].map(([name, desc]) => (
                <div key={name} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", whiteSpace: "nowrap" }}>{name}</p>
                  <p style={{ fontSize: 10, color: "#a0a8c0" }}>{desc}</p>
                </div>
              ))}
              <div style={{ marginTop: 8, background: "#e0f2fe", borderRadius: 7, padding: "8px 10px", border: "1px solid #bae6fd" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", marginBottom: 4 }}>🔒 住所を教えずに送る（LINE匿名配送）</p>
                <p style={{ fontSize: 10, color: "#0369a1", lineHeight: 1.6 }}>① チャットでLINEを交換する<br />② ヤマト「宅急便をスマホで送る」→お届け先「LINEでリクエスト」<br />③ 個人情報を「非公開」にしてリクエスト送信<br />④ 相手が住所を入力したら発送OK！</p>
                <p style={{ fontSize: 9, color: "#5a7a9a", marginTop: 4 }}>※ 送料 +110円。クロネコメンバーズ登録が必要。</p>
              </div>
              <div style={{ marginTop: 7, background: "#fef9f0", borderRadius: 7, padding: "7px 10px", border: "1px solid #fde68a" }}>
                <p style={{ fontSize: 10, color: "#92400e" }}>⚠️ 配送はユーザー間で各自手配してください。配送トラブルについて運営者は責任を負いません。</p>
              </div>
            </div>
          </div>
        )}
        {ts === "受取確認" && (
          <div style={{ background: "#0a1f14", borderBottom: "1px solid #1a4a2e", padding: "9px 14px", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#4ade80", flex: 1 }}>📬 商品は届きましたか？</p>
            <button onClick={() => updateTradeStatus("評価", "✅ 受け取り完了！お互いの評価をお願いします🌟")} className="bp" style={{ background: "#16a34a", border: "none", borderRadius: 9, padding: "7px 13px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>✅ 受け取りました</button>
          </div>
        )}
        {ts === "評価" && (thread.reviewedBy || []).includes(user.uid) && (
          <div style={{ background: "#0a1f14", borderBottom: "1px solid #1a4a2e", padding: "9px 14px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>⭐ 評価済み！相手の評価を待っています...</p>
          </div>
        )}
        {ts === "評価" && !(thread.reviewedBy || []).includes(user.uid) && (
          <div style={{ background: "#1a0a2e", borderBottom: "1px solid #3d1f6b", padding: "9px 14px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#7e22ce", marginBottom: 7, fontWeight: 600 }}>🌟 {thread.partner} さんを評価してください</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setOpenThread(prev => ({ ...prev, reviewScore: s }))} style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer", opacity: (thread.reviewScore || 0) >= s ? 1 : 0.3 }}>⭐</button>
              ))}
            </div>
            <textarea placeholder="コメントを入力（任意）" value={thread.reviewComment || ""} onChange={e => setOpenThread(prev => ({ ...prev, reviewComment: e.target.value }))} style={{ width: "100%", background: "#1e2130", border: "1px solid #e9d5ff", borderRadius: 9, padding: "8px 11px", fontSize: 12, color: "#e8eaf0", resize: "none", height: 56, marginBottom: 7 }} />
            <button onClick={async () => {
              if (!thread.reviewScore) { showToast("⭐ 星をつけてください"); return; }
              try {
                await addDoc(collection(db, "users", thread.partnerUid || thread.partner, "reviews"), {
                  fromUid: user?.uid, fromName: user?.name,
                  rating: thread.reviewScore, comment: thread.reviewComment || "",
                  itemTitle: thread.partnerItem || "", createdAt: serverTimestamp()
                });
              } catch(e) { console.log("review save error:", e); }
              try {
                let myPostId = null;
                let myItemDocId = thread.myItemId;
                if (!myItemDocId) {
                  const q = await getDocs(collection(db, "users", user.uid, "items"));
                  const found = q.docs.find(d => d.data().title === thread.myItem);
                  if (found) { myItemDocId = found.id; myPostId = found.data().postId || found.data().id?.toString(); }
                } else {
                  const snap = await getDocs(collection(db, "users", user.uid, "items"));
                  const found = snap.docs.find(d => d.id === myItemDocId);
                  if (found) myPostId = found.data().postId || found.data().id?.toString();
                }
                if (!myPostId) {
                  const found2 = myItems.find(i => i.title === thread.myItem);
                  myPostId = found2?.postId || found2?.id?.toString();
                }
                if (myPostId) {
                  try { await updateDoc(doc(db, "posts", String(myPostId)), { status: "交換済み" }); } catch(e) {}
                }
                if (myItemDocId) {
                  try { await updateDoc(doc(db, "users", user.uid, "items", myItemDocId), { status: "交換済み" }); } catch(e) {}
                }
                setMyItems(prev => prev.map(i => i.title === thread.myItem ? { ...i, status: "交換済み" } : i));

                let partnerPostId = null;
                let partnerItemDocId = thread.partnerItemId;
                if (!partnerItemDocId && thread.partnerUid) {
                  const q2 = await getDocs(collection(db, "users", thread.partnerUid, "items"));
                  const found2 = q2.docs.find(d => d.data().title === thread.partnerItem);
                  if (found2) { partnerItemDocId = found2.id; partnerPostId = found2.data().postId || found2.data().id?.toString(); }
                }
                if (!partnerPostId) {
                  const found3 = allItems.find(i => i.title === thread.partnerItem);
                  partnerPostId = found3?.postId || found3?.id?.toString();
                }
                if (partnerPostId) {
                  try { await updateDoc(doc(db, "posts", String(partnerPostId)), { status: "交換済み" }); } catch(e) {}
                }
                if (partnerItemDocId && thread.partnerUid) {
                  try { await updateDoc(doc(db, "users", thread.partnerUid, "items", partnerItemDocId), { status: "交換済み" }); } catch(e) {}
                }
                setAllItems(prev => prev.map(i => i.title === thread.partnerItem ? { ...i, status: "交換済み" } : i));
              } catch(e) { console.log("item status update error:", e); }
              const reviewedBy = [...(thread.reviewedBy || []), user.uid];
              const bothReviewed = reviewedBy.includes(thread.ownerUid || "") && reviewedBy.includes(thread.partnerUid || "");
              if (thread.firestoreId) {
                try { await updateDoc(doc(db, "chats", thread.firestoreId), { reviewedBy, updatedAt: serverTimestamp(), ...(bothReviewed ? { tradeStatus: "完了" } : {}) }); } catch(e) {}
              }
              if (bothReviewed) {
                setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, tradeStatus: "完了", status: "完了" } : t));
                if (window._chatUnsub) { window._chatUnsub(); window._chatUnsub = null; }
                showToast(`🎉 スワプる完了！${thread.reviewScore}⭐ ありがとうございました！`);
                setView("mypage");
                setMypageTab("history");
              } else {
                setOpenThread(prev => ({ ...prev, reviewedBy }));
                setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, reviewedBy } : t));
                if (window._chatUnsub) { window._chatUnsub(); window._chatUnsub = null; }
                showToast(`⭐ 評価しました！相手の評価を待っています`);
                setView("messages");
              }
            }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#a855f7,#7e22ce)", border: "none", borderRadius: 9, padding: "9px 0", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>評価を送信する</button>
          </div>
        )}
        {ts === "完了" && (
          <div style={{ background: "#0a1f14", borderBottom: "1px solid #1a5a33", padding: "9px 14px", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: 18 }}>🎉</span>
              <p style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>スワプる成立！取引が完了しました</p>
            </div>
            <button onClick={async () => {
              const text = `🎉 スワプる成立！\n${thread.myItem} ⟳ ${thread.partnerItem}\n@${thread.partner} さんとの交換が完了しました！\n#Swapru #物々交換 #スワプる`;
              if (navigator.share) { try { await navigator.share({ text, url: "https://swapru.vercel.app/" }); } catch(e) {} }
              else { await navigator.clipboard.writeText(text); showToast("📋 コピーしました！SNSに貼り付けてシェアしよう"); }
            }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#16a34a,#15803d)", border: "none", borderRadius: 9, padding: "8px 0", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📤 成立をシェアする 🎊</button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
          {thread.messages.map((msg, i) => {
            const isMe = msg.from === "me";
            const isSystem = msg.from === "system";
            if (isSystem) return (
              <div key={msg.id} style={{ textAlign: "center", margin: "10px 0", animation: `up .25s ease both` }}>
                <span style={{ background: "#0f1117", border: "1px solid #252836", borderRadius: 20, padding: "5px 14px", fontSize: 10, color: "#6b7280" }}>{msg.text}</span>
              </div>
            );
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 10, animation: `up .25s ease ${i * 30}ms both` }}>
                {!isMe && <div style={{ width: 30, height: 30, background: "#7c6aff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>{thread.partnerAvatar}</div>}
                <div style={{ maxWidth: "72%" }}>
                  {msg.imageUrl ? (
                    <img src={msg.imageUrl} style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 12, display: "block" }} />
                  ) : (
                    <div style={{ background: isMe ? "linear-gradient(135deg,#7c6aff,#6a58f0)" : "#1e2130", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 13px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
                      <p style={{ fontSize: 13, color: "#e8eaf0", lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  )}
                  <p style={{ fontSize: 9, color: "#4a5068", marginTop: 3, textAlign: isMe ? "right" : "left" }}>
                    {msg.time}{isMe && <span style={{ marginLeft: 4 }}>{msg.read ? "✓✓" : "✓"}</span>}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* アフィリエイト（チャット内） */}
        <div style={{ padding: "0 12px 8px", flexShrink: 0 }}>
          <AffiliateCard ad={AFFILIATE_ADS[0]} compact />
        </div>

        {/* Input */}
        <div style={{ background: "#1e2130", padding: "10px 12px", borderTop: "1px solid #252836", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          <input type="file" accept="image/*" ref={el => window._chatImgInput = el} style={{ display: "none" }} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;
            try {
              const storageRef = ref(storage, `chat/${user.uid}/${Date.now()}_${file.name}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
              const newMsg = { id: Date.now(), from: "me", imageUrl: url, time: now, read: false };
              setOpenThread(prev => ({ ...prev, messages: [...prev.messages, newMsg] }));
              setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, lastMsg: "📷 写真", lastTime: now } : t));
            } catch(e) { showToast("❌ 送信失敗"); }
          }} />
          <button onClick={() => window._chatImgInput?.click()} className="bp" style={{ width: 40, height: 40, background: "#0f1117", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18 }}>📷</button>
          <div style={{ flex: 1, background: "#0f1117", borderRadius: 22, padding: "10px 14px", display: "flex", alignItems: "center" }}>
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="メッセージを入力..." rows={1} style={{ flex: 1, background: "none", border: "none", fontSize: 13, color: "#e8eaf0", resize: "none", lineHeight: 1.5, maxHeight: 100 }} />
          </div>
          <button onClick={sendMessage} disabled={!chatInput.trim()} className="bp" style={{ width: 42, height: 42, background: chatInput.trim() ? "linear-gradient(135deg,#7c6aff,#6a58f0)" : "#252836", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: chatInput.trim() ? "pointer" : "default", flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>↑</span>
          </button>
        </div>
        {toast && <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#2a2d3e", color: "#e8eaf0", borderRadius: 19, padding: "10px 20px", fontSize: 12, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap", boxShadow: "0 4px 18px rgba(0,0,0,.35)" }}>{toast}</div>}
        {confirmDialog && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#1e2130", borderRadius: 18, padding: 22, width: "100%", maxWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0", marginBottom: 6, textAlign: "center" }}>確認</p>
              <p style={{ fontSize: 13, color: "#a0a8c0", marginBottom: 20, textAlign: "center", lineHeight: 1.6 }}>{confirmDialog.message}</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDialog(null)} className="bp" style={{ flex: 1, background: "#0f1117", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#6b7280", cursor: "pointer" }}>キャンセル</button>
                <button onClick={() => { confirmDialog.onOk(); setConfirmDialog(null); }} className="bp" style={{ flex: 1, background: "#ef4444", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{confirmDialog.okLabel || "やめる"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MAIN APP SHELL ──
  return (
    <div style={{ fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", background: "#0f1117", minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{max-width:430px;margin:0 auto;overflow-x:hidden}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#7c6aff;border-radius:2px}
        .ph{transition:transform .18s;cursor:pointer}.ph:active{transform:scale(.97)}
        .bp:active{transform:scale(.95)}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes ti{from{transform:translateY(46px);opacity:0}to{transform:translateY(0);opacity:1}}
        .au{animation:up .32s ease both}.fi{animation:fi .24s ease both}
        input,textarea,select{outline:none}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#e8eaf0", padding: "12px 16px 10px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 24px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <div onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
            <div style={{ width: 27, height: 27, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⟳</div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, color: "#0f1117", letterSpacing: -.5 }}>Swap<span style={{ color: "#7c6aff" }}>ru</span></span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setView("messages")} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }}>
              <span style={{ color: "#0f1117", fontSize: 20 }}>💬</span>
              {totalUnread > 0 && <div style={{ position: "absolute", top: -2, right: -4, background: "#ef4444", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{totalUnread}</div>}
            </button>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 12, cursor: "pointer" }} onClick={() => setView("mypage")}>{user?.avatar}</div>
          </div>
        </div>
        <div style={{ background: "#2a1f10", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "#6b7280", fontSize: 14 }}>🔍</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="商品名・欲しいもので検索..." style={{ background: "none", border: "none", color: "#e8eaf0", fontSize: 13, flex: 1 }} />
          {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>✕</button>}
        </div>
      </div>

      <div style={{ paddingBottom: 82, minHeight: "100vh", background: "#0f1117" }}>

        {/* ════ HOME ════ */}
        {view === "home" && (
          <div className="fi">
            {/* ヒーローバナー */}
            <div style={{ background: "linear-gradient(135deg,#1a1208 0%,#3d2b15 55%,#1a1208 100%)", padding: "22px 16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 180, height: 180, background: "radial-gradient(circle,rgba(212,165,116,.18) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -20, left: -20, width: 120, height: 120, background: "radial-gradient(circle,rgba(212,165,116,.1) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
              <p style={{ color: "#d4a574", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>手数料ゼロ · 完全無料</p>
              <h2 style={{ color: "#f0ede8", fontSize: 22, fontWeight: 900, lineHeight: 1.3, marginBottom: 10 }}>不要なものを<br /><span style={{ color: "#d4a574" }}>価値ある交換へ</span></h2>
              <p style={{ color: "#8a7a6a", fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>お金を使わずに、あなたの不用品を<br />誰かの「欲しい」に変えよう。</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setView("list"); setListTab("offer"); }} className="bp" style={{ background: "#d4a574", border: "none", borderRadius: 9, padding: "10px 18px", color: "#1a1208", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>出品を探す →</button>
                <button onClick={() => setShowPostModal(true)} className="bp" style={{ background: "rgba(212,165,116,.15)", border: "1px solid rgba(212,165,116,.4)", borderRadius: 9, padding: "10px 18px", color: "#d4a574", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>出品する ➕</button>
              </div>
            </div>

            {/* 統計バー */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#d4c4a8", marginBottom: 14 }}>
              {[[`${allItems.filter(i=>i.status!=="交換済み").length}`, "出品数"], [`${likedItems.length}`, "お気に入り"], ["¥0", "手数料"]].map(([n, l]) => (
                <div key={l} style={{ background: "#f7f4ef", padding: "11px 0", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: l === "手数料" ? "#16a34a" : "#1a1208" }}>{n}</div>
                  <div style={{ fontSize: 9, color: "#8a7a6a", marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* 使い方3ステップ */}
            <div style={{ margin: "0 14px 14px", background: "#fff", borderRadius: 14, padding: "14px 14px", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#1a1208", marginBottom: 12, letterSpacing: 1 }}>✦ Swapruの使い方</p>
              <div style={{ display: "flex", gap: 0, position: "relative" }}>
                <div style={{ position: "absolute", top: 18, left: "16.5%", right: "16.5%", height: 2, background: "linear-gradient(90deg,#d4a574,#c4813a)", zIndex: 0 }} />
                {[["📦","出品する","不用品を写真付きで投稿"],["⟳","マッチ","交換希望が合う人を探す"],["🎉","成立！","チャットで詳細を決めて交換"]].map(([icon, title, desc], i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
                    <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 3px 10px rgba(212,165,116,.4)" }}>{icon}</div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#1a1208", textAlign: "center" }}>{title}</p>
                    <p style={{ fontSize: 9, color: "#8a7a6a", textAlign: "center", lineHeight: 1.4 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* アフィリエイト */}
            <div style={{ padding: "0 14px 10px" }}><AffiliateCard ad={AFFILIATE_ADS[0]} /></div>

            {/* キーワードマッチ */}
            {matchedItems.length > 0 && (
              <div style={{ margin: "0 14px 12px" }}>
                <div style={{ background: "linear-gradient(135deg,#1a1208,#2d2010)", borderRadius: 14, padding: 13, border: "2px solid rgba(212,165,116,.3)" }}>
                  <p style={{ color: "#d4a574", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 3 }}>✦ キーワードマッチ</p>
                  <p style={{ color: "#f0ede8", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{matchedItems.length}人があなたの出品物のキーワードを求めています</p>
                  <p style={{ color: "#6a5a4a", fontSize: 9, marginBottom: 8, fontStyle: "italic" }}>※ 自分でザッピングして確認しよう</p>
                  <button onClick={() => setView("match")} className="bp" style={{ width: "100%", background: "rgba(212,165,116,.18)", border: "1px solid rgba(212,165,116,.35)", borderRadius: 8, padding: 8, color: "#d4a574", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>一覧を見る ({matchedItems.length}件) →</button>
                </div>
              </div>
            )}

            {/* 新着出品 or 空状態 */}
            <div style={{ padding: "0 14px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1208" }}>🔥 新着出品</p>
                <button onClick={() => { setView("list"); setListTab("offer"); }} className="bp" style={{ background: "none", border: "none", color: "#c4813a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>すべて →</button>
              </div>
              {allItems.filter(item => item.status !== "交換済み" && item.ownerUid !== user?.uid && item.owner !== user?.name).length === 0 ? (
                <div style={{ background: "#fff", borderRadius: 14, padding: "28px 20px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1208", marginBottom: 6 }}>まだ出品がありません</p>
                  <p style={{ fontSize: 12, color: "#8a7a6a", marginBottom: 16, lineHeight: 1.6 }}>最初の出品者になってみよう！<br />不用品を交換に出すだけでOK。</p>
                  <button onClick={() => setShowPostModal(true)} className="bp" style={{ background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 12, padding: "11px 24px", color: "#1a1208", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>➕ 最初に出品する</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {allItems.filter(item => item.status !== "交換済み" && item.ownerUid !== user?.uid && item.owner !== user?.name).slice(0, 4).map((item, i) => <ItemCard key={item.id} item={item} liked={likedItems.includes(item.id)} onLike={toggleLike} onClick={() => openDetail(item)} delay={i * 55} />)}
                </div>
              )}
            </div>

            {/* 安心ポイント */}
            <div style={{ margin: "4px 14px 14px", background: "linear-gradient(135deg,#1a1208,#3d2b15)", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ color: "#d4a574", fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>✦ SWAPRU の安心ポイント</p>
              {[["⟳","完全無料","出品・交換・メッセージ、すべて0円"],["🛡️","相互評価","取引後のレビューで信頼を可視化"],["💬","丁寧なチャット","成立まで直接メッセージで交渉できる"]].map(([icon, title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, background: "rgba(212,165,116,.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <p style={{ color: "#f0ede8", fontSize: 12, fontWeight: 700 }}>{title}</p>
                    <p style={{ color: "#8a7a6a", fontSize: 10, marginTop: 1 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ LIST ════ */}
        {view === "list" && (
          <div className="fi">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#e8eaf0", borderBottom: "1px solid #2a1f10" }}>
              {[["offer", "🔥 出品一覧"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setListTab(tab)} className="bp" style={{ background: "none", border: "none", padding: "11px 0", fontWeight: 700, fontSize: 13, color: listTab === tab ? "#7c6aff" : "#8892aa", cursor: "pointer", borderBottom: listTab === tab ? "2px solid #7c6aff" : "2px solid transparent" }}>{label}</button>
              ))}
            </div>
            <div style={{ padding: "8px 12px 4px", display: "flex", overflowX: "auto", gap: 6 }}>
              {CATEGORIES.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className="bp" style={{ flexShrink: 0, background: selectedCategory === cat ? "#e8eaf0" : "#fff", border: `1px solid ${selectedCategory === cat ? "#e8eaf0" : "#252836"}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: selectedCategory === cat ? "#7c6aff" : "#a0a8c0", cursor: "pointer" }}>{cat}</button>)}
            </div>
            {listTab === "offer" && (
              <div style={{ padding: "4px 14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {filteredItems.map((item, i) => <ItemCard key={item.id} item={item} liked={likedItems.includes(item.id)} onLike={toggleLike} onClick={() => openDetail(item)} delay={i * 35} />)}
                </div>
                <div style={{ marginTop: 12 }}><AffiliateCard ad={AFFILIATE_ADS[0]} /></div>
              </div>
            )}
          </div>
        )}

        {/* ════ DETAIL ════ */}
        {view === "detail" && selectedItem && (
          <div className="au">
            <button onClick={() => setView("list")} style={{ margin: "12px 14px 0", background: "none", border: "none", color: "#a0a8c0", fontSize: 12, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>← 戻る</button>
            <div style={{ background: "#1e2130", margin: "9px 14px", borderRadius: 17, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
              <div style={{ background: "linear-gradient(135deg,#1a1d27,#252836)", height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 76, position: "relative" }}>
                {selectedItem.imageUrls?.[0] ? <img src={selectedItem.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : selectedItem.image}
                <button onClick={e => toggleLike(selectedItem.id, e)} style={{ position: "absolute", bottom: 9, right: 9, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{likedItems.includes(selectedItem.id) ? "❤️" : "🤍"}</button>
              </div>
              <div style={{ padding: "15px 15px 17px" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#e8eaf0", lineHeight: 1.3, marginBottom: 7 }}>{selectedItem.title}</h2>
                <div style={{ display: "flex", gap: 5, marginBottom: 11, flexWrap: "wrap" }}>
                  <span style={{ background: "#0f1117", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: "#a0a8c0" }}>{selectedItem.category}</span>
                  {selectedItem.subCategory && <span style={{ background: "#252836", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: "#a0a8c0" }}>{selectedItem.subCategory}</span>}
                  <span style={{ background: "#e8f5e9", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: "#2e7d32" }}>{selectedItem.condition}</span>
                </div>
                {selectedItem.category === "🎁 お中元・お歳暮" && (selectedItem.expiryDate || selectedItem.shippingNote) && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 11, padding: 11, marginBottom: 11 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 7 }}>🎁 食品・ギフト情報</p>
                    {selectedItem.expiryDate && <p style={{ fontSize: 11, color: "#a0a8c0", marginBottom: 4 }}>📅 賞味期限：<span style={{ fontWeight: 700 }}>{selectedItem.expiryDate}</span></p>}
                    {selectedItem.shippingNote && <p style={{ fontSize: 11, color: "#a0a8c0" }}>🚚 発送・保存：<span style={{ fontWeight: 700, color: selectedItem.shippingNote === "常温OK" ? "#16a34a" : "#d97706" }}>{selectedItem.shippingNote}</span></p>}
                  </div>
                )}
                <div style={{ background: "#1a1d27", borderRadius: 12, padding: 12, marginBottom: 11 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#6a58f0", marginBottom: 6 }}>↔ 交換希望</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{selectedItem.wantItems?.map(w => <span key={w} style={{ background: "#1e2130", border: "1px solid #252836", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#c8d0e0" }}>{w}</span>)}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: "#6b7280", fontWeight: 600, letterSpacing: 1, marginBottom: 5 }}>PR · おすすめ</p>
                  <AffiliateCard ad={AFFILIATE_ADS[0]} compact />
                </div>
                <div onClick={async () => {
                  const owner = { name: selectedItem.owner, avatar: selectedItem.ownerAvatar, location: selectedItem.location, uid: selectedItem.ownerUid };
                  setSelectedOwner(owner);
                  setOwnerReviews([]);
                  if (owner.uid && owner.uid !== "seed") {
                    try {
                      const snap = await getDocs(query(collection(db, "users", owner.uid, "reviews"), orderBy("createdAt", "desc")));
                      setOwnerReviews(snap.docs.map(d => d.data()));
                    } catch(e) {}
                  }
                }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", background: "#1a1d27", borderRadius: 12, padding: "9px 12px" }}>
                  <div style={{ width: 34, height: 34, background: "#7c6aff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>{selectedItem.ownerAvatar}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#e8eaf0" }}>{selectedItem.owner}</p>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>📍 {selectedItem.location}</p>
                  </div>
                  <p style={{ fontSize: 10, color: "#6a58f0", fontWeight: 600 }}>プロフを見る →</p>
                </div>
                <button onClick={() => { setShowTradeModal(selectedItem); setSelectedMyItem(null); }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 12, padding: 13, color: "#e8eaf0", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 7 }}>⟳ 交換を申し込む（無料）</button>
                <button onClick={() => handleShare(selectedItem)} className="bp" style={{ width: "100%", background: "#1e2130", border: "1px solid #252836", borderRadius: 12, padding: 11, color: "#a0a8c0", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 7 }}>
                  <span>📤</span>
                  <span>シェアする</span>
                  <span style={{ background: "#0f1117", borderRadius: 20, padding: "2px 8px", fontSize: 10, color: "#6a58f0", fontWeight: 700 }}>3回で上位権利GET</span>
                </button>
                <button onClick={() => { setShowReportModal(selectedItem); setReportReason(""); }} className="bp" style={{ width: "100%", background: "none", border: "none", padding: "6px 0", color: "#4a5068", fontSize: 11, cursor: "pointer" }}>🚨 この出品を通報する</button>
              </div>
            </div>
          </div>
        )}

        {/* ════ MESSAGES ════ */}
        {view === "messages" && (
          <div className="fi">
            <div style={{ padding: "14px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0" }}>💬 メッセージ</h2>
              {totalUnread > 0 && <span style={{ background: "#ef4444", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#fff" }}>{totalUnread}件未読</span>}
            </div>

            {applications.filter(a => (a.status === "申し込み中" || a.status === "保留中") && a.applicantUid !== user?.uid).length > 0 && (
              <div style={{ margin: "0 14px 12px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#6a58f0", letterSpacing: 1, marginBottom: 7 }}>📨 申し込み</p>
                {applications.filter(a => (a.status === "申し込み中" || a.status === "保留中") && a.applicantUid !== user?.uid).map(app => (
                  <div key={app.id} style={{ background: "#1e2130", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 12px rgba(0,0,0,.4)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{app.applicant?.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 2 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0" }}>{app.applicant}</p>
                          <span style={{ background: app.status === "保留中" ? "#fffbeb" : "#eff6ff", borderRadius: 20, padding: "1px 7px", fontSize: 9, fontWeight: 700, color: app.status === "保留中" ? "#d97706" : "#3b82f6" }}>{app.status}</span>
                        </div>
                        <p style={{ fontSize: 11, color: "#6b7280" }}>{app.myItemImage?.startsWith("http") ? "📦" : app.myItemImage} {app.myItemTitle} → {app.itemImage?.startsWith("http") ? "📦" : app.itemImage} {app.itemTitle}</p>
                      </div>
                    </div>
                    {app.message && <p style={{ fontSize: 11, color: "#a0a8c0", background: "#1a1d27", borderRadius: 9, padding: "8px 10px", marginBottom: 10 }}>「{app.message}」</p>}
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => respondToApplication(app.id, "交渉する")} className="bp" style={{ flex: 2, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#e8eaf0", cursor: "pointer" }}>🤝 交渉する</button>
                      <button onClick={() => respondToApplication(app.id, "保留")} className="bp" style={{ flex: 1, background: "#0f1117", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#6b7280", cursor: "pointer" }}>📋 保留</button>
                      <button onClick={() => respondToApplication(app.id, "ごめんなさい")} className="bp" style={{ flex: 1, background: "#fef2f2", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>🙏 ごめん</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {applications.filter(a => a.applicantUid === user?.uid && a.status === "申し込み中").length > 0 && (
              <div style={{ margin: "0 14px 12px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 7 }}>📤 申し込み中</p>
                {applications.filter(a => a.applicantUid === user?.uid && a.status === "申し込み中").map(app => (
                  <div key={app.id} style={{ background: "#1e2130", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 12px rgba(0,0,0,.4)", display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 24 }}>{app.itemImage?.startsWith("http") ? <img src={app.itemImage} style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6 }} /> : app.itemImage}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: "#e8eaf0", marginBottom: 2 }}>{app.itemTitle}</p>
                      <p style={{ fontSize: 10, color: "#6b7280" }}>返答待ち（24時間以内）</p>
                    </div>
                    <button onClick={() => cancelApplication(app.id)} className="bp" style={{ background: "#fef2f2", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 11, fontWeight: 700, color: "#ef4444", cursor: "pointer", flexShrink: 0 }}>キャンセル</button>
                  </div>
                ))}
              </div>
            )}

            {threads.filter(t => t.tradeStatus !== "完了" && t.tradeStatus !== "キャンセル").length > 0 && <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1, margin: "0 14px 7px" }}>💬 チャット</p>}
            {threads.filter(t => t.tradeStatus !== "完了" && t.tradeStatus !== "キャンセル").map((thread, i) => (
              <div key={thread.id} className="ph au" style={{ background: "#1e2130", margin: "0 14px 8px", borderRadius: 14, padding: 13, display: "flex", gap: 11, alignItems: "center", boxShadow: "0 2px 12px rgba(0,0,0,.4)", animationDelay: `${i * 55}ms`, position: "relative" }} onClick={() => openChat(thread)}>
                {thread.unread > 0 && <div style={{ position: "absolute", top: 10, right: 10, background: "#ef4444", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{thread.unread}</div>}
                <div style={{ width: 46, height: 46, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{thread.partnerAvatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0" }}>{thread.partner}</p>
                    <p style={{ fontSize: 10, color: "#6b7280", flexShrink: 0, marginLeft: 8 }}>{thread.lastTime}</p>
                  </div>
                  <div style={{ display: "flex", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontSize: 11 }}>{thread.myItemImage}</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>⟳</span>
                    <span style={{ fontSize: 11 }}>{thread.partnerItemImage}</span>
                    <span style={{ background: thread.status === "スワプる成立！" ? "#dcfce7" : "#fef3c7", borderRadius: 20, padding: "1px 7px", fontSize: 9, fontWeight: 700, color: thread.status === "スワプる成立！" ? "#16a34a" : "#d97706" }}>{thread.status}</span>
                  </div>
                  <p style={{ fontSize: 11, color: thread.unread > 0 ? "#e8eaf0" : "#6b7280", fontWeight: thread.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.lastMsg}</p>
                </div>
              </div>
            ))}
            <div style={{ padding: "4px 14px 0" }}><AffiliateCard ad={AFFILIATE_ADS[0]} compact /></div>
          </div>
        )}

        {/* ════ MATCH ════ */}
        {view === "match" && (
          <div className="fi" style={{ padding: "13px 14px 0" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0", marginBottom: 2 }}>🎯 キーワードマッチ</h2>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>あなたの出品物のキーワードを求めている人。自分でザッピングして確かめよう！</p>
            <div style={{ background: "#e8eaf0", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 9, color: "#7c6aff", fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>あなたの出品中</p>
              <div style={{ display: "flex", gap: 7 }}>{myItems.map(item => <div key={item.id} style={{ background: "rgba(255,255,255,.08)", borderRadius: 9, padding: 6, display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, flexShrink: 0, overflow: "hidden" }}>{imgSafe(item.image, 40)}</div>)}</div>
            </div>
            {matchedItems.map((item, i) => {
              const reasons = getMatchReasons(item, myItems, profileForm.wantKeywords);
              return (
                <div key={item.id} className="au" style={{ background: "#1e2130", borderRadius: 14, marginBottom: 10, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.4)", animationDelay: `${i * 50}ms` }}>
                  <div style={{ background: "#1a1730", padding: "8px 13px", borderBottom: "1px solid #0f1117", display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#6a58f0" }}>🎯</span>
                    {reasons.map((r, ri) => <span key={ri} style={{ background: "#1e2130", border: "1px solid #252836", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#c8d0e0" }}>{r.myImage?.startsWith?.("http") ? "📦" : r.myImage} {r.myItem.split(" ")[0]} → <span style={{ color: "#6a58f0" }}>「{r.want}」</span></span>)}
                  </div>
                  <div style={{ padding: 12, display: "flex", gap: 10, cursor: "pointer" }} onClick={() => openDetail(item)}>
                    <div style={{ width: 62, height: 62, background: "linear-gradient(135deg,#1a1d27,#252836)", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>{item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(item.image, 48)}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0", marginBottom: 4 }}>{item.title}</p>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{item.wantItems.map(w => <span key={w} style={{ background: reasons.some(r => r.want === w) ? "#fef3c7" : "#1a1d27", border: `1px solid ${reasons.some(r => r.want === w) ? "#fcd34d" : "#252836"}`, borderRadius: 20, padding: "2px 7px", fontSize: 10, fontWeight: 600, color: reasons.some(r => r.want === w) ? "#d97706" : "#c8d0e0" }}>{w}</span>)}</div>
                    </div>
                  </div>
                  <div style={{ padding: "0 12px 12px", display: "flex", gap: 7 }}>
                    <button onClick={() => { setShowTradeModal(item); setSelectedMyItem(null); }} className="bp" style={{ flex: 1, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 9, padding: 9, color: "#e8eaf0", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>⟳ 交換申し込む</button>
                    <button onClick={e => toggleLike(item.id, e)} className="bp" style={{ width: 38, background: "#0f1117", border: "none", borderRadius: 9, fontSize: 16, cursor: "pointer" }}>{likedItems.includes(item.id) ? "❤️" : "🤍"}</button>
                  </div>
                </div>
              );
            })}
            <AffiliateCard ad={AFFILIATE_ADS[0]} />
          </div>
        )}

        {/* ════ MYPAGE ════ */}
        {view === "mypage" && (
          <div className="fi" style={{ width: "100%" }}>
            <div style={{ background: "linear-gradient(135deg,#e8eaf0,#c8d0e0)", padding: "20px 16px", color: "#0f1117" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>{user?.avatar}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{profileForm.name || user?.name}</p>
                  <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{profileForm.bio || "自己紹介を追加しよう"}</p>
                  <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                    <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 20, padding: "2px 8px", fontSize: 9, color: "#7c6aff", fontWeight: 700 }}>{user?.method === "google" ? "🔵 Google" : "🟢 LINE"}</span>
                    <span style={{ background: "rgba(22,163,74,.2)", borderRadius: 20, padding: "2px 8px", fontSize: 9, color: "#4ade80", fontWeight: 700 }}>✅ 無料</span>
                  </div>
                </div>
                <button onClick={() => setMypageTab("settings")} className="bp" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 9, padding: "7px 11px", color: "#7c6aff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>⚙ 設定</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7 }}>
                {[[myItems.filter(i => i.status === "出品中").length, "出品中"], [threads.filter(t => t.status === "交渉中").length, "交換中"], [threads.filter(t => t.tradeStatus === "完了").length, "成立"], [totalUnread, "未読"]].map(([n, l]) => (
                  <div key={l} style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: l === "未読" && Number(n) > 0 ? "#ef4444" : "#7c6aff" }}>{n}</p>
                    <p style={{ fontSize: 9, color: "#4a5068" }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "#1e2130", borderBottom: "1px solid #252836" }}>
              {[["listings", "📦 出品"], ["favorites", "❤️ お気に入り"], ["history", "🔄 履歴"], ["settings", "⚙ 設定"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setMypageTab(tab)} className="bp" style={{ background: "none", border: "none", padding: "11px 0", fontWeight: 700, fontSize: 12, color: mypageTab === tab ? "#6a58f0" : "#6b7280", cursor: "pointer", borderBottom: mypageTab === tab ? "2px solid #6a58f0" : "2px solid transparent" }}>{label}</button>
              ))}
            </div>

            {/* ── 出品管理タブ ── */}
            {mypageTab === "listings" && (
              <div style={{ padding: 14, width: "100%" }}>
                <button onClick={() => setShowPostModal(true)} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 12, padding: 13, color: "#e8eaf0", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  ➕ 新しく出品する
                </button>
                {myItems.filter(i => i.status !== "交換済み").length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#6b7280" }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
                    <p style={{ fontWeight: 600 }}>まだ出品がありません</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>上のボタンから出品してみよう！</p>
                  </div>
                ) : myItems.filter(i => i.status !== "交換済み").map(item => (
                  <div key={item.id} style={{ background: "#1e2130", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ width: 54, height: 54, background: "linear-gradient(135deg,#1a1d27,#252836)", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(item.image, 48)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0", marginBottom: 3 }}>{item.title}</p>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ background: "#0f1117", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#a0a8c0" }}>{item.category}</span>
                          <span style={{ background: "#0f1117", borderRadius: 20, padding: "2px 8px", fontSize: 10, color: "#a0a8c0" }}>{item.condition}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#6b7280" }}>
                          <span>👁 {item.views}</span><span>❤️ {item.likes}</span>
                        </div>
                      </div>
                      <span style={{ background: item.status === "出品中" ? "#dcfce7" : item.status === "交換中" ? "#fef3c7" : "#f3f4f6", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: item.status === "出品中" ? "#16a34a" : item.status === "交換中" ? "#d97706" : "#6b7280", flexShrink: 0 }}>{item.status}</span>
                    </div>
                    <div style={{ background: "#1a1d27", borderRadius: 9, padding: "7px 10px", marginBottom: 10 }}>
                      <p style={{ fontSize: 10, color: "#6a58f0", fontWeight: 700, marginBottom: 3 }}>↔ 交換希望</p>
                      <p style={{ fontSize: 11, color: "#a0a8c0" }}>{item.wantItems?.join("・")}</p>
                    </div>
                    <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
                      <button onClick={() => { setEditingItem(item); setPostForm({ title: item.title, category: item.category, condition: item.condition, detail: "", wantItems: item.wantItems?.join("、"), image: item.image }); setPostType("offer"); setShowPostModal(true); }} className="bp" style={{ flex: 1, background: "#0f1117", border: "none", borderRadius: 9, padding: "8px 0", color: "#a0a8c0", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>✏️ 編集</button>
                      <button onClick={() => toggleItemStatus(item)} className="bp" style={{ flex: 1, background: "#0f1117", border: "none", borderRadius: 9, padding: "8px 0", color: item.status === "非公開" ? "#16a34a" : "#d97706", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{item.status === "非公開" ? "👁 公開する" : "🙈 非公開"}</button>
                      <button onClick={() => setConfirmDialog({ message: `「${item.title}」を削除しますか？`, onOk: () => deleteMyItem(item) })} className="bp" style={{ width: 38, background: "#fef2f2", border: "none", borderRadius: 9, color: "#ef4444", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🗑</button>
                    </div>
                    <button onClick={() => handleBoost(item.id)} className="bp" style={{ width: "100%", background: boostedItemId === item.id ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : boostCredits > 0 ? "linear-gradient(135deg,#e8eaf0,#c8d0e0)" : "#0f1117", border: "none", borderRadius: 9, padding: "8px 0", color: boostedItemId === item.id ? "#e8eaf0" : boostCredits > 0 ? "#7c6aff" : "#4a5068", fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {boostedItemId === item.id ? "🚀 上位表示中（48h）" : boostCredits > 0 ? `🚀 上位表示する（権利 ${boostCredits}/2）` : "🚀 上位表示（シェア3回でGET）"}
                    </button>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, letterSpacing: 1, marginBottom: 7 }}>PR · おすすめ</p>
                  <AffiliateCard ad={AFFILIATE_ADS[0]} compact />
                </div>
              </div>
            )}

            {/* ── お気に入りタブ ── */}
            {mypageTab === "favorites" && (
              <div style={{ padding: 14, width: "100%" }}>
                {likedItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>🤍</div>
                    <p style={{ fontWeight: 600 }}>お気に入りはまだありません</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>気になる出品にハートを押してみよう！</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {allItems.filter(item => likedItems.includes(item.id) || likedItems.includes(String(item.id))).map(item => (
                      <div key={item.id} onClick={() => openDetail(item)} className="ph" style={{ background: "#1e2130", borderRadius: 13, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.4)" }}>
                        <div style={{ height: 90, background: "linear-gradient(135deg,#1a1d27,#252836)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                          {item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(item.image, 48)}
                          <button onClick={e => toggleLike(item.id, e)} style={{ position: "absolute", top: 5, right: 5, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 26, height: 26, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>❤️</button>
                        </div>
                        <div style={{ padding: "8px 9px 10px" }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "#e8eaf0", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</p>
                          <p style={{ fontSize: 9, color: "#6a58f0", fontWeight: 700 }}>⟳ {item.wantItems?.[0]} など</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 取引履歴タブ ── */}
            {mypageTab === "history" && (
              <div style={{ padding: 14, width: "100%" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6a58f0", letterSpacing: 1, marginBottom: 9 }}>⏳ 進行中</p>
                {threads.filter(t => t.status === "交渉中").length === 0 ? (
                  <div style={{ background: "#1e2130", borderRadius: 12, padding: "20px", textAlign: "center", color: "#6b7280", marginBottom: 18 }}>
                    <p style={{ fontSize: 13 }}>進行中の取引はありません</p>
                  </div>
                ) : threads.filter(t => t.status === "交渉中").map(t => (
                  <div key={t.id} onClick={() => openChat(t)} className="ph" style={{ background: "#1e2130", borderRadius: 14, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)", border: "1px solid #fcd34d" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ flex: 1, background: "#1a1d27", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.myItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#e8eaf0", marginTop: 2 }}>{t.myItem}</p>
                      </div>
                      <div style={{ color: "#7c6aff", fontSize: 18, fontWeight: 700 }}>⟳</div>
                      <div style={{ flex: 1, background: "#1a1d27", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.partnerItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#e8eaf0", marginTop: 2 }}>{t.partnerItem}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 11, color: "#6b7280" }}>@{t.partner}</p>
                      <span style={{ background: "#fef3c7", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#d97706" }}>💬 交渉中 →</span>
                    </div>
                  </div>
                ))}

                <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", letterSpacing: 1, marginBottom: 9, marginTop: 4 }}>✅ 完了済み</p>
                {threads.filter(t => t.tradeStatus === "完了" || t.status === "交換成立").map(t => (
                  <div key={t.id} style={{ background: "#1e2130", borderRadius: 14, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ flex: 1, background: "#1a1d27", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.myItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#e8eaf0", marginTop: 2 }}>{t.myItem}</p>
                      </div>
                      <div style={{ color: "#7c6aff", fontSize: 18, fontWeight: 700 }}>⟳</div>
                      <div style={{ flex: 1, background: "#1a1d27", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.partnerItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#e8eaf0", marginTop: 2 }}>{t.partnerItem}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 11, color: "#6b7280" }}>@{t.partner}</p>
                      <span style={{ background: "#dcfce7", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#16a34a" }}>✅ 交換成立</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── 設定タブ ── */}
            {mypageTab === "settings" && (
              <div style={{ padding: 14, width: "100%" }}>
                <div style={{ background: "linear-gradient(135deg,#e8eaf0,#c8d0e0)", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#7c6aff", marginBottom: 12 }}>🚀 シェア＆上位表示</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 10, padding: 11, textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#7c6aff" }}>{shareCount}</p>
                      <p style={{ fontSize: 10, color: "#6b7280" }}>累積シェア数</p>
                      <p style={{ fontSize: 9, color: "#8892aa", marginTop: 2 }}>次の権利まであと{3 - (shareCount % 3)}回</p>
                    </div>
                    <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 10, padding: 11, textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: boostCredits > 0 ? "#fbbf24" : "#8892aa" }}>{boostCredits}/2</p>
                      <p style={{ fontSize: 10, color: "#6b7280" }}>上位表示権利</p>
                      <p style={{ fontSize: 9, color: "#8892aa", marginTop: 2 }}>最大2つストック可</p>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: (shareCount % 3) >= i ? "#7c6aff" : "rgba(255,255,255,.15)" }} />)}
                    </div>
                    <p style={{ fontSize: 10, color: "#6b7280", textAlign: "center" }}>シェア3回で上位表示権利GET！</p>
                  </div>
                </div>

                <div style={{ background: "#1e2130", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginBottom: 13 }}>👤 プロフィール</h3>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 70, height: 70, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: profileForm.avatarEmoji ? 36 : 28, fontWeight: 700, color: "#e8eaf0", marginBottom: 8, overflow: "hidden", flexShrink: 0 }}>
                      {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : profileForm.avatarEmoji || user?.avatar}
                    </div>
                    <input type="file" accept="image/*" ref={el => window._avatarInput = el} style={{ display: "none" }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !user) return;
                      try {
                        const { ref: sref, uploadBytes: ub, getDownloadURL: gdl } = await import("firebase/storage");
                        const storageRef = sref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
                        await ub(storageRef, file);
                        const url = await gdl(storageRef);
                        setProfileForm(f => ({ ...f, avatarUrl: url, avatarEmoji: null }));
                        showToast("✅ アイコンを変更しました");
                      } catch(e) { showToast("❌ アップロード失敗"); }
                    }} />
                    <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
                      <button onClick={() => window._avatarInput?.click()} className="bp" style={{ background: "#0f1117", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#a0a8c0", cursor: "pointer" }}>📷 写真</button>
                      <button onClick={() => setProfileForm(f => ({ ...f, showEmojiPicker: !f.showEmojiPicker }))} className="bp" style={{ background: "#0f1117", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#a0a8c0", cursor: "pointer" }}>😀 絵文字</button>
                    </div>
                    {profileForm.showEmojiPicker && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, background: "#1a1d27", borderRadius: 12, padding: 10, marginBottom: 8 }}>
                        {["😀","😎","🤩","🥳","😸","🐶","🐱","🦊","🐼","🐨","🦁","🐯","🐸","🐧","🦋","🌸","⭐","🎸","📷","🎮","🏄","🧗","🎨","🍕","☕"].map(em => (
                          <button key={em} onClick={() => setProfileForm(f => ({ ...f, avatarEmoji: em, avatarUrl: null, showEmojiPicker: false }))} style={{ width: 36, height: 36, background: "none", border: "none", fontSize: 22, cursor: "pointer", borderRadius: 8 }}>{em}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {[["ニックネーム", "name", "例: カメラ好き太郎"], ["自己紹介", "bio", "例: カメラ・楽器好きです。丁寧な取引を心がけています。"]].map(([label, key, ph]) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#a0a8c0", marginBottom: 5 }}>{label}</p>
                      {key === "bio" ? (
                        <textarea value={profileForm[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#e8eaf0", height: 72, resize: "none" }} />
                      ) : (
                        <input value={profileForm[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#e8eaf0" }} />
                      )}
                    </div>
                  ))}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#a0a8c0", marginBottom: 5 }}>活動エリア</p>
                    <select value={profileForm.location} onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))} disabled={profileForm.locationPrivate} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: profileForm.locationPrivate ? "#4a5068" : "#e8eaf0", cursor: "pointer", marginBottom: 7 }}>
                      {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div onClick={() => setProfileForm(f => ({ ...f, locationPrivate: !f.locationPrivate }))} style={{ width: 36, height: 20, background: profileForm.locationPrivate ? "#7c6aff" : "#252836", borderRadius: 10, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", top: 2, left: profileForm.locationPrivate ? 17 : 2, width: 16, height: 16, background: "#1e2130", borderRadius: "50%", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                      </div>
                      <p style={{ fontSize: 11, color: "#6b7280" }}>エリアを非公開にする</p>
                    </div>
                  </div>
                  <button onClick={saveProfile} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 11, padding: 12, color: "#e8eaf0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>保存する</button>
                </div>

                <div style={{ background: "#1e2130", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginBottom: 4 }}>🙋 欲しいもの（最大3つ）</h3>
                  <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>キーワードマッチに使われます</p>
                  <div style={{ background: "#1a1730", border: "1px solid #fcd34d", borderRadius: 9, padding: "8px 11px", marginBottom: 12 }}>
                    <p style={{ fontSize: 10, color: "#92400e" }}>💡 ブランド名+商品名で書くとマッチ精度が上がります</p>
                    <p style={{ fontSize: 10, color: "#92400e" }}>例）「コーヒーメーカー」より「シロカ コーヒーメーカー」</p>
                  </div>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6a58f0", width: 16 }}>#{i + 1}</span>
                      <input
                        value={profileForm.wantKeywords[i]}
                        onChange={e => setProfileForm(f => {
                          const kw = [...f.wantKeywords];
                          kw[i] = e.target.value;
                          return { ...f, wantKeywords: kw };
                        })}
                        placeholder={["例）シロカ コーヒーメーカー", "例）Gibson レスポール", "例）Canon フィルムカメラ"][i]}
                        style={{ flex: 1, background: "#1a1d27", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#e8eaf0" }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ background: "#1e2130", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginBottom: 4 }}>🎯 気になるカテゴリ</h3>
                  <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>最大3つ選択 · 欲しいリストの上位に表示されます</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CATEGORIES.filter(c => c !== "すべて").map(cat => {
                      const selected = profileForm.preferredCategories.includes(cat);
                      return (
                        <button key={cat} onClick={() => {
                          setProfileForm(f => {
                            const cur = f.preferredCategories;
                            if (selected) return { ...f, preferredCategories: cur.filter(c => c !== cat) };
                            if (cur.length >= 3) { showToast("⚠️ 最大3つまで選択できます"); return f; }
                            return { ...f, preferredCategories: [...cur, cat] };
                          });
                        }} className="bp" style={{ background: selected ? "#e8eaf0" : "#1a1d27", border: `2px solid ${selected ? "#7c6aff" : "transparent"}`, borderRadius: 20, padding: "7px 13px", fontSize: 12, fontWeight: 700, color: selected ? "#7c6aff" : "#a0a8c0", cursor: "pointer" }}>
                          {cat} {selected && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "#1e2130", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginBottom: 13 }}>🔔 通知設定</h3>
                  {[["notify_message", "新しいメッセージ", "交渉中の相手からメッセージが届いたとき"], ["notify_match", "キーワードマッチ", "出品物のキーワードを求める人が現れたとき"], ["notify_news", "お知らせ", "アップデートや新機能のお知らせ"]].map(([key, label, desc]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #0f1117" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf0" }}>{label}</p>
                        <p style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{desc}</p>
                      </div>
                      <div onClick={async () => {
                        const newVal = !profileForm[key];
                        if (key === "notify_message" && newVal && !fcmToken) {
                          try {
                            const permission = await Notification.requestPermission();
                            if (permission !== "granted") { showToast("⚠️ 通知が許可されていません"); return; }
                            const token = await getToken(messaging, { vapidKey: "BEdUq87Qs4gWdyw4psTHk8goAJn-znUGzZ3nQ3F_SWVo97QXyPo_GkhZJvHE8lSqyfWcnzUBfbSOLdkUyzY-ZZM" });
                            if (token) { setFcmToken(token); await setDoc(doc(db, "users", user.uid, "tokens", "fcm"), { token, updatedAt: new Date().toISOString() }); }
                          } catch(e) { showToast("❌ 通知の設定に失敗しました"); return; }
                        }
                        setProfileForm(f => ({ ...f, [key]: newVal }));
                      }} style={{ width: 44, height: 24, background: profileForm[key] ? "#7c6aff" : "#252836", borderRadius: 12, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", top: 3, left: profileForm[key] ? 22 : 3, width: 18, height: 18, background: "#1e2130", borderRadius: "50%", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#1e2130", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginBottom: 13 }}>🔐 アカウント</h3>
                  <div style={{ background: "#1a1d27", borderRadius: 10, padding: "11px 13px", marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>ログイン方法</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf0" }}>{user?.method === "google" ? "🔵 Google アカウント" : "🟢 LINE アカウント"}</p>
                    {user?.email && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{user.email}</p>}
                  </div>
                  <button onClick={() => setLegalModal("faq")} className="bp" style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 10, padding: "11px", color: "#a0a8c0", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 7 }}>❓ よくある質問（FAQ）</button>
                  <button onClick={() => setLegalModal("terms")} className="bp" style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 10, padding: "11px", color: "#a0a8c0", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 7 }}>📋 利用規約を見る</button>
                  <button onClick={() => setLegalModal("privacy")} className="bp" style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 10, padding: "11px", color: "#a0a8c0", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 7 }}>🔒 プライバシーポリシー</button>
                  <button onClick={() => setLegalModal("contact")} className="bp" style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 10, padding: "11px", color: "#a0a8c0", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>📮 お問い合わせ</button>
                </div>

                {isAdmin && <button onClick={() => setView("admin")} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#e8eaf0,#c8d0e0)", border: "none", borderRadius: 12, padding: 12, color: "#7c6aff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 7 }}>🛡️ 管理画面</button>}
                <button onClick={async () => { await signOut(auth); setUser(null); setMyItems([]); setThreads([]); setApplications([]); setLikedItems([]); setAuthState("landing"); }} className="bp" style={{ width: "100%", background: "none", border: "1px solid #252836", borderRadius: 12, padding: 12, color: "#6b7280", fontSize: 13, cursor: "pointer", marginBottom: 7 }}>ログアウト</button>

                <button className="bp" style={{ width: "100%", background: "none", border: "1px solid #fecaca", borderRadius: 12, padding: 12, color: "#ef4444", fontSize: 12, cursor: "pointer" }}>アカウントを削除する</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── POST MODAL ── */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => { setShowPostModal(false); setEditingItem(null); }}>
          <div style={{ background: "#0f1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", padding: 20, maxHeight: "92vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#3a3f52", borderRadius: 2, margin: "0 auto 15px" }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#e8eaf0", marginBottom: editingItem ? 14 : 3 }}>{editingItem ? "✏️ 出品を編集" : "新規投稿"}</h2>
            {!editingItem && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                {[["offer", "🔥 出品する", "持っているものを交換に出す"]].map(([type, ttl, desc]) => (
                  <button key={type} onClick={() => setPostType(type)} className="bp" style={{ background: postType === type ? "#e8eaf0" : "#fff", border: `2px solid ${postType === type ? "#7c6aff" : "#252836"}`, borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: postType === type ? "#7c6aff" : "#e8eaf0", marginBottom: 2 }}>{ttl}</p>
                    <p style={{ fontSize: 9, color: postType === type ? "#6b7280" : "#9a8a7a", lineHeight: 1.4 }}>{desc}</p>
                  </button>
                ))}
              </div>
            )}
            <div style={{ background: "#1e2130", borderRadius: 13, padding: 15, marginBottom: 11 }}>
              <div style={{ marginBottom: 13 }}>
                <input type="file" accept="image/*" multiple ref={el => window._imgInput = el} style={{ display: "none" }} onChange={async (e) => {
                  const files = Array.from(e.target.files);
                  if (!files.length || !user) return;
                  setPostForm(f => ({ ...f, uploading: true }));
                  try {
                    const urls = [];
                    for (const file of files.slice(0, 3)) {
                      const storageRef = ref(storage, `items/${user.uid}/${Date.now()}_${file.name}`);
                      await uploadBytes(storageRef, file);
                      const url = await getDownloadURL(storageRef);
                      urls.push(url);
                    }
                    setPostForm(f => ({ ...f, imageUrls: [...(f.imageUrls || []), ...urls], uploading: false }));
                  } catch(e) { setPostForm(f => ({ ...f, uploading: false })); showToast("❌ アップロード失敗"); }
                }} />
                <div onClick={() => { if ((postForm.imageUrls || []).length >= 3) { showToast("⚠️ 写真は最大3枚です"); return; } window._imgInput?.click(); }} style={{ border: "2px dashed #252836", borderRadius: 10, height: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 8, background: "#1a1d27" }}>
                  {postForm.uploading ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ width: 28, height: 28, border: "3px solid #7c6aff", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 6px", animation: "spin .8s linear infinite" }} />
                      <p style={{ fontSize: 11, color: "#6b7280" }}>アップロード中...</p>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 28, marginBottom: 4 }}>📷</span>
                      <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>写真を追加 <span style={{ color: "#ef4444" }}>必須</span></p>
                      <p style={{ fontSize: 10, color: "#4a5068" }}>{(postForm.imageUrls || []).length}/3枚</p>
                    </>
                  )}
                </div>
                {postForm.imageUrls?.length > 0 && (
                  <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 }}>
                    {postForm.imageUrls.map((url, i) => (
                      <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                        <img src={url} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 9, border: "2px solid #252836" }} />
                        <button onClick={() => setPostForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, j) => j !== i) }))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, background: "#ef4444", border: "none", borderRadius: "50%", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {[["商品名・タイトル", "title", postType === "offer" ? "例: Canon AE-1 フィルムカメラ" : "例: フィルムカメラ全般"], ["詳細・説明", "detail", postType === "offer" ? "状態、付属品など..." : "希望条件など..."], [postType === "offer" ? "交換希望アイテム（カンマ区切り）" : "交換に出せるもの", "wantItems", postType === "offer" ? "例: ギター, ゲーム機" : "例: Nintendo Switch"]].map(([label, key, ph]) => (
                <div key={key} style={{ marginBottom: 11 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 4 }}>{label}</p>
                  {key === "wantItems" && postType === "offer" && (
                    <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 5 }}>💡 空欄の場合はマイページの「欲しいもの」が使われます。この商品だけ特定のものと交換したい場合に入力してください</p>
                  )}
                  {key === "detail" ? (
                    <textarea value={postForm[key]} onChange={e => setPostForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#e8eaf0", height: 65, resize: "none" }} />
                  ) : (
                    <input value={postForm[key]} onChange={e => setPostForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#e8eaf0" }} />
                  )}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 4 }}>カテゴリー</p>
                  <select value={postForm.category} onChange={e => setPostForm(f => ({ ...f, category: e.target.value, subCategory: "" }))} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#e8eaf0", cursor: "pointer" }}>
                    {CATEGORIES.filter(c => c !== "すべて").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 4 }}>状態</p>
                  <select value={postForm.condition} onChange={e => setPostForm(f => ({ ...f, condition: e.target.value }))} style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#e8eaf0", cursor: "pointer" }}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 4 }}>中分類 <span style={{ color: "#ef4444" }}>*</span></p>
                <select value={postForm.subCategory} onChange={e => setPostForm(f => ({ ...f, subCategory: e.target.value }))} style={{ width: "100%", background: "#1a1d27", border: postForm.subCategory ? "none" : "1px solid #fca5a5", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: postForm.subCategory ? "#e8eaf0" : "#6b7280", cursor: "pointer" }}>
                  <option value="">-- 選択してください --</option>
                  {(SUB_CATEGORIES[postForm.category] || ["その他"]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {postForm.category === "🎁 お中元・お歳暮" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 11, padding: 12, marginTop: 2 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 10 }}>🎁 食品・ギフト情報</p>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 4 }}>賞味期限 <span style={{ color: "#ef4444" }}>*</span></p>
                    <input type="date" value={postForm.expiryDate} onChange={e => setPostForm(f => ({ ...f, expiryDate: e.target.value }))} style={{ width: "100%", background: "#1e2130", border: "1px solid #fcd34d", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#e8eaf0" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 6 }}>発送・保存方法</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["常温OK", "冷蔵必要", "冷凍必要", "生もの注意", "割れ物注意"].map(opt => (
                        <button key={opt} onClick={() => setPostForm(f => ({ ...f, shippingNote: opt }))} className="bp" style={{ background: postForm.shippingNote === opt ? "#d97706" : "#fff", border: `1px solid ${postForm.shippingNote === opt ? "#d97706" : "#252836"}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: postForm.shippingNote === opt ? "#fff" : "#a0a8c0", cursor: "pointer" }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={async () => {
              if (!postForm.title.trim()) { showToast("⚠️ タイトルを入力してください"); return; }
              if (!postForm.subCategory) { showToast("⚠️ 中分類を選択してください"); return; }
              if (postType === "offer" && !editingItem && (!postForm.imageUrls || postForm.imageUrls.length === 0)) { showToast("📷 写真を1枚以上追加してください"); return; }
              if (editingItem) {
                const wantArr = postForm.wantItems.split(/[,、]/).map(s => s.trim()).filter(Boolean);
                const updatedData = { title: postForm.title, category: postForm.category, condition: postForm.condition, image: postForm.image, wantItems: wantArr };
                if (editingItem.firestoreId && user) {
                  await updateDoc(doc(db, "users", user.uid, "items", editingItem.firestoreId), updatedData);
                }
                setMyItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updatedData } : i));
                showToast("✅ 出品を更新しました");
              } else {
                const wantArr = postForm.wantItems.trim() ? postForm.wantItems.split(/[,、]/).map(s => s.trim()).filter(Boolean) : profileForm.wantKeywords.filter(Boolean);
                const newItem = { id: Date.now(), title: postForm.title, category: postForm.category, subCategory: postForm.subCategory || "その他", condition: postForm.condition, image: postForm.imageUrls?.[0] || postForm.image, imageUrls: postForm.imageUrls || [], status: "出品中", likes: 0, views: 0, wantItems: wantArr, keywords: wantArr, expiryDate: postForm.expiryDate || null, shippingNote: postForm.shippingNote || null, createdAt: new Date().toISOString(), ownerUid: user?.uid || "", owner: user?.name || "匿名", ownerAvatar: user?.avatar || "U", location: profileForm.locationPrivate ? "非公開" : profileForm.location };
                if (user) {
                  const docRef = await addDoc(collection(db, "users", user.uid, "items"), { ...newItem, postId: String(newItem.id) });
                  newItem.firestoreId = docRef.id;
                  newItem.postId = String(newItem.id);
                  await setDoc(doc(db, "posts", String(newItem.id)), { ...newItem, createdAt: serverTimestamp() });
                }
                setMyItems(prev => [newItem, ...prev]);
                showToast(postType === "offer" ? "🎉 出品しました！" : "🙋 欲しいリストに投稿しました！");
              }
              setShowPostModal(false); setEditingItem(null);
              setPostForm({ title: "", category: "📷 カメラ・映像", subCategory: "", condition: "良好", detail: "", wantItems: "", image: "📷", imageUrls: [], uploading: false, expiryDate: "", shippingNote: "常温OK" });
            }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#7c6aff,#6a58f0)", border: "none", borderRadius: 12, padding: 14, color: "#e8eaf0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {editingItem ? "更新する" : postType === "offer" ? "無料で出品する" : "欲しいリストに投稿"}
            </button>
          </div>
        </div>
      )}

      {/* ── OWNER PROFILE ── */}
      {selectedOwner && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setSelectedOwner(null)}>
          <div style={{ background: "#0f1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", maxHeight: "88vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#3a3f52", borderRadius: 2, margin: "14px auto 0" }} />
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #252836" }}>
              <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 22, flexShrink: 0 }}>{selectedOwner.avatar}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#e8eaf0", marginBottom: 3 }}>{selectedOwner.name}</p>
                <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>📍 {selectedOwner.location || "非公開"}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[...allItems, ...myItems].filter(i => i.owner === selectedOwner.name).length >= 5 && <span style={{ background: "#7c6aff", borderRadius: 20, padding: "2px 9px", fontSize: 9, fontWeight: 700, color: "#e8eaf0" }}>🏆 アクティブ</span>}
                  {threads.filter(t => t.tradeStatus === "完了" && (t.partner === selectedOwner.name || t.ownerName === selectedOwner.name)).length >= 1 && <span style={{ background: "#dcfce7", borderRadius: 20, padding: "2px 9px", fontSize: 9, fontWeight: 700, color: "#15803d" }}>✅ 成立実績あり</span>}
                  {threads.filter(t => t.tradeStatus === "完了" && (t.partner === selectedOwner.name || t.ownerName === selectedOwner.name)).length >= 3 && <span style={{ background: "#fef9c3", borderRadius: 20, padding: "2px 9px", fontSize: 9, fontWeight: 700, color: "#854d0e" }}>🌟 信頼ユーザー</span>}
                  <span style={{ background: "#0f1117", borderRadius: 20, padding: "2px 9px", fontSize: 9, fontWeight: 600, color: "#a0a8c0" }}>出品 {[...allItems, ...myItems].filter(i => i.owner === selectedOwner.name).length}件</span>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#252836", margin: "0 0 14px" }}>
              {[["⭐ 評価", myReviews.length > 0 ? (myReviews.reduce((s, r) => s + (r.rating || 0), 0) / myReviews.length).toFixed(1) : "なし"], ["🔁 成立", `${threads.filter(t => t.tradeStatus === "完了").length}回`], ["❌ キャンセル率", "0%"]].map(([label, val]) => (
                <div key={label} style={{ background: "#1e2130", padding: "12px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#e8eaf0" }}>{val}</p>
                  <p style={{ fontSize: 9, color: "#6b7280" }}>{label}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 14px 20px" }}>
              {selectedOwner.name !== user?.name && (
                <button onClick={() => { if (window.confirm(`${selectedOwner.name} をブロックしますか？この人の出品が表示されなくなります。`)) blockUser(selectedOwner.name, selectedOwner.uid); }} className="bp" style={{ width: "100%", background: "#fef2f2", border: "none", borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#ef4444", cursor: "pointer", marginBottom: 12 }}>🚫 このユーザーをブロック</button>
              )}
              <p style={{ fontSize: 12, fontWeight: 700, color: "#e8eaf0", marginBottom: 10 }}>📦 出品中のアイテム</p>
              {[...allItems, ...myItems].filter(i => i.owner === selectedOwner.name && i.status !== "非公開").length === 0 ? (
                <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: 20 }}>出品中のアイテムはありません</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[...allItems, ...myItems].filter(i => i.owner === selectedOwner.name && i.status !== "非公開").map(item => (
                    <div key={item.id} onClick={() => { setSelectedOwner(null); openDetail(item); }} className="ph" style={{ background: "#1e2130", borderRadius: 13, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.4)", cursor: "pointer" }}>
                      <div style={{ height: 90, background: "linear-gradient(135deg,#1a1d27,#252836)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                        {item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(item.image, 48)}
                      </div>
                      <div style={{ padding: "8px 9px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#e8eaf0", lineHeight: 1.3, marginBottom: 3 }}>{item.title}</p>
                        <p style={{ fontSize: 9, color: "#6b7280" }}>{item.condition}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, fontWeight: 700, color: "#e8eaf0", margin: "18px 0 10px" }}>⭐ レビュー</p>
              {ownerReviews.length === 0 ? (
                <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "12px 0" }}>まだレビューはありません</p>
              ) : ownerReviews.map((review, i) => (
                <div key={i} style={{ background: "#1e2130", borderRadius: 12, padding: 13, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, background: "#7c6aff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 10 }}>{review.fromName?.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#e8eaf0" }}>{review.fromName}</p>
                      <p style={{ fontSize: 10, color: "#7c6aff" }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                    </div>
                  </div>
                  {review.comment && <p style={{ fontSize: 11, color: "#a0a8c0", lineHeight: 1.6 }}>{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TRADE MODAL ── */}
      {showTradeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setShowTradeModal(null)}>
          <div style={{ background: "#0f1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", padding: 20, maxHeight: "85vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#3a3f52", borderRadius: 2, margin: "0 auto 15px" }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#e8eaf0", marginBottom: 4 }}>⟳ 交換を申し込む</h2>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>出品者が24時間以内に返答します</p>
            <div style={{ background: "#1e2130", borderRadius: 12, padding: 11, marginBottom: 11, display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, background: "#1a1d27", borderRadius: 9, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25 }}>{showTradeModal.imageUrls?.[0] ? <img src={showTradeModal.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(showTradeModal.image, 48)}</div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#6a58f0", marginBottom: 2 }}>相手のアイテム</p>
                <p style={{ fontWeight: 600, fontSize: 13, color: "#e8eaf0" }}>{showTradeModal.title}</p>
                <p style={{ fontSize: 10, color: "#6b7280" }}>{showTradeModal.owner}</p>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: 18, color: "#7c6aff", margin: "3px 0 9px" }}>⟳ あなたが提供</div>
            {myItems.length === 0 ? (
              <div style={{ background: "#1e2130", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 11 }}>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>出品中のアイテムがありません</p>
                <button onClick={() => { setShowTradeModal(null); setShowPostModal(true); }} className="bp" style={{ background: "#7c6aff", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#e8eaf0", cursor: "pointer" }}>+ 出品する</button>
              </div>
            ) : myItems.map(item => (
              <div key={item.id} onClick={() => setSelectedMyItem(item)} className="ph" style={{ background: "#1e2130", borderRadius: 12, padding: 11, marginBottom: 7, display: "flex", gap: 10, alignItems: "center", border: `2px solid ${selectedMyItem?.id === item.id ? "#7c6aff" : "transparent"}` }}>
                <div style={{ width: 44, height: 44, background: "#1a1d27", borderRadius: 9, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : imgSafe(item.image, 48)}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 12, color: "#e8eaf0" }}>{item.title}</p>
                  <p style={{ fontSize: 10, color: "#6b7280" }}>{item.condition}</p>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedMyItem?.id === item.id ? "#7c6aff" : "#3a3f52"}`, background: selectedMyItem?.id === item.id ? "#7c6aff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedMyItem?.id === item.id && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#a0a8c0", marginBottom: 5 }}>一言メッセージ（任意）</p>
              <textarea id="tradeMsg" placeholder="一言添えるとマッチ率アップ！" style={{ width: "100%", background: "#1a1d27", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#e8eaf0", height: 60, resize: "none" }} />
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#92400e" }}>⏰ 出品者が24時間以内に返答しない場合は自動キャンセルされます</p>
            </div>
            <AffiliateCard ad={AFFILIATE_ADS[0]} compact />
            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
              <button onClick={() => setShowTradeModal(null)} className="bp" style={{ flex: 1, background: "#0f1117", border: "none", borderRadius: 11, padding: 12, color: "#a0a8c0", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => submitApplication(showTradeModal, selectedMyItem, document.getElementById("tradeMsg")?.value || "")} className="bp" style={{ flex: 2, background: selectedMyItem ? "linear-gradient(135deg,#7c6aff,#6a58f0)" : "#252836", border: "none", borderRadius: 11, padding: 12, color: selectedMyItem ? "#e8eaf0" : "#4a5068", fontWeight: 700, fontSize: 13, cursor: selectedMyItem ? "pointer" : "not-allowed" }}>
                申し込む →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEGAL MODAL ── */}
      {legalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 2000, display: "flex", alignItems: "flex-end" }} onClick={() => setLegalModal(null)}>
          <div style={{ background: "#0f1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", maxHeight: "88vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ position: "sticky", top: 0, background: "#0f1117", padding: "14px 18px 10px", borderBottom: "1px solid #252836", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#e8eaf0" }}>
                {legalModal === "terms" && "📋 利用規約"}
                {legalModal === "privacy" && "🔒 プライバシーポリシー"}
                {legalModal === "contact" && "📮 お問い合わせ"}
                {legalModal === "faq" && "❓ よくある質問"}
              </h2>
              <button onClick={() => setLegalModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ padding: "18px 18px 40px", fontSize: 12, color: "#c8d0e0", lineHeight: 1.9 }}>
              {legalModal === "terms" && (<>
                <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 16 }}>最終更新日：2026年3月1日</p>
                {[
                  ["第1条（目的）", "本規約は、Swapru（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆様には本規約に従って本サービスをご利用いただきます。"],
                  ["第2条（サービスの内容）", "本サービスは、ユーザー同士が不用品を無償で交換するためのマッチングプラットフォームです。運営者は取引の当事者ではなく、交換の成立・履行・結果について一切の責任を負いません。"],
                  ["第3条（免責事項）", "本サービスを通じて行われる取引はすべてユーザー間の個人取引です。取引に関するトラブル（商品の不具合、未着、破損、詐欺等）は、当事者間で解決していただく必要があります。運営者はいかなる場合も取引トラブルへの介入・補償・賠償を行いません。"],
                  ["第4条（食品・ギフト品の取引について）", "食品・飲料・お中元・お歳暮等の食品類を出品する場合は、未開封かつ製造元のシールが intact な状態のものに限ります。賞味期限・消費期限は正確に記載してください。生もの・要冷蔵・要冷凍品の取引はユーザー自身の責任において行うものとし、配送中の品質劣化・食中毒等のトラブルについて運営者は一切の責任を負いません。食品の取引は自己責任でお願いします。"],
                  ["第5条（禁止事項）", "偽りの情報による出品・詐欺的行為、他ユーザーへの嫌がらせ・誹謗中傷、違法物・危険物の出品、著作権を侵害するコンテンツの投稿、賞味期限切れ・消費期限切れ食品の出品、偽ブランド品・模倣品の出品、その他法令に違反する行為を禁止します。"],
                  ["第6条（アカウントの管理）", "ユーザーは自己の責任においてアカウントを管理するものとします。アカウントの不正使用による損害について、運営者は責任を負いません。"],
                  ["第7条（サービスの変更・終了）", "運営者は事前の通知なく本サービスの内容を変更、または提供を終了することがあります。これによりユーザーに生じた損害について、運営者は責任を負いません。"],
                  ["第8条（配送について）", "本サービスを通じた取引における配送はすべてユーザー間で各自手配していただきます。配送方法・送料・配送事故等のトラブルについて運営者は一切の責任を負いません。住所の取り扱いには十分ご注意ください。なお、ヤマト運輸「宅急便をスマホで送る」のLINE匿名配送（+110円）を利用すると、お互いの住所・氏名を非公開のまま発送できます。"],
                  ["第9条（規約の変更）", "運営者は必要に応じて本規約を変更できるものとします。変更後の規約はサービス上に掲載した時点で効力を生じます。"],
                  ["第9条（トラブル発生時の対応フロー）", "取引トラブルが発生した場合は以下の順で対応してください。①まずチャット機能で相手と直接話し合う。②解決しない場合は通報ボタンから運営に連絡。③悪質な行為（発送不履行・虚偽出品等）が確認された場合、運営はアカウント停止等の対応を行います。なお運営は金銭的補償は行いませんが、状況確認・仲裁サポートは可能な限り対応します。"],
                ].map(([title, body]) => (
                  <div key={title} style={{ marginBottom: 18 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0", marginBottom: 5 }}>{title}</p>
                    <p>{body}</p>
                  </div>
                ))}
              </>)}
              {legalModal === "privacy" && (<>
                <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 16 }}>最終更新日：2026年3月1日</p>
                {[
                  ["取得する情報", "Googleログイン時に取得する情報：お名前、メールアドレス、プロフィール写真。出品時に取得する情報：商品画像、商品説明、交換希望内容。"],
                  ["情報の利用目的", "取得した情報は、サービスの提供・改善、ユーザー間のマッチング、不正利用の防止のみに使用します。第三者への販売・提供は行いません。"],
                  ["情報の保管", "取得した情報はFirebase（Google LLC）のサーバーに保管されます。"],
                  ["Cookieについて", "本サービスではログイン状態の維持のためにCookieを使用しています。"],
                  ["お問い合わせ", "個人情報の取扱いに関するお問い合わせは、本サービスのお問い合わせフォームよりご連絡ください。"],
                ].map(([title, body]) => (
                  <div key={title} style={{ marginBottom: 18 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0", marginBottom: 5 }}>{title}</p>
                    <p>{body}</p>
                  </div>
                ))}
              </>)}
              {legalModal === "faq" && (<>
                {[
                  ["🔒 住所を相手に教えなくて大丈夫？", "はい。郵便局留め・ヤマト営業所止め・PUDOロッカーを使えば住所を教えずに送受取できます。発送が始まると画面内に具体的な方法が表示されます。"],
                  ["⟳ 交換が成立しなかったらどうなる？", "申し込みが断られた・期限切れ・キャンセルの場合は出品が継続されます。交換成立まで何度でも他のユーザーと交渉できます。"],
                  ["📦 相手が発送してくれなかったら？", "「発送しました」ボタンを押した後、相手が受け取り確認をしない場合はチャットで連絡を取ってください。それでも解決しない場合は通報機能からご連絡ください。運営が状況を確認します。"],
                  ["⭐ 評価はどう使われる？", "相互レビューで積み上がる平均評価スコアがプロフィールに表示されます。高評価ユーザーには「信頼ユーザー」バッジが付き、交換が成立しやすくなります。"],
                  ["💰 本当に手数料ゼロ？", "はい。出品・申し込み・交換のすべてが完全無料です。配送費用のみ各自の負担となります。"],
                  ["🚫 トラブルになったら？", "まずチャットで相手と話し合ってください。解決しない場合は通報ボタン or contact@swapru.app へご連絡ください。悪質ユーザーはBANします。"],
                  ["📮 配送はどうすればいい？", "配送はユーザー間で各自手配してください。ヤマト宅急便・ゆうパック・クリックポストなどが使えます。発送画面に詳しいガイドが表示されます。"],
                  ["🔒 住所を教えずに送れる？", "ヤマト「宅急便をスマホで送る」のLINE匿名配送を使えばOKです。チャットでLINEを交換 → ヤマトのアプリでリクエスト送信 → 相手が住所入力 → 発送の流れで、お互いの住所・氏名を非公開のまま送れます（送料 +110円）。クロネコメンバーズ登録が必要です。"],
                  ["📱 アプリはある？", "現在はWebアプリのみです。スマホのブラウザからそのまま使えます。ホーム画面に追加するとアプリ感覚で使えます。"],
                ].map(([q, a]) => (
                  <div key={q} style={{ marginBottom: 18, background: "#1a1d27", borderRadius: 11, padding: "12px 14px" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0", marginBottom: 6 }}>{q}</p>
                    <p style={{ fontSize: 12, color: "#a0a8c0", lineHeight: 1.8 }}>{a}</p>
                  </div>
                ))}
              </>)}
              {legalModal === "contact" && (<>
                <div style={{ background: "#1e2130", borderRadius: 13, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0", marginBottom: 8 }}>📧 メールでのお問い合わせ</p>
                  <p style={{ marginBottom: 12 }}>下記メールアドレスまでお気軽にご連絡ください。通常2〜3営業日以内にご返信いたします。</p>
                  <div style={{ background: "#1a1d27", borderRadius: 9, padding: "11px 13px", textAlign: "center" }}>
                    <p style={{ fontWeight: 700, color: "#6a58f0", fontSize: 13 }}>contact@swapru.app</p>
                  </div>
                </div>
                <div style={{ background: "#1a1730", border: "1px solid #2d2450", borderRadius: 13, padding: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 12, color: "#6a58f0", marginBottom: 6 }}>⚠️ 取引トラブルについて</p>
                  <p>本サービスはユーザー間の個人取引のため、取引に関するトラブルは当事者間での解決をお願いしております。運営者は取引への介入・補償を行うことができません。</p>
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN ── */}
      {view === "admin" && isAdmin && (
        <div style={{ paddingBottom: 80 }}>
          <div style={{ background: "#e8eaf0", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("mypage")} style={{ background: "none", border: "none", color: "#7c6aff", fontSize: 20, cursor: "pointer" }}>←</button>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#7c6aff" }}>🛡️ 管理画面</h2>
          </div>
          <div style={{ display: "flex", background: "#1e2130", borderBottom: "1px solid #252836" }}>
            {[["dashboard","📊 概要"], ["items","📦 出品"], ["users","👥 ユーザー"], ["reports","🚨 通報"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setAdminTab(tab)} style={{ flex: 1, background: "none", border: "none", borderBottom: adminTab === tab ? "2px solid #7c6aff" : "2px solid transparent", padding: "10px 0", fontSize: 10, fontWeight: 700, color: adminTab === tab ? "#6a58f0" : "#6b7280", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {adminTab === "dashboard" && (
            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[["📦 出品数", allItems.filter(i=>i.status!=="交換済み").length + myItems.filter(i=>i.status!=="交換済み").length, "#7c6aff"], ["👥 ユーザー数", "1", "#60a5fa"], ["🚨 通報数", reports.length, "#f87171"], ["✅ 成立数", threads.filter(t => t.tradeStatus === "完了").length, "#4ade80"]].map(([label, val, color]) => (
                  <div key={label} style={{ background: "#1e2130", borderRadius: 13, padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,.4)", textAlign: "center" }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color }}>{val}</p>
                    <p style={{ fontSize: 11, color: "#6b7280" }}>{label}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: "#1e2130", borderRadius: 13, padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,.4)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#e8eaf0", marginBottom: 10 }}>🚨 未対応通報</p>
                {reports.filter(r => r.status === "未対応").length === 0 ? (
                  <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "10px 0" }}>通報はありません ✅</p>
                ) : reports.filter(r => r.status === "未対応").slice(0, 3).map(r => (
                  <div key={r.id} style={{ background: "#fef2f2", borderRadius: 9, padding: 10, marginBottom: 7 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>{r.reason}</p>
                    <p style={{ fontSize: 11, color: "#a0a8c0" }}>{r.itemTitle}</p>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>by {r.reportedBy}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {adminTab === "items" && (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>全出品 {allItems.filter(i=>i.status!=="交換済み").length + myItems.filter(i=>i.status!=="交換済み").length}件</p>
              {[...allItems, ...myItems].map(item => (
                <div key={item.id} style={{ background: "#1e2130", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 12px rgba(0,0,0,.4)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 44, height: 44, background: "#0f1117", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, overflow: "hidden" }}>{imgSafe(item.image, 44)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: "#e8eaf0", marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 10, color: "#6b7280" }}>by {item.owner} · {item.category}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    {["偽物・模倣品", "期限切れ食品", "不適切", "詐欺"].map(reason => (
                      <button key={reason} onClick={() => { if (window.confirm(`「${item.title}」を「${reason}」として削除しますか？`)) adminDeleteItem(item, reason); }} className="bp" style={{ flex: 1, background: "#fef2f2", border: "none", borderRadius: 7, padding: "6px 0", fontSize: 9, fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>{reason}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {adminTab === "users" && (
            <div style={{ padding: 14 }}>
              {[...new Map([...allItems, ...myItems].map(i => [i.owner, i])).values()].map(item => (
                <div key={item.owner} style={{ background: "#1e2130", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 12px rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8eaf0", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{item.ownerAvatar}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#e8eaf0" }}>{item.owner}</p>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>{item.location}</p>
                  </div>
                  <button onClick={() => { if (window.confirm(`${item.owner} をBANしますか？`)) adminBanUser(item.owner, item.ownerUid || ""); }} className="bp" style={{ background: "#fef2f2", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>🚫 BAN</button>
                </div>
              ))}
            </div>
          )}
          {adminTab === "reports" && (
            <div style={{ padding: 14 }}>
              {reports.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
                  <p style={{ fontSize: 13 }}>通報はありません</p>
                </div>
              ) : reports.map(r => (
                <div key={r.id} style={{ background: "#1e2130", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 12px rgba(0,0,0,.4)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ background: r.status === "未対応" ? "#fef2f2" : "#dcfce7", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: r.status === "未対応" ? "#ef4444" : "#16a34a" }}>{r.status}</span>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>{new Date(r.createdAt).toLocaleDateString("ja-JP")}</p>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#e8eaf0", marginBottom: 2 }}>{r.itemTitle}</p>
                  <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 2 }}>理由：{r.reason}</p>
                  <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 10 }}>通報者：{r.reportedBy}</p>
                  {r.status === "未対応" && (
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => { adminDeleteItem({ id: r.itemId, title: r.itemTitle, owner: r.itemOwner, ownerUid: "" }, r.reason); setReports(prev => prev.map(rep => rep.id === r.id ? { ...rep, status: "対応済み" } : rep)); }} className="bp" style={{ flex: 1, background: "#fef2f2", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 11, fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>🗑️ 削除する</button>
                      <button onClick={() => setReports(prev => prev.map(rep => rep.id === r.id ? { ...rep, status: "対応済み" } : rep))} className="bp" style={{ flex: 1, background: "#f0fdf4", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 11, fontWeight: 700, color: "#16a34a", cursor: "pointer" }}>✅ 問題なし</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 通報モーダル */}
      {showReportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setShowReportModal(null)}>
          <div style={{ background: "#0f1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", padding: 20, animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#3a3f52", borderRadius: 2, margin: "0 auto 15px" }} />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#e8eaf0", marginBottom: 4 }}>🚨 通報する</h2>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 14 }}>「{showReportModal.title}」を通報</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {["偽物・模倣品", "賞味期限切れ食品", "詐欺・虚偽出品", "不適切なコンテンツ", "スパム・宣伝", "その他"].map(reason => (
                <button key={reason} onClick={() => setReportReason(reason)} className="bp" style={{ background: reportReason === reason ? "#e8eaf0" : "#fff", border: `2px solid ${reportReason === reason ? "#7c6aff" : "#252836"}`, borderRadius: 10, padding: "10px 14px", textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 600, color: reportReason === reason ? "#7c6aff" : "#a0a8c0" }}>{reason}</button>
              ))}
            </div>
            <button onClick={submitReport} className="bp" style={{ width: "100%", background: reportReason ? "#ef4444" : "#252836", border: "none", borderRadius: 12, padding: 13, color: reportReason ? "#fff" : "#4a5068", fontWeight: 700, fontSize: 14, cursor: reportReason ? "pointer" : "default" }}>通報を送信する</button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#2a2d3e", color: "#e8eaf0", borderRadius: 19, padding: "10px 20px", fontSize: 12, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap", animation: "ti .25s ease", boxShadow: "0 4px 18px rgba(0,0,0,.35)" }}>{toast}</div>}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#1e2130", borderRadius: 18, padding: 22, width: "100%", maxWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0", marginBottom: 6, textAlign: "center" }}>確認</p>
            <p style={{ fontSize: 13, color: "#a0a8c0", marginBottom: 20, textAlign: "center", lineHeight: 1.6 }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDialog(null)} className="bp" style={{ flex: 1, background: "#0f1117", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#6b7280", cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => { confirmDialog.onOk(); setConfirmDialog(null); }} className="bp" style={{ flex: 1, background: "#ef4444", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{confirmDialog.okLabel || "やめる"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#1e2130", borderTop: "1px solid #252836", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "6px 0 9px", zIndex: 100, boxShadow: "0 -4px 24px rgba(0,0,0,.5)" }}>
        {[["🏠","ホーム","home"],["🔍","さがす","list"],["➕","投稿",null],["💬","スワップ","messages"],["👤","マイページ","mypage"]].map(([icon, label, v]) => (
          <button key={label} onClick={() => v ? setView(v) : setShowPostModal(true)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, cursor: "pointer", padding: "2px 0", position: "relative" }}>
            {label === "投稿" ? (
              <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#7c6aff,#6a58f0)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginTop: -12, boxShadow: "0 4px 16px rgba(124,106,255,.6)" }}>➕</div>
            ) : (
              <span style={{ fontSize: 19, filter: view === v ? "none" : "grayscale(50%) opacity(.65)" }}>{icon}</span>
            )}
            {v === "messages" && (totalUnread + applications.filter(a => (a.status === "申し込み中" || a.status === "保留中") && a.applicantUid !== user?.uid).length) > 0 && (
              <div style={{ position: "absolute", top: 0, right: "calc(50% - 18px)", background: "#ef4444", borderRadius: 10, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", padding: "0 3px" }}>
                {totalUnread + applications.filter(a => (a.status === "申し込み中" || a.status === "保留中") && a.applicantUid !== user?.uid).length}
              </div>
            )}
            <span style={{ fontSize: 8, fontWeight: 600, color: view === v ? "#6a58f0" : "#6b7280" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
