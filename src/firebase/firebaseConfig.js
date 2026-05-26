// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCf9Esb-XGG_SjBgCpVwyFVDPvG_2bi-ic",
  authDomain: "scrolling-app-806c7.firebaseapp.com",
  projectId: "scrolling-app-806c7",
  storageBucket: "scrolling-app-806c7.firebasestorage.app",
  messagingSenderId: "95028110710",
  appId: "1:95028110710:web:361ab97a05112f3ae28657"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const database = getFirestore(app);
export const storage = getStorage(app);