/**
 * FESTIVAL GUIDE 2026 - Core Logic
 */

const BASE_PATH = 'festivaldata/';

// Globale Zustände
let allFestivalsData = {}; // Speicher für alle geladenen JSON-Daten
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// UI-Elemente Referenzen
const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');

/**
 * 1. INITIALISIERUNG
 */
async function initApp() {
    // 1.1 Festivals alphabetisch sortieren
    if (typeof festivalRegistry !== 'undefined') {
        festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        console.error("festivalRegistry fehlt!");
        return;
    }

    setupUI();
    stats.textContent = "Lade Lineups...";

    try {
        // 1.2 Alle Festival-Daten parallel laden
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            if (!res.ok) throw new Error(`Fetch failed for ${fest.file}`);

            let data = await res.json();
            // Bands direkt beim Laden alphabetisch sortieren
            data.sort((a, b) => a.name.localeCompare(b.name));

            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);

        // 1.3 Das erste Festival der Liste als Standard setzen
        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);

    } catch (err) {
        console.error("Datenbank-Fehler:", err);
        stats.innerHTML = `<span style="color:red">Datenfehler: ${err.message}</span>`;
    }

    // 1.4 PWA Service Worker registrieren (für Offline-Modus)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
    }
}

/**
 * 2. UI-LOGIK (Menüs, Tabs, Filter)
 */
function setupUI() {
    // Festival-Auswahlmenü füllen
    festivalRegistry.forEach(fest => {
        const opt = document.createElement('option');
        opt.value = fest.id;
        opt.textContent = fest.name;
        selector.appendChild(opt);
    });

    selector.onchange = (e) => {
        const selected = festivalRegistry.find(f => f.id === e.target.value);
        loadFestival(selected);
    };

    // Bottom-Navigation Tab-Wechsel
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            // Aktiven Button und View umschalten
            document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            const targetViewId = btn.dataset.target;
            document.getElementById(targetViewId).classList.add('active');

            // Suche ausblenden, wenn wir in der Statistik sind
            const isStatsView = targetViewId === 'stats-view';
            document.body.classList.toggle('hide-search', isStatsView);

            if (isStatsView) {
                renderGenreStats();
            } else {
                renderTable();
            }
        };
    });

    // Exklusiv-Bands Filter Toggle
    document.getElementById('exclusive-btn').onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };

    // Suche bei Eingabe
    searchInput.oninput = renderTable;
}

/**
 * 3. FESTIVAL-DATEN LADEN
 */
function loadFestival(fest) {
    currentFestival = fest;
    selector.value = fest.id;

    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

    // Scroll-Position in der aktiven Ansicht zurücksetzen
    const activeScrollBox = document.querySelector('.view-container.active .scroll-box');
    if (activeScrollBox) activeScrollBox.scrollTop = 0;

    renderTable();

    // Genre-Statistik nur rendern, wenn der Tab gerade offen ist
    if (document.body.classList.contains('hide-search')) {
        renderGenreStats();
    }
}

/**
 * 4. LINEUP-TABELLE RENDERN
 */
function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";
    let overlapsCount = 0;

    // Filter-Logik (Suche + Overlap-Check)
    const filtered = currentBands.filter(band => {
        const matchesSearch = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);

        // Prüfen, ob die Band auf anderen Festivals spielt
        const otherFestivals = [];
        for (const [festId, bands] of Object.entries(allFestivalsData)) {
            if (festId !== currentFestival.id) {
                if (bands.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                    const festInfo = festivalRegistry.find(f => f.id === festId);
                    otherFestivals.push(festInfo.name);
                }
            }
        }

        const hasOverlap = otherFestivals.length > 0;
        if (hasOverlap) overlapsCount++;

        // Exklusiv-Filter: Falls aktiv, nur Bands ohne Overlap behalten
        if (showExclusiveOnly && hasOverlap) return false;

        band.currentMatches = otherFestivals.sort((a, b) => a.localeCompare(b));
        return matchesSearch;
    });

    // Statistik-Zeile aktualisieren
    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--acc)">${overlapsCount}</span> Überschneidungen`;

    // Zeilen erstellen
    filtered.forEach(band => {
        const isFav = favorites.includes(band.name);
        const tr = document.createElement('tr');
        if (isFav) tr.classList.add('is-fav');

        // Flagge ermitteln
        const iso = countryCodes[band.origin.toLowerCase()] || null;
        const flagHtml = iso ?
            `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20" alt="${band.origin}">` :
            `<span class="flag-icon">🏳️</span>`;

        // Badges für andere Festivals
        const badgesHtml = band.currentMatches.map(m => `<span class="fest-badge">${m}</span>`).join('');

        tr.innerHTML = `
            <td>
                <span class="fav-star" style="color:${isFav ? 'var(--acc)' : '#333'}">
                    ${isFav ? '★' : '☆'}
                </span>
            </td>
            <td>
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flagHtml} <span>${band.name}</span></div>
                    <div class="badge-container">${badgesHtml}</div>
                </div>
            </td>
            <td class="genre-cell">${band.genres[0] || '-'}</td>
        `;

        // Klick auf Zeile toggelt Favorit
        tr.onclick = () => {
            if (favorites.includes(band.name)) {
                favorites = favorites.filter(n => n !== band.name);
            } else {
                favorites.push(band.name);
            }
            localStorage.setItem(`favs_${currentFestival.id}`, JSON.stringify(favorites));
            renderTable();
        };

        tbody.appendChild(tr);
    });
}

/**
 * 5. GENRE-STATISTIK RENDERN
 */
function renderGenreStats() {
    genreContent.innerHTML = `
        <h2 style="color:var(--acc); text-align:center; font-size: 1rem; margin: 20px 0;">
            TOP 10 GENRES (${currentFestival.name})
        </h2>
    `;

    const genreCounts = {};

    currentBands.forEach(band => {
        let genreName = band.genres[0] || "Unbekannt";
        const low = genreName.toLowerCase();

        // Normalisierung der Genre-Namen
        if (low.includes("thrash")) genreName = "Thrash Metal";
        else if (low.includes("death") && !low.includes("core")) genreName = "Death Metal";
        else if (low.includes("black")) genreName = "Black Metal";
        else if (low.includes("power")) genreName = "Power Metal";
        else if (low.includes("heavy") || low === "metal") genreName = "Heavy Metal";
        else if (low.includes("core")) genreName = "Core (Metal/Death)";
        else if (low.includes("prog")) genreName = "Progressive";
        else if (low.includes("folk") || low.includes("pagan")) genreName = "Folk / Pagan";

        genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
    });

    // Nach Häufigkeit sortieren und Top 10 nehmen
    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const maxCount = sortedGenres[0] ? sortedGenres[0][1] : 0;

    sortedGenres.forEach(([name, count]) => {
        const percentage = (count / maxCount) * 100;
        const row = document.createElement('div');
        row.className = 'genre-row';
        row.innerHTML = `
            <div class="genre-info">
                <span>${name}</span>
                <span>${count} Bands</span>
            </div>
            <div class="genre-bar-bg">
                <div class="genre-bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        genreContent.appendChild(row);
    });
}

// APP STARTEN
initApp();