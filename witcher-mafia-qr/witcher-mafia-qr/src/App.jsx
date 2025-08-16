import React, { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Wiedźmińska Mafia — QR Role Generator
 * -------------------------------------------------
 * Jednoplikowa aplikacja React do przydzielania postaci i zdolności.
 * - Host tworzy wydarzenie, ustawia PIN MG i liczbę mafii.
 * - Generuje QR do dołączenia (tryb "ślepy") lub indywidualne QR-y z pre-przydziałem.
 * - Uczestnik skanuje QR, wpisuje imię+nazwisko i wybiera płeć → otrzymuje postać, rolę i zdolność.
 * - Działa w 100% statycznie (bez backendu). Opcjonalnie można włączyć tryb "pre-assign" (unikalne QR-y).
 *
 * WAŻNE: Unikalność przydziałów bez serwera jest najlepiej osiągnąć przez PRE-ASSIGN (wygeneruj QR-y dla listy gości).
 */

// ——— DATA ———
const FEMALE_CHARACTERS = [
  "Yennefer z Vengerbergu",
  "Filippa Eilhart",
  "Triss Merigold",
  "Keira Metz",
  "Shani",
  "Królowa Nocy (Bruxa)",
  "Ciri",
  "Margarita Laux-Antille",
  "Sabrina Glevissig",
  "Marti Södergren",
  "Nenneke",
];

const MALE_CHARACTERS = [
  "Geralt z Rivii",
  "Emhyr var Emreis",
  "Avallac'h",
  "Zoltan Chivay",
  "Druid (Śledczy)",
  "Stregobor",
];

// Preferencje ról (tylko wskazówki; ostateczny przydział zależy od losowania i limitu mafii)
const ALIGNMENT_HINTS = {
  "Druid (Śledczy)": "citizen", // klasyczny detektyw
  Shani: "citizen", // leczy
  "Marti Södergren": "citizen", // medyk
  Nenneke: "citizen",
  "Zoltan Chivay": "citizen",
  "Królowa Nocy (Bruxa)": "mafia",
  "Emhyr var Emreis": "mafia",
  Stregobor: "mafia",
  "Filippa Eilhart": "mafia",
};

// Zdolności powiązane z konkretnymi postaciami (priorytet)
const ABILITIES_BY_CHARACTER = {
  "Druid (Śledczy)": {
    name: "Wiedźmińskie Tropienie",
    desc: "Raz na noc możesz zapytać MG o prawdziwe nastawienie jednej osoby (mafia/obywatel).",
  },
  Shani: {
    name: "Leczenie",
    desc: "Raz w grze możesz ochronić jedną osobę przed eliminacją (działa po głosowaniu).",
  },
  "Marti Södergren": {
    name: "Eliksir Odrodzenia",
    desc: "Anulujesz eliminację wybranej osoby w tej rundzie (raz w grze).",
  },
  Nenneke: {
    name: "Błogosławieństwo",
    desc: "Raz w grze przyznajesz +1 ukryty głos wybranej osobie w głosowaniu.",
  },
  "Zoltan Chivay": {
    name: "Harcownik",
    desc: "Raz możesz wymusić zamianę kart akcji między dwiema osobami.",
  },
  "Królowa Nocy (Bruxa)": {
    name: "Przemiana",
    desc: "Raz możesz uniknąć ujawnienia roli lub eliminacji.",
  },
  Ciri: {
    name: "Skok Przez Wymiary",
    desc: "Raz pomijasz skutki akcji wymierzonej w Ciebie (po ujawnieniu).",
  },
  "Yennefer z Vengerbergu": {
    name: "Aksji",
    desc: "Raz w grze uciszasz jedną osobę na 1 minutę debaty.",
  },
  "Triss Merigold": {
    name: "Płomień Ochronny",
    desc: "Masz jednorazowy immunitet na akcję w nocy.",
  },
  "Keira Metz": {
    name: "Iluzja",
    desc: "Możesz wystawić fałszywy trop UV (jednorazowo).",
  },
  "Filippa Eilhart": {
    name: "Szpiegowska Sowa",
    desc: "Podglądasz kartę zdolności jednej osoby (bez ujawniania jej roli).",
  },
  "Margarita Laux-Antille": {
    name: "Tarcza Aretuzy",
    desc: "Raz w grze chronisz kogoś przed nocną akcją.",
  },
  "Sabrina Glevissig": {
    name: "Klątwa",
    desc: "Jednej osobie w turze przepada użycie karty specjalnej.",
  },
  "Emhyr var Emreis": {
    name: "Intryga Cesarza",
    desc: "Po głosowaniu możesz zamienić miejscami dwa głosy.",
  },
  "Avallac'h": {
    name: "Proroctwo",
    desc: "Raz pytasz MG pytanie tak/nie o dowolną osobę.",
  },
  "Geralt z Rivii": {
    name: "Tropienie",
    desc: "Raz sprawdzasz, czy wybrana osoba użyła zdolności w tej nocy.",
  },
  Stregobor: {
    name: "Miraż",
    desc: "Unieważniasz jedną wskazówkę UV przygotowaną przez MG (raz).",
  },
};

// Zdolności ogólne (fallback, gdy postać nie ma przypiętej)
const ABILITIES_BY_ALIGNMENT = {
  mafia: [
    {
      name: "Fałszywy Trop",
      desc: "Możesz wprowadzić jeden mylący znak UV na trasie.",
    },
    {
      name: "Zatrucie",
      desc: "Jedna osoba traci możliwość użycia zdolności w tej nocy.",
    },
    {
      name: "Cisza Nocy",
      desc: "Uciszasz jedną osobę na 30 sekund w debacie.",
    },
  ],
  citizen: [
    {
      name: "Znak Aard",
      desc: "Wymuszasz od MG drobny, prawdziwy hint na temat losowego tropu.",
    },
    {
      name: "Straż",
      desc: "Chronisz jedną osobę przed jedną nocną akcją.",
    },
    {
      name: "Przesłuchanie",
      desc: "Raz zadajesz jednej osobie pytanie, na które musi odpowiedzieć TAK/NIE.",
    },
  ],
};

// ——— UTILS ———
const randId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

function strHash(str) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(prng, arr) {
  return arr[Math.floor(prng() * arr.length)];
}

function shuffleWithSeed(arr, seed) {
  const a = [...arr];
  const r = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function encodeToken(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeToken(tok) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(tok))));
  } catch (e) {
    return null;
  }
}

