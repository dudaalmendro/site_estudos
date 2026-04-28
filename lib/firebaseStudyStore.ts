import { initializeApp, getApps } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc, serverTimestamp } from "firebase/firestore";

type StudyFolder = {
  id: string;
  name: string;
  createdAt: string;
};

type Flashcard = {
  id: string;
  folderId: string;
  question: string;
  answer: string;
  topic: string;
  difficulty: "facil" | "medio" | "dificil";
  review_days: number;
  createdAt: string;
  nextReviewAt: string;
  lastReviewedAt?: string;
  reviewCount: number;
};

type ReviewLog = {
  id: string;
  cardId: string;
  topic: string;
  rating: "again" | "easy" | "hard" | "wrong";
  createdAt: string;
  nextReviewAt: string;
};

export type StudyState = {
  folders: StudyFolder[];
  cards: Flashcard[];
  history: ReviewLog[];
};

const firebaseConfig = {
  apiKey: "AIzaSyDjoRMhmLvsbyOscYCWo2XiXeDnmzuseJ0",
  authDomain: "site-maria-med.firebaseapp.com",
  projectId: "site-maria-med",
  storageBucket: "site-maria-med.firebasestorage.app",
  messagingSenderId: "759542276786",
  appId: "1:759542276786:web:87e93253b2fb9ff0acdfab",
  measurementId: "G-J7L0V93D16",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const stateRef = doc(db, "studyState", "shared");

function normalizeState(value: unknown): StudyState | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Partial<StudyState>;

  return {
    folders: Array.isArray(data.folders) ? data.folders : [],
    cards: Array.isArray(data.cards) ? data.cards : [],
    history: Array.isArray(data.history) ? data.history : [],
  };
}

export async function loadFirebaseStudyState() {
  const snapshot = await getDoc(stateRef);
  if (!snapshot.exists()) return null;

  return normalizeState(snapshot.data());
}

export async function saveFirebaseStudyState(state: StudyState) {
  await setDoc(
    stateRef,
    {
      ...state,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
