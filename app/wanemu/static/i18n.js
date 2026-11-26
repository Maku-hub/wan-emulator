"use strict";
// UI strings: English (default) and Polish.
// Placeholders like {name} are filled in by t(key, {name: value}).

const I18N = {
  en: {
    "app.title": "WAN Emulator",
    "status.stopped": "STOPPED",
    "status.running": "RUNNING ({profile})",
    "status.dirty": " – unapplied changes",
    "status.manual": "manual configuration",
    "status.modified": "{name} (modified)",
    "btn.start": "Start",
    "btn.apply": "Apply changes",
    "btn.stop": "Stop",
    "btn.save": "Save",
    "btn.saveTitle": "Overwrite the loaded profile",
    "btn.saveAs": "Save as…",
    "btn.delete": "Delete",
    "btn.reset": "Reset form",
    "profiles.title": "Profiles",
    "profiles.loaded": "Loaded profile:",
    "profiles.clickToLoad": "Click to load into the form",
    "profiles.running": "▶ running",
    "profiles.runningModified": "▶ running (modified)",
    "sym.label": "Symmetric directions (B → A = A → B)",
    "sym.info": "Direction B → A uses the same parameters as A → B. Real links are often asymmetric (e.g. faster download than upload) – disable this option then.",
    "dir.a_to_b.info": "Traffic from the device on side A to the device on side B. In the default profiles A = client, so A → B is upload.",
    "dir.b_to_a.info": "Traffic from the device on side B to the device on side A. In the default profiles B = network, so B → A is download.",
    "preview.title": "tc commands for the current form",
    "preview.error": "Invalid parameters:\n{msg}",
    "live.pps": "pkt/s",
    "live.noIface": "interface missing",
    "live.noLink": "no link",
    "live.link": "link {speed}",
    "live.drops": "dropped: {drops} · queued: {qlen}",
    "live.off": "emulation off",
    "toast.started": "Emulation started",
    "toast.stopped": "Emulation stopped",
    "toast.loaded": "Profile “{name}” loaded – click “{button}”",
    "toast.saved": "Profile “{name}” saved",
    "toast.deleted": "Profile “{name}” deleted",
    "prompt.name": "New profile name:",
    "prompt.copy": "{name} (copy)",
    "prompt.description": "Description (optional):",
    "confirm.overwrite": "Profile “{name}” already exists. Overwrite?",
    "confirm.delete": "Delete profile “{name}”?",
    "field.default": "default",
    "unit.packets": "packets",
    "unit.bytes": "bytes",

    "sec.delay": "Delay",
    "sec.loss": "Packet loss",
    "sec.rate": "Bandwidth",
    "sec.other": "Other impairments",

    "f.delay_ms": "Delay",
    "f.delay_ms.info": "Fixed time by which every packet is delayed in this direction. RTT (e.g. ping result) is the sum of the delays of both directions.",
    "f.jitter_ms": "Jitter (±)",
    "f.jitter_ms.info": "Random delay variation: each packet gets delay ± jitter. Without “Keep packet order” packets may overtake each other.",
    "f.jitter_correlation_pct": "Jitter correlation",
    "f.jitter_correlation_pct.info": "How much a packet's delay depends on the previous one. 0 % – each drawn independently; higher values – delay changes more smoothly.",
    "f.distribution": "Jitter distribution",
    "f.distribution.info": "How the deviation is drawn. Uniform – evenly across ±jitter. Normal – most packets close to the mean. Pareto – rare but large delay spikes, typical of congested networks.",
    "opt.none": "uniform",
    "opt.normal": "normal",
    "opt.pareto": "Pareto",
    "opt.paretonormal": "Pareto-normal",
    "f.keep_order": "Keep packet order",
    "f.keep_order.info": "Despite jitter, packets do not overtake each other – as on most real links. With a bandwidth limit set the order is always kept. Excludes “Reordering”.",
    "f.loss_mode": "Mode",
    "f.loss_mode.info": "Random – each packet is lost independently. Burst – packets are lost in groups, like during radio fading. At the same loss rate, burst loss is usually harder for applications.",
    "opt.loss.none": "none",
    "opt.loss.random": "random",
    "opt.loss.burst": "burst (Gilbert)",
    "f.loss_pct": "Average loss",
    "f.loss_pct.info": "Average percentage of lost packets in this direction. In random mode 100 % means a complete link outage.",
    "f.loss_correlation_pct": "Correlation",
    "f.loss_correlation_pct.info": "Increases the chance that the packet after a lost one is lost too. For realistic loss bursts use “burst” mode instead.",
    "f.loss_burst_len": "Average burst length",
    "f.loss_burst_len.info": "Average number of consecutive packets lost in one burst. The average loss rate stays as set above – longer bursts mean rarer but longer gaps.",
    "f.rate_kbit": "Bandwidth limit",
    "f.rate_kbit.info": "Maximum link speed in this direction; 0 = unlimited. Excess traffic waits in the queue (delay grows) and is dropped once the queue is full.",
    "f.limit": "Queue length",
    "f.limit.info": "Link buffer – how many packets can wait in the emulator. A small queue with a bandwidth limit drops excess quickly; a large one causes growing delay (bufferbloat). With large delays it must hold all packets “in flight”, otherwise extra loss appears.",
    "f.reorder_pct": "Reordering",
    "f.reorder_pct.info": "Percentage of packets sent immediately, without delay – they overtake packets waiting in the queue. Requires delay > 0 and “Keep packet order” off.",
    "f.reorder_correlation_pct": "Reordering correlation",
    "f.reorder_correlation_pct.info": "Increases the chance that following packets are also sent out of order – reordering happens in groups.",
    "f.duplicate_pct": "Duplication",
    "f.duplicate_pct.info": "Percentage of packets delivered twice. Checks whether the application detects and discards duplicates.",
    "f.corrupt_pct": "Corruption",
    "f.corrupt_pct.info": "Percentage of packets with a random bit flipped. The receiver usually drops them due to a bad checksum (acts like loss), but it tests robustness against damaged data.",
    "f.mtu": "MTU",
    "f.mtu.info": "Maximum IP packet size in this direction; empty = 1500. Larger packets are silently dropped (no ICMP message) – like a misconfigured VPN tunnel. Tests fragmentation and large packets.",

    // Server error messages (translations of the English originals)
    "err.reorderDelay": "Reordering requires a delay greater than 0 ms",
    "err.burst100": "Burst loss must be below 100 % (for a complete outage use random loss of 100 %)",
    "err.keepReorder": "Keeping packet order and reordering cannot be enabled together",
  },

  pl: {
    "app.title": "Emulator WAN",
    "status.stopped": "ZATRZYMANY",
    "status.running": "DZIAŁA ({profile})",
    "status.dirty": " – niezastosowane zmiany",
    "status.manual": "konfiguracja ręczna",
    "status.modified": "{name} (zmodyfikowany)",
    "btn.start": "Start",
    "btn.apply": "Zastosuj zmiany",
    "btn.stop": "Stop",
    "btn.save": "Zapisz",
    "btn.saveTitle": "Nadpisz wczytany profil",
    "btn.saveAs": "Zapisz jako…",
    "btn.delete": "Usuń",
    "btn.reset": "Wyczyść formularz",
    "profiles.title": "Profile",
    "profiles.loaded": "Wczytany profil:",
    "profiles.clickToLoad": "Kliknij, aby wczytać do formularza",
    "profiles.running": "▶ działa",
    "profiles.runningModified": "▶ działa (zmodyfikowany)",
    "sym.label": "Kierunki symetryczne (B → A = A → B)",
    "sym.info": "Kierunek B → A używa tych samych parametrów co A → B. Prawdziwe łącza są często asymetryczne (np. szybsze pobieranie niż wysyłanie) – wtedy wyłącz tę opcję.",
    "dir.a_to_b.info": "Ruch od urządzenia podłączonego do strony A do urządzenia po stronie B. W profilach domyślnych A = klient, więc A → B to wysyłanie (upload).",
    "dir.b_to_a.info": "Ruch od urządzenia po stronie B do urządzenia po stronie A. W profilach domyślnych B = sieć, więc B → A to pobieranie (download).",
    "preview.title": "Polecenia tc dla bieżącego formularza",
    "preview.error": "Błąd parametrów:\n{msg}",
    "live.pps": "pak./s",
    "live.noIface": "brak interfejsu",
    "live.noLink": "brak linku",
    "live.link": "link {speed}",
    "live.drops": "odrzucone: {drops} · w kolejce: {qlen}",
    "live.off": "emulacja wyłączona",
    "toast.started": "Emulacja uruchomiona",
    "toast.stopped": "Emulacja zatrzymana",
    "toast.loaded": "Wczytano profil „{name}” – kliknij „{button}”",
    "toast.saved": "Zapisano profil „{name}”",
    "toast.deleted": "Usunięto profil „{name}”",
    "prompt.name": "Nazwa nowego profilu:",
    "prompt.copy": "{name} (kopia)",
    "prompt.description": "Opis (opcjonalnie):",
    "confirm.overwrite": "Profil „{name}” już istnieje. Nadpisać?",
    "confirm.delete": "Usunąć profil „{name}”?",
    "field.default": "domyślne",
    "unit.packets": "pakiety",
    "unit.bytes": "bajty",

    "sec.delay": "Opóźnienie",
    "sec.loss": "Utrata pakietów",
    "sec.rate": "Przepustowość",
    "sec.other": "Inne zakłócenia",

    "f.delay_ms": "Opóźnienie",
    "f.delay_ms.info": "Stały czas, o jaki każdy pakiet jest opóźniany w tym kierunku. RTT (np. wynik ping) to suma opóźnień obu kierunków.",
    "f.jitter_ms": "Jitter (±)",
    "f.jitter_ms.info": "Losowa zmienność opóźnienia: każdy pakiet dostaje opóźnienie ± jitter. Bez opcji „Zachowaj kolejność pakietów” pakiety mogą się wtedy wyprzedzać.",
    "f.jitter_correlation_pct": "Korelacja jittera",
    "f.jitter_correlation_pct.info": "Na ile opóźnienie pakietu zależy od opóźnienia poprzedniego. 0 % – każde losowane niezależnie; wyższe wartości – opóźnienie zmienia się płynniej.",
    "f.distribution": "Rozkład jittera",
    "f.distribution.info": "Jak losowane jest odchylenie. Jednostajny – równomiernie w całym zakresie ±jitter. Normalny – większość pakietów blisko średniej. Pareto – rzadkie, ale duże skoki opóźnienia, typowe dla sieci przeciążonych.",
    "opt.none": "jednostajny",
    "opt.normal": "normalny",
    "opt.pareto": "Pareto",
    "opt.paretonormal": "Pareto-normalny",
    "f.keep_order": "Zachowaj kolejność pakietów",
    "f.keep_order.info": "Mimo jittera pakiety nie wyprzedzają się – tak zachowuje się większość prawdziwych łączy. Przy ustawionym limicie przepustowości kolejność jest zachowana zawsze. Wyklucza „Zmianę kolejności”.",
    "f.loss_mode": "Tryb",
    "f.loss_mode.info": "Losowe – każdy pakiet ginie niezależnie. Seriami – pakiety giną grupami po kilka z rzędu, jak przy zanikach sygnału radiowego. Przy tym samym odsetku straty seriami są dla aplikacji zwykle trudniejsze.",
    "opt.loss.none": "brak",
    "opt.loss.random": "losowe",
    "opt.loss.burst": "seriami (Gilbert)",
    "f.loss_pct": "Średnie straty",
    "f.loss_pct.info": "Średni odsetek traconych pakietów w tym kierunku. W trybie losowym 100 % oznacza całkowitą przerwę łącza.",
    "f.loss_correlation_pct": "Korelacja",
    "f.loss_correlation_pct.info": "Zwiększa szansę, że po straconym pakiecie zginie też następny. Do realistycznych serii strat lepiej użyć trybu „seriami”.",
    "f.loss_burst_len": "Średnia długość serii",
    "f.loss_burst_len.info": "Ile pakietów średnio ginie z rzędu w jednej serii. Średni odsetek strat pozostaje taki, jak ustawiony wyżej – dłuższe serie to rzadsze, ale dłuższe przerwy.",
    "f.rate_kbit": "Limit przepustowości",
    "f.rate_kbit.info": "Maksymalna szybkość łącza w tym kierunku; 0 = bez limitu. Nadmiar ruchu czeka w kolejce (rośnie opóźnienie), a po jej zapełnieniu pakiety są odrzucane.",
    "f.limit": "Długość kolejki",
    "f.limit.info": "Bufor łącza – ile pakietów może czekać w emulatorze. Mała kolejka przy limicie przepustowości szybko odrzuca nadmiar; duża powoduje rosnące opóźnienie (bufferbloat). Przy dużym opóźnieniu musi pomieścić wszystkie pakiety „w drodze”, inaczej pojawią się dodatkowe straty.",
    "f.reorder_pct": "Zmiana kolejności",
    "f.reorder_pct.info": "Odsetek pakietów wysyłanych od razu, bez opóźnienia – wyprzedzają pakiety czekające w kolejce. Wymaga opóźnienia > 0 i wyłączonego „Zachowaj kolejność”.",
    "f.reorder_correlation_pct": "Korelacja zmiany kolejności",
    "f.reorder_correlation_pct.info": "Zwiększa szansę, że kolejne pakiety też zostaną wysłane poza kolejnością – zmiany kolejności pojawiają się grupami.",
    "f.duplicate_pct": "Duplikacja",
    "f.duplicate_pct.info": "Odsetek pakietów dostarczanych podwójnie. Sprawdza, czy aplikacja poprawnie rozpoznaje i odrzuca duplikaty.",
    "f.corrupt_pct": "Uszkodzenia",
    "f.corrupt_pct.info": "Odsetek pakietów z przekłamanym losowym bitem. Odbiorca zwykle odrzuca je po błędnej sumie kontrolnej (działa to jak strata), ale sprawdza odporność na uszkodzone dane.",
    "f.mtu": "MTU",
    "f.mtu.info": "Maksymalny rozmiar pakietu IP w tym kierunku; puste = 1500. Większe pakiety są po cichu odrzucane (bez komunikatu ICMP) – jak w źle skonfigurowanym tunelu VPN. Pozwala sprawdzić fragmentację i duże pakiety.",

    "err.reorderDelay": "Zmiana kolejności wymaga opóźnienia większego od 0 ms",
    "err.burst100": "Straty seriami muszą być mniejsze niż 100 % (dla całkowitej przerwy użyj strat losowych 100 %)",
    "err.keepReorder": "Nie można jednocześnie zachować kolejności pakietów i włączyć zmiany kolejności",
  },
};

const LANGS = ["en", "pl"];
let LANG = "en";
try {
  const saved = localStorage.getItem("wanemu.lang");
  if (LANGS.includes(saved)) LANG = saved;
} catch { /* localStorage unavailable - keep English */ }
// ?lang=pl / ?lang=en in the URL takes precedence (links, tests)
const urlLang = new URLSearchParams(location.search).get("lang");
if (LANGS.includes(urlLang)) LANG = urlLang;

function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(v);
  return s;
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  LANG = lang;
  try { localStorage.setItem("wanemu.lang", lang); } catch { /* ignore */ }
}

// Static elements: data-i18n (text), data-i18n-tip (tooltip), data-i18n-title (title attribute)
function translateStatic(root = document) {
  document.documentElement.lang = LANG;
  root.querySelectorAll("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-tip]").forEach(el => {
    el.dataset.tip = t(el.dataset.i18nTip);
    el.setAttribute("aria-label", el.dataset.tip);
  });
  root.querySelectorAll("[data-i18n-title]").forEach(el => (el.title = t(el.dataset.i18nTitle)));
}