// ——— STORAGE KEYS ———
const LS_EVENTS = "wm_events_v1"; // mapa: eventId -> config

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(LS_EVENTS) || "{}");
  } catch {
    return {};
  }
}
function saveEvents(map) {
  localStorage.setItem(LS_EVENTS, JSON.stringify(map));
}

// ——— COMPONENTS ———

export default function App() {
  const [events, setEvents] = useState(loadEvents());
  const [view, setView] = useState("setup");
  const [currentEventId, setCurrentEventId] = useState("");
  const [gmAuthed, setGmAuthed] = useState(false);

  // parse URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const eid = url.searchParams.get("event");
    const tok = url.searchParams.get("t");
    const gm = url.searchParams.get("gm");

    if (eid) {
      setCurrentEventId(eid);
      setView(tok ? "assignment" : gm ? "gm" : "join");
    }
  }, []);

  useEffect(() => saveEvents(events), [events]);

  const currentConfig = currentEventId ? events[currentEventId] : null;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Wiedźmińska Mafia — Role & QR
          </h1>
          <div className="text-zinc-400 text-sm">
            Event: {currentEventId || "—"}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {view === "setup" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <SetupScreen
                onCreate={(eid, cfg) => {
                  setEvents({ ...events, [eid]: cfg });
                  setCurrentEventId(eid);
                  setView("qr");
                }}
              />
            </motion.div>
          )}

          {view === "qr" && currentConfig && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <QrScreen eventId={currentEventId} config={currentConfig} />
            </motion.div>
          )}

          {view === "join" && currentConfig && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <JoinScreen eventId={currentEventId} config={currentConfig} />
            </motion.div>
          )}

          {view === "assignment" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AssignmentScreen />
            </motion.div>
          )}

          {view === "gm" && currentConfig && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GMDashboard
                eventId={currentEventId}
                config={currentConfig}
                onAuth={() => setGmAuthed(true)}
                authed={gmAuthed}
                onUpdate={(cfg) => setEvents({ ...events, [currentEventId]: cfg })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-10 text-xs text-zinc-500">
          Tip: w trybie PRE-ASSIGN wygeneruj dla każdego gracza osobny QR z jego
          imieniem — to gwarantuje unikalne postacie bez internetu.
        </footer>
      </div>
    </div>
  );
}

