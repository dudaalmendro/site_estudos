"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Activity,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Folder,
  FolderPlus,
  History,
  Layers3,
  Loader2,
  Microscope,
  PencilLine,
  Plus,
  RotateCcw,
  Stethoscope,
  ThumbsUp,
  Trash2,
  Upload,
  WandSparkles,
  XCircle,
} from "lucide-react";
type Rating = "again" | "easy" | "hard" | "wrong";
type StudyTab = "review" | "create" | "manual";

type AiFlashcard = {
  question: string;
  answer: string;
  topic: string;
  difficulty: "facil" | "medio" | "dificil";
  review_days: number;
};

type Flashcard = AiFlashcard & {
  id: string;
  folderId: string;
  createdAt: string;
  nextReviewAt: string;
  lastReviewedAt?: string;
  reviewCount: number;
};

type StudyFolder = {
  id: string;
  name: string;
  createdAt: string;
};

type ReviewLog = {
  id: string;
  cardId: string;
  topic: string;
  rating: Rating;
  createdAt: string;
  nextReviewAt: string;
};

type StudyState = {
  folders: StudyFolder[];
  cards: Flashcard[];
  history: ReviewLog[];
};

const storageKey = "studyagent_flashcards_v2";

const ratingActions: Array<{
  id: Rating;
  label: string;
  detail: string;
  days: number;
  icon: typeof RotateCcw;
  tone: string;
}> = [
  {
    id: "again",
    label: "De novo",
    detail: "revisar amanha",
    days: 1,
    icon: RotateCcw,
    tone: "border-indigo-300 bg-indigo-950 text-white hover:bg-indigo-900",
  },
  {
    id: "easy",
    label: "Facil",
    detail: "espacar revisao",
    days: 6,
    icon: ThumbsUp,
    tone: "border-cyan-300 bg-cyan-600 text-white hover:bg-cyan-700",
  },
  {
    id: "hard",
    label: "Dificil",
    detail: "revisar em breve",
    days: 2,
    icon: AlertTriangle,
    tone: "border-violet-300 bg-violet-600 text-white hover:bg-violet-700",
  },
  {
    id: "wrong",
    label: "Errado",
    detail: "volta rapido",
    days: 1,
    icon: XCircle,
    tone: "border-rose-300 bg-rose-500 text-white hover:bg-rose-600",
  },
];

const cardColors = [
  "from-[#eff6ff] to-[#dbeafe] border-[#93c5fd]",
  "from-[#eef2ff] to-[#ddd6fe] border-[#a5b4fc]",
  "from-[#ecfeff] to-[#cffafe] border-[#67e8f9]",
  "from-[#f8fafc] to-[#e0f2fe] border-[#7dd3fc]",
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyState(): StudyState {
  return { folders: [], cards: [], history: [] };
}

function normalizeTopic(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 72);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function readState() {
  if (typeof window === "undefined") return emptyState();

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptyState();
    const data = JSON.parse(raw) as Partial<StudyState>;

    return {
      folders: data.folders || [],
      cards: data.cards || [],
      history: data.history || [],
    };
  } catch {
    return emptyState();
  }
}

async function loadStoredState() {
  const localState = readState();

  try {
    const response = await fetch("/api/study-state", { cache: "no-store" });
    const json = (await response.json()) as {
      error?: string;
      state?: StudyState | null;
      sync?: "remote" | "local";
      reason?: string;
    };

    if (response.ok && json.state) {
      localStorage.setItem(storageKey, JSON.stringify(json.state));
      return {
        state: json.state,
        syncMessage: "Memoria online ativa com Supabase.",
      };
    }

    if (response.ok && json.sync === "remote") {
      return {
        state: localState,
        syncMessage:
          "Supabase conectado. Ainda nao havia historico salvo online.",
      };
    }

    return {
      state: localState,
      syncMessage:
        json.error ||
        json.reason ||
        "Supabase nao esta ativo; usando este navegador.",
    };
  } catch {
    return {
      state: localState,
      syncMessage:
        "Nao consegui verificar o Supabase; usando este navegador por enquanto.",
    };
  }
}

