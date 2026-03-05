import { useState, useRef, useEffect } from "react";
import { auth, provider, db, storage, messaging, getToken, onMessage } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const ALL_ITEMS = [
  { id: 1, title: "ヴィンテージカメラ Canon AE-1", category: "カメラ", condition: "良好", wantItems: ["レンズ", "三脚", "フィルム"], image: "📷", owner: "taka_photo", ownerAvatar: "T", location: "東京都渋谷区", views: 234, likes: 18 },
  { id: 2, title: "Gibson レスポール エレキギター", category: "楽器", condition: "目立つ傷あり", wantItems: ["アコースティックギター", "エフェクター", "カメラ"], image: "🎸", owner: "music_lover", ownerAvatar: "M", location: "大阪府梅田", views: 512, likes: 42 },
  { id: 3, title: "Nintendo Switch + ソフト5本", category: "ゲーム", condition: "ほぼ新品", wantItems: ["PS5", "Xbox", "ゲームソフト"], image: "🎮", owner: "gamer_yuki", ownerAvatar: "Y", location: "神奈川県横浜市", views: 891, likes: 76 },
  { id: 4, title: "登山用テント 2〜3人用", category: "アウトドア", condition: "良好", wantItems: ["登山靴", "バックパック", "望遠レンズ"], image: "⛺", owner: "outdoor_ken", ownerAvatar: "K", location: "長野県松本市", views: 145, likes: 11 },
  { id: 5, title: "Nespresso コーヒーメーカー", category: "家電", condition: "ほぼ新品", wantItems: ["空気清浄機", "電気ケトル", "財布"], image: "☕", owner: "cafe_home", ownerAvatar: "C", location: "福岡県福岡市", views: 328, likes: 27 },
  { id: 6, title: "折りたたみ自転車 20インチ", category: "自転車", condition: "良好", wantItems: ["電動キックボード", "スケートボード", "カメラ"], image: "🚲", owner: "cycling_ryo", ownerAvatar: "R", location: "愛知県名古屋市", views: 203, likes: 15 },
  { id: 7, title: "プロ一眼レフ Nikon D850", category: "カメラ", condition: "良好", wantItems: ["ミラーレスカメラ", "ドローン", "ギター"], image: "📸", owner: "pro_shooter", ownerAvatar: "P", location: "東京都新宿区", views: 672, likes: 53 },
  { id: 8, title: "ハンドメイド革財布", category: "ファッション", condition: "新品同様", wantItems: ["バッグ", "ベルト", "腕時計"], image: "👜", owner: "craft_momo", ownerAvatar: "M", location: "京都府京都市", views: 189, likes: 22 },
];

const SAMPLE_WANTLIST = [
  { id: "w1", title: "フィルムカメラ全般", category: "カメラ", detail: "Canonか Nikonの古いフィルムカメラ。動作品であれば外観不問。", image: "📷", owner: "retro_lover", ownerAvatar: "R", location: "東京都", offering: "ロードバイク用ヘルメット", offeringImage: "⛑️", created: "2時間前", responses: 3 },
  { id: "w2", title: "アコースティックギター", category: "楽器", detail: "初心者でも弾きやすいもの。ハードケースあれば尚良し。", image: "🎸", owner: "music_start", ownerAvatar: "M", location: "大阪府", offering: "Nintendo Switch本体", offeringImage: "🎮", created: "5時間前", responses: 7 },
  { id: "w3", title: "一眼レフカメラ（どこのメーカーでも）", category: "カメラ", detail: "旅行用に欲しい。レンズキットだと最高。", image: "📸", owner: "travel_kei", ownerAvatar: "K", location: "神奈川県", offering: "コーヒーメーカー + 豆セット", offeringImage: "☕", created: "1日前", responses: 12 },
  { id: "w4", title: "PS5本体", category: "ゲーム", detail: "ディスクドライブ版希望。コントローラー付きだと嬉しい。", image: "🎮", owner: "game_seeker", ownerAvatar: "G", location: "福岡県", offering: "iPad Air + Appleペンシル", offeringImage: "📱", created: "3日前", responses: 21 },
];

// チャットのモックデータ
const MOCK_THREADS = [
  {
    id: "c1", partner: "music_lover", partnerAvatar: "M", partnerItem: "Gibson レスポール エレキギター", partnerItemImage: "🎸",
    myItem: "キャノン望遠レンズ 70-200mm", myItemImage: "🔭",
    status: "交渉中", tradeStatus: "交渉中", unread: 2, lastMsg: "レンズの状態をもう少し詳しく教えてもらえますか？", lastTime: "14:32",
    messages: [
      { id: 1, from: "them", text: "はじめまして！レンズとギターの交換に興味があります。", time: "13:10", read: true },
      { id: 2, from: "me", text: "こちらこそ！ギターずっと探してたんです。レンズはかなり程度良いですよ。", time: "13:25", read: true },
      { id: 3, from: "them", text: "それは嬉しい！写真とか送ってもらえますか？", time: "13:40", read: true },
      { id: 4, from: "me", text: "もちろん！傷なし・カビなし・動作確認済みです。フードとケースも付きます。", time: "13:55", read: true },
      { id: 5, from: "them", text: "レンズの状態をもう少し詳しく教えてもらえますか？", time: "14:32", read: false },
    ],
  },
  {
    id: "c2", partner: "gamer_yuki", partnerAvatar: "Y", partnerItem: "Nintendo Switch + ソフト5本", partnerItemImage: "🎮",
    myItem: "ミニマルレザーウォレット", myItemImage: "💼",
    status: "スワプる成立！", tradeStatus: "完了", unread: 0, lastMsg: "ありがとうございました！また機会があれば！", lastTime: "昨日",
    messages: [
      { id: 1, from: "them", text: "財布の交換希望です！Switchはほぼ新品で画面にキズなしです。", time: "昨日 10:00", read: true },
      { id: 2, from: "me", text: "いいですね！財布もほぼ新品です。交換しましょう！", time: "昨日 10:30", read: true },
      { id: 3, from: "them", text: "ありがとうございました！また機会があれば！", time: "昨日 18:00", read: true },
    ],
  },
  {
    id: "c3", partner: "outdoor_ken", partnerAvatar: "K", partnerItem: "登山用テント 2〜3人用", partnerItemImage: "⛺",
    myItem: "キャノン望遠レンズ 70-200mm", myItemImage: "🔭",
    status: "交渉中", unread: 1, lastMsg: "今週末に手渡しできますか？", lastTime: "10:05",
    messages: [
      { id: 1, from: "them", text: "レンズとテントの交換どうでしょう？", time: "9:00", read: true },
      { id: 2, from: "me", text: "良いですね！どのあたりにお住まいですか？", time: "9:30", read: true },
      { id: 3, from: "them", text: "今週末に手渡しできますか？", time: "10:05", read: false },
    ],
  },
];

const AFFILIATE_ADS = [
  { id: "af1", brand: "Amazon", tag: "PR", title: "カメラ用品をAmazonでチェック", desc: "交換できなかったものは買い足しで解決！", image: "📦", cta: "Amazonで見る →", url: "https://www.amazon.co.jp/", color: ["#FF9900", "#e07800"], category: "カメラ" },
  { id: "af2", brand: "楽天市場", tag: "PR", title: "楽天で楽器・音楽機材を探す", desc: "ポイント還元でさらにお得に", image: "🎸", cta: "楽天で見る →", url: "https://www.rakuten.co.jp/", color: ["#bf0000", "#900"], category: "楽器" },
  { id: "af5", brand: "メルカリShops", tag: "PR", title: "交換できない場合はメルカリで", desc: "出品無料・全国配送対応", image: "🏪", cta: "メルカリを開く", url: "https://mercari-shops.com/", color: ["#FF0211", "#cc0010"], category: null },
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

function getAdsForCategory(cat) { return AFFILIATE_ADS.filter(a => a.category === cat || a.category === null); }
function getMatchReasons(item, myItems) {
  const reasons = [];
  for (const mi of myItems) for (const w of item.wantItems || [])
    if (mi.keywords?.some(k => w.includes(k) || k.includes(w))) reasons.push({ myItem: mi.title, myImage: mi.image, want: w });
  return reasons;
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

function AffiliateCard({ ad, compact }) {
  const click = () => alert(`【PRリンク】\n${ad.brand}: ${ad.url}\n※本番ではアフィリエイトURLに差し替えてください`);
  if (compact) return (
    <div onClick={click} className="bp" style={{ background: `linear-gradient(135deg,${ad.color[0]},${ad.color[1]})`, borderRadius: 11, padding: "10px 13px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 7 }}>
      <span style={{ fontSize: 22 }}>{ad.image}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 1 }}>
          <span style={{ background: "rgba(255,255,255,.25)", borderRadius: 4, padding: "1px 5px", fontSize: 8, fontWeight: 700, color: "#fff" }}>{ad.tag}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{ad.brand}</span>
        </div>
        <p style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{ad.title}</p>
      </div>
      <span style={{ color: "rgba(255,255,255,.9)", fontSize: 13, fontWeight: 700 }}>→</span>
    </div>
  );
  return (
    <div onClick={click} className="bp" style={{ background: `linear-gradient(135deg,${ad.color[0]},${ad.color[1]})`, borderRadius: 14, padding: 14, cursor: "pointer", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ background: "rgba(255,255,255,.25)", borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: "#fff" }}>{ad.tag}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.85)", fontWeight: 600 }}>{ad.brand}</span>
        </div>
        <span style={{ fontSize: 22 }}>{ad.image}</span>
      </div>
      <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{ad.title}</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,.8)", marginBottom: 10 }}>{ad.desc}</p>
      <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{ad.cta}</span>
      </div>
    </div>
  );
}