function SetupScreen({ onCreate }) {
  const [name, setName] = useState("Ognisko w Parku Osobowickim");
  const [mafias, setMafias] = useState(3);
  const [pin, setPin] = useState("1111");

  const [femalePool, setFemalePool] = useState(FEMALE_CHARACTERS.join("\\n"));
  const [malePool, setMalePool] = useState(MALE_CHARACTERS.join("\\n"));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold mb-3">Utwórz wydarzenie</h2>
        <label className="block text-sm text-zinc-300 mb-1">Nazwa</label>
        <input
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="block text-sm text-zinc-300 mb-1">PIN MG</label>
        <input
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-3"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <label className="block text-sm text-zinc-300 mb-1">Liczba mafii</label>
        <input
          type="number"
          min={1}
          max={6}
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-4"
          value={mafias}
          onChange={(e) => setMafias(parseInt(e.target.value || "0", 10))}
        />
        <button
          onClick={() => {
            const eventId = randId();
            onCreate(eventId, {
              name,
              pin,
              mafias,
              femalePool: femalePool
                .split("\\n")
                .map((s) => s.trim())
                .filter(Boolean),
              malePool: malePool
                .split("\\n")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold py-2"
        >
          Utwórz wydarzenie
        </button>
      </div>

      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h3 className="font-medium mb-2">Pula postaci (możesz edytować)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-zinc-300 mb-1">Kobiety</div>
            <textarea
              className="w-full h-48 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2"
              value={femalePool}
              onChange={(e) => setFemalePool(e.target.value)}
            />
          </div>
          <div>
            <div className="text-sm text-zinc-300 mb-1">Mężczyźni</div>
            <textarea
              className="w-full h-48 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2"
              value={malePool}
              onChange={(e) => setMalePool(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3">
          Domyślne listy zawierają Twoje propozycje (dodałem Geralta, aby było 6
          męskich postaci na 6 chłopaków).
        </p>
      </div>
    </div>
  );
}

function QrScreen({ eventId, config }) {
  const base = window.location.href.split("?")[0];
  const joinUrl = `${base}?event=${eventId}`;
  const gmUrl = `${base}?event=${eventId}&gm=1`;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold mb-2">Dołączanie — QR (ślepy)</h2>
        <p className="text-sm text-zinc-300 mb-4">
          Uczestnicy skanują QR, wpisują imię+nazwisko i wybierają płeć —
          aplikacja przydzieli im postać, rolę i zdolność. (Możliwe rzadkie
          duplikaty bez serwera.)
        </p>
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl"><QRCode value={joinUrl} /></div>
          <Copyable text={joinUrl} label="Skopiuj link dołączania" />
        </div>
      </div>

      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold mb-2">Panel MG — QR</h2>
        <p className="text-sm text-zinc-300 mb-4">
          Zeskanuj jako Mistrz Gry, aby wejść do panelu (PIN: ustawiony w
          konfiguracji).
        </p>
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl"><QRCode value={gmUrl} /></div>
          <Copyable text={gmUrl} label="Skopiuj link MG" />
        </div>
      </div>

      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg md:col-span-2">
        <PreAssignGenerator eventId={eventId} config={config} />
      </div>
    </div>
  );
}

function PreAssignGenerator({ eventId, config }) {
  const [rosterText, setRosterText] = useState(
    "Imię Nazwisko,K\n… (wpisz 15 osób: K/M w drugiej kolumnie)"
  );
  const [generated, setGenerated] = useState([]);

  const base = window.location.href.split("?")[0];

  function generate() {
    // parse roster
    const rows = rosterText
      .split(/\n+/)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => {
        const [name, g] = r.split(/,|;|\t/);
        return { name: (name || "").trim(), gender: (g || "").trim().toUpperCase() };
      })
      .filter((r) => r.name && (r.gender === "K" || r.gender === "M"));

    // seed-based shuffle of pools
    const female = shuffleWithSeed(
      config.femalePool,
      strHash(eventId + "FEMALEPOOL")
    );
    const male = shuffleWithSeed(
      config.malePool,
      strHash(eventId + "MALEPOOL")
    );

    // Assign characters in order, wrap if necessary
    let fi = 0,
      mi = 0;

    const draft = rows.map((r, idx) => {
      const char = r.gender === "K" ? female[fi++ % female.length] : male[mi++ % male.length];
      return { idx, ...r, character: char };
    });

    // Roles: pick mafias avoiding strong citizen locks if możliwe
    const mafiaCount = Math.max(1, Math.min(config.mafias || 3, draft.length - 1));
    const seed = strHash(eventId + "ROLES");
    const order = shuffleWithSeed(draft.map((_, i) => i), seed);
    const mafiaIdx = new Set();
    for (let i of order) {
      const ch = draft[i].character;
      if (mafiaIdx.size >= mafiaCount) break;
      if (ALIGNMENT_HINTS[ch] === "citizen") continue; // prefer ominąć
      mafiaIdx.add(i);
    }
    // jeśli dalej brakuje — dobij losowo
    for (let i of order) {
      if (mafiaIdx.size >= mafiaCount) break;
      mafiaIdx.add(i);
    }

    const assigned = draft.map((r, i) => {
      const role = mafiaIdx.has(i) ? "mafia" : "citizen";
      const ability = pickAbility(r.character, role, eventId + r.name);
      const payload = {
        eventId,
        name: r.name,
        character: r.character,
        role,
        ability,
        stamp: Date.now(),
      };
      const t = encodeToken(payload);
      const url = `${base}?event=${eventId}&t=${encodeURIComponent(t)}`;
      return { ...payload, url };
    });

    setGenerated(assigned);
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">PRE-ASSIGN — unikalne QR-y dla każdego</h3>
      <p className="text-sm text-zinc-300 mb-3">
        Wklej listę: <code>Imię Nazwisko, K/M</code> po jednej osobie w
        wierszu. Kliknij „Generuj”. Otrzymasz indywidualne QR-y i linki — rozdaj
        je uczestnikom.
      </p>
      <textarea
        className="w-full h-36 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-3"
        value={rosterText}
        onChange={(e) => setRosterText(e.target.value)}
      />
      <button
        onClick={generate}
        className="rounded-xl bg-indigo-500 hover:bg-indigo-400 text-indigo-950 font-semibold px-4 py-2"
      >
        Generuj QR-y
      </button>

      {generated.length > 0 && (
        <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {generated.map((g, i) => (
            <div key={i} className="bg-zinc-900/70 rounded-2xl p-4">
              <div className="bg-white rounded-lg p-2 mb-3">
                <QRCode value={g.url} size={160} />
              </div>
              <div className="font-semibold">{g.name}</div>
              <div className="text-sm text-zinc-300">{g.character}</div>
              <div className="text-xs text-zinc-400 mb-2">{g.role} — {g.ability.name}</div>
              <Copyable text={g.url} label="Skopiuj link" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pickAbility(character, role, seedStr) {
  const forced = ABILITIES_BY_CHARACTER[character];
  if (forced) return forced;
  const pool = ABILITIES_BY_ALIGNMENT[role] || ABILITIES_BY_ALIGNMENT.citizen;
  const prng = mulberry32(strHash(seedStr));
  return pickRandom(prng, pool);
}

function JoinScreen({ eventId, config }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("K");
  const [result, setResult] = useState(null);

  function assign() {
    const pool = gender === "K" ? config.femalePool : config.malePool;
    const prng = mulberry32(strHash(`${eventId}|${name}|${gender}`));
    const character = pickRandom(prng, pool);

    // role losowana, z lekką preferencją jeśli są hinty
    const hint = ALIGNMENT_HINTS[character];
    const weightMafia = hint === "mafia" ? 0.7 : 0.3;
    const role = prng() < weightMafia ? "mafia" : "citizen";

    const ability = pickAbility(character, role, `${eventId}|${name}`);

    setResult({ name, character, role, ability });
  }

  if (result) {
    const t = encodeToken({ eventId, ...result, stamp: Date.now() });
    const url = `${window.location.href.split("?")[0]}?event=${eventId}&t=${encodeURIComponent(t)}`;
    return (
      <div className="max-w-xl mx-auto bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold mb-3">Twoja rola</h2>
        <RevealCard result={result} />
        <div className="mt-4">
          <Copyable text={url} label="Skopiuj swój sekret link" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
      <h2 className="text-lg font-semibold mb-2">Dołącz do gry</h2>
      <div className="text-sm text-zinc-300 mb-4">
        Wpisz imię i nazwisko oraz wybierz płeć (K/M). Dane służą wyłącznie do
        wygenerowania roli na Twoim urządzeniu.
      </div>
      <label className="block text-sm text-zinc-300 mb-1">Imię i nazwisko</label>
      <input
        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-3"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="np. Julia Nowak"
      />
      <label className="block text-sm text-zinc-300 mb-1">Płeć</label>
      <div className="flex gap-3 mb-4">
        {[
          { v: "K", l: "Kobieta" },
          { v: "M", l: "Mężczyzna" },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setGender(o.v)}
            className={`px-3 py-2 rounded-xl border ${
              gender === o.v ? "bg-emerald-500 text-emerald-950 border-emerald-400" : "bg-zinc-900 border-zinc-700"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
      <button
        onClick={assign}
        disabled={!name.trim()}
        className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 text-indigo-950 font-semibold py-2 disabled:opacity-50"
      >
        Wylosuj postać i zdolność
      </button>
    </div>
  );
}

function AssignmentScreen() {
  const url = new URL(window.location.href);
  const tok = url.searchParams.get("t");
  const data = decodeToken(tok || "");

  if (!tok || !data) {
    return (
      <div className="max-w-md mx-auto bg-rose-900/30 border border-rose-700 text-rose-100 rounded-2xl p-5">
        Nieprawidłowy lub pusty token. Poproś MG o prawidłowy link.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
      <h2 className="text-lg font-semibold mb-3">Twoja rola</h2>
      <RevealCard result={data} />
    </div>
  );
}

function RevealCard({ result }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-400">Gracz</div>
          <div className="font-semibold text-lg">{result.name || "—"}</div>
        </div>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold"
        >
          {revealed ? "Ukryj" : "Odsłoń"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-zinc-700"
          >
            <div className="p-4 grid gap-2">
              <Row label="Postać" value={result.character} />
              <Row label="Rola" value={result.role === "mafia" ? "Mafia" : "Obywatel"} />
              <div>
                <div className="text-sm text-zinc-400">Zdolność</div>
                <div className="font-medium">{result.ability?.name}</div>
                <div className="text-sm text-zinc-300">{result.ability?.desc}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="font-medium text-right">{value}</div>
    </div>
  );
}

function GMDashboard({ eventId, config, onAuth, authed, onUpdate }) {
  const [pin, setPin] = useState("");
  const [mafias, setMafias] = useState(config.mafias || 3);

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold mb-2">Panel MG</h2>
        <div className="text-sm text-zinc-300 mb-3">Podaj PIN, aby wejść.</div>
        <input
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-3"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
        />
        <button
          onClick={() => {
            if (pin === config.pin) onAuth();
            else alert("Błędny PIN");
          }}
          className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold py-2"
        >
          Wejdź
        </button>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h3 className="font-semibold mb-2">Ustawienia wydarzenia</h3>
        <div className="text-sm text-zinc-300 mb-3">{config.name}</div>
        <label className="block text-sm text-zinc-300 mb-1">Liczba mafii</label>
        <input
          type="number"
          min={1}
          max={6}
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 mb-3"
          value={mafias}
          onChange={(e) => setMafias(parseInt(e.target.value || "0", 10))}
        />
        <button
          onClick={() => onUpdate({ ...config, mafias })}
          className="rounded-xl bg-indigo-500 hover:bg-indigo-400 text-indigo-950 font-semibold px-4 py-2"
        >
          Zapisz
        </button>
        <p className="text-xs text-zinc-400 mt-3">
          Rekomendacja na 15 graczy: 3 mafii (lub 4, jeśli zagadki dają wiele
          podpowiedzi obywatelom).
        </p>
      </div>

      <div className="bg-zinc-800/60 rounded-2xl p-5 shadow-lg">
        <h3 className="font-semibold mb-2">Szybkie zasady roli/zdolności</h3>
        <ul className="text-sm text-zinc-300 list-disc pl-5 space-y-1">
          <li><b>Druid</b> = śledczy (obywatel),
            <b> Shani/Marti</b> = medyk, <b>Bruxa</b> zwykle pro-mafia.</li>
          <li>Jeśli grasz „ślepo”, możliwe duplikaty postaci. Użyj PRE-ASSIGN,
            by ich uniknąć.</li>
          <li>Link z tokenem „t” wyświetla gotowy przydział na urządzeniu gracza.</li>
        </ul>
      </div>
    </div>
  );
}

function Copyable({ text, label = "Kopiuj" }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } catch {}
      }}
      className={`px-3 py-2 rounded-xl border ${
        ok
          ? "border-emerald-400 bg-emerald-500 text-emerald-950"
          : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
      }`}
      title={text}
    >
      {ok ? "Skopiowano!" : label}
    </button>
  );
}