function isEmptyStudyState(nextState: StudyState) {
  return (
    nextState.folders.length === 0 &&
    nextState.cards.length === 0 &&
    nextState.history.length === 0
  );
}

async function saveStoredState(nextState: StudyState) {
  localStorage.setItem(storageKey, JSON.stringify(nextState));

  if (isEmptyStudyState(nextState)) {
    return {
      saved: true,
      message: "Nenhum historico para sincronizar ainda.",
    };
  }

  try {
    const response = await fetch("/api/study-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: nextState }),
    });
    const json = (await response.json()) as {
      error?: string;
      saved?: boolean;
      reason?: string;
      sync?: "remote" | "local";
    };

    if (response.ok && json.saved === true) {
      return {
        saved: true,
        message: "Memoria online salva no Supabase.",
      };
    }

    return {
      saved: false,
      message:
        json.error ||
        json.reason ||
        "Supabase indisponivel; usando este navegador.",
    };
  } catch {
    // Local storage still keeps the current browser usable if remote sync fails.
    return {
      saved: false,
      message:
        "Nao consegui salvar no Supabase; confira variaveis e tabela.",
    };
  }
}

export default function FlashStudyApp() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<StudyState>(emptyState);
  const [activeTab, setActiveTab] = useState<StudyTab>("review");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [count, setCount] = useState(10);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualFolderMode, setManualFolderMode] = useState<"existing" | "new">(
    "existing"
  );
  const [manualFolderId, setManualFolderId] = useState("");
  const [manualFolderName, setManualFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [sessionLimit, setSessionLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStoredState().then((loaded) => {
        const data = loaded.state;
        const loadedAt = new Date().toISOString();
        setState(data);
        setSelectedFolderId(data.folders[0]?.id || "");
        setManualFolderId(data.folders[0]?.id || "");
        setSyncMessage(loaded.syncMessage);
        setCurrentTime(new Date(loadedAt).getTime());
        setMounted(true);
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timeoutId = window.setTimeout(() => {
      void saveStoredState(state).then((result) => {
        setSyncMessage(result.message);
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [mounted, state]);

  const selectedFolder = state.folders.find((folder) => folder.id === selectedFolderId);

  const dueCards = useMemo(
    () =>
      state.cards
        .filter((card) => new Date(card.nextReviewAt).getTime() <= currentTime)
        .sort(
          (a, b) =>
            new Date(a.nextReviewAt).getTime() -
            new Date(b.nextReviewAt).getTime()
        ),
    [currentTime, state.cards]
  );

  const selectedCards = state.cards.filter(
    (card) => card.folderId === selectedFolderId
  );
  const sessionCards = dueCards.slice(0, sessionLimit);
  const totalReviewed = state.history.length;
  const hardReviews = state.history.filter(
    (item) => item.rating === "hard" || item.rating === "wrong" || item.rating === "again"
  ).length;
  const mastery = totalReviewed
    ? Math.max(0, Math.round(((totalReviewed - hardReviews) / totalReviewed) * 100))
    : 0;

  function findOrCreateFolder(folderName: string) {
    const cleanName = normalizeTopic(folderName) || "Tema sem nome";
    const existing = state.folders.find(
      (folder) => folder.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) return existing;

    return {
      id: createId("folder"),
      name: cleanName,
      createdAt: new Date().toISOString(),
    };
  }

  async function generateFlashcards() {
    const cleanTopic = normalizeTopic(topic);

    if (!cleanTopic) {
      setMessage("Escolha um tema para a IA criar os flashcards.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("topic", cleanTopic);
      formData.append("notes", notes);
      formData.append("count", String(count));
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/ai/flashcards", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Nao consegui gerar com IA agora.");
      }

      const folder = findOrCreateFolder(cleanTopic);
      const createdAt = new Date().toISOString();
      const newCards = (json.flashcards || []).map((card: AiFlashcard) => ({
        ...card,
        id: createId("card"),
        folderId: folder.id,
        topic: card.topic || cleanTopic,
        review_days: Math.max(1, Math.round(card.review_days || 2)),
        createdAt,
        nextReviewAt: createdAt,
        reviewCount: 0,
      }));

      setState((current) => ({
        folders: current.folders.some((item) => item.id === folder.id)
          ? current.folders
          : [folder, ...current.folders],
        cards: [...newCards, ...current.cards],
        history: current.history,
      }));
      setSelectedFolderId(folder.id);
      setSessionLimit(10);
      setRevealed({});
      setTopic("");
      setNotes("");
      setFiles([]);
      setCurrentTime(new Date(createdAt).getTime());
      setActiveTab("review");
      setMessage(`${newCards.length} flashcards criados na pasta ${folder.name}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao gerar flashcards."
      );
    } finally {
      setLoading(false);
    }
  }

  function reviewCard(card: Flashcard, rating: Rating) {
    const action = ratingActions.find((item) => item.id === rating);
    if (!action) return;

    const nextReviewAt = addDays(new Date(), action.days);
    const log: ReviewLog = {
      id: createId("review"),
      cardId: card.id,
      topic: card.topic,
      rating,
      createdAt: new Date().toISOString(),
      nextReviewAt,
    };

    setState((current) => ({
      folders: current.folders,
      cards: current.cards.map((item) =>
        item.id === card.id
          ? {
              ...item,
              review_days: action.days,
              nextReviewAt,
              lastReviewedAt: log.createdAt,
              reviewCount: item.reviewCount + 1,
            }
          : item
      ),
      history: [log, ...current.history].slice(0, 80),
    }));

    setRevealed((current) => ({ ...current, [card.id]: false }));
    setCurrentTime(new Date(log.createdAt).getTime());
    setMessage(`${action.label}: ${card.topic} volta em ${formatDate(nextReviewAt)}.`);
  }

  function createManualFolder() {
    const folder = findOrCreateFolder(topic || "Novo tema");
    setState((current) => ({
      ...current,
      folders: current.folders.some((item) => item.id === folder.id)
        ? current.folders
        : [folder, ...current.folders],
    }));
    setSelectedFolderId(folder.id);
    setMessage(`Pasta ${folder.name} pronta.`);
  }

  function deleteFolder(folder: StudyFolder) {
    const cardsInFolder = state.cards.filter((card) => card.folderId === folder.id);
    const confirmed = window.confirm(
      `Excluir a pasta "${folder.name}" e ${cardsInFolder.length} flashcards?`
    );

    if (!confirmed) return;

    setState((current) => {
      const remainingFolders = current.folders.filter((item) => item.id !== folder.id);
      const deletedCardIds = new Set(
        current.cards.filter((card) => card.folderId === folder.id).map((card) => card.id)
      );

      return {
        folders: remainingFolders,
        cards: current.cards.filter((card) => card.folderId !== folder.id),
        history: current.history.filter((item) => !deletedCardIds.has(item.cardId)),
      };
    });

    if (selectedFolderId === folder.id) {
      const nextFolder = state.folders.find((item) => item.id !== folder.id);
      setSelectedFolderId(nextFolder?.id || "");
    }

      setMessage(`Pasta ${folder.name} excluida.`);
  }

  function createManualFlashcard() {
    const question = manualQuestion.trim();
    const answer = manualAnswer.trim();

    if (!question || !answer) {
      setMessage("Escreva a pergunta e a resposta do flashcard.");
      return;
    }

    let folder: StudyFolder | undefined;

    if (manualFolderMode === "existing") {
      folder = state.folders.find((item) => item.id === manualFolderId);
      if (!folder) {
        setMessage("Escolha uma pasta existente ou crie uma pasta nova.");
        return;
      }
    } else {
      const folderName = normalizeTopic(manualFolderName);
      if (!folderName) {
        setMessage("Digite o nome da nova pasta.");
        return;
      }
      folder = findOrCreateFolder(folderName);
    }

    const createdAt = new Date().toISOString();
    const card: Flashcard = {
      id: createId("card"),
      folderId: folder.id,
      question,
      answer,
      topic: folder.name,
      difficulty: "medio",
      review_days: 1,
      createdAt,
      nextReviewAt: createdAt,
      reviewCount: 0,
    };

    setState((current) => ({
      folders: current.folders.some((item) => item.id === folder.id)
        ? current.folders
        : [folder, ...current.folders],
      cards: [card, ...current.cards],
      history: current.history,
    }));

    setSelectedFolderId(folder.id);
    setManualFolderId(folder.id);
    setManualQuestion("");
    setManualAnswer("");
    setManualFolderName("");
    setCurrentTime(new Date(createdAt).getTime());
    setActiveTab("review");
    setMessage(`Flashcard manual salvo na pasta ${folder.name}.`);
  }

  function renderCard(card: Flashcard, index: number) {
    const isRevealed = Boolean(revealed[card.id]);
    const color = cardColors[index % cardColors.length];

    return (
      <article
        key={card.id}
        className={`flex min-h-[340px] flex-col rounded-[8px] border bg-gradient-to-br p-5 shadow-[0_18px_30px_rgba(30,64,175,0.12)] ${color}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="rounded-full bg-white/80 px-3 py-1 text-blue-950">
            {card.topic}
          </span>
          <span className="rounded-full bg-white/65 px-3 py-1">
            revisar {formatDate(card.nextReviewAt)}
          </span>
          <span className="rounded-full bg-white/65 px-3 py-1">
            {card.reviewCount}x feita
          </span>
        </div>

        <div className="mt-5 flex flex-1 flex-col justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-blue-800">
              <Stethoscope size={14} />
              Caso clinico
            </p>
            <h2 className="mt-2 text-2xl font-black leading-8 text-slate-950">
              {card.question}
            </h2>
          </div>

          {!isRevealed ? (
            <button
              onClick={() =>
                setRevealed((current) => ({ ...current, [card.id]: true }))
              }
              className="mt-6 flex h-12 items-center justify-center gap-2 rounded-[8px] bg-blue-950 px-4 text-sm font-bold text-white transition hover:bg-blue-900"
            >
              <ChevronRight size={18} />
              Virar card
            </button>
          ) : (
            <div className="mt-6 rounded-[8px] border border-blue-100 bg-white/78 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-blue-800">
                <Microscope size={14} />
                Conduta mental
              </p>
              <p className="mt-2 text-base leading-7 text-slate-900">
                {card.answer}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ratingActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => reviewCard(card, action.id)}
                      className={`min-h-14 rounded-[8px] border px-3 py-2 text-left text-sm font-black transition ${action.tone}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={16} />
                        {action.label}
                      </span>
                      <span className="mt-1 block text-xs font-semibold opacity-80">
                        {action.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </article>
    );
  }

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef6ff] text-slate-700">
        Carregando area de estudo...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef6ff] text-slate-950">
      <section className="border-b border-blue-100 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef2ff_58%,#e0f2fe_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1fr_380px] lg:px-8">
          <div className="flex min-h-[360px] flex-col justify-between">
            <header className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-[8px] bg-blue-950 text-cyan-200">
                <Stethoscope size={26} />
              </div>
              <div>
                <p className="text-xl font-black">MedStudy AI</p>
                <p className="text-sm font-semibold text-blue-900/65">
                  Flashcards clinicos por memoria espacada
                </p>
              </div>
            </header>

            <div className="max-w-3xl">
              <p className="mb-4 inline-flex items-center gap-3 rounded-full bg-blue-950 px-4 py-2 text-sm font-black text-cyan-100">
                <Activity size={16} />
                <span>Plantao de revisao.</span>
              </p>
              <h1 className="text-5xl font-black leading-tight sm:text-6xl">
                Flashcards de medicina com ritmo de prova e revisao clinica.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-600">
                A IA cria flashcards com pergunta na frente e resposta no verso.
                Cada tema ganha sua propria pasta, e a sessao diaria mostra 10
                cards vencidos por vez.
              </p>
              <p className="mt-3 inline-flex rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-black text-violet-800 shadow-sm">
                maria te amo muito
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Pastas", `${state.folders.length} temas`],
                ["Flashcards", `${state.cards.length} cards`],
                ["Dominio", `${mastery}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[8px] border border-blue-100 bg-white/82 px-4 py-3 shadow-sm"
                >
                  <p className="text-sm font-bold text-blue-900/60">{label}</p>
                  <p className="mt-1 text-2xl font-black text-blue-950">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-[8px] border border-blue-100 bg-white/90 p-5 shadow-[0_20px_40px_rgba(30,64,175,0.12)]">
            <div className="mb-5 flex items-center gap-2">
              <WandSparkles size={20} className="text-violet-700" />
              <h2 className="text-xl font-black text-blue-950">Fluxo de estudo</h2>
            </div>
            <div className="space-y-3">
              {[
                ["1", "Crie revisoes com tema, texto e arquivos."],
                ["2", "A IA monta cards de pergunta e resposta."],
                ["3", "Revise por lotes de 10 e agende pelo desempenho."],
              ].map(([step, text]) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-[8px] border border-blue-100 bg-blue-50/60 p-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-950 text-sm font-black text-white">
                    {step}
                  </span>
                  <p className="text-sm font-bold leading-6 text-slate-700">{text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="space-y-5">
          <section className="rounded-[8px] border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Folder size={18} className="text-blue-800" />
              <h2 className="font-black text-blue-950">Pastas</h2>
            </div>
            <div className="space-y-2">
              {state.folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`flex min-h-11 w-full items-center justify-between rounded-[8px] border px-3 text-left text-sm font-bold ${
                    selectedFolderId === folder.id
                      ? "border-blue-950 bg-blue-950 text-white"
                      : "border-blue-100 bg-white text-slate-700 hover:bg-blue-50"
                  }`}
                >
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span className="truncate">{folder.name}</span>
                    <span className="text-xs opacity-70">
                      {state.cards.filter((card) => card.folderId === folder.id).length}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteFolder(folder)}
                    className={`ml-2 flex size-8 shrink-0 items-center justify-center rounded-[8px] ${
                      selectedFolderId === folder.id
                        ? "text-white/75 hover:bg-white/10 hover:text-white"
                        : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    }`}
                    title="Excluir pasta"
                    aria-label={`Excluir pasta ${folder.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {state.folders.length === 0 && (
                <p className="rounded-[8px] bg-blue-50 p-4 text-sm font-medium text-blue-900/70">
                  As pastas aparecem quando voce gera o primeiro tema.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[8px] border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <History size={18} className="text-blue-800" />
              <h2 className="font-black text-blue-950">Historico</h2>
            </div>
            <div className="space-y-2">
              {state.history.slice(0, 8).map((item) => {
                const action = ratingActions.find((rating) => rating.id === item.rating);
                return (
                  <div
                    key={item.id}
                    className="rounded-[8px] border border-blue-100 bg-blue-50/50 p-3 text-sm"
                  >
                    <p className="font-black text-blue-950">{item.topic}</p>
                    <p className="mt-1 text-slate-600">
                      {action?.label} - volta {formatDate(item.nextReviewAt)}
                    </p>
                  </div>
                );
              })}
              {state.history.length === 0 && (
                <p className="rounded-[8px] bg-blue-50 p-4 text-sm font-medium text-blue-900/70">
                  O historico aparece depois das primeiras revisoes.
                </p>
              )}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          {message && (
            <div className="rounded-[8px] border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700">
              {message}
            </div>
          )}
          {syncMessage && (
            <div className="rounded-[8px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900/75">
              {syncMessage}
            </div>
          )}

          <div className="grid gap-2 rounded-[8px] border border-blue-100 bg-white p-2 shadow-sm sm:grid-cols-3">
            {[
              { id: "review" as const, label: "Revisao de hoje", icon: CalendarDays },
              { id: "create" as const, label: "Criar revisao", icon: WandSparkles },
              { id: "manual" as const, label: "Criar manual", icon: PencilLine },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-[8px] text-sm font-black transition ${
                    activeTab === tab.id
                      ? "bg-blue-950 text-white"
                      : "text-blue-950 hover:bg-blue-50"
                  }`}
                >
                  <Icon size={17} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "create" && (
            <section className="rounded-[8px] border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-blue-800">
                  <WandSparkles size={17} />
                  Criar revisao
                </div>
                <h2 className="text-3xl font-black text-blue-950">
                  Novo tema com texto e arquivos
                </h2>
                <p className="mt-2 font-medium text-slate-600">
                  Cole anotacoes, envie materiais e escolha quantos flashcards a IA deve
                  gerar para a pasta do tema.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-blue-900/70">Tema</span>
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      className="mt-2 h-12 w-full rounded-[8px] border border-blue-200 bg-blue-50/40 px-4 font-semibold outline-none focus:border-blue-700"
                      placeholder="Ex: Cardiologia, anatomia renal, sepse"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-blue-900/70">
                      Contexto em texto
                    </span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="mt-2 h-40 w-full resize-none rounded-[8px] border border-blue-200 bg-blue-50/40 p-4 text-sm outline-none focus:border-blue-700"
                      placeholder="Cole resumo, topicos da prova, caso clinico ou nivel desejado."
                    />
                  </label>

                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-blue-300 bg-blue-50/60 px-4 py-5 text-center hover:bg-blue-50">
                    <Upload size={24} className="text-blue-800" />
                    <span className="mt-2 font-black text-blue-950">
                      Adicionar arquivos
                    </span>
                    <span className="mt-1 text-sm font-medium text-slate-600">
                      PDF, DOCX ou TXT entram como contexto da IA
                    </span>
                    <input
                      className="hidden"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) =>
                        setFiles(Array.from(event.target.files || []))
                      }
                    />
                  </label>

                  {files.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {files.map((file) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-[8px] border border-blue-100 bg-white px-3 text-sm font-bold text-slate-700"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText size={16} className="shrink-0 text-blue-800" />
                            <span className="truncate">{file.name}</span>
                          </span>
                          <button
                            onClick={() =>
                              setFiles((current) =>
                                current.filter((item) => item !== file)
                              )
                            }
                            className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Remover arquivo"
                            aria-label={`Remover ${file.name}`}
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[8px] border border-blue-100 bg-blue-50/50 p-4">
                  <label className="block">
                    <span className="text-sm font-bold text-blue-900/70">
                      Quantos cards
                    </span>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={count}
                      onChange={(event) => setCount(Number(event.target.value))}
                      className="mt-2 h-12 w-full rounded-[8px] border border-blue-200 bg-white px-4 font-semibold outline-none focus:border-blue-700"
                    />
                  </label>

                  <button
                    onClick={generateFlashcards}
                    disabled={loading}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-blue-950 px-5 font-black text-white transition hover:bg-blue-900 disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <BrainCircuit size={18} />
                    )}
                    Gerar flashcards
                  </button>

                  <button
                    onClick={createManualFolder}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-blue-200 bg-white text-sm font-black text-blue-950 hover:bg-blue-50"
                  >
                    <FolderPlus size={17} />
                    Criar pasta vazia
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "manual" && (
            <section className="rounded-[8px] border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-blue-800">
                  <PencilLine size={17} />
                  Criar manual
                </div>
                <h2 className="text-3xl font-black text-blue-950">
                  Escreva seu proprio flashcard
                </h2>
                <p className="mt-2 font-medium text-slate-600">
                  Salve pergunta e resposta em uma pasta existente ou abra uma nova
                  pasta para esse tema.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-blue-900/70">
                      Pergunta da frente
                    </span>
                    <textarea
                      value={manualQuestion}
                      onChange={(event) => setManualQuestion(event.target.value)}
                      className="mt-2 h-36 w-full resize-none rounded-[8px] border border-blue-200 bg-blue-50/40 p-4 text-sm outline-none focus:border-blue-700"
                      placeholder="Ex: Qual estrutura separa o atrio direito do ventriculo direito?"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-blue-900/70">
                      Resposta do verso
                    </span>
                    <textarea
                      value={manualAnswer}
                      onChange={(event) => setManualAnswer(event.target.value)}
                      className="mt-2 h-36 w-full resize-none rounded-[8px] border border-blue-200 bg-blue-50/40 p-4 text-sm outline-none focus:border-blue-700"
                      placeholder="Ex: Valva tricuspide."
                    />
                  </label>
                </div>

                <div className="rounded-[8px] border border-blue-100 bg-blue-50/50 p-4">
                  <div className="grid gap-2">
                    <button
                      onClick={() => setManualFolderMode("existing")}
                      className={`h-11 rounded-[8px] text-sm font-black ${
                        manualFolderMode === "existing"
                          ? "bg-blue-950 text-white"
                          : "border border-blue-200 bg-white text-blue-950 hover:bg-blue-50"
                      }`}
                    >
                      Pasta existente
                    </button>
                    <button
                      onClick={() => setManualFolderMode("new")}
                      className={`h-11 rounded-[8px] text-sm font-black ${
                        manualFolderMode === "new"
                          ? "bg-blue-950 text-white"
                          : "border border-blue-200 bg-white text-blue-950 hover:bg-blue-50"
                      }`}
                    >
                      Nova pasta
                    </button>
                  </div>

                  {manualFolderMode === "existing" ? (
                    <label className="mt-4 block">
                      <span className="text-sm font-bold text-blue-900/70">
                        Escolher pasta
                      </span>
                      <select
                        value={manualFolderId}
                        onChange={(event) => setManualFolderId(event.target.value)}
                        className="mt-2 h-12 w-full rounded-[8px] border border-blue-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-700"
                      >
                        <option value="">Selecione uma pasta</option>
                        {state.folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="mt-4 block">
                      <span className="text-sm font-bold text-blue-900/70">
                        Nome da nova pasta
                      </span>
                      <input
                        value={manualFolderName}
                        onChange={(event) => setManualFolderName(event.target.value)}
                        className="mt-2 h-12 w-full rounded-[8px] border border-blue-200 bg-white px-4 font-semibold outline-none focus:border-blue-700"
                        placeholder="Ex: Anatomia cardiaca"
                      />
                    </label>
                  )}

                  <button
                    onClick={createManualFlashcard}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-blue-950 px-5 font-black text-white transition hover:bg-blue-900"
                  >
                    <PencilLine size={18} />
                    Salvar flashcard
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "review" && (
            <>
          <section className="rounded-[8px] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-blue-800">
                  <CalendarDays size={17} />
                  Sessao diaria
                </div>
                <h2 className="text-3xl font-black text-blue-950">Revisar hoje</h2>
                <p className="mt-2 font-medium text-slate-600">
                  {Math.min(sessionLimit, dueCards.length)} de {dueCards.length} cards
                  vencidos. A sessao padrao mostra 10.
                </p>
              </div>
              {dueCards.length > sessionLimit && (
                <button
                  onClick={() => setSessionLimit((value) => value + 10)}
                  className="flex h-11 items-center justify-center gap-2 rounded-[8px] border border-blue-200 bg-white px-4 text-sm font-black text-blue-950 hover:bg-blue-50"
                >
                  <Plus size={17} />
                  Mais 10
                </button>
              )}
            </div>

            {sessionCards.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sessionCards.map((card, index) => renderCard(card, index))}
              </div>
            ) : (
              <div className="rounded-[8px] border border-dashed border-blue-200 bg-blue-50 p-8 text-center">
                <Check className="mx-auto text-cyan-600" size={32} />
                <p className="mt-3 text-lg font-black text-blue-950">Nada vencido agora</p>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  Gere cards novos ou volte quando a proxima revisao chegar.
                </p>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-blue-800">
                  <Layers3 size={17} />
                  Pasta selecionada
                </div>
                <h2 className="text-3xl font-black text-blue-950">
                  {selectedFolder?.name || "Nenhuma pasta"}
                </h2>
                <p className="mt-2 font-medium text-slate-600">
                  {selectedCards.length} flashcards salvos nesse tema.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-[8px] border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-900/70">
                <Clock3 size={16} />
                Revisao automatica por resposta
              </div>
            </div>

            {selectedCards.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedCards.map((card, index) =>
                  renderCard(card, index + sessionCards.length)
                )}
              </div>
            ) : (
              <div className="rounded-[8px] border border-blue-100 bg-white p-8 text-center shadow-sm">
                <BookOpenCheck className="mx-auto text-blue-700" size={32} />
                <p className="mt-3 text-lg font-black text-blue-950">Escolha ou crie um tema</p>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  A IA vai guardar os flashcards em uma pasta com o nome do tema.
                </p>
              </div>
            )}
          </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
