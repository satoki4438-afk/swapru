import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAVvVXYMT7oaDIXUfQk1of0Jnj-RnAWUHU",
  aauthDomain: "swapru.firebaseapp.com",
  projectId: "swapru",
  storageBucket: "swapru.firebasestorage.app",
  messagingSenderId: "310180077020",
  appId: "1:310180077020:web:8b56e30aeb60e85f9bc319"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);