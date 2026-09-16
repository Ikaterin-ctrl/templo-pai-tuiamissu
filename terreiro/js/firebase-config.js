// Configuração Firebase — Templo Pai Tuiamissu
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const ADMIN_EMAIL = "catarina.costa.andrade.com@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyDVM2sdW3qGgY4Lj7fOTaxtmkBqCUTwFRk",
  authDomain: "templopaituiamissu.firebaseapp.com",
  projectId: "templopaituiamissu",
  storageBucket: "templopaituiamissu.firebasestorage.app",
  messagingSenderId: "1032761780652",
  appId: "1:1032761780652:web:0e9eb6b228bf29a368f209"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