function ItemCard({ item, liked, onLike, onClick, delay = 0 }) {
  return (
    <div className="ph" onClick={onClick} style={{ background: "#fff", borderRadius: 13, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.06)", animation: `up .34s ease ${delay}ms both` }}>
      <div style={{ background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, position: "relative", overflow: "hidden" }}>
        {item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : item.image}
        <button onClick={e => onLike(item.id, e)} style={{ position: "absolute", top: 5, right: 5, background: "rgba(255,255,255,.9)", border: "none", borderRadius: "50%", width: 26, height: 26, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {liked ? "❤️" : "🤍"}
        </button>
      </div>
      <div style={{ padding: "8px 9px 10px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#1a1208", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</p>
        <div style={{ background: "#f0ede8", borderRadius: 6, padding: "3px 7px" }}>
          <p style={{ fontSize: 9, color: "#c4813a", fontWeight: 700 }}>⟳ {item.wantItems?.[0]} など</p>
        </div>
      </div>
    </div>
  );
}

function WantCard({ item, onRespond, delay = 0 }) {
  return (
    <div className="au" style={{ background: "#fff", borderRadius: 15, marginBottom: 10, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.06)", animationDelay: `${delay}ms` }}>
      <div style={{ background: "linear-gradient(90deg,#f0f7ff,#e8f0ff)", padding: "9px 13px", borderBottom: "1px solid #e8eefc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>🙋</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>これ欲しい！リクエスト</span>
        </div>
        <span style={{ fontSize: 10, color: "#8a7a6a" }}>{item.created} · {item.responses}件</span>
      </div>
      <div style={{ padding: 13 }}>
        <div style={{ display: "flex", gap: 11, marginBottom: 9 }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#f0f7ff,#dbeafe)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>{item.image}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208", marginBottom: 3 }}>{item.title}</p>
            <span style={{ background: "#f0ede8", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#5a4a3a" }}>{item.category}</span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#5a4a3a", lineHeight: 1.6, marginBottom: 9, background: "#f7f4ef", borderRadius: 9, padding: "8px 10px" }}>"{item.detail}"</p>
        <div style={{ background: "linear-gradient(90deg,#fef9f0,#fff8e8)", borderRadius: 10, padding: "9px 11px", display: "flex", gap: 9, alignItems: "center", marginBottom: 10, border: "1px solid #f0e0c0" }}>
          <div style={{ fontSize: 24 }}>{item.offeringImage}</div>
          <div>
            <p style={{ fontSize: 9, color: "#c4813a", fontWeight: 700, marginBottom: 1 }}>↔ 交換に出せるもの</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1208" }}>{item.offering}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 28, height: 28, background: "#d4a574", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{item.ownerAvatar}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#1a1208" }}>{item.owner}</p>
            <p style={{ fontSize: 9, color: "#8a7a6a" }}>📍 {item.location}</p>
          </div>
          <button onClick={() => onRespond(item)} className="bp" style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", border: "none", borderRadius: 9, padding: "8px 13px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>🙋 応じる</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function SwapApp() {
  // Auth
  const [authState, setAuthState] = useState("landing");
  const [loginMethod, setLoginMethod] = useState(null);
  const [user, setUser] = useState(null);

  // Navigation
  const [view, setView] = useState("home");
  const [listTab, setListTab] = useState("offer");
  const [mypageTab, setMypageTab] = useState("listings"); // listings | settings

  // Data
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [likedItems, setLikedItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [openThread, setOpenThread] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  // Modals
  const [showPostModal, setShowPostModal] = useState(false);
  const [postType, setPostType] = useState("offer");
  const [showTradeModal, setShowTradeModal] = useState(null);
  const [selectedMyItem, setSelectedMyItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(10);
  const [pendingFirstMsg, setPendingFirstMsg] = useState(null);
  const [showReportModal, setShowReportModal] = useState(null); // item to report
  const [reportReason, setReportReason] = useState("");
  const [reports, setReports] = useState([]);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [applications, setApplications] = useState([]); // 申し込み一覧
  const [cancelCount, setCancelCount] = useState(0); // キャンセル回数
  const ADMIN_EMAIL = "satoki4438@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Profile settings state
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", location: "東京都", locationPrivate: false, notify_message: true, notify_match: true, notify_news: false, avatarUrl: null, avatarEmoji: null, preferredCategories: [] });

  // Post form
  const [postForm, setPostForm] = useState({ title: "", category: "📷 カメラ・映像", subCategory: "", condition: "良好", detail: "", wantItems: "", image: "📷", imageUrls: [], uploading: false, expiryDate: "", shippingNote: "常温OK" });

  const [toast, setToast] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  const [shareCount, setShareCount] = useState(0); // 累積シェア数
  const [boostCredits, setBoostCredits] = useState(0); // 上位表示権利（最大2）
  const [boostedItemId, setBoostedItemId] = useState(null); // 現在上位表示中の商品ID
  const [boostExpiry, setBoostExpiry] = useState(null); // 上位表示期限
  const [legalModal, setLegalModal] = useState(null); // "terms" | "privacy" | "contact"
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const submitApplication = async (item, myItem, message) => {
    if (!myItem) { showToast("⚠️ 提供するアイテムを選んでください"); return; }
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const app = {
      itemId: item.id, itemTitle: item.title, itemOwner: item.owner, itemImage: item.image,
      itemOwnerUid: item.ownerUid || "",
      myItemId: myItem.id, myItemTitle: myItem.title, myItemImage: myItem.image || "📦",
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
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: "交渉中", negotiationDeadline: deadline.toISOString() } : a));
      const app = applications.find(a => a.id === appId);
      // Firestoreにチャット作成
      try {
        const chatData = {
          applicantUid: app?.applicantUid, applicantName: app?.applicant, applicantAvatar: app?.applicantAvatar,
          applicantItemTitle: app?.myItemTitle, applicantItemImage: app?.myItemImage,
          ownerUid: user.uid, ownerName: user.name, ownerAvatar: user.avatar,
          ownerItemTitle: app?.itemTitle, ownerItemImage: app?.itemImage,
          tradeStatus: "交渉中", lastMsg: "交渉が開始されました", updatedAt: serverTimestamp(),
          messages: [], unreadCount: { [app?.applicantUid]: 1 }
        };
        const chatRef = await addDoc(collection(db, "chats"), chatData);
        await updateDoc(doc(db, "applications", appId), { status: "交渉中" });
        const newThread = {
          id: chatRef.id, firestoreId: chatRef.id,
          partner: app?.applicant, partnerAvatar: app?.applicant?.charAt(0) || "U",
          partnerItem: app?.myItemTitle, partnerItemImage: app?.myItemImage,
          myItem: app?.itemTitle, myItemImage: app?.itemImage,
          status: "交渉中", tradeStatus: "交渉中", unread: 0, lastMsg: "交渉が開始されました", lastTime: "今",
          messages: [{ id: Date.now(), from: "system", text: "🤝 交渉が開始されました！48時間以内にスワプるかどうか決めましょう", time: "今", read: true }],
        };
        setThreads(prev => [...prev, newThread]);
      } catch(e) {
        console.error(e);
        const newThread = {
          id: `app_${appId}`, partner: app?.applicant, partnerAvatar: app?.applicant?.charAt(0) || "U",
          partnerItem: app?.myItemTitle, partnerItemImage: app?.myItemImage,
          myItem: app?.itemTitle, myItemImage: app?.itemImage,
          status: "交渉中", tradeStatus: "交渉中", unread: 1, lastMsg: app?.message || "交渉を開始しました", lastTime: "今",
          messages: [{ id: Date.now(), from: "system", text: "🤝 交渉が開始されました！48時間以内にスワプるかどうか決めましょう", time: "今", read: true }],
        };
        setThreads(prev => [...prev, newThread]);
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

  const cancelApplication = (appId) => {
    const newCount = cancelCount + 1;
    setCancelCount(newCount);
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: "キャンセル" } : a));
    if (newCount >= 3) showToast("⚠️ キャンセルが多いです。警告バッジが付く場合があります");
    else showToast("キャンセルしました");
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
  const toggleLike = (id, e) => { e.stopPropagation(); setLikedItems(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]); };
  const openDetail = (item) => { if (!item) return; setSelectedItem(item); setView("detail"); setSelectedMyItem(null); window.scrollTo(0, 0); };
  const matchedItems = ALL_ITEMS.filter(item => getMatchReasons(item, myItems).length > 0);
  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  const filteredItems = ALL_ITEMS.filter(item => {
    const mc = selectedCategory === "すべて" || item.category === selectedCategory;
    const ms = !searchQuery || item.title.includes(searchQuery) || item.wantItems?.some(w => w.includes(searchQuery));
    return mc && ms;
  }).sort((a, b) => {
    if (a.id === boostedItemId) return -1;
    if (b.id === boostedItemId) return 1;
    return 0;
  });
  const filteredWants = SAMPLE_WANTLIST.filter(item => {
    const mc = selectedCategory === "すべて" || item.category === selectedCategory;
    return mc && (!searchQuery || item.title.includes(searchQuery));
  }).sort((a, b) => {
    const aPref = profileForm.preferredCategories.includes(a.category) ? 0 : 1;
    const bPref = profileForm.preferredCategories.includes(b.category) ? 0 : 1;
    return aPref - bPref;
  });

  // Chat scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [openThread]);

  // 広告カウントダウン
  useEffect(() => {
    if (!showAdModal) return;
    if (adCountdown <= 0) { sendPendingMessage(); return; }
    const timer = setTimeout(() => setAdCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showAdModal, adCountdown]);

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

    // フォアグラウンド通知受信
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
    const isFirstMsg = openThread.messages.filter(m => m.from === "me").length === 0;
    if (isFirstMsg) {
      setPendingFirstMsg(newMsg);
      setShowAdModal(true);
      setAdCountdown(10);
      setChatInput("");
      return;
    }
    // ローカル即時反映
    setThreads(prev => prev.map(t => t.id === openThread.id ? { ...t, messages: [...t.messages, newMsg], lastMsg: newMsg.text, lastTime: now, unread: 0 } : t));
    setOpenThread(prev => ({ ...prev, messages: [...prev.messages, newMsg] }));
    setChatInput("");
    // Firestore保存
    if (openThread.firestoreId) {
      try {
        await addDoc(collection(db, "chats", openThread.firestoreId, "messages"), {
          from: user.uid, text: newMsg.text, createdAt: serverTimestamp(), read: false
        });
        await updateDoc(doc(db, "chats", openThread.firestoreId), {
          lastMsg: newMsg.text, updatedAt: serverTimestamp()
        });
      } catch(e) { console.error("メッセージ保存失敗:", e); }
    }
    // モックの自動返信（Firestore未連携スレッドのみ）
    if (!openThread.firestoreId) {
      setTimeout(() => {
        const reply = { id: Date.now() + 1, from: "them", text: "なるほど！それは良さそうですね。もう少し詳しく聞かせてもらえますか？", time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }), read: true };
        setThreads(prev => prev.map(t => t.id === openThread.id ? { ...t, messages: [...t.messages, newMsg, reply], lastMsg: reply.text, lastTime: reply.time } : t));
        setOpenThread(prev => prev ? { ...prev, messages: [...prev.messages, reply] } : prev);
      }, 1200);
    }
  };

  const sendPendingMessage = () => {
    if (!pendingFirstMsg || !openThread) return;
    const newMsg = pendingFirstMsg;
    setThreads(prev => prev.map(t => t.id === openThread.id ? { ...t, messages: [...t.messages, newMsg], lastMsg: newMsg.text, lastTime: newMsg.time, unread: 0 } : t));
    setOpenThread(prev => ({ ...prev, messages: [...prev.messages, newMsg] }));
    setPendingFirstMsg(null);
    setShowAdModal(false);
    setTimeout(() => {
      const reply = { id: Date.now() + 1, from: "them", text: "はじめまして！交換に興味を持っていただきありがとうございます😊", time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }), read: true };
      setThreads(prev => prev.map(t => t.id === openThread.id ? { ...t, messages: [...t.messages, newMsg, reply], lastMsg: reply.text, lastTime: reply.time } : t));
      setOpenThread(prev => prev ? { ...prev, messages: [...prev.messages, reply] } : prev);
    }, 1200);
  };

  const openChat = (thread) => {
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: 0 } : t));
    setOpenThread({ ...thread, unread: 0 });
    setView("chat");
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

  const deleteMyItem = async (item) => {
    try {
      if (item.firestoreId && user) {
        await deleteDoc(doc(db, "users", user.uid, "items", item.firestoreId));
      }
      setMyItems(prev => prev.filter(i => i.id !== item.id));
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
      } else {
        setAuthState("landing");
      }
    });
    return () => unsub();
  }, []);

  // チャットのリアルタイム連携
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const chats = snap.docs
        .map(d => ({ ...d.data(), firestoreId: d.id }))
        .filter(c => c.ownerUid === user.uid || c.applicantUid === user.uid);
      if (chats.length > 0) {
        const mapped = chats.map(c => ({
          id: c.firestoreId,
          partner: c.ownerUid === user.uid ? c.applicantName : c.ownerName,
          partnerAvatar: c.ownerUid === user.uid ? c.applicantAvatar : c.ownerAvatar,
          partnerItem: c.ownerUid === user.uid ? c.applicantItemTitle : c.ownerItemTitle,
          partnerItemImage: c.ownerUid === user.uid ? c.applicantItemImage : c.ownerItemImage,
          myItem: c.ownerUid === user.uid ? c.ownerItemTitle : c.applicantItemTitle,
          myItemImage: c.ownerUid === user.uid ? c.ownerItemImage : c.applicantItemImage,
          status: c.tradeStatus || "交渉中",
          tradeStatus: c.tradeStatus || "交渉中",
          unread: c.unreadCount?.[user.uid] || 0,
          lastMsg: c.lastMsg || "",
          lastTime: c.updatedAt ? new Date(c.updatedAt.toDate()).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "",
          messages: c.messages || [],
        }));
        setThreads(prev => {
          const mockThreads = prev.filter(t => !t.firestoreId);
          return [...mapped, ...mockThreads];
        });
      }
    });
    return () => unsub();
  }, [user]);

  // 申し込みのリアルタイム連携
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "applications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const apps = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter(a => a.itemOwnerUid === user.uid || a.applicantUid === user.uid);
      if (apps.length > 0) setApplications(apps);
    });
    return () => unsub();
  }, [user]);

  // ── LANDING ──
  if (authState !== "app") return (
    <div style={{ fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", background: "#1a1208", minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} .bp:active{transform:scale(.96)}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .au{animation:up .4s ease both}
      `}</style>
      <div style={{ position: "absolute", top: -60, left: -60, width: 250, height: 250, background: "radial-gradient(circle,rgba(212,165,116,.15) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div className="au" style={{ animationDelay: "0ms", textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 72, height: 72, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(212,165,116,.3)" }}>⟳</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 38, color: "#f0ede8", letterSpacing: -1 }}>Swap<span style={{ color: "#d4a574" }}>ru</span></h1>
        <p style={{ color: "#8a7a6a", fontSize: 13, marginTop: 8 }}>お金を使わない、新しい交換体験</p>
      </div>
      <div className="au" style={{ animationDelay: "80ms", width: "100%", marginBottom: 36 }}>
        {[["⟳", "手数料ゼロ", "出品・交換・メッセージすべて無料"], ["🎯", "ザッピングして発見", "AIに頼らず、自分で探す楽しさ"], ["🙋", "欲しいも投稿できる", "「これ頂戴」リクエスト機能つき"]].map(([icon, ttl, desc]) => (
          <div key={ttl} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, background: "rgba(212,165,116,.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
            <div><p style={{ color: "#f0ede8", fontSize: 13, fontWeight: 700 }}>{ttl}</p><p style={{ color: "#8a7a6a", fontSize: 11, marginTop: 1 }}>{desc}</p></div>
          </div>
        ))}
      </div>
      {authState === "landing" ? (
        <div className="au" style={{ animationDelay: "160ms", width: "100%" }}>
          <button onClick={() => handleLogin()} className="bp" style={{ width: "100%", background: "#fff", border: "none", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 11, boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1208", flex: 1, textAlign: "center" }}>Googleでログイン</span>
          </button>
          <button onClick={() => handleLogin()} className="bp" style={{ width: "100%", background: "#06C755", border: "none", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 16px rgba(6,199,85,.3)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.979C23.209 14.146 24 12.459 24 10.314"/></svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff", flex: 1, textAlign: "center" }}>LINEでログイン</span>
          </button>
          <p style={{ color: "#6a5a4a", fontSize: 10, textAlign: "center", lineHeight: 1.7 }}>ログインで<span onClick={() => setLegalModal("terms")} style={{ color: "#d4a574", cursor: "pointer" }}>利用規約</span>・<span onClick={() => setLegalModal("privacy")} style={{ color: "#d4a574", cursor: "pointer" }}>プライバシーポリシー</span>に同意</p>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "3px solid #d4a574", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 12px", animation: "spin .8s linear infinite" }} />
          <p style={{ color: "#d4a574", fontWeight: 700, fontSize: 14 }}>{loginMethod === "google" ? "Google" : "LINE"}で認証中...</p>
          <p style={{ color: "#6a5a4a", fontSize: 10, marginTop: 4 }}>※ デモ: 本番はFirebase Authに接続します</p>
        </div>
      )}
    </div>
  );

  // ── CHAT SCREEN (full screen) ──
  if (view === "chat" && openThread) {
    const thread = openThread;
    const ts = thread.tradeStatus || "交渉中";
    const TRADE_STEPS = ["申し込み", "交渉中", "スワプる！", "発送中", "受取確認", "評価", "完了"];
    const stepIdx = TRADE_STEPS.indexOf(ts);

    const updateTradeStatus = (newStatus, extraMsg) => {
      const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      const sysMsg = { id: Date.now(), from: "system", text: extraMsg, time: now, read: true };
      setOpenThread(prev => ({ ...prev, tradeStatus: newStatus, status: newStatus, messages: [...prev.messages, sysMsg] }));
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, tradeStatus: newStatus, status: newStatus } : t));
    };

    return (
      <div style={{ fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", background: "#f0ede8", height: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
          *{box-sizing:border-box;margin:0;padding:0} .bp:active{transform:scale(.96)}
          @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
          @keyframes fi{from{opacity:0}to{opacity:1}}
          @keyframes spin{to{transform:rotate(360deg)}}
          input,textarea{outline:none}
        `}</style>

        {/* Chat header */}
        <div style={{ background: "#1a1208", padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, boxShadow: "0 2px 16px rgba(0,0,0,.3)" }}>
          <button onClick={() => setView("messages")} style={{ background: "none", border: "none", color: "#d4a574", fontSize: 20, cursor: "pointer", padding: "4px 8px 4px 0" }}>←</button>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1208", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{thread.partnerAvatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#f0ede8", fontWeight: 700, fontSize: 14 }}>{thread.partner}</p>
            <p style={{ color: "#8a7a6a", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.partnerItemImage} {thread.partnerItem}</p>
          </div>
        </div>

        {/* ステータスレール */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e8dfd0", padding: "10px 12px", flexShrink: 0, overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: "max-content", gap: 0 }}>
            {TRADE_STEPS.map((step, i) => {
              const done = i < stepIdx;
              const current = i === stepIdx;
              return (
                <div key={step} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "#d4a574" : current ? "#1a1208" : "#e8dfd0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: done || current ? "#fff" : "#b4a494", fontWeight: 700, flexShrink: 0 }}>
                      {done ? "✓" : i + 1}
                    </div>
                    <p style={{ fontSize: 8, fontWeight: current ? 700 : 400, color: current ? "#1a1208" : done ? "#d4a574" : "#b4a494", whiteSpace: "nowrap" }}>{step}</p>
                  </div>
                  {i < TRADE_STEPS.length - 1 && <div style={{ width: 18, height: 2, background: done ? "#d4a574" : "#e8dfd0", marginBottom: 11, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade context bar */}
        <div style={{ background: "#fff", padding: "10px 14px", borderBottom: "1px solid #e8dfd0", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{thread.myItemImage}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 9, color: "#8a7a6a" }}>あなたが提供</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#1a1208", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.myItem}</p>
            </div>
          </div>
          <span style={{ color: "#c4813a", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>⟳</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <p style={{ fontSize: 9, color: "#8a7a6a" }}>相手が提供</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#1a1208", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.partnerItem}</p>
            </div>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{thread.partnerItemImage}</div>
          </div>
        </div>

        {/* アクションバー（ステータス別） */}
        {ts === "交渉中" && (
          <div style={{ background: "#fffbeb", borderBottom: "1px solid #fcd34d", padding: "9px 14px", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#92400e", flex: 1 }}>💬 条件が合ったら「スワプる！」を押しましょう</p>
            <button onClick={() => updateTradeStatus("スワプる！", "🔁 スワプる申請を送りました！相手の承認を待ちましょう")} className="bp" style={{ background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 9, padding: "7px 13px", color: "#1a1208", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>🔁 スワプる！</button>
          </div>
        )}
        {ts === "スワプる！" && (
          <div style={{ background: "#fffbeb", borderBottom: "1px solid #fcd34d", padding: "9px 14px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#92400e", marginBottom: 7, fontWeight: 600 }}>🔁 スワプる申請が届いています！</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => updateTradeStatus("発送中", "🎉 スワプる成立！お互い発送の準備をしましょう")} className="bp" style={{ flex: 1, background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 9, padding: "8px 0", color: "#1a1208", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✅ スワプる成立！</button>
              <button onClick={() => updateTradeStatus("交渉中", "🙏 申し訳ありませんが、今回はご縁がありませんでした。またの機会によろしくお願いします。")} className="bp" style={{ flex: 1, background: "#f0ede8", border: "1px solid #e8dfd0", borderRadius: 9, padding: "8px 0", color: "#8a7a6a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🙏 ごめんなさい</button>
            </div>
          </div>
        )}
        {ts === "発送中" && (
          <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "9px 14px", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#1e40af", flex: 1 }}>📦 発送が完了したら押してください</p>
            <button onClick={() => updateTradeStatus("受取確認", "📦 発送しました！相手の受取確認を待ちましょう")} className="bp" style={{ background: "#3b82f6", border: "none", borderRadius: 9, padding: "7px 13px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>📦 発送しました</button>
          </div>
        )}
        {ts === "受取確認" && (
          <div style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", padding: "9px 14px", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#15803d", flex: 1 }}>📬 商品は届きましたか？</p>
            <button onClick={() => updateTradeStatus("評価", "✅ 受け取り完了！お互いの評価をお願いします🌟")} className="bp" style={{ background: "#16a34a", border: "none", borderRadius: 9, padding: "7px 13px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>✅ 受け取りました</button>
          </div>
        )}
        {ts === "評価" && (
          <div style={{ background: "#fdf4ff", borderBottom: "1px solid #e9d5ff", padding: "9px 14px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#7e22ce", marginBottom: 7, fontWeight: 600 }}>🌟 {thread.partner} さんを評価してください</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setOpenThread(prev => ({ ...prev, reviewScore: s }))} style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer", opacity: (thread.reviewScore || 0) >= s ? 1 : 0.3 }}>⭐</button>
              ))}
            </div>
            <textarea placeholder="コメントを入力（任意）" value={thread.reviewComment || ""} onChange={e => setOpenThread(prev => ({ ...prev, reviewComment: e.target.value }))} style={{ width: "100%", background: "#fff", border: "1px solid #e9d5ff", borderRadius: 9, padding: "8px 11px", fontSize: 12, color: "#1a1208", resize: "none", height: 56, marginBottom: 7 }} />
            <button onClick={() => { if (!thread.reviewScore) { showToast("⭐ 星をつけてください"); return; } updateTradeStatus("完了", `🎉 スワプる完了！${thread.reviewScore}⭐ の評価をしました。ありがとうございました！`); }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#a855f7,#7e22ce)", border: "none", borderRadius: 9, padding: "9px 0", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>評価を送信する</button>
          </div>
        )}
        {ts === "完了" && (
          <div style={{ background: "#dcfce7", borderBottom: "1px solid #86efac", padding: "9px 14px", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>🎉</span>
            <p style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>スワプる成立！取引が完了しました</p>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
          {thread.messages.map((msg, i) => {
            const isMe = msg.from === "me";
            const isSystem = msg.from === "system";
            if (isSystem) return (
              <div key={msg.id} style={{ textAlign: "center", margin: "10px 0", animation: `up .25s ease both` }}>
                <span style={{ background: "#f0ede8", border: "1px solid #e8dfd0", borderRadius: 20, padding: "5px 14px", fontSize: 10, color: "#8a7a6a" }}>{msg.text}</span>
              </div>
            );
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 10, animation: `up .25s ease ${i * 30}ms both` }}>
                {!isMe && <div style={{ width: 30, height: 30, background: "#d4a574", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>{thread.partnerAvatar}</div>}
                <div style={{ maxWidth: "72%" }}>
                  {msg.imageUrl ? (
                    <img src={msg.imageUrl} style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 12, display: "block" }} />
                  ) : (
                    <div style={{ background: isMe ? "linear-gradient(135deg,#d4a574,#c4813a)" : "#fff", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 13px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
                      <p style={{ fontSize: 13, color: "#1a1208", lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  )}
                  <p style={{ fontSize: 9, color: "#b4a494", marginTop: 3, textAlign: isMe ? "right" : "left" }}>
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
          <AffiliateCard ad={AFFILIATE_ADS[2]} compact />
        </div>

        {/* Input */}
        <div style={{ background: "#fff", padding: "10px 12px", borderTop: "1px solid #e8dfd0", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          {/* 写真送信ボタン */}
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
          <button onClick={() => window._chatImgInput?.click()} className="bp" style={{ width: 40, height: 40, background: "#f0ede8", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18 }}>📷</button>
          <div style={{ flex: 1, background: "#f0ede8", borderRadius: 22, padding: "10px 14px", display: "flex", alignItems: "center" }}>
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="メッセージを入力..." rows={1} style={{ flex: 1, background: "none", border: "none", fontSize: 13, color: "#1a1208", resize: "none", lineHeight: 1.5, maxHeight: 100 }} />
          </div>
          <button onClick={sendMessage} disabled={!chatInput.trim()} className="bp" style={{ width: 42, height: 42, background: chatInput.trim() ? "linear-gradient(135deg,#d4a574,#c4813a)" : "#e8dfd0", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: chatInput.trim() ? "pointer" : "default", flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>↑</span>
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN APP SHELL ──
  return (
    <div style={{ fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", background: "#f0ede8", minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{max-width:430px;margin:0 auto;overflow-x:hidden}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#d4a574;border-radius:2px}
        .ph{transition:transform .18s;cursor:pointer}.ph:active{transform:scale(.97)}
        .bp:active{transform:scale(.95)}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes ti{from{transform:translateY(46px);opacity:0}to{transform:translateY(0);opacity:1}}
        .au{animation:up .32s ease both}.fi{animation:fi .24s ease both}
        input,textarea,select{outline:none}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#1a1208", padding: "12px 16px 10px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 24px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <div onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
            <div style={{ width: 27, height: 27, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⟳</div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, color: "#f0ede8", letterSpacing: -.5 }}>Swap<span style={{ color: "#d4a574" }}>ru</span></span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setView("messages")} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }}>
              <span style={{ color: "#f0ede8", fontSize: 20 }}>💬</span>
              {totalUnread > 0 && <div style={{ position: "absolute", top: -2, right: -4, background: "#ef4444", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{totalUnread}</div>}
            </button>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1208", fontWeight: 700, fontSize: 12, cursor: "pointer" }} onClick={() => setView("mypage")}>{user?.avatar}</div>
          </div>
        </div>
        <div style={{ background: "#2a1f10", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "#8a7a6a", fontSize: 14 }}>🔍</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="商品名・欲しいもので検索..." style={{ background: "none", border: "none", color: "#f0ede8", fontSize: 13, flex: 1 }} />
          {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "#8a7a6a", cursor: "pointer" }}>✕</button>}
        </div>
      </div>

      <div style={{ paddingBottom: 82, minHeight: "100vh", background: "#f0ede8" }}>

        {/* ════ HOME ════ */}
        {view === "home" && (
          <div className="fi">
            <div style={{ background: "linear-gradient(135deg,#1a1208 0%,#3d2b15 55%,#1a1208 100%)", padding: "20px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 150, height: 150, background: "radial-gradient(circle,rgba(212,165,116,.18) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
              <p style={{ color: "#d4a574", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>手数料ゼロ · 完全無料</p>
              <h2 style={{ color: "#f0ede8", fontSize: 20, fontWeight: 900, lineHeight: 1.3, marginBottom: 13 }}>不要なものを<br /><span style={{ color: "#d4a574" }}>価値ある交換へ</span></h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setView("list"); setListTab("offer"); }} className="bp" style={{ background: "#d4a574", border: "none", borderRadius: 9, padding: "9px 14px", color: "#1a1208", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>出品を探す →</button>
                <button onClick={() => { setView("list"); setListTab("want"); }} className="bp" style={{ background: "rgba(59,130,246,.2)", border: "1px solid rgba(59,130,246,.4)", borderRadius: 9, padding: "9px 14px", color: "#93c5fd", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🙋 欲しいを見る</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#d4c4a8", marginBottom: 12 }}>
              {[["12.4K", "出品数"], ["5.2K", "欲しいリスト"], ["¥0", "手数料"]].map(([n, l]) => (
                <div key={l} style={{ background: "#f7f4ef", padding: "11px 0", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: l === "手数料" ? "#16a34a" : "#1a1208" }}>{n}</div>
                  <div style={{ fontSize: 9, color: "#8a7a6a", marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 14px 10px" }}><AffiliateCard ad={AFFILIATE_ADS[0]} /></div>
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
            <div style={{ padding: "0 14px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1208" }}>🙋 新着「欲しい」</p>
                <button onClick={() => { setView("list"); setListTab("want"); }} className="bp" style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>すべて →</button>
              </div>
              {SAMPLE_WANTLIST.slice(0, 2).map((w, i) => <WantCard key={w.id} item={w} onRespond={(it) => setShowTradeModal({ ...it, fromWant: true })} delay={i * 55} />)}
            </div>
            <div style={{ padding: "0 14px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1208" }}>🔥 新着出品</p>
                <button onClick={() => { setView("list"); setListTab("offer"); }} className="bp" style={{ background: "none", border: "none", color: "#c4813a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>すべて →</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                {ALL_ITEMS.slice(0, 4).map((item, i) => <ItemCard key={item.id} item={item} liked={likedItems.includes(item.id)} onLike={toggleLike} onClick={() => openDetail(item)} delay={i * 55} />)}
              </div>
            </div>
            <div style={{ padding: "12px 14px 0" }}>{AFFILIATE_ADS.slice(1).map(ad => <AffiliateCard key={ad.id} ad={ad} compact />)}</div>
          </div>
        )}

        {/* ════ LIST ════ */}
        {view === "list" && (
          <div className="fi">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#1a1208", borderBottom: "1px solid #2a1f10" }}>
              {[["offer", "🔥 出品一覧"], ["want", "🙋 欲しいリスト"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setListTab(tab)} className="bp" style={{ background: "none", border: "none", padding: "11px 0", fontWeight: 700, fontSize: 13, color: listTab === tab ? "#d4a574" : "#6a5a4a", cursor: "pointer", borderBottom: listTab === tab ? "2px solid #d4a574" : "2px solid transparent" }}>{label}</button>
              ))}
            </div>
            <div style={{ padding: "8px 12px 4px", display: "flex", overflowX: "auto", gap: 6 }}>
              {CATEGORIES.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className="bp" style={{ flexShrink: 0, background: selectedCategory === cat ? "#1a1208" : "#fff", border: `1px solid ${selectedCategory === cat ? "#1a1208" : "#e8dfd0"}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: selectedCategory === cat ? "#d4a574" : "#5a4a3a", cursor: "pointer" }}>{cat}</button>)}
            </div>
            {listTab === "offer" && (
              <div style={{ padding: "4px 14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {filteredItems.map((item, i) => <ItemCard key={item.id} item={item} liked={likedItems.includes(item.id)} onLike={toggleLike} onClick={() => openDetail(item)} delay={i * 35} />)}
                </div>
                <div style={{ marginTop: 12 }}><AffiliateCard ad={AFFILIATE_ADS[2]} /></div>
              </div>
            )}
            {listTab === "want" && (
              <div style={{ padding: "4px 14px" }}>
                <div style={{ background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 11, padding: "9px 12px", marginBottom: 10, display: "flex", gap: 7 }}>
                  <span style={{ fontSize: 16 }}>💡</span>
                  <p style={{ fontSize: 11, color: "#1d4ed8" }}>「これ持ってる！」と思ったら<strong>「応じる」</strong>ボタンを押そう</p>
                </div>
                {filteredWants.map((item, i) => <WantCard key={item.id} item={item} onRespond={(it) => setShowTradeModal({ ...it, fromWant: true })} delay={i * 50} />)}
                <AffiliateCard ad={AFFILIATE_ADS[2]} />
              </div>
            )}
          </div>
        )}

        {/* ════ DETAIL ════ */}
        {view === "detail" && selectedItem && (
          <div className="au">
            <button onClick={() => setView("list")} style={{ margin: "12px 14px 0", background: "none", border: "none", color: "#5a4a3a", fontSize: 12, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>← 戻る</button>
            <div style={{ background: "#fff", margin: "9px 14px", borderRadius: 17, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
              <div style={{ background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 76, position: "relative" }}>
                {selectedItem.imageUrls?.[0] ? <img src={selectedItem.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : selectedItem.image}
                <button onClick={e => toggleLike(selectedItem.id, e)} style={{ position: "absolute", bottom: 9, right: 9, background: "rgba(255,255,255,.9)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{likedItems.includes(selectedItem.id) ? "❤️" : "🤍"}</button>
              </div>
              <div style={{ padding: "15px 15px 17px" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1a1208", lineHeight: 1.3, marginBottom: 7 }}>{selectedItem.title}</h2>
                <div style={{ display: "flex", gap: 5, marginBottom: 11, flexWrap: "wrap" }}>
                  <span style={{ background: "#f0ede8", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: "#5a4a3a" }}>{selectedItem.category}</span>
                  {selectedItem.subCategory && <span style={{ background: "#e8dfd0", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: "#5a4a3a" }}>{selectedItem.subCategory}</span>}
                  <span style={{ background: "#e8f5e9", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: "#2e7d32" }}>{selectedItem.condition}</span>
                </div>
                {selectedItem.category === "🎁 お中元・お歳暮" && (selectedItem.expiryDate || selectedItem.shippingNote) && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 11, padding: 11, marginBottom: 11 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 7 }}>🎁 食品・ギフト情報</p>
                    {selectedItem.expiryDate && <p style={{ fontSize: 11, color: "#5a4a3a", marginBottom: 4 }}>📅 賞味期限：<span style={{ fontWeight: 700 }}>{selectedItem.expiryDate}</span></p>}
                    {selectedItem.shippingNote && <p style={{ fontSize: 11, color: "#5a4a3a" }}>🚚 発送・保存：<span style={{ fontWeight: 700, color: selectedItem.shippingNote === "常温OK" ? "#16a34a" : "#d97706" }}>{selectedItem.shippingNote}</span></p>}
                  </div>
                )}
                <div style={{ background: "#f7f4ef", borderRadius: 12, padding: 12, marginBottom: 11 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#c4813a", marginBottom: 6 }}>↔ 交換希望</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{selectedItem.wantItems?.map(w => <span key={w} style={{ background: "#fff", border: "1px solid #e8dfd0", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#3d2b15" }}>{w}</span>)}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: "#8a7a6a", fontWeight: 600, letterSpacing: 1, marginBottom: 5 }}>PR · このカテゴリのおすすめ</p>
                  {getAdsForCategory(selectedItem.category).slice(0, 1).map(ad => <AffiliateCard key={ad.id} ad={ad} compact />)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, background: "#d4a574", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>{selectedItem.ownerAvatar}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1a1208" }}>{selectedItem.owner}</p>
                    <p style={{ fontSize: 10, color: "#8a7a6a" }}>📍 {selectedItem.location}</p>
                  </div>
                  <p style={{ fontSize: 10, color: "#8a7a6a" }}>👁 {selectedItem.views} · ❤️ {(selectedItem.likes || 0) + (likedItems.includes(selectedItem.id) ? 1 : 0)}</p>
                </div>
                <button onClick={() => { setShowTradeModal(selectedItem); setSelectedMyItem(null); }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 12, padding: 13, color: "#1a1208", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 7 }}>⟳ 交換を申し込む（無料）</button>
                <button onClick={() => { const t = threads.find(t => t.partner === selectedItem.owner); if (t) { openChat(t); } else { showToast("💬 メッセージを送りました！"); } }} className="bp" style={{ width: "100%", background: "#f0ede8", border: "none", borderRadius: 12, padding: 11, color: "#5a4a3a", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 7 }}>💬 メッセージを送る</button>
                <button onClick={() => handleShare(selectedItem)} className="bp" style={{ width: "100%", background: "#fff", border: "1px solid #e8dfd0", borderRadius: 12, padding: 11, color: "#5a4a3a", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 7 }}>
                  <span>📤</span>
                  <span>シェアする</span>
                  <span style={{ background: "#f0ede8", borderRadius: 20, padding: "2px 8px", fontSize: 10, color: "#c4813a", fontWeight: 700 }}>3回で上位権利GET</span>
                </button>
                <button onClick={() => { setShowReportModal(selectedItem); setReportReason(""); }} className="bp" style={{ width: "100%", background: "none", border: "none", padding: "6px 0", color: "#b4a494", fontSize: 11, cursor: "pointer" }}>🚨 この出品を通報する</button>
              </div>
            </div>
          </div>
        )}

        {/* ════ MESSAGES ════ */}
        {view === "messages" && (
          <div className="fi">
            <div style={{ padding: "14px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1208" }}>💬 メッセージ</h2>
              {totalUnread > 0 && <span style={{ background: "#ef4444", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#fff" }}>{totalUnread}件未読</span>}
            </div>

            {/* 申し込み受信ボックス */}
            {applications.filter(a => a.status === "申し込み中" || a.status === "保留中").length > 0 && (
              <div style={{ margin: "0 14px 12px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#c4813a", letterSpacing: 1, marginBottom: 7 }}>📨 申し込み</p>
                {applications.filter(a => a.status === "申し込み中" || a.status === "保留中").map(app => (
                  <div key={app.id} style={{ background: "#fff", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1208", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{app.applicant?.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 2 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208" }}>{app.applicant}</p>
                          <span style={{ background: app.status === "保留中" ? "#fffbeb" : "#eff6ff", borderRadius: 20, padding: "1px 7px", fontSize: 9, fontWeight: 700, color: app.status === "保留中" ? "#d97706" : "#3b82f6" }}>{app.status}</span>
                        </div>
                        <p style={{ fontSize: 11, color: "#8a7a6a" }}>{app.myItemImage} {app.myItemTitle} → {app.itemImage} {app.itemTitle}</p>
                      </div>
                    </div>
                    {app.message && <p style={{ fontSize: 11, color: "#5a4a3a", background: "#f7f4ef", borderRadius: 9, padding: "8px 10px", marginBottom: 10 }}>「{app.message}」</p>}
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => respondToApplication(app.id, "交渉する")} className="bp" style={{ flex: 2, background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#1a1208", cursor: "pointer" }}>🤝 交渉する</button>
                      <button onClick={() => respondToApplication(app.id, "保留")} className="bp" style={{ flex: 1, background: "#f0ede8", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#8a7a6a", cursor: "pointer" }}>📋 保留</button>
                      <button onClick={() => respondToApplication(app.id, "ごめんなさい")} className="bp" style={{ flex: 1, background: "#fef2f2", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>🙏 ごめん</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 自分の申し込み状況 */}
            {applications.filter(a => a.applicantUid === user?.uid && a.status === "申し込み中").length > 0 && (
              <div style={{ margin: "0 14px 12px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#8a7a6a", letterSpacing: 1, marginBottom: 7 }}>📤 申し込み中</p>
                {applications.filter(a => a.applicantUid === user?.uid && a.status === "申し込み中").map(app => (
                  <div key={app.id} style={{ background: "#fff", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.06)", display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 24 }}>{app.itemImage}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: "#1a1208", marginBottom: 2 }}>{app.itemTitle}</p>
                      <p style={{ fontSize: 10, color: "#8a7a6a" }}>返答待ち（24時間以内）</p>
                    </div>
                    <button onClick={() => cancelApplication(app.id)} className="bp" style={{ background: "#fef2f2", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 11, fontWeight: 700, color: "#ef4444", cursor: "pointer", flexShrink: 0 }}>キャンセル</button>
                  </div>
                ))}
              </div>
            )}

            {/* チャット一覧 */}
            {threads.length > 0 && <p style={{ fontSize: 10, fontWeight: 700, color: "#8a7a6a", letterSpacing: 1, margin: "0 14px 7px" }}>💬 チャット</p>}
            {threads.map((thread, i) => (
              <div key={thread.id} className="ph au" style={{ background: "#fff", margin: "0 14px 8px", borderRadius: 14, padding: 13, display: "flex", gap: 11, alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,.06)", animationDelay: `${i * 55}ms`, position: "relative" }} onClick={() => openChat(thread)}>
                {thread.unread > 0 && <div style={{ position: "absolute", top: 10, right: 10, background: "#ef4444", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{thread.unread}</div>}
                <div style={{ width: 46, height: 46, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1208", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{thread.partnerAvatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208" }}>{thread.partner}</p>
                    <p style={{ fontSize: 10, color: "#8a7a6a", flexShrink: 0, marginLeft: 8 }}>{thread.lastTime}</p>
                  </div>
                  <div style={{ display: "flex", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontSize: 11 }}>{thread.myItemImage}</span>
                    <span style={{ fontSize: 10, color: "#8a7a6a" }}>⟳</span>
                    <span style={{ fontSize: 11 }}>{thread.partnerItemImage}</span>
                    <span style={{ background: thread.status === "スワプる成立！" ? "#dcfce7" : "#fef3c7", borderRadius: 20, padding: "1px 7px", fontSize: 9, fontWeight: 700, color: thread.status === "スワプる成立！" ? "#16a34a" : "#d97706" }}>{thread.status}</span>
                  </div>
                  <p style={{ fontSize: 11, color: thread.unread > 0 ? "#1a1208" : "#8a7a6a", fontWeight: thread.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.lastMsg}</p>
                </div>
              </div>
            ))}
            <div style={{ padding: "4px 14px 0" }}><AffiliateCard ad={AFFILIATE_ADS[2]} compact /></div>
          </div>
        )}

        {/* ════ MATCH ════ */}
        {view === "match" && (
          <div className="fi" style={{ padding: "13px 14px 0" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1208", marginBottom: 2 }}>🎯 キーワードマッチ</h2>
            <p style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 12 }}>あなたの出品物のキーワードを求めている人。自分でザッピングして確かめよう！</p>
            <div style={{ background: "#1a1208", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 9, color: "#d4a574", fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>あなたの出品中</p>
              <div style={{ display: "flex", gap: 7 }}>{myItems.map(item => <div key={item.id} style={{ background: "rgba(255,255,255,.08)", borderRadius: 9, padding: "7px 10px", flex: 1, display: "flex", gap: 7, alignItems: "center" }}><span style={{ fontSize: 20 }}>{item.image}</span><p style={{ fontSize: 10, color: "#f0ede8", fontWeight: 600, lineHeight: 1.2 }}>{item.title}</p></div>)}</div>
            </div>
            {matchedItems.map((item, i) => {
              const reasons = getMatchReasons(item, myItems);
              return (
                <div key={item.id} className="au" style={{ background: "#fff", borderRadius: 14, marginBottom: 10, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.06)", animationDelay: `${i * 50}ms` }}>
                  <div style={{ background: "#fef9f0", padding: "8px 13px", borderBottom: "1px solid #f0ede8", display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#c4813a" }}>🎯</span>
                    {reasons.map((r, ri) => <span key={ri} style={{ background: "#fff", border: "1px solid #e8dfd0", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#3d2b15" }}>{r.myImage} {r.myItem.split(" ")[0]} → <span style={{ color: "#c4813a" }}>「{r.want}」</span></span>)}
                  </div>
                  <div style={{ padding: 12, display: "flex", gap: 10, cursor: "pointer" }} onClick={() => openDetail(item)}>
                    <div style={{ width: 62, height: 62, background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>{item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : item.image}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208", marginBottom: 4 }}>{item.title}</p>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{item.wantItems.map(w => <span key={w} style={{ background: reasons.some(r => r.want === w) ? "#fef3c7" : "#f7f4ef", border: `1px solid ${reasons.some(r => r.want === w) ? "#fcd34d" : "#e8dfd0"}`, borderRadius: 20, padding: "2px 7px", fontSize: 10, fontWeight: 600, color: reasons.some(r => r.want === w) ? "#d97706" : "#3d2b15" }}>{w}</span>)}</div>
                    </div>
                  </div>
                  <div style={{ padding: "0 12px 12px", display: "flex", gap: 7 }}>
                    <button onClick={() => { setShowTradeModal(item); setSelectedMyItem(null); }} className="bp" style={{ flex: 1, background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 9, padding: 9, color: "#1a1208", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>⟳ 交換申し込む</button>
                    <button onClick={e => toggleLike(item.id, e)} className="bp" style={{ width: 38, background: "#f0ede8", border: "none", borderRadius: 9, fontSize: 16, cursor: "pointer" }}>{likedItems.includes(item.id) ? "❤️" : "🤍"}</button>
                  </div>
                </div>
              );
            })}
            <AffiliateCard ad={AFFILIATE_ADS[2]} />
          </div>
        )}

        {/* ════ MYPAGE ════ */}
        {view === "mypage" && (
          <div className="fi" style={{ width: "100%" }}>
            {/* Profile header */}
            <div style={{ background: "linear-gradient(135deg,#1a1208,#3d2b15)", padding: "20px 16px", color: "#f0ede8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>{user?.avatar}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{profileForm.name || user?.name}</p>
                  <p style={{ fontSize: 11, color: "#8a7a6a", marginTop: 2 }}>{profileForm.bio || "自己紹介を追加しよう"}</p>
                  <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                    <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 20, padding: "2px 8px", fontSize: 9, color: "#d4a574", fontWeight: 700 }}>{user?.method === "google" ? "🔵 Google" : "🟢 LINE"}</span>
                    <span style={{ background: "rgba(22,163,74,.2)", borderRadius: 20, padding: "2px 8px", fontSize: 9, color: "#4ade80", fontWeight: 700 }}>✅ 無料</span>
                  </div>
                </div>
                <button onClick={() => setMypageTab("settings")} className="bp" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 9, padding: "7px 11px", color: "#d4a574", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>⚙ 設定</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7 }}>
                {[["2", "出品中"], ["1", "交換中"], ["5", "成立"], [totalUnread, "未読"]].map(([n, l]) => (
                  <div key={l} style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: l === "未読" && Number(n) > 0 ? "#ef4444" : "#d4a574" }}>{n}</p>
                    <p style={{ fontSize: 9, color: "#b4a494" }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fff", borderBottom: "1px solid #e8dfd0" }}>
              {[["listings", "📦 出品管理"], ["history", "🔄 取引履歴"], ["settings", "⚙ 設定"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setMypageTab(tab)} className="bp" style={{ background: "none", border: "none", padding: "11px 0", fontWeight: 700, fontSize: 12, color: mypageTab === tab ? "#c4813a" : "#8a7a6a", cursor: "pointer", borderBottom: mypageTab === tab ? "2px solid #c4813a" : "2px solid transparent" }}>{label}</button>
              ))}
            </div>

            {/* ── 出品管理タブ ── */}
            {mypageTab === "listings" && (
              <div style={{ padding: 14, width: "100%" }}>
                <button onClick={() => setShowPostModal(true)} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 12, padding: 13, color: "#1a1208", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  ➕ 新しく出品する
                </button>

                {myItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#8a7a6a" }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
                    <p style={{ fontWeight: 600 }}>まだ出品がありません</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>上のボタンから出品してみよう！</p>
                  </div>
                ) : myItems.map(item => (
                  <div key={item.id} style={{ background: "#fff", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ width: 54, height: 54, background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : item.image}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208", marginBottom: 3 }}>{item.title}</p>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ background: "#f0ede8", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#5a4a3a" }}>{item.category}</span>
                          <span style={{ background: "#f0ede8", borderRadius: 20, padding: "2px 8px", fontSize: 10, color: "#5a4a3a" }}>{item.condition}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#8a7a6a" }}>
                          <span>👁 {item.views}</span><span>❤️ {item.likes}</span>
                        </div>
                      </div>
                      <span style={{ background: item.status === "出品中" ? "#dcfce7" : item.status === "交換中" ? "#fef3c7" : "#f3f4f6", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: item.status === "出品中" ? "#16a34a" : item.status === "交換中" ? "#d97706" : "#6b7280", flexShrink: 0 }}>{item.status}</span>
                    </div>
                    <div style={{ background: "#f7f4ef", borderRadius: 9, padding: "7px 10px", marginBottom: 10 }}>
                      <p style={{ fontSize: 10, color: "#c4813a", fontWeight: 700, marginBottom: 3 }}>↔ 交換希望</p>
                      <p style={{ fontSize: 11, color: "#5a4a3a" }}>{item.wantItems?.join("・")}</p>
                    </div>
                    {/* アクションボタン */}
                    <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
                      <button onClick={() => { setEditingItem(item); setPostForm({ title: item.title, category: item.category, condition: item.condition, detail: "", wantItems: item.wantItems?.join("、"), image: item.image }); setPostType("offer"); setShowPostModal(true); }} className="bp" style={{ flex: 1, background: "#f0ede8", border: "none", borderRadius: 9, padding: "8px 0", color: "#5a4a3a", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>✏️ 編集</button>
                      <button onClick={() => toggleItemStatus(item)} className="bp" style={{ flex: 1, background: "#f0ede8", border: "none", borderRadius: 9, padding: "8px 0", color: item.status === "非公開" ? "#16a34a" : "#d97706", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{item.status === "非公開" ? "👁 公開する" : "🙈 非公開"}</button>
                      <button onClick={() => deleteMyItem(item)} className="bp" style={{ width: 38, background: "#fef2f2", border: "none", borderRadius: 9, color: "#ef4444", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🗑</button>
                    </div>
                    <button onClick={() => handleBoost(item.id)} className="bp" style={{ width: "100%", background: boostedItemId === item.id ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : boostCredits > 0 ? "linear-gradient(135deg,#1a1208,#3d2b15)" : "#f0ede8", border: "none", borderRadius: 9, padding: "8px 0", color: boostedItemId === item.id ? "#1a1208" : boostCredits > 0 ? "#d4a574" : "#b4a494", fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {boostedItemId === item.id ? "🚀 上位表示中（48h）" : boostCredits > 0 ? `🚀 上位表示する（権利 ${boostCredits}/2）` : "🚀 上位表示（シェア3回でGET）"}
                    </button>
                  </div>
                ))}

                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 10, color: "#8a7a6a", fontWeight: 600, letterSpacing: 1, marginBottom: 7 }}>PR · おすすめ</p>
                  {AFFILIATE_ADS.map(ad => <AffiliateCard key={ad.id} ad={ad} compact />)}
                </div>
              </div>
            )}

            {/* ── 取引履歴タブ ── */}
            {mypageTab === "history" && (
              <div style={{ padding: 14, width: "100%" }}>

                {/* 進行中 */}
                <p style={{ fontSize: 11, fontWeight: 700, color: "#c4813a", letterSpacing: 1, marginBottom: 9 }}>⏳ 進行中</p>
                {threads.filter(t => t.status === "交渉中").length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 12, padding: "20px", textAlign: "center", color: "#8a7a6a", marginBottom: 18 }}>
                    <p style={{ fontSize: 13 }}>進行中の取引はありません</p>
                  </div>
                ) : threads.filter(t => t.status === "交渉中").map(t => (
                  <div key={t.id} onClick={() => openChat(t)} className="ph" style={{ background: "#fff", borderRadius: 14, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)", border: "1px solid #fcd34d" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ flex: 1, background: "#f7f4ef", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.myItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#1a1208", marginTop: 2 }}>{t.myItem}</p>
                      </div>
                      <div style={{ color: "#d4a574", fontSize: 18, fontWeight: 700 }}>⟳</div>
                      <div style={{ flex: 1, background: "#f7f4ef", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.partnerItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#1a1208", marginTop: 2 }}>{t.partnerItem}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 11, color: "#8a7a6a" }}>@{t.partner}</p>
                      <span style={{ background: "#fef3c7", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#d97706" }}>💬 交渉中 →</span>
                    </div>
                  </div>
                ))}

                {/* 完了済み */}
                <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", letterSpacing: 1, marginBottom: 9, marginTop: 4 }}>✅ 完了済み</p>
                {threads.filter(t => t.status === "交換成立").map(t => (
                  <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ flex: 1, background: "#f7f4ef", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.myItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#1a1208", marginTop: 2 }}>{t.myItem}</p>
                      </div>
                      <div style={{ color: "#d4a574", fontSize: 18, fontWeight: 700 }}>⟳</div>
                      <div style={{ flex: 1, background: "#f7f4ef", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.partnerItemImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#1a1208", marginTop: 2 }}>{t.partnerItem}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 11, color: "#8a7a6a" }}>@{t.partner}</p>
                      <span style={{ background: "#dcfce7", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#16a34a" }}>✅ 交換成立</span>
                    </div>
                  </div>
                ))}
                {[{ id: "t1", myItem: "ミラーレスカメラ", myImage: "📸", theirItem: "エレキギター", theirImage: "🎸", partner: "music_fan", date: "2025/12/10" }, { id: "t2", myItem: "キーボード", myImage: "🎹", theirItem: "コントローラー", theirImage: "🎮", partner: "gamer_pro", date: "2025/11/28" }].map(t => (
                  <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ flex: 1, background: "#f7f4ef", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.myImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#1a1208", marginTop: 2 }}>{t.myItem}</p>
                      </div>
                      <div style={{ color: "#d4a574", fontSize: 18, fontWeight: 700 }}>⟳</div>
                      <div style={{ flex: 1, background: "#f7f4ef", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{t.theirImage}</div>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#1a1208", marginTop: 2 }}>{t.theirItem}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 11, color: "#8a7a6a" }}>@{t.partner} · {t.date}</p>
                      <span style={{ background: "#dcfce7", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#16a34a" }}>✅ 完了</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── 設定タブ ── */}
            {mypageTab === "settings" && (
              <div style={{ padding: 14, width: "100%" }}>

                {/* シェア・上位表示ステータス */}
                <div style={{ background: "linear-gradient(135deg,#1a1208,#3d2b15)", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d4a574", marginBottom: 12 }}>🚀 シェア＆上位表示</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 10, padding: 11, textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#d4a574" }}>{shareCount}</p>
                      <p style={{ fontSize: 10, color: "#8a7a6a" }}>累積シェア数</p>
                      <p style={{ fontSize: 9, color: "#6a5a4a", marginTop: 2 }}>次の権利まであと{3 - (shareCount % 3)}回</p>
                    </div>
                    <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 10, padding: 11, textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: boostCredits > 0 ? "#fbbf24" : "#6a5a4a" }}>{boostCredits}/2</p>
                      <p style={{ fontSize: 10, color: "#8a7a6a" }}>上位表示権利</p>
                      <p style={{ fontSize: 9, color: "#6a5a4a", marginTop: 2 }}>最大2つストック可</p>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: (shareCount % 3) >= i ? "#d4a574" : "rgba(255,255,255,.15)" }} />)}
                    </div>
                    <p style={{ fontSize: 10, color: "#8a7a6a", textAlign: "center" }}>シェア3回で上位表示権利GET！</p>
                  </div>
                </div>
                {/* プロフィール */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1a1208", marginBottom: 13 }}>👤 プロフィール</h3>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 70, height: 70, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: profileForm.avatarEmoji ? 36 : 28, fontWeight: 700, color: "#1a1208", marginBottom: 8, overflow: "hidden", flexShrink: 0 }}>
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
                      <button onClick={() => window._avatarInput?.click()} className="bp" style={{ background: "#f0ede8", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#5a4a3a", cursor: "pointer" }}>📷 写真</button>
                      <button onClick={() => setProfileForm(f => ({ ...f, showEmojiPicker: !f.showEmojiPicker }))} className="bp" style={{ background: "#f0ede8", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#5a4a3a", cursor: "pointer" }}>😀 絵文字</button>
                    </div>
                    {profileForm.showEmojiPicker && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, background: "#f7f4ef", borderRadius: 12, padding: 10, marginBottom: 8 }}>
                        {["😀","😎","🤩","🥳","😸","🐶","🐱","🦊","🐼","🐨","🦁","🐯","🐸","🐧","🦋","🌸","⭐","🎸","📷","🎮","🏄","🧗","🎨","🍕","☕"].map(em => (
                          <button key={em} onClick={() => setProfileForm(f => ({ ...f, avatarEmoji: em, avatarUrl: null, showEmojiPicker: false }))} style={{ width: 36, height: 36, background: "none", border: "none", fontSize: 22, cursor: "pointer", borderRadius: 8 }}>{em}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {[["ニックネーム", "name", "例: カメラ好き太郎"], ["自己紹介", "bio", "例: カメラ・楽器好きです。丁寧な取引を心がけています。"]].map(([label, key, ph]) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#5a4a3a", marginBottom: 5 }}>{label}</p>
                      {key === "bio" ? (
                        <textarea value={profileForm[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#1a1208", height: 72, resize: "none" }} />
                      ) : (
                        <input value={profileForm[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#1a1208" }} />
                      )}
                    </div>
                  ))}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#5a4a3a", marginBottom: 5 }}>活動エリア</p>
                    <select value={profileForm.location} onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))} disabled={profileForm.locationPrivate} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: profileForm.locationPrivate ? "#b4a494" : "#1a1208", cursor: "pointer", marginBottom: 7 }}>
                      {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div onClick={() => setProfileForm(f => ({ ...f, locationPrivate: !f.locationPrivate }))} style={{ width: 36, height: 20, background: profileForm.locationPrivate ? "#d4a574" : "#e8dfd0", borderRadius: 10, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", top: 2, left: profileForm.locationPrivate ? 17 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                      </div>
                      <p style={{ fontSize: 11, color: "#8a7a6a" }}>エリアを非公開にする</p>
                    </div>
                  </div>
                  <button onClick={() => showToast("✅ プロフィールを保存しました")} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 11, padding: 12, color: "#1a1208", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>保存する</button>
                </div>

                {/* 気になるカテゴリ */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1a1208", marginBottom: 4 }}>🎯 気になるカテゴリ</h3>
                  <p style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 12 }}>最大3つ選択 · 欲しいリストの上位に表示されます</p>
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
                        }} className="bp" style={{ background: selected ? "#1a1208" : "#f7f4ef", border: `2px solid ${selected ? "#d4a574" : "transparent"}`, borderRadius: 20, padding: "7px 13px", fontSize: 12, fontWeight: 700, color: selected ? "#d4a574" : "#5a4a3a", cursor: "pointer" }}>
                          {cat} {selected && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 通知設定 */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1a1208", marginBottom: 13 }}>🔔 通知設定</h3>
                  {[["notify_message", "新しいメッセージ", "交渉中の相手からメッセージが届いたとき"], ["notify_match", "キーワードマッチ", "出品物のキーワードを求める人が現れたとき"], ["notify_news", "お知らせ", "アップデートや新機能のお知らせ"]].map(([key, label, desc]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f0ede8" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1208" }}>{label}</p>
                        <p style={{ fontSize: 10, color: "#8a7a6a", marginTop: 2 }}>{desc}</p>
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
                      }} style={{ width: 44, height: 24, background: profileForm[key] ? "#d4a574" : "#e8dfd0", borderRadius: 12, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", top: 3, left: profileForm[key] ? 22 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* アカウント設定 */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1a1208", marginBottom: 13 }}>🔐 アカウント</h3>
                  <div style={{ background: "#f7f4ef", borderRadius: 10, padding: "11px 13px", marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 2 }}>ログイン方法</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1208" }}>{user?.method === "google" ? "🔵 Google アカウント" : "🟢 LINE アカウント"}</p>
                    {user?.email && <p style={{ fontSize: 11, color: "#8a7a6a", marginTop: 2 }}>{user.email}</p>}
                  </div>
                  <button onClick={() => setLegalModal("terms")} className="bp" style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 10, padding: "11px", color: "#5a4a3a", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 7 }}>📋 利用規約を見る</button>
                  <button onClick={() => setLegalModal("privacy")} className="bp" style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 10, padding: "11px", color: "#5a4a3a", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 7 }}>🔒 プライバシーポリシー</button>
                  <button onClick={() => setLegalModal("contact")} className="bp" style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 10, padding: "11px", color: "#5a4a3a", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>📮 お問い合わせ</button>
                </div>

                {isAdmin && <button onClick={() => setView("admin")} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#1a1208,#3d2b15)", border: "none", borderRadius: 12, padding: 12, color: "#d4a574", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 7 }}>🛡️ 管理画面</button>}
                <button onClick={() => { setUser(null); setAuthState("landing"); }} className="bp" style={{ width: "100%", background: "none", border: "1px solid #e8dfd0", borderRadius: 12, padding: 12, color: "#8a7a6a", fontSize: 13, cursor: "pointer", marginBottom: 7 }}>ログアウト</button>
                <button className="bp" style={{ width: "100%", background: "none", border: "1px solid #fecaca", borderRadius: 12, padding: 12, color: "#ef4444", fontSize: 12, cursor: "pointer" }}>アカウントを削除する</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── POST MODAL ── */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => { setShowPostModal(false); setEditingItem(null); }}>
          <div style={{ background: "#f0ede8", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", padding: 20, maxHeight: "92vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#d4c4a8", borderRadius: 2, margin: "0 auto 15px" }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1a1208", marginBottom: editingItem ? 14 : 3 }}>{editingItem ? "✏️ 出品を編集" : "新規投稿"}</h2>
            {!editingItem && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                {[["offer", "🔥 出品する", "持っているものを交換に出す"], ["want", "🙋 欲しいを投稿", "これと交換してほしいとリクエスト"]].map(([type, ttl, desc]) => (
                  <button key={type} onClick={() => setPostType(type)} className="bp" style={{ background: postType === type ? "#1a1208" : "#fff", border: `2px solid ${postType === type ? "#d4a574" : "#e8dfd0"}`, borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: postType === type ? "#d4a574" : "#1a1208", marginBottom: 2 }}>{ttl}</p>
                    <p style={{ fontSize: 9, color: postType === type ? "#8a7a6a" : "#9a8a7a", lineHeight: 1.4 }}>{desc}</p>
                  </button>
                ))}
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 13, padding: 15, marginBottom: 11 }}>
              {/* 画像 */}
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
                <div onClick={() => { if ((postForm.imageUrls || []).length >= 3) { showToast("⚠️ 写真は最大3枚です"); return; } window._imgInput?.click(); }} style={{ border: "2px dashed #e8dfd0", borderRadius: 10, height: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 8, background: "#fafafa" }}>
                  {postForm.uploading ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ width: 28, height: 28, border: "3px solid #d4a574", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 6px", animation: "spin .8s linear infinite" }} />
                      <p style={{ fontSize: 11, color: "#8a7a6a" }}>アップロード中...</p>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 28, marginBottom: 4 }}>📷</span>
                      <p style={{ fontSize: 12, color: "#8a7a6a", fontWeight: 600 }}>写真を追加</p>
                      <p style={{ fontSize: 10, color: "#b4a494" }}>{(postForm.imageUrls || []).length}/3枚</p>
                    </>
                  )}
                </div>
                {postForm.imageUrls?.length > 0 && (
                  <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 }}>
                    {postForm.imageUrls.map((url, i) => (
                      <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                        <img src={url} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 9, border: "2px solid #e8dfd0" }} />
                        <button onClick={() => setPostForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, j) => j !== i) }))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, background: "#ef4444", border: "none", borderRadius: "50%", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 絵文字アイコン選択 */}
              <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 13, paddingBottom: 3 }}>
                {["📷","🎸","🎮","⛺","☕","🚲","📸","👜","🎵","🎥","📱","💻","⌚","🎒","🎹"].map(em => (
                  <button key={em} onClick={() => setPostForm(f => ({ ...f, image: em }))} style={{ width: 38, height: 38, background: postForm.image === em ? "#1a1208" : "#f7f4ef", border: `2px solid ${postForm.image === em ? "#d4a574" : "transparent"}`, borderRadius: 9, fontSize: 20, cursor: "pointer", flexShrink: 0 }}>{em}</button>
                ))}
              </div>
              {/* フォームフィールド */}
              {[["商品名・タイトル", "title", postType === "offer" ? "例: Canon AE-1 フィルムカメラ" : "例: フィルムカメラ全般"], ["詳細・説明", "detail", postType === "offer" ? "状態、付属品など..." : "希望条件など..."], [postType === "offer" ? "交換希望アイテム（カンマ区切り）" : "交換に出せるもの", "wantItems", postType === "offer" ? "例: ギター, ゲーム機" : "例: Nintendo Switch"]].map(([label, key, ph]) => (
                <div key={key} style={{ marginBottom: 11 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 4 }}>{label}</p>
                  {key === "detail" ? (
                    <textarea value={postForm[key]} onChange={e => setPostForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#1a1208", height: 65, resize: "none" }} />
                  ) : (
                    <input value={postForm[key]} onChange={e => setPostForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#1a1208" }} />
                  )}
                </div>
              ))}
              {/* カテゴリ・状態 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 4 }}>カテゴリー</p>
                  <select value={postForm.category} onChange={e => setPostForm(f => ({ ...f, category: e.target.value, subCategory: "" }))} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#1a1208", cursor: "pointer" }}>
                    {CATEGORIES.filter(c => c !== "すべて").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 4 }}>状態</p>
                  <select value={postForm.condition} onChange={e => setPostForm(f => ({ ...f, condition: e.target.value }))} style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#1a1208", cursor: "pointer" }}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 4 }}>中分類 <span style={{ color: "#ef4444" }}>*</span></p>
                <select value={postForm.subCategory} onChange={e => setPostForm(f => ({ ...f, subCategory: e.target.value }))} style={{ width: "100%", background: "#f7f4ef", border: postForm.subCategory ? "none" : "1px solid #fca5a5", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: postForm.subCategory ? "#1a1208" : "#8a7a6a", cursor: "pointer" }}>
                  <option value="">-- 選択してください --</option>
                  {(SUB_CATEGORIES[postForm.category] || ["その他"]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* お中元・お歳暮専用フィールド */}
              {postForm.category === "🎁 お中元・お歳暮" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 11, padding: 12, marginTop: 2 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 10 }}>🎁 食品・ギフト情報</p>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 4 }}>賞味期限 <span style={{ color: "#ef4444" }}>*</span></p>
                    <input type="date" value={postForm.expiryDate} onChange={e => setPostForm(f => ({ ...f, expiryDate: e.target.value }))} style={{ width: "100%", background: "#fff", border: "1px solid #fcd34d", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "#1a1208" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 6 }}>発送・保存方法</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["常温OK", "冷蔵必要", "冷凍必要", "生もの注意", "割れ物注意"].map(opt => (
                        <button key={opt} onClick={() => setPostForm(f => ({ ...f, shippingNote: opt }))} className="bp" style={{ background: postForm.shippingNote === opt ? "#d97706" : "#fff", border: `1px solid ${postForm.shippingNote === opt ? "#d97706" : "#e8dfd0"}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: postForm.shippingNote === opt ? "#fff" : "#5a4a3a", cursor: "pointer" }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={async () => {
              if (!postForm.title.trim()) { showToast("⚠️ タイトルを入力してください"); return; }
              if (!postForm.subCategory) { showToast("⚠️ 中分類を選択してください"); return; }
              if (editingItem) {
                // Firestore更新
                const wantArr = postForm.wantItems.split(/[,、]/).map(s => s.trim()).filter(Boolean);
                const updatedData = { title: postForm.title, category: postForm.category, condition: postForm.condition, image: postForm.image, wantItems: wantArr };
                if (editingItem.firestoreId && user) {
                  await updateDoc(doc(db, "users", user.uid, "items", editingItem.firestoreId), updatedData);
                }
                setMyItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updatedData } : i));
                showToast("✅ 出品を更新しました");
              } else {
                const wantArr = postForm.wantItems.split(/[,、]/).map(s => s.trim()).filter(Boolean);
                const newItem = { id: Date.now(), title: postForm.title, category: postForm.category, subCategory: postForm.subCategory || "その他", condition: postForm.condition, image: postForm.imageUrls?.[0] || postForm.image, imageUrls: postForm.imageUrls || [], status: "出品中", likes: 0, views: 0, wantItems: wantArr, keywords: wantArr, expiryDate: postForm.expiryDate || null, shippingNote: postForm.shippingNote || null, createdAt: new Date().toISOString(), ownerUid: user?.uid || "", owner: user?.name || "匿名", ownerAvatar: user?.avatar || "U" };
                // Firestoreに保存
                if (user) {
                  const docRef = await addDoc(collection(db, "users", user.uid, "items"), newItem);
                  newItem.firestoreId = docRef.id;
                }
                setMyItems(prev => [newItem, ...prev]);
                showToast(postType === "offer" ? "🎉 出品しました！" : "🙋 欲しいリストに投稿しました！");
              }
              setShowPostModal(false); setEditingItem(null);
              setPostForm({ title: "", category: "📷 カメラ・映像", subCategory: "", condition: "良好", detail: "", wantItems: "", image: "📷", imageUrls: [], uploading: false, expiryDate: "", shippingNote: "常温OK" });
            }} className="bp" style={{ width: "100%", background: "linear-gradient(135deg,#d4a574,#c4813a)", border: "none", borderRadius: 12, padding: 14, color: "#1a1208", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {editingItem ? "更新する" : postType === "offer" ? "無料で出品する" : "欲しいリストに投稿"}
            </button>
          </div>
        </div>
      )}

      {/* ── TRADE MODAL ── */}
      {/* 交渉開始広告モーダル */}
      {showAdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 390, overflow: "hidden", animation: "up .3s ease" }}>
            <div style={{ background: "#1a1208", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: "#8a7a6a", fontSize: 11 }}>📢 スポンサー</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ color: "#d4a574", fontSize: 12, fontWeight: 700 }}>{adCountdown}秒</p>
                {adCountdown <= 0 && <button onClick={sendPendingMessage} style={{ background: "#d4a574", border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#1a1208", cursor: "pointer" }}>スキップ ✕</button>}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ background: "linear-gradient(135deg,#f7f4ef,#e8dfd0)", borderRadius: 14, padding: 20, marginBottom: 14, textAlign: "center" }}>
                <p style={{ fontSize: 36, marginBottom: 8 }}>📦</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1208", marginBottom: 4 }}>らくらくメルカリ便</p>
                <p style={{ fontSize: 12, color: "#5a4a3a", marginBottom: 12, lineHeight: 1.5 }}>交換後の発送に便利！全国一律料金で匿名配送。ローソン・ファミマで簡単発送。</p>
                <a href="https://www.mercari.com" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: 20, padding: "8px 20px", fontSize: 12, fontWeight: 700, color: "#1a1208", textDecoration: "none" }}>詳しく見る →</a>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 8 }}>
                  {[...Array(10)].map((_, i) => <div key={i} style={{ width: 20, height: 4, borderRadius: 2, background: i < (10 - adCountdown) ? "#d4a574" : "#e8dfd0" }} />)}
                </div>
                <p style={{ fontSize: 10, color: "#8a7a6a" }}>{adCountdown > 0 ? `${adCountdown}秒後にスキップできます` : "準備完了！"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTradeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setShowTradeModal(null)}>
          <div style={{ background: "#f0ede8", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", padding: 20, maxHeight: "85vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#d4c4a8", borderRadius: 2, margin: "0 auto 15px" }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1a1208", marginBottom: 4 }}>⟳ 交換を申し込む</h2>
            <p style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 12 }}>出品者が24時間以内に返答します</p>
            <div style={{ background: "#fff", borderRadius: 12, padding: 11, marginBottom: 11, display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, background: "#f7f4ef", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25 }}>{showTradeModal.image}</div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#c4813a", marginBottom: 2 }}>相手のアイテム</p>
                <p style={{ fontWeight: 600, fontSize: 13, color: "#1a1208" }}>{showTradeModal.title}</p>
                <p style={{ fontSize: 10, color: "#8a7a6a" }}>{showTradeModal.owner}</p>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: 18, color: "#d4a574", margin: "3px 0 9px" }}>⟳ あなたが提供</div>
            {myItems.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 11 }}>
                <p style={{ fontSize: 13, color: "#8a7a6a", marginBottom: 8 }}>出品中のアイテムがありません</p>
                <button onClick={() => { setShowTradeModal(null); setShowPostModal(true); }} className="bp" style={{ background: "#d4a574", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#1a1208", cursor: "pointer" }}>+ 出品する</button>
              </div>
            ) : myItems.map(item => (
              <div key={item.id} onClick={() => setSelectedMyItem(item)} className="ph" style={{ background: "#fff", borderRadius: 12, padding: 11, marginBottom: 7, display: "flex", gap: 10, alignItems: "center", border: `2px solid ${selectedMyItem?.id === item.id ? "#d4a574" : "transparent"}` }}>
                <div style={{ width: 44, height: 44, background: "#f7f4ef", borderRadius: 9, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{item.imageUrls?.[0] ? <img src={item.imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : item.image}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 12, color: "#1a1208" }}>{item.title}</p>
                  <p style={{ fontSize: 10, color: "#8a7a6a" }}>{item.condition}</p>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedMyItem?.id === item.id ? "#d4a574" : "#d4c4a8"}`, background: selectedMyItem?.id === item.id ? "#d4a574" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedMyItem?.id === item.id && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#5a4a3a", marginBottom: 5 }}>一言メッセージ（任意）</p>
              <textarea id="tradeMsg" placeholder="一言添えるとマッチ率アップ！" style={{ width: "100%", background: "#f7f4ef", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#1a1208", height: 60, resize: "none" }} />
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#92400e" }}>⏰ 出品者が24時間以内に返答しない場合は自動キャンセルされます</p>
            </div>
            <AffiliateCard ad={AFFILIATE_ADS[2]} compact />
            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
              <button onClick={() => setShowTradeModal(null)} className="bp" style={{ flex: 1, background: "#f0ede8", border: "none", borderRadius: 11, padding: 12, color: "#5a4a3a", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => submitApplication(showTradeModal, selectedMyItem, document.getElementById("tradeMsg")?.value || "")} className="bp" style={{ flex: 2, background: selectedMyItem ? "linear-gradient(135deg,#d4a574,#c4813a)" : "#e8dfd0", border: "none", borderRadius: 11, padding: 12, color: selectedMyItem ? "#1a1208" : "#b4a494", fontWeight: 700, fontSize: 13, cursor: selectedMyItem ? "pointer" : "not-allowed" }}>
                申し込む →
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── LEGAL MODAL ── */}
      {legalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 2000, display: "flex", alignItems: "flex-end" }} onClick={() => setLegalModal(null)}>
          <div style={{ background: "#f0ede8", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", maxHeight: "88vh", overflowY: "auto", animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ position: "sticky", top: 0, background: "#f0ede8", padding: "14px 18px 10px", borderBottom: "1px solid #e8dfd0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a1208" }}>
                {legalModal === "terms" && "📋 利用規約"}
                {legalModal === "privacy" && "🔒 プライバシーポリシー"}
                {legalModal === "contact" && "📮 お問い合わせ"}
              </h2>
              <button onClick={() => setLegalModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8a7a6a" }}>✕</button>
            </div>
            <div style={{ padding: "18px 18px 40px", fontSize: 12, color: "#3d2b15", lineHeight: 1.9 }}>

              {legalModal === "terms" && (<>
                <p style={{ fontSize: 10, color: "#8a7a6a", marginBottom: 16 }}>最終更新日：2026年3月1日</p>
                {[
                  ["第1条（目的）", "本規約は、Swapru（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆様には本規約に従って本サービスをご利用いただきます。"],
                  ["第2条（サービスの内容）", "本サービスは、ユーザー同士が不用品を無償で交換するためのマッチングプラットフォームです。運営者は取引の当事者ではなく、交換の成立・履行・結果について一切の責任を負いません。"],
                  ["第3条（免責事項）", "本サービスを通じて行われる取引はすべてユーザー間の個人取引です。取引に関するトラブル（商品の不具合、未着、破損、詐欺等）は、当事者間で解決していただく必要があります。運営者はいかなる場合も取引トラブルへの介入・補償・賠償を行いません。"],
                  ["第4条（食品・ギフト品の取引について）", "食品・飲料・お中元・お歳暮等の食品類を出品する場合は、未開封かつ製造元のシールが intact な状態のものに限ります。賞味期限・消費期限は正確に記載してください。生もの・要冷蔵・要冷凍品の取引はユーザー自身の責任において行うものとし、配送中の品質劣化・食中毒等のトラブルについて運営者は一切の責任を負いません。食品の取引は自己責任でお願いします。"],
                  ["第5条（禁止事項）", "偽りの情報による出品・詐欺的行為、他ユーザーへの嫌がらせ・誹謗中傷、違法物・危険物の出品、著作権を侵害するコンテンツの投稿、賞味期限切れ・消費期限切れ食品の出品、偽ブランド品・模倣品の出品、その他法令に違反する行為を禁止します。"],
                  ["第6条（アカウントの管理）", "ユーザーは自己の責任においてアカウントを管理するものとします。アカウントの不正使用による損害について、運営者は責任を負いません。"],
                  ["第7条（サービスの変更・終了）", "運営者は事前の通知なく本サービスの内容を変更、または提供を終了することがあります。これによりユーザーに生じた損害について、運営者は責任を負いません。"],
                  ["第8条（規約の変更）", "運営者は必要に応じて本規約を変更できるものとします。変更後の規約はサービス上に掲載した時点で効力を生じます。"],
                ].map(([title, body]) => (
                  <div key={title} style={{ marginBottom: 18 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208", marginBottom: 5 }}>{title}</p>
                    <p>{body}</p>
                  </div>
                ))}
              </>)}

              {legalModal === "privacy" && (<>
                <p style={{ fontSize: 10, color: "#8a7a6a", marginBottom: 16 }}>最終更新日：2026年3月1日</p>
                {[
                  ["取得する情報", "Googleログイン時に取得する情報：お名前、メールアドレス、プロフィール写真。出品時に取得する情報：商品画像、商品説明、交換希望内容。"],
                  ["情報の利用目的", "取得した情報は、サービスの提供・改善、ユーザー間のマッチング、不正利用の防止のみに使用します。第三者への販売・提供は行いません。"],
                  ["情報の保管", "取得した情報はFirebase（Google LLC）のサーバーに保管されます。"],
                  ["Cookieについて", "本サービスではログイン状態の維持のためにCookieを使用しています。"],
                  ["お問い合わせ", "個人情報の取扱いに関するお問い合わせは、本サービスのお問い合わせフォームよりご連絡ください。"],
                ].map(([title, body]) => (
                  <div key={title} style={{ marginBottom: 18 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208", marginBottom: 5 }}>{title}</p>
                    <p>{body}</p>
                  </div>
                ))}
              </>)}

              {legalModal === "contact" && (<>
                <div style={{ background: "#fff", borderRadius: 13, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208", marginBottom: 8 }}>📧 メールでのお問い合わせ</p>
                  <p style={{ marginBottom: 12 }}>下記メールアドレスまでお気軽にご連絡ください。通常2〜3営業日以内にご返信いたします。</p>
                  <div style={{ background: "#f7f4ef", borderRadius: 9, padding: "11px 13px", textAlign: "center" }}>
                    <p style={{ fontWeight: 700, color: "#c4813a", fontSize: 13 }}>contact@swapru.app</p>
                  </div>
                </div>
                <div style={{ background: "#fef9f0", border: "1px solid #f0e0c0", borderRadius: 13, padding: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 12, color: "#c4813a", marginBottom: 6 }}>⚠️ 取引トラブルについて</p>
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
          <div style={{ background: "#1a1208", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("mypage")} style={{ background: "none", border: "none", color: "#d4a574", fontSize: 20, cursor: "pointer" }}>←</button>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#d4a574" }}>🛡️ 管理画面</h2>
          </div>

          {/* 管理タブ */}
          <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e8dfd0" }}>
            {[["dashboard","📊 概要"], ["items","📦 出品"], ["users","👥 ユーザー"], ["reports","🚨 通報"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setAdminTab(tab)} style={{ flex: 1, background: "none", border: "none", borderBottom: adminTab === tab ? "2px solid #d4a574" : "2px solid transparent", padding: "10px 0", fontSize: 10, fontWeight: 700, color: adminTab === tab ? "#c4813a" : "#8a7a6a", cursor: "pointer" }}>{label}</button>
            ))}
          </div>

          {/* ── 概要タブ ── */}
          {adminTab === "dashboard" && (
            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[["📦 出品数", ALL_ITEMS.length + myItems.length, "#d4a574"], ["👥 ユーザー数", "1", "#60a5fa"], ["🚨 通報数", reports.length, "#f87171"], ["✅ 成立数", threads.filter(t => t.tradeStatus === "完了").length, "#4ade80"]].map(([label, val, color]) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 13, padding: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", textAlign: "center" }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color }}>{val}</p>
                    <p style={{ fontSize: 11, color: "#8a7a6a" }}>{label}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", borderRadius: 13, padding: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1208", marginBottom: 10 }}>🚨 未対応通報</p>
                {reports.filter(r => r.status === "未対応").length === 0 ? (
                  <p style={{ fontSize: 12, color: "#8a7a6a", textAlign: "center", padding: "10px 0" }}>通報はありません ✅</p>
                ) : reports.filter(r => r.status === "未対応").slice(0, 3).map(r => (
                  <div key={r.id} style={{ background: "#fef2f2", borderRadius: 9, padding: 10, marginBottom: 7 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>{r.reason}</p>
                    <p style={{ fontSize: 11, color: "#5a4a3a" }}>{r.itemTitle}</p>
                    <p style={{ fontSize: 10, color: "#8a7a6a" }}>by {r.reportedBy}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 出品タブ ── */}
          {adminTab === "items" && (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 10 }}>全出品 {ALL_ITEMS.length + myItems.length}件</p>
              {[...ALL_ITEMS, ...myItems].map(item => (
                <div key={item.id} style={{ background: "#fff", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 44, height: 44, background: "#f0ede8", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.image}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: "#1a1208", marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 10, color: "#8a7a6a" }}>by {item.owner} · {item.category}</p>
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

          {/* ── ユーザータブ ── */}
          {adminTab === "users" && (
            <div style={{ padding: 14 }}>
              {[...new Map([...ALL_ITEMS, ...myItems].map(i => [i.owner, i])).values()].map(item => (
                <div key={item.owner} style={{ background: "#fff", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1208", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{item.ownerAvatar}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1208" }}>{item.owner}</p>
                    <p style={{ fontSize: 10, color: "#8a7a6a" }}>{item.location}</p>
                  </div>
                  <button onClick={() => { if (window.confirm(`${item.owner} をBANしますか？`)) adminBanUser(item.owner, item.ownerUid || ""); }} className="bp" style={{ background: "#fef2f2", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>🚫 BAN</button>
                </div>
              ))}
            </div>
          )}

          {/* ── 通報タブ ── */}
          {adminTab === "reports" && (
            <div style={{ padding: 14 }}>
              {reports.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#8a7a6a" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
                  <p style={{ fontSize: 13 }}>通報はありません</p>
                </div>
              ) : reports.map(r => (
                <div key={r.id} style={{ background: "#fff", borderRadius: 13, padding: 13, marginBottom: 9, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ background: r.status === "未対応" ? "#fef2f2" : "#dcfce7", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: r.status === "未対応" ? "#ef4444" : "#16a34a" }}>{r.status}</span>
                    <p style={{ fontSize: 10, color: "#8a7a6a" }}>{new Date(r.createdAt).toLocaleDateString("ja-JP")}</p>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1208", marginBottom: 2 }}>{r.itemTitle}</p>
                  <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 2 }}>理由：{r.reason}</p>
                  <p style={{ fontSize: 10, color: "#8a7a6a", marginBottom: 10 }}>通報者：{r.reportedBy}</p>
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
          <div style={{ background: "#f0ede8", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", padding: 20, animation: "up .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 34, height: 4, background: "#d4c4a8", borderRadius: 2, margin: "0 auto 15px" }} />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a1208", marginBottom: 4 }}>🚨 通報する</h2>
            <p style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 14 }}>「{showReportModal.title}」を通報</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {["偽物・模倣品", "賞味期限切れ食品", "詐欺・虚偽出品", "不適切なコンテンツ", "スパム・宣伝", "その他"].map(reason => (
                <button key={reason} onClick={() => setReportReason(reason)} className="bp" style={{ background: reportReason === reason ? "#1a1208" : "#fff", border: `2px solid ${reportReason === reason ? "#d4a574" : "#e8dfd0"}`, borderRadius: 10, padding: "10px 14px", textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 600, color: reportReason === reason ? "#d4a574" : "#5a4a3a" }}>{reason}</button>
              ))}
            </div>
            <button onClick={submitReport} className="bp" style={{ width: "100%", background: reportReason ? "#ef4444" : "#e8dfd0", border: "none", borderRadius: 12, padding: 13, color: reportReason ? "#fff" : "#b4a494", fontWeight: 700, fontSize: 14, cursor: reportReason ? "pointer" : "default" }}>通報を送信する</button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1a1208", color: "#f0ede8", borderRadius: 19, padding: "10px 20px", fontSize: 12, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap", animation: "ti .25s ease", boxShadow: "0 4px 18px rgba(0,0,0,.35)" }}>{toast}</div>}

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: "1px solid #e8dfd0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "6px 0 9px", zIndex: 100, boxShadow: "0 -4px 18px rgba(0,0,0,.08)" }}>
        {[["🏠","ホーム","home"],["🔍","さがす","list"],["➕","投稿",null],["💬","メッセージ","messages"],["👤","マイページ","mypage"]].map(([icon, label, v]) => (
          <button key={label} onClick={() => v ? setView(v) : setShowPostModal(true)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, cursor: "pointer", padding: "2px 0", position: "relative" }}>
            {label === "投稿" ? (
              <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#d4a574,#c4813a)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginTop: -12, boxShadow: "0 4px 14px rgba(212,165,116,.5)" }}>➕</div>
            ) : (
              <span style={{ fontSize: 19, filter: view === v ? "none" : "grayscale(50%) opacity(.65)" }}>{icon}</span>
            )}
            {v === "messages" && totalUnread > 0 && <div style={{ position: "absolute", top: 0, right: "calc(50% - 15px)", width: 7, height: 7, background: "#ef4444", borderRadius: "50%", border: "1.5px solid #fff" }} />}
            <span style={{ fontSize: 8, fontWeight: 600, color: view === v ? "#c4813a" : "#8a7a6a" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
