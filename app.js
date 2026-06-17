(async function () {
  const CHUNK_SIZE = 700;
  const dbName = "lemais-library-v1";
  const dbVersion = 1;
  const activeBookKey = "lemais-active-book-id";
  const prefsKey = "lemais-preferences-v1";
  const playbackRates = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const sleepTimerOptions = [15, 30, 45, 60, 0];

  const state = {
    db: null,
    library: [],
    activeBookId: "",
    audioUrl: "",
    audioName: "",
    epubName: "",
    vttName: "",
    coverImage: "",
    chapters: [],
    anchors: [],
    currentChapter: 0,
    currentChunk: 0,
    audioPosition: 0,
    draft: {
      audioFile: null,
      epubFile: null,
      vttFile: null,
      chapters: [],
      coverImage: ""
    },
    prefs: {
      nightMode: false,
      fontSize: 18,
      playbackRate: 1,
      navCollapsed: false
    }
  };

  const el = {
    tabs: Array.from(document.querySelectorAll("[data-screen-target]")),
    appTabs: document.querySelector("#app-tabs"),
    navToggle: document.querySelector("#nav-toggle"),
    appearanceToggle: document.querySelector("#appearance-toggle"),
    appearancePanel: document.querySelector("#appearance-panel"),
    nightModeToggle: document.querySelector("#night-mode-toggle"),
    fontSizeInput: document.querySelector("#font-size-input"),
    screens: {
      library: document.querySelector("#screen-library"),
      upload: document.querySelector("#screen-upload"),
      sync: document.querySelector("#screen-sync"),
      listen: document.querySelector("#screen-listen"),
      read: document.querySelector("#screen-read")
    },
    libraryList: document.querySelector("#library-list"),
    exportDbButton: document.querySelector("#export-db-button"),
    importDbButton: document.querySelector("#import-db-button"),
    importDbInput: document.querySelector("#import-db-input"),
    coverRepairInput: document.querySelector("#cover-repair-input"),
    currentBookCover: document.querySelector("#current-book-cover"),
    currentBookTitle: document.querySelector("#current-book-title"),
    currentBookMeta: document.querySelector("#current-book-meta"),
    bookTitleInput: document.querySelector("#book-title-input"),
    audioInput: document.querySelector("#audio-input"),
    epubInput: document.querySelector("#epub-input"),
    vttInput: document.querySelector("#vtt-input"),
    audioFileName: document.querySelector("#audio-file-name"),
    epubFileName: document.querySelector("#epub-file-name"),
    vttFileName: document.querySelector("#vtt-file-name"),
    parseEpubButton: document.querySelector("#parse-epub-button"),
    autoAnchorButton: document.querySelector("#auto-anchor-button"),
    clearButton: document.querySelector("#clear-button"),
    importStatus: document.querySelector("#import-status"),
    chapterCount: document.querySelector("#chapter-count"),
    audioDuration: document.querySelector("#audio-duration"),
    anchorCount: document.querySelector("#anchor-count"),
    syncAudio: document.querySelector("#sync-audio"),
    mainAudio: document.querySelector("#main-audio"),
    syncBackward: document.querySelector("#sync-backward"),
    syncForward: document.querySelector("#sync-forward"),
    backwardButton: document.querySelector("#backward-button"),
    forwardButton: document.querySelector("#forward-button"),
    playToggle: document.querySelector("#play-toggle"),
    mainSpeedButton: document.querySelector("#main-speed-button"),
    sleepTimerButton: document.querySelector("#sleep-timer-button"),
    sleepTimerLabel: document.querySelector("#sleep-timer-label"),
    audioSeek: document.querySelector("#audio-seek"),
    mainCurrentTime: document.querySelector("#main-current-time"),
    mainDuration: document.querySelector("#main-duration"),
    listenChapter: document.querySelector("#listen-chapter"),
    listenExcerpt: document.querySelector("#listen-excerpt"),
    addAnchorButton: document.querySelector("#add-anchor-button"),
    anchorTime: document.querySelector("#anchor-time"),
    anchorProgress: document.querySelector("#anchor-progress"),
    anchorNote: document.querySelector("#anchor-note"),
    syncChapterSelect: document.querySelector("#sync-chapter-select"),
    syncPosition: document.querySelector("#sync-position"),
    syncPreview: document.querySelector("#sync-preview"),
    anchorList: document.querySelector("#anchor-list"),
    readChapterSelect: document.querySelector("#read-chapter-select"),
    readerBookCover: document.querySelector("#reader-book-cover"),
    readerPlayToggle: document.querySelector("#reader-play-toggle"),
    readerSpeedButton: document.querySelector("#reader-speed-button"),
    readerSyncButton: document.querySelector("#reader-sync-button"),
    readPosition: document.querySelector("#read-position"),
    readerPage: document.querySelector("#reader-page"),
    readProgressLabel: document.querySelector("#read-progress-label"),
    estimatedAudioLabel: document.querySelector("#estimated-audio-label"),
    toast: document.querySelector("#toast")
  };

  let toastTimer = 0;
  let activeAudio = el.mainAudio;
  let saveProgressTimer = 0;
  let coverRepairBookId = "";
  let lastProgressSaveAt = 0;
  let sleepTimerDeadline = 0;
  let sleepTimerInterval = 0;

  function showToast(message) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      el.toast.classList.remove("is-visible");
    }, 3000);
  }

  function id() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function renderIcons() {
    if (window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
  }

  function setIconButton(button, icon, label) {
    if (!button) return;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `
      <i data-lucide="${icon}" aria-hidden="true"></i>
      <span class="visually-hidden">${label}</span>
    `;
  }

  function updateMenuButton() {
    const label = state.prefs.navCollapsed ? "Abrir menu" : "Recolher menu";
    const icon = state.prefs.navCollapsed ? "panel-left-open" : "panel-left-close";
    setIconButton(el.navToggle, icon, label);
  }

  function currentlyPlayingAudio() {
    return [el.mainAudio, el.syncAudio].find((audio) => audio.src && !audio.paused) || null;
  }

  function preferredPlaybackAudio() {
    return currentlyPlayingAudio() || (el.mainAudio.src ? el.mainAudio : activeAudio?.src ? activeAudio : el.syncAudio);
  }

  function updatePlaybackButtons() {
    const isPlaying = Boolean(currentlyPlayingAudio());
    const label = isPlaying ? "Pausar" : "Reproduzir";
    const icon = isPlaying ? "pause-circle" : "play";
    setIconButton(el.playToggle, icon, label);
    setIconButton(el.readerPlayToggle, icon, label);
    el.readerSyncButton.hidden = false;
    renderIcons();
  }

  async function togglePlayback(audio) {
    if (!audio?.src) {
      showToast("Abra um livro com áudio primeiro.");
      return;
    }
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      showToast("Não consegui iniciar o áudio. Toque novamente ou confira o arquivo.");
    } finally {
      updatePlaybackButtons();
    }
  }

  function formatPlaybackRate(rate) {
    return `${Number(rate).toFixed(rate % 1 === 0 ? 0 : 2).replace(/0$/, "")}×`;
  }

  function updateSpeedButtons() {
    const label = formatPlaybackRate(state.prefs.playbackRate);
    [el.mainSpeedButton, el.readerSpeedButton].forEach((button) => {
      button.innerHTML = `
        <i data-lucide="gauge" aria-hidden="true"></i>
        <span>${label}</span>
      `;
      button.title = `Velocidade ${label}`;
      button.setAttribute("aria-label", `Alterar velocidade do áudio. Velocidade atual: ${label}`);
    });
    renderIcons();
  }

  function formatSleepRemaining(milliseconds) {
    const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
    return `${minutes} min`;
  }

  function clearSleepTimer(showMessage = true) {
    window.clearInterval(sleepTimerInterval);
    sleepTimerInterval = 0;
    sleepTimerDeadline = 0;
    updateSleepTimerButton();
    if (showMessage) showToast("Timer de sono desligado.");
  }

  function updateSleepTimerButton() {
    if (!el.sleepTimerButton || !el.sleepTimerLabel) return;
    if (!sleepTimerDeadline) {
      el.sleepTimerLabel.textContent = "Timer";
      el.sleepTimerButton.title = "Timer de sono desligado";
      el.sleepTimerButton.setAttribute("aria-label", "Timer de sono desligado");
      return;
    }

    const remaining = sleepTimerDeadline - Date.now();
    if (remaining <= 0) {
      clearSleepTimer(false);
      [el.mainAudio, el.syncAudio].forEach((audio) => {
        if (audio.src) audio.pause();
      });
      captureAudioPosition();
      saveActiveBookProgress().catch(() => {
        showToast("Não consegui salvar onde você parou.");
      });
      updatePlaybackButtons();
      showToast("Timer encerrado. Áudio pausado.");
      return;
    }

    const label = formatSleepRemaining(remaining);
    el.sleepTimerLabel.textContent = label;
    el.sleepTimerButton.title = `Timer de sono: ${label} restantes`;
    el.sleepTimerButton.setAttribute("aria-label", `Timer de sono ativo. ${label} restantes`);
  }

  function setSleepTimer(minutes) {
    window.clearInterval(sleepTimerInterval);
    if (!minutes) {
      clearSleepTimer();
      return;
    }

    sleepTimerDeadline = Date.now() + minutes * 60000;
    sleepTimerInterval = window.setInterval(updateSleepTimerButton, 1000);
    updateSleepTimerButton();
    showToast(`Timer de sono: ${minutes} min.`);
  }

  function cycleSleepTimer() {
    const remainingMinutes = sleepTimerDeadline ? Math.ceil((sleepTimerDeadline - Date.now()) / 60000) : 0;
    const currentIndex = sleepTimerDeadline
      ? sleepTimerOptions.findIndex((minutes) => minutes >= remainingMinutes)
      : -1;
    const nextIndex = (currentIndex + 1) % sleepTimerOptions.length;
    setSleepTimer(sleepTimerOptions[nextIndex]);
  }

  function cyclePlaybackRate() {
    const currentIndex = playbackRates.findIndex((rate) => Number(rate) === Number(state.prefs.playbackRate));
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playbackRates.length : 1;
    state.prefs.playbackRate = playbackRates[nextIndex];
    applyPrefs();
    savePrefs();
    showToast(`Velocidade: ${formatPlaybackRate(state.prefs.playbackRate)}`);
  }

  function captureAudioPosition(audio = activeAudio) {
    if (!audio || !Number.isFinite(audio.currentTime)) return;
    state.audioPosition = Math.max(0, audio.currentTime || 0);
  }

  function restoreAudioPosition(audio) {
    if (!audio.src || !Number.isFinite(state.audioPosition) || state.audioPosition <= 0) return;
    if (audio.dataset.restoredBookId === state.activeBookId) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = duration ? clamp(state.audioPosition, 0, Math.max(0, duration - 0.25)) : state.audioPosition;
    audio.dataset.restoredBookId = state.activeBookId;
    updateAudioTimeUi();
  }

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(prefsKey) || "{}");
      state.prefs = {
        ...state.prefs,
        ...saved,
        fontSize: clamp(Number(saved.fontSize) || state.prefs.fontSize, 16, 26),
        playbackRate: clamp(Number(saved.playbackRate) || state.prefs.playbackRate, 0.75, 2)
      };
    } catch (error) {
      localStorage.removeItem(prefsKey);
    }
  }

  function savePrefs() {
    localStorage.setItem(prefsKey, JSON.stringify(state.prefs));
  }

  function applyPrefs() {
    document.body.classList.toggle("is-night", Boolean(state.prefs.nightMode));
    document.body.classList.toggle("is-nav-collapsed", Boolean(state.prefs.navCollapsed));
    document.documentElement.style.setProperty("--reader-font-size", `${state.prefs.fontSize}px`);
    el.nightModeToggle.checked = Boolean(state.prefs.nightMode);
    el.fontSizeInput.value = String(state.prefs.fontSize);
    el.appTabs.classList.toggle("is-collapsed", Boolean(state.prefs.navCollapsed));
    el.navToggle.setAttribute("aria-expanded", String(!state.prefs.navCollapsed));
    updateMenuButton();
    [el.mainAudio, el.syncAudio].forEach((audio) => {
      audio.playbackRate = state.prefs.playbackRate;
    });
    updateSpeedButtons();
    fitReaderPage();
  }

  function setScreen(name) {
    Object.entries(el.screens).forEach(([screenName, screen]) => {
      screen.classList.toggle("is-active", screenName === name);
    });
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.screenTarget === name);
    });
    if (name === "read") {
      if (activeAudio?.readyState > 0) syncReaderToAudio();
      else fitReaderPage();
    }
    if (name === "listen") updateListeningEstimate();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const two = (value) => String(value).padStart(2, "0");
    return hours ? `${hours}:${two(minutes)}:${two(secs)}` : `${two(minutes)}:${two(secs)}`;
  }

  function parseTime(value) {
    const parts = String(value || "")
      .trim()
      .replace(",", ".")
      .split(":")
      .map((part) => Number.parseFloat(part));
    if (parts.some((part) => Number.isNaN(part))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function sanitize(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  function splitIntoParagraphs(text) {
    const compact = text.replace(/\s+/g, " ").trim();
    if (!compact) return [];
    const sentences = compact.match(/[^.!?。！？]+[.!?。！？]+["')\]]*|.+$/g) || [compact];
    const paragraphs = [];
    let paragraph = "";
    sentences.forEach((sentence) => {
      const next = `${paragraph} ${sentence}`.trim();
      if (next.length > 520 && paragraph) {
        paragraphs.push(paragraph);
        paragraph = sentence.trim();
      } else {
        paragraph = next;
      }
    });
    if (paragraph) paragraphs.push(paragraph);
    return paragraphs;
  }

  function chapterChunks(chapter) {
    if (!chapter || !chapter.text) return [""];
    const chunks = [];
    let cursor = 0;
    while (cursor < chapter.text.length) {
      chunks.push(chapter.text.slice(cursor, cursor + CHUNK_SIZE));
      cursor += CHUNK_SIZE;
    }
    return chunks.length ? chunks : [""];
  }

  function totalTextLength() {
    return state.chapters.reduce((sum, chapter) => sum + chapter.text.length, 0) || 1;
  }

  function fullText() {
    return state.chapters.map((chapter) => chapter.text).join("\n\n");
  }

  function chapterStartOffset(chapterIndex) {
    return state.chapters.slice(0, chapterIndex).reduce((sum, chapter) => sum + chapter.text.length, 0);
  }

  function textOffsetFromPosition(chapterIndex, chunkIndex) {
    const chapter = state.chapters[chapterIndex];
    if (!chapter) return 0;
    return chapterStartOffset(chapterIndex) + clamp(chunkIndex * CHUNK_SIZE, 0, chapter.text.length);
  }

  function progressFromPosition(chapterIndex, chunkIndex) {
    return textOffsetFromPosition(chapterIndex, chunkIndex) / totalTextLength();
  }

  function positionFromProgress(progress) {
    const target = clamp(progress, 0, 1) * totalTextLength();
    let seen = 0;
    for (let index = 0; index < state.chapters.length; index += 1) {
      const chapterLength = state.chapters[index].text.length;
      if (target <= seen + chapterLength || index === state.chapters.length - 1) {
        return {
          chapter: index,
          chunk: Math.floor(clamp(target - seen, 0, chapterLength) / CHUNK_SIZE)
        };
      }
      seen += chapterLength;
    }
    return { chapter: 0, chunk: 0 };
  }

  function sortedAnchors() {
    return [...state.anchors].sort((a, b) => a.progress - b.progress || a.time - b.time);
  }

  function interpolate(progress, left, right, fallback) {
    const span = right.progress - left.progress;
    if (!span) return fallback;
    return left.time + ((progress - left.progress) / span) * (right.time - left.time);
  }

  function interpolateByTime(time, left, right, fallback) {
    const span = right.time - left.time;
    if (!span) return fallback;
    return left.progress + ((time - left.time) / span) * (right.progress - left.progress);
  }

  function audioTimeFromProgress(progress) {
    const anchors = sortedAnchors();
    const duration = activeAudio.duration || el.mainAudio.duration || el.syncAudio.duration || 0;
    const fallback = duration ? progress * duration : 0;
    if (!anchors.length) return fallback;
    if (anchors.length === 1) {
      const only = anchors[0];
      return clamp(only.time + (progress - only.progress) * duration, 0, duration || Infinity);
    }

    if (progress <= anchors[0].progress) return interpolate(progress, { progress: 0, time: 0 }, anchors[0], fallback);
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const left = anchors[index];
      const right = anchors[index + 1];
      if (progress >= left.progress && progress <= right.progress) return interpolate(progress, left, right, fallback);
    }
    const last = anchors[anchors.length - 1];
    return interpolate(progress, last, { progress: 1, time: duration || last.time }, fallback);
  }

  function progressFromAudioTime(time) {
    const anchors = [...state.anchors].sort((a, b) => a.time - b.time);
    const duration = activeAudio.duration || el.mainAudio.duration || el.syncAudio.duration || 0;
    const fallback = duration ? time / duration : 0;
    if (!anchors.length) return clamp(fallback, 0, 1);
    if (anchors.length === 1) {
      const only = anchors[0];
      return clamp(only.progress + (time - only.time) / (duration || 1), 0, 1);
    }

    if (time <= anchors[0].time) {
      return clamp(interpolateByTime(time, { progress: 0, time: 0 }, anchors[0], fallback), 0, 1);
    }
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const left = anchors[index];
      const right = anchors[index + 1];
      if (time >= left.time && time <= right.time) return clamp(interpolateByTime(time, left, right, fallback), 0, 1);
    }
    const last = anchors[anchors.length - 1];
    return clamp(interpolateByTime(time, last, { progress: 1, time: duration || last.time }, fallback), 0, 1);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function storeRequest(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction("books", mode);
      const store = tx.objectStore("books");
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadBooks() {
    state.library = await storeRequest("readonly", (store) => store.getAll());
    state.library.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    renderLibrary();
  }

  async function saveBook(book, refreshLibrary = true) {
    book.updatedAt = new Date().toISOString();
    await storeRequest("readwrite", (store) => store.put(book));
    localStorage.setItem(activeBookKey, book.id);
    if (refreshLibrary) {
      await loadBooks();
    } else {
      const index = state.library.findIndex((item) => item.id === book.id);
      if (index >= 0) state.library[index] = book;
    }
  }

  async function deleteBook(bookId) {
    await storeRequest("readwrite", (store) => store.delete(bookId));
    if (state.activeBookId === bookId) clearActiveBook();
    await loadBooks();
    showToast("Livro removido da biblioteca.");
  }

  async function clearBooksStore() {
    await storeRequest("readwrite", (store) => store.clear());
  }

  async function blobToDataUrl(blob) {
    if (!blob) return "";
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl) return null;
    const [meta, encoded] = dataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
    const binary = atob(encoded || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportDatabase() {
    const books = await storeRequest("readonly", (store) => store.getAll());
    const exportedBooks = [];
    for (const book of books) {
      exportedBooks.push({
        ...book,
        audioBlob: undefined,
        epubBlob: undefined,
        audioDataUrl: await blobToDataUrl(book.audioBlob),
        epubDataUrl: await blobToDataUrl(book.epubBlob)
      });
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadJson(`lemais-backup-${stamp}.json`, {
      app: "LeMais",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      activeBookId: state.activeBookId || localStorage.getItem(activeBookKey) || "",
      preferences: state.prefs,
      books: exportedBooks
    });
  }

  async function importDatabase(file) {
    const payload = JSON.parse(await file.text());
    if (payload.app !== "LeMais" || !Array.isArray(payload.books)) {
      throw new Error("Arquivo de backup inválido.");
    }
    const books = payload.books.map((book) => {
      const restored = { ...book };
      restored.audioBlob = dataUrlToBlob(book.audioDataUrl);
      restored.epubBlob = dataUrlToBlob(book.epubDataUrl);
      delete restored.audioDataUrl;
      delete restored.epubDataUrl;
      return restored;
    });

    await clearBooksStore();
    for (const book of books) {
      await storeRequest("readwrite", (store) => store.put(book));
    }

    if (payload.preferences) {
      state.prefs = { ...state.prefs, ...payload.preferences };
      savePrefs();
      applyPrefs();
    }

    clearActiveBook();
    await loadBooks();
    const activeBookId = books.some((book) => book.id === payload.activeBookId)
      ? payload.activeBookId
      : books[0]?.id;
    if (activeBookId) await selectBook(activeBookId);
  }

  async function recoverCoverForBook(bookId, epubFile) {
    const book = await storeRequest("readonly", (store) => store.get(bookId));
    if (!book) throw new Error("Livro não encontrado.");
    const parsed = await parseEpub(epubFile);
    if (!parsed.coverImage) throw new Error("Não encontrei arte nesse EPUB.");
    book.coverImage = parsed.coverImage;
    book.epubBlob = epubFile;
    if (!book.chapters?.length) book.chapters = parsed.chapters;
    await saveBook(book);
    if (state.activeBookId === book.id) {
      state.coverImage = parsed.coverImage;
      renderSummary();
    }
  }

  async function recoverStoredCovers() {
    const books = await storeRequest("readonly", (store) => store.getAll());
    const candidates = books.filter((book) => !book.coverImage && book.epubBlob);
    for (const book of candidates) {
      try {
        await recoverCoverForBook(book.id, book.epubBlob);
      } catch (error) {
        // Best effort: old or unusual EPUBs may not expose a cover.
      }
    }
  }

  async function selectBook(bookId) {
    const book = await storeRequest("readonly", (store) => store.get(bookId));
    if (!book) return;
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.activeBookId = book.id;
    state.audioUrl = book.audioBlob ? URL.createObjectURL(book.audioBlob) : "";
    state.audioName = book.audioName || "";
    state.epubName = book.epubName || "";
    state.vttName = book.vttName || "";
    state.coverImage = book.coverImage || "";
    state.chapters = book.chapters || [];
    state.anchors = book.anchors || [];
    state.currentChapter = book.currentChapter || 0;
    state.currentChunk = book.currentChunk || 0;
    state.audioPosition = book.audioPosition || 0;
    localStorage.setItem(activeBookKey, book.id);
    [el.mainAudio, el.syncAudio].forEach((audio) => {
      audio.pause();
      audio.removeAttribute("src");
      delete audio.dataset.restoredBookId;
      audio.load();
    });
    renderSummary();
    updateAudioSources();
    renderLibrary();
    setScreen("read");
    showToast(`Livro aberto: ${book.title}`);
  }

  function clearActiveBook() {
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    Object.assign(state, {
      activeBookId: "",
      audioUrl: "",
      audioName: "",
      epubName: "",
      vttName: "",
      coverImage: "",
      chapters: [],
      anchors: [],
      currentChapter: 0,
      currentChunk: 0,
      audioPosition: 0
    });
    localStorage.removeItem(activeBookKey);
    [el.mainAudio, el.syncAudio].forEach((audio) => {
      audio.pause();
      audio.removeAttribute("src");
      delete audio.dataset.restoredBookId;
      audio.load();
    });
  }

  async function saveActiveBookProgress(refreshLibrary = false) {
    if (!state.activeBookId) return;
    const book = await storeRequest("readonly", (store) => store.get(state.activeBookId));
    if (!book) return;
    book.anchors = state.anchors;
    book.currentChapter = state.currentChapter;
    book.currentChunk = state.currentChunk;
    captureAudioPosition();
    book.audioPosition = state.audioPosition;
    await saveBook(book, refreshLibrary);
  }

  function queueSaveActiveBookProgress() {
    window.clearTimeout(saveProgressTimer);
    saveProgressTimer = window.setTimeout(() => {
      saveActiveBookProgress().catch(() => {
        showToast("Não consegui salvar o progresso.");
      });
    }, 450);
  }

  function renderImage(image, src, alt) {
    if (!src) {
      image.hidden = true;
      image.removeAttribute("src");
      image.alt = "";
      return;
    }
    image.hidden = false;
    image.src = src;
    image.alt = alt;
  }

  function renderLibrary() {
    const current = state.library.find((book) => book.id === state.activeBookId);
    renderImage(el.currentBookCover, current?.coverImage || "", current ? `Capa de ${current.title}` : "");
    el.currentBookTitle.textContent = current?.title || "Nenhum livro aberto";
    el.currentBookMeta.textContent = current
      ? `${current.chapters?.length || 0} capítulos · ${current.anchors?.length || 0} âncoras · ${current.audioName || "sem áudio"}`
      : "Importe um MP3, um EPUB e uma legenda VTT para criar âncoras automaticamente.";

    if (!state.library.length) {
      el.libraryList.innerHTML = '<div class="empty-state">Sua biblioteca ainda está vazia.</div>';
      return;
    }

    el.libraryList.innerHTML = state.library
      .map((book) => `
        <article class="book-card">
          ${book.coverImage
            ? `<img class="book-card-cover" src="${book.coverImage}" alt="Capa de ${sanitize(book.title)}">`
            : `<div class="book-card-fallback" aria-hidden="true">${sanitize((book.title || "?").slice(0, 1))}</div>`}
          <div>
            <h3>${sanitize(book.title)}</h3>
            <p>${book.chapters?.length || 0} capítulos · ${book.anchors?.length || 0} âncoras · ${sanitize(book.vttName || "sem VTT")}</p>
          </div>
          <div class="book-card-actions">
            <button class="primary-action" type="button" data-open-book="${book.id}">Abrir</button>
            ${book.coverImage ? "" : `<button class="secondary-action" type="button" data-recover-cover="${book.id}">Recuperar capa</button>`}
            <button class="secondary-action" type="button" data-delete-book="${book.id}">Remover</button>
          </div>
        </article>
      `)
      .join("");
  }

  function updateAudioSources() {
    [el.mainAudio, el.syncAudio].forEach((audio) => {
      if (state.audioUrl && audio.src !== state.audioUrl) audio.src = state.audioUrl;
      audio.playbackRate = state.prefs.playbackRate;
    });
  }

  function syncAudioElements(source, target) {
    if (!source.src || !target.src) return;
    if (Math.abs(source.currentTime - target.currentTime) > 0.5) target.currentTime = source.currentTime;
  }

  function renderChapterOptions() {
    const options = state.chapters
      .map((chapter, index) => `<option value="${index}">${sanitize(chapter.title || `Capítulo ${index + 1}`)}</option>`)
      .join("");
    el.syncChapterSelect.innerHTML = options;
    el.readChapterSelect.innerHTML = options;
    el.syncChapterSelect.disabled = !state.chapters.length;
    el.readChapterSelect.disabled = !state.chapters.length;
  }

  function renderReader() {
    const chapter = state.chapters[state.currentChapter];
    renderImage(el.readerBookCover, state.coverImage, state.activeBookId ? "Capa do livro aberto" : "");
    if (!chapter) {
      el.readerPage.innerHTML = "<p>Abra um livro da biblioteca ou importe um novo EPUB para começar.</p>";
      el.syncPreview.innerHTML = "<p>Abra um livro para revisar âncoras manualmente.</p>";
      el.readPosition.max = 0;
      el.syncPosition.max = 0;
      el.readProgressLabel.textContent = "0%";
      el.estimatedAudioLabel.textContent = "00:00";
      return;
    }

    const chunks = chapterChunks(chapter);
    state.currentChunk = clamp(state.currentChunk, 0, chunks.length - 1);
    const chunk = chunks[state.currentChunk];
    const paragraphs = splitIntoParagraphs(chunk);
    const html = `<h3>${sanitize(chapter.title)}</h3>${paragraphs.map((text) => `<p>${sanitize(text)}</p>`).join("")}`;

    el.readerPage.innerHTML = html;
    addReaderTapZones();
    fitReaderPage();
    el.syncPreview.innerHTML = html;
    el.readChapterSelect.value = String(state.currentChapter);
    el.syncChapterSelect.value = String(state.currentChapter);
    el.readPosition.max = String(chunks.length - 1);
    el.syncPosition.max = String(chunks.length - 1);
    el.readPosition.value = String(state.currentChunk);
    el.syncPosition.value = String(state.currentChunk);

    const progress = progressFromPosition(state.currentChapter, state.currentChunk);
    el.readProgressLabel.textContent = `${Math.round(progress * 100)}%`;
    el.estimatedAudioLabel.textContent = formatTime(audioTimeFromProgress(progress));
    el.anchorProgress.value = (progress * 100).toFixed(2);
  }

  function addReaderTapZones() {
    const left = document.createElement("button");
    left.type = "button";
    left.className = "reader-tap-zone is-left";
    left.dataset.readerNav = "previous";
    left.setAttribute("aria-label", "Página anterior");
    left.title = "Página anterior";

    const right = document.createElement("button");
    right.type = "button";
    right.className = "reader-tap-zone is-right";
    right.dataset.readerNav = "next";
    right.setAttribute("aria-label", "Próxima página");
    right.title = "Próxima página";

    el.readerPage.append(left, right);
  }

  function fitReaderPage() {
    if (!el.readerPage) return;
    el.readerPage.style.setProperty("--reader-fit-scale", "1");
    window.requestAnimationFrame(() => {
      const page = el.readerPage;
      if (!page || !page.isConnected || !page.clientHeight) return;
      const overflow = page.scrollHeight - page.clientHeight;
      if (overflow <= 0) return;
      const scale = clamp((page.clientHeight / page.scrollHeight) * 0.98, 0.78, 1);
      page.style.setProperty("--reader-fit-scale", scale.toFixed(2));
    });
  }

  function renderAnchors() {
    const anchors = sortedAnchors();
    el.anchorCount.textContent = String(anchors.length);
    if (!anchors.length) {
      el.anchorList.innerHTML = "<li>Nenhuma âncora criada ainda.</li>";
      return;
    }
    el.anchorList.innerHTML = anchors
      .map((anchor) => {
        const position = positionFromProgress(anchor.progress);
        const chapter = state.chapters[position.chapter];
        const confidence = anchor.confidence ? ` · ${Math.round(anchor.confidence * 100)}%` : "";
        return `
          <li>
            <div class="anchor-item-head">
              <span>${formatTime(anchor.time)}</span>
              <span>${Math.round(anchor.progress * 100)}%</span>
            </div>
            <p class="anchor-item-note">${sanitize(chapter?.title || "Texto")} · ${sanitize(anchor.note || "Sem nota")}${confidence}</p>
            <button class="anchor-remove" type="button" data-anchor-id="${anchor.id}">Remover</button>
          </li>
        `;
      })
      .join("");
  }

  function renderSummary() {
    document.documentElement.dataset.jszipReady = window.JSZip ? "true" : "false";
    el.audioFileName.textContent = state.draft.audioFile?.name || state.audioName || "Nenhum arquivo";
    el.epubFileName.textContent = state.draft.epubFile?.name || state.epubName || "Nenhum arquivo";
    el.vttFileName.textContent = state.draft.vttFile?.name || state.vttName || "Nenhum arquivo";
    el.chapterCount.textContent = String(state.draft.chapters.length || state.chapters.length);
    el.anchorCount.textContent = String(state.anchors.length);
    el.importStatus.textContent = state.draft.chapters.length
      ? "Pronto para ancorar"
      : state.activeBookId
        ? "Livro aberto"
        : "Aguardando arquivos";
    updateAudioSources();
    renderChapterOptions();
    renderReader();
    renderAnchors();
    renderLibrary();
    updateListeningEstimate();
    updatePlaybackButtons();
    updateSleepTimerButton();
    renderIcons();
  }

  function updateDurationLabels() {
    const duration = activeAudio.duration || el.mainAudio.duration || el.syncAudio.duration || 0;
    el.audioDuration.textContent = formatTime(duration);
    el.mainDuration.textContent = formatTime(duration);
    el.audioSeek.max = String(Math.floor(duration || 0));
  }

  function updateAudioTimeUi() {
    const audio = activeAudio;
    el.mainCurrentTime.textContent = formatTime(audio.currentTime);
    el.anchorTime.value = formatTime(audio.currentTime);
    if (!el.audioSeek.matches(":active")) el.audioSeek.value = String(Math.floor(audio.currentTime || 0));
    updateListeningEstimate();
  }

  function updateListeningEstimate() {
    if (!state.chapters.length) {
      el.listenChapter.textContent = "Sem capítulo";
      el.listenExcerpt.textContent = "Abra um livro da biblioteca ou importe um novo.";
      return;
    }
    const progress = progressFromAudioTime(activeAudio.currentTime || 0);
    const position = positionFromProgress(progress);
    const chapter = state.chapters[position.chapter];
    const chunks = chapterChunks(chapter);
    const chunk = chunks[position.chunk] || "";
    el.listenChapter.textContent = chapter?.title || "Capítulo";
    el.listenExcerpt.textContent = chunk.replace(/\s+/g, " ").trim().slice(0, 260) || "Sem trecho disponível.";
  }

  function syncReaderToAudio() {
    if (!state.chapters.length) return;
    const progress = progressFromAudioTime(activeAudio.currentTime || 0);
    const position = positionFromProgress(progress);
    state.currentChapter = position.chapter;
    state.currentChunk = position.chunk;
    renderReader();
  }

  function seekAudioFromReader() {
    if (!state.audioUrl) return;
    const progress = progressFromPosition(state.currentChapter, state.currentChunk);
    const time = audioTimeFromProgress(progress);
    [el.mainAudio, el.syncAudio].forEach((audio) => {
      if (Number.isFinite(time) && Math.abs(audio.currentTime - time) > 0.7) {
        audio.currentTime = clamp(time, 0, audio.duration || time);
      }
    });
    captureAudioPosition();
    updateAudioTimeUi();
    queueSaveActiveBookProgress();
  }

  async function parseEpub(file) {
    if (!window.JSZip) throw new Error("JSZip não carregou.");
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const containerXml = await zip.file("META-INF/container.xml")?.async("text");
    if (!containerXml) throw new Error("EPUB sem META-INF/container.xml.");

    const parser = new DOMParser();
    const container = parser.parseFromString(containerXml, "application/xml");
    const rootfile = container.querySelector("rootfile")?.getAttribute("full-path");
    if (!rootfile) throw new Error("Não encontrei o pacote OPF do EPUB.");

    const opfXml = await zip.file(rootfile)?.async("text");
    if (!opfXml) throw new Error("Não consegui ler o pacote OPF.");

    const opf = parser.parseFromString(opfXml, "application/xml");
    const basePath = rootfile.split("/").slice(0, -1).join("/");
    const manifest = new Map();
    opf.querySelectorAll("manifest > item").forEach((item) => {
      manifest.set(item.getAttribute("id"), {
        href: item.getAttribute("href"),
        mediaType: item.getAttribute("media-type")
      });
    });

    const spineIds = Array.from(opf.querySelectorAll("spine > itemref")).map((item) => item.getAttribute("idref"));
    const chapters = [];
    let coverImage = "";
    for (const idref of spineIds) {
      const item = manifest.get(idref);
      if (!item || !/xhtml|html/i.test(item.mediaType || item.href || "")) continue;
      const path = normalizePath([basePath, item.href].filter(Boolean).join("/"));
      const html = await zip.file(path)?.async("text");
      if (!html) continue;
      const doc = parser.parseFromString(html, "text/html");
      const body = doc.body;
      if (!coverImage) coverImage = await extractCoverFromPage(zip, doc, path);
      const title = body.querySelector("h1,h2,h3,title")?.textContent?.replace(/\s+/g, " ").trim() || `Capítulo ${chapters.length + 1}`;
      const text = body.textContent.replace(/\s+/g, " ").trim();
      if (text.length > 40) chapters.push({ title, text });
    }

    if (!coverImage) coverImage = await extractFallbackCover(zip, manifest, basePath);
    if (!chapters.length) throw new Error("Não encontrei capítulos de texto nesse EPUB.");
    return { chapters, coverImage };
  }

  async function extractCoverFromPage(zip, doc, pagePath) {
    const image = doc.querySelector("img, image");
    const rawSrc =
      image?.getAttribute("src") ||
      image?.getAttribute("href") ||
      image?.getAttribute("xlink:href") ||
      "";
    if (!rawSrc || rawSrc.startsWith("data:")) return rawSrc || "";
    const pageDir = pagePath.split("/").slice(0, -1).join("/");
    return imageToDataUrl(zip, normalizePath([pageDir, rawSrc.split("#")[0]].filter(Boolean).join("/")));
  }

  async function extractFallbackCover(zip, manifest, basePath) {
    const imageItem =
      Array.from(manifest.values()).find((item) => /cover/i.test(item.href || "") && /^image\//i.test(item.mediaType || "")) ||
      Array.from(manifest.values()).find((item) => /^image\//i.test(item.mediaType || ""));
    if (!imageItem) return "";
    return imageToDataUrl(zip, normalizePath([basePath, imageItem.href].filter(Boolean).join("/")));
  }

  async function imageToDataUrl(zip, path) {
    const file = zip.file(path);
    if (!file) return "";
    const ext = path.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      ext === "svg" ? "image/svg+xml" :
      "image/jpeg";
    const base64 = await file.async("base64");
    return `data:${mime};base64,${base64}`;
  }

  function normalizePath(path) {
    const stack = [];
    path.split("/").forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") stack.pop();
      else stack.push(part);
    });
    return stack.join("/");
  }

  function parseVtt(raw) {
    const blocks = raw.replace(/\r/g, "").split(/\n{2,}/);
    const cues = [];
    blocks.forEach((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeLineIndex === -1) return;
      const timeLine = lines[timeLineIndex];
      const [startRaw, endRaw] = timeLine.split("-->").map((part) => part.trim().split(/\s+/)[0]);
      const start = parseTime(startRaw);
      const end = parseTime(endRaw);
      if (end - start < 0.08) return;
      const textLines = lines.slice(timeLineIndex + 1).map(cleanCueLine).filter(Boolean);
      const text = textLines[textLines.length - 1] || "";
      const normalized = normalizeWords(text);
      if (normalized.length < 3 || /^\[.*\]$/.test(text)) return;
      cues.push({ start, end, text, words: normalized });
    });
    return cues.filter((cue, index) => index === 0 || cue.words.join(" ") !== cues[index - 1].words.join(" "));
  }

  function cleanCueLine(line) {
    const withoutTiming = line
      .replace(/<\d{2}:\d{2}:\d{2}[.,]\d{3}>/g, "")
      .replace(/<\/?c[^>]*>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return withoutTiming;
  }

  function normalizeWords(text) {
    return text
      .replace(/[\u00ad\u2010-\u2015-]/g, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 1 && !["musica", "aplausos"].includes(word));
  }

  function buildNormalizedIndex(text) {
    let normalized = "";
    const map = [];
    let previousSpace = true;
    for (let index = 0; index < text.length; index += 1) {
      if (/[\u00ad\u2010-\u2015-]/.test(text[index])) continue;
      const base = text[index].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (/^[a-z0-9]$/.test(base)) {
        normalized += base;
        map.push(index);
        previousSpace = false;
      } else if (!previousSpace) {
        normalized += " ";
        map.push(index);
        previousSpace = true;
      }
    }
    return { normalized: ` ${normalized.trim()} `, map };
  }

  function createAutoAnchors(chapters, vttText) {
    const cues = parseVtt(vttText);
    const text = chapters.map((chapter) => chapter.text).join("\n\n");
    const index = buildNormalizedIndex(text);
    const matches = [];
    let lastMatchIndex = 0;

    for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 6) {
      const windowWords = [];
      for (let lookahead = cueIndex; lookahead < cues.length && windowWords.length < 44; lookahead += 1) {
        windowWords.push(...cues[lookahead].words);
      }
      if (windowWords.length < 10) continue;
      const match = findBestPhraseMatch(windowWords, index.normalized, lastMatchIndex);
      if (!match) continue;
      const originalOffset = index.map[Math.max(0, match.index - 1)] || 0;
      const progress = originalOffset / Math.max(1, text.length);
      const cue = cues[cueIndex];

      if (matches.length) {
        const previous = matches[matches.length - 1];
        if (cue.start - previous.time < 75 || progress - previous.progress < 0.008) continue;
      }

      matches.push({
        id: id(),
        time: cue.start,
        progress,
        confidence: match.confidence,
        source: "auto-vtt",
        note: `Auto: ${match.phrase.split(" ").slice(0, 8).join(" ")}`
      });
      lastMatchIndex = match.index + match.phrase.length;
    }

    return {
      cues: cues.length,
      anchors: matches.sort((a, b) => a.progress - b.progress || a.time - b.time)
    };
  }

  function findBestPhraseMatch(words, normalizedText, startIndex) {
    const lengths = [24, 20, 16, 12, 10, 8];
    for (const length of lengths) {
      if (words.length < length) continue;
      for (let offset = 0; offset <= words.length - length; offset += 2) {
        const phrase = words.slice(offset, offset + length).join(" ");
        const index = normalizedText.indexOf(` ${phrase} `, Math.max(0, startIndex - 1200));
        if (index >= 0 && index >= startIndex - 1200) {
          return { index, phrase, confidence: length / Math.max(words.length, length) };
        }
      }
    }
    return null;
  }

  async function ensureDraftChapters() {
    if (state.draft.chapters.length) return state.draft.chapters;
    if (!state.draft.epubFile) throw new Error("Selecione um EPUB primeiro.");
    const parsed = await parseEpub(state.draft.epubFile);
    state.draft.chapters = parsed.chapters;
    state.draft.coverImage = parsed.coverImage;
    return state.draft.chapters;
  }

  function defaultTitle() {
    return (
      el.bookTitleInput.value.trim() ||
      state.draft.epubFile?.name.replace(/\.epub$/i, "") ||
      state.draft.audioFile?.name.replace(/\.[^.]+$/i, "") ||
      "Livro sem título"
    );
  }

  function clearDraft() {
    state.draft = { audioFile: null, epubFile: null, vttFile: null, chapters: [], coverImage: "" };
    el.audioInput.value = "";
    el.epubInput.value = "";
    el.vttInput.value = "";
    el.bookTitleInput.value = "";
  }

  async function saveAnchoredDraft() {
    if (!state.draft.audioFile) throw new Error("Selecione um MP3 primeiro.");
    if (!state.draft.vttFile) throw new Error("Selecione uma legenda VTT primeiro.");
    const chapters = await ensureDraftChapters();
    const vttText = await state.draft.vttFile.text();
    const result = createAutoAnchors(chapters, vttText);
    if (!result.anchors.length) {
      throw new Error(`Não encontrei âncoras confiáveis em ${result.cues} legendas. Tente confirmar manualmente alguns pontos.`);
    }

    const book = {
      id: id(),
      title: defaultTitle(),
      audioName: state.draft.audioFile.name,
      epubName: state.draft.epubFile.name,
      vttName: state.draft.vttFile.name,
      coverImage: state.draft.coverImage,
      audioBlob: state.draft.audioFile,
      epubBlob: state.draft.epubFile,
      chapters,
      anchors: result.anchors,
      currentChapter: 0,
      currentChunk: 0,
      audioPosition: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveBook(book);
    clearDraft();
    await selectBook(book.id);
    showToast(`${result.anchors.length} âncoras criadas automaticamente.`);
  }

  function wireEvents() {
    el.tabs.forEach((control) => {
      control.addEventListener("click", () => setScreen(control.dataset.screenTarget));
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        captureAudioPosition();
        saveActiveBookProgress().catch(() => {});
      }
    });

    el.navToggle.addEventListener("click", () => {
      state.prefs.navCollapsed = !state.prefs.navCollapsed;
      applyPrefs();
      savePrefs();
    });

    el.nightModeToggle.addEventListener("change", () => {
      state.prefs.nightMode = el.nightModeToggle.checked;
      applyPrefs();
      savePrefs();
    });

    el.fontSizeInput.addEventListener("input", () => {
      state.prefs.fontSize = clamp(Number(el.fontSizeInput.value), 16, 26);
      applyPrefs();
      savePrefs();
    });

    el.appearanceToggle.addEventListener("click", () => {
      const willOpen = el.appearancePanel.hidden;
      el.appearancePanel.hidden = !willOpen;
      el.appearanceToggle.setAttribute("aria-expanded", String(willOpen));
    });

    el.mainSpeedButton.addEventListener("click", cyclePlaybackRate);
    el.readerSpeedButton.addEventListener("click", cyclePlaybackRate);
    el.sleepTimerButton.addEventListener("click", cycleSleepTimer);

    el.exportDbButton.addEventListener("click", async () => {
      el.exportDbButton.disabled = true;
      try {
        await exportDatabase();
        showToast("Backup exportado.");
      } catch (error) {
        showToast(error.message || "Não consegui exportar o banco.");
      } finally {
        el.exportDbButton.disabled = false;
      }
    });

    el.importDbButton.addEventListener("click", () => {
      el.importDbInput.click();
    });

    el.importDbInput.addEventListener("change", async () => {
      const file = el.importDbInput.files?.[0];
      if (!file) return;
      const confirmed = window.confirm("Importar este backup substituirá a biblioteca local atual. Continuar?");
      if (!confirmed) {
        el.importDbInput.value = "";
        return;
      }
      el.importDbButton.disabled = true;
      try {
        await importDatabase(file);
        showToast("Backup importado.");
      } catch (error) {
        showToast(error.message || "Não consegui importar o backup.");
      } finally {
        el.importDbButton.disabled = false;
        el.importDbInput.value = "";
      }
    });

    el.libraryList.addEventListener("click", async (event) => {
      const openButton = event.target.closest("[data-open-book]");
      const deleteButton = event.target.closest("[data-delete-book]");
      const recoverCoverButton = event.target.closest("[data-recover-cover]");
      if (openButton) await selectBook(openButton.dataset.openBook);
      if (deleteButton) await deleteBook(deleteButton.dataset.deleteBook);
      if (recoverCoverButton) {
        coverRepairBookId = recoverCoverButton.dataset.recoverCover;
        el.coverRepairInput.click();
      }
    });

    el.coverRepairInput.addEventListener("change", async () => {
      const file = el.coverRepairInput.files?.[0];
      if (!file || !coverRepairBookId) return;
      try {
        await recoverCoverForBook(coverRepairBookId, file);
        showToast("Capa recuperada.");
      } catch (error) {
        showToast(error.message || "Não consegui recuperar a capa.");
      } finally {
        coverRepairBookId = "";
        el.coverRepairInput.value = "";
      }
    });

    el.audioInput.addEventListener("change", () => {
      const file = el.audioInput.files?.[0];
      if (!file) return;
      state.draft.audioFile = file;
      if (!el.bookTitleInput.value.trim()) el.bookTitleInput.value = file.name.replace(/\.[^.]+$/i, "");
      renderSummary();
      showToast("MP3 selecionado.");
    });

    el.epubInput.addEventListener("change", () => {
      const file = el.epubInput.files?.[0];
      if (!file) return;
      state.draft.epubFile = file;
      state.draft.chapters = [];
      if (!el.bookTitleInput.value.trim()) el.bookTitleInput.value = file.name.replace(/\.epub$/i, "");
      renderSummary();
      showToast("EPUB selecionado.");
    });

    el.vttInput.addEventListener("change", () => {
      const file = el.vttInput.files?.[0];
      if (!file) return;
      state.draft.vttFile = file;
      renderSummary();
      showToast("VTT selecionado.");
    });

    el.parseEpubButton.addEventListener("click", async () => {
      el.parseEpubButton.disabled = true;
      el.importStatus.textContent = "Preparando EPUB";
      try {
        const chapters = await ensureDraftChapters();
        el.chapterCount.textContent = String(chapters.length);
        el.importStatus.textContent = "Pronto para ancorar";
        showToast(`${chapters.length} capítulos preparados.`);
      } catch (error) {
        showToast(error.message || "Não consegui preparar o EPUB.");
        el.importStatus.textContent = "Falha na importação";
      } finally {
        el.parseEpubButton.disabled = false;
      }
    });

    el.autoAnchorButton.addEventListener("click", async () => {
      el.autoAnchorButton.disabled = true;
      el.importStatus.textContent = "Criando âncoras";
      try {
        await saveAnchoredDraft();
      } catch (error) {
        showToast(error.message || "Não consegui criar âncoras.");
        el.importStatus.textContent = "Falha na ancoragem";
      } finally {
        el.autoAnchorButton.disabled = false;
        renderSummary();
      }
    });

    el.clearButton.addEventListener("click", () => {
      clearDraft();
      renderSummary();
      showToast("Importação limpa.");
    });

    [el.mainAudio, el.syncAudio].forEach((audio) => {
      audio.addEventListener("loadedmetadata", () => {
        activeAudio = audio;
        restoreAudioPosition(audio);
        updateDurationLabels();
        if (audio.currentTime > 0) syncReaderToAudio();
        else renderReader();
        updatePlaybackButtons();
      });
      audio.addEventListener("play", () => {
        activeAudio = audio;
        const other = audio === el.mainAudio ? el.syncAudio : el.mainAudio;
        syncAudioElements(audio, other);
        other.pause();
        updatePlaybackButtons();
      });
      audio.addEventListener("timeupdate", () => {
        activeAudio = audio;
        captureAudioPosition(audio);
        const other = audio === el.mainAudio ? el.syncAudio : el.mainAudio;
        syncAudioElements(audio, other);
        updateAudioTimeUi();
        if (Date.now() - lastProgressSaveAt > 5000) {
          lastProgressSaveAt = Date.now();
          saveActiveBookProgress().catch(() => {
            showToast("Não consegui salvar onde você parou.");
          });
        }
      });
      audio.addEventListener("pause", () => {
        activeAudio = audio;
        captureAudioPosition(audio);
        saveActiveBookProgress().catch(() => {
          showToast("Não consegui salvar onde você parou.");
        });
        updatePlaybackButtons();
      });
    });

    el.mainAudio.addEventListener("play", () => {
      updatePlaybackButtons();
    });

    el.playToggle.addEventListener("click", () => {
      togglePlayback(el.mainAudio);
    });

    el.readerPlayToggle.addEventListener("click", () => {
      togglePlayback(preferredPlaybackAudio());
    });

    el.readerSyncButton.addEventListener("click", () => {
      seekAudioFromReader();
      showToast("Áudio sincronizado com a página atual.");
    });

    el.audioSeek.addEventListener("input", () => {
      const time = Number(el.audioSeek.value);
      [el.mainAudio, el.syncAudio].forEach((audio) => {
        if (audio.src) audio.currentTime = time;
      });
      state.audioPosition = time;
      updateAudioTimeUi();
      saveActiveBookProgress().catch(() => {
        showToast("Não consegui salvar onde você parou.");
      });
    });

    const jump = (seconds) => {
      [el.mainAudio, el.syncAudio].forEach((audio) => {
        if (audio.src) audio.currentTime = clamp(audio.currentTime + seconds, 0, audio.duration || Infinity);
      });
      updateAudioTimeUi();
    };
    el.backwardButton.addEventListener("click", () => jump(-15));
    el.forwardButton.addEventListener("click", () => jump(15));
    el.syncBackward.addEventListener("click", () => jump(-15));
    el.syncForward.addEventListener("click", () => jump(15));

    el.addAnchorButton.addEventListener("click", async () => {
      if (!state.activeBookId) {
        showToast("Abra um livro da biblioteca primeiro.");
        return;
      }
      const time = parseTime(el.anchorTime.value);
      const progress = clamp(Number(el.anchorProgress.value) / 100, 0, 1);
      state.anchors.push({
        id: id(),
        time,
        progress,
        note: el.anchorNote.value.trim()
      });
      state.anchors = sortedAnchors();
      el.anchorNote.value = "";
      renderAnchors();
      renderReader();
      await saveActiveBookProgress(true);
      showToast("Âncora criada.");
    });

    el.anchorList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-anchor-id]");
      if (!button) return;
      state.anchors = state.anchors.filter((anchor) => anchor.id !== button.dataset.anchorId);
      renderAnchors();
      renderReader();
      await saveActiveBookProgress(true);
    });

    function setReaderPosition(chapter, chunk, syncAudio) {
      state.currentChapter = clamp(Number(chapter), 0, Math.max(state.chapters.length - 1, 0));
      const maxChunk = chapterChunks(state.chapters[state.currentChapter]).length - 1;
      state.currentChunk = clamp(Number(chunk), 0, maxChunk);
      renderReader();
      if (syncAudio) seekAudioFromReader();
      queueSaveActiveBookProgress();
    }

    el.readChapterSelect.addEventListener("change", () => setReaderPosition(el.readChapterSelect.value, 0, false));
    el.syncChapterSelect.addEventListener("change", () => setReaderPosition(el.syncChapterSelect.value, 0, false));
    el.readPosition.addEventListener("input", () => setReaderPosition(state.currentChapter, el.readPosition.value, false));
    el.syncPosition.addEventListener("input", () => setReaderPosition(state.currentChapter, el.syncPosition.value, false));

    function navigateReader(direction) {
      if (!state.chapters.length) return;
      if (direction < 0) {
        if (state.currentChunk > 0) setReaderPosition(state.currentChapter, state.currentChunk - 1, false);
        else if (state.currentChapter > 0) {
          const previousChapter = state.currentChapter - 1;
          setReaderPosition(previousChapter, chapterChunks(state.chapters[previousChapter]).length - 1, false);
        }
        return;
      }

      const maxChunk = chapterChunks(state.chapters[state.currentChapter]).length - 1;
      if (state.currentChunk < maxChunk) setReaderPosition(state.currentChapter, state.currentChunk + 1, false);
      else if (state.currentChapter < state.chapters.length - 1) setReaderPosition(state.currentChapter + 1, 0, false);
    }

    el.readerPage.addEventListener("click", (event) => {
      const zone = event.target.closest("[data-reader-nav]");
      if (!zone) return;
      navigateReader(zone.dataset.readerNav === "previous" ? -1 : 1);
    });

    el.readerPage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateReader(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateReader(1);
      }
    });
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return;
    try {
      await navigator.storage.persist();
    } catch (error) {
      // The app still works with best-effort browser storage.
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!["http:", "https:"].includes(window.location.protocol)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        // Offline support is optional; keep the reader usable if registration fails.
      });
    });
  }

  try {
    loadPrefs();
    applyPrefs();
    state.db = await openDb();
    await loadBooks();
    await recoverStoredCovers();
    wireEvents();
    const activeBookId = localStorage.getItem(activeBookKey);
    if (activeBookId) await selectBook(activeBookId);
    else renderSummary();
  } catch (error) {
    loadPrefs();
    applyPrefs();
    wireEvents();
    renderSummary();
    showToast("Não consegui abrir a biblioteca local.");
  }
  requestPersistentStorage();
  registerServiceWorker();
})();
