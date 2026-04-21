const BASE_PATH = 'festivaldata/';

let allFestivalsData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// UI Elemente Referenzen
const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const lineupScrollBox = document.querySelector('#lineup-view .scroll-box');

/**
 * 1. INITIALISIERUNG
 */
async function initApp() {
    // Check ob globale Variablen aus anderen Files geladen wurden
    if (typeof festivalRegistry === 'undefined' || typeof countryCodes === 'undefined') {
        stats.innerHTML = "<span style='color:red'>Fehler: festivals.js oder countries.js nicht geladen!</span>";
        return;
    }

    // Festivals alphabetisch sortieren
    festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));

    setupUI();
    stats.textContent = "Lade Lineups...";

    try {
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);

            if (!res.ok) {
                throw new Error(`Datei nicht gefunden: ${fest.file} (Status: ${res.status})`);
            }

            let data = await res.json();

            // Bands innerhalb des Festivals alphabetisch sortieren
            data.sort((a, b) => a.name.localeCompare(b.name));
            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);

        // Erstes Festival laden
        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);

    } catch (err) {
        console.error("Datenbank-Fehler:", err);
        stats.innerHTML = `<span style='color:red'>Fehler beim Laden: ${err.message}</span>`;
    }

    // Service Worker Registrierung für PWA (Offline-Modus)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
        });
    }
}

/**
 * 2. UI SETUP (Tabs, Selector, Suche)
 */
function setupUI() {
    // Festival-Auswahl füllen
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

    // Tab-Steuerung (Bands vs. Genre)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            // Aktiven Tab-Button markieren
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            // Ansicht umschalten
            document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
            const targetView = document.getElementById(btn.dataset.target);
            targetView.classList.add('active');

            // Suche ausblenden wenn Genre-Tab aktiv ist
            const isStats = btn.dataset.target === 'stats-view';
            document.body.classList.toggle('hide-search', isStats);

            if (isStats) {
                renderGenreStats();
            } else {
                renderTable();
            }
        };
    });

    // Exklusiv-Filter Toggle
    document.getElementById('exclusive-btn').onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };

    // Echtzeit-Suche
    searchInput.oninput = renderTable;
}

/**
 * 3. FESTIVAL WECHSELN
 */
function loadFestival(fest) {
    currentFestival = fest;
    selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

    // Nach oben scrollen
    if (lineupScrollBox) lineupScrollBox.scrollTop = 0;

    renderTable();

    // Falls wir gerade im Genre-Tab sind, Statistik sofort updaten
    if (document.getElementById('stats-view').classList.contains('active')) {
        renderGenreStats();
    }
}

/**
 * 4. LINEUP RENDERN (Tabelle)
 */
function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";
    let overlapsCount = 0;

    const filtered = currentBands.filter(band => {
        const matchesSearch = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);

        // Overlaps mit anderen Festivals prüfen
        const matches = [];
        for (const [festId, bands] of Object.entries(allFestivalsData)) {
            if (festId !== currentFestival.id) {
                if (bands.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                    const festInfo = festivalRegistry.find(f => f.id === festId);
                    matches.push(festInfo.name);
                }
            }
        }

        const hasOverlap = matches.length > 0;
        if (hasOverlap) overlapsCount++;

        // Filter: Nur Exklusive anzeigen (keine Overlaps)
        if (showExclusiveOnly && hasOverlap) return false;

        band.currentMatches = matches.sort((a, b) => a.localeCompare(b));
        return matchesSearch;
    });

    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--accent-color)">${overlapsCount}</span> Überschneidungen`;

    filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');

                const iso = countryCodes[band.origin.toLowerCase()] || null;
                const flagHtml = iso ?
                    `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20">` :
                    `<span class="flag-icon">🏳️</span>`;

                let badgesHtml = "";
                if (band.currentMatches.length > 0) {
                    badgesHtml = `<div class="badge-container">
                ${band.currentMatches.map(m => `<span class="fest-badge">${m}</span>`).join('')}
            </div>`;
        }

        tr.innerHTML = `
            <td class="col-fav"><span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span></td>
            <td>
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flagHtml} <span>${band.name}</span></div>
                    ${badgesHtml}
                </div>
            </td>
            <td class="genre-cell">${band.genres[0] || '-'}</td>
        `;

        tr.onclick = () => toggleFavorite(band.name);
        tbody.appendChild(tr);
    });
}

/**
 * 5. GENRE STATISTIK RENDERN
 */
function renderGenreStats() {
    genreContent.innerHTML = `<h2 style="color:var(--accent-color); text-align:center; margin-top:0;">Top 10 Genres</h2>`;
    
    const counts = {};
    currentBands.forEach(band => {
        let g = band.genres[0] || "Unbekannt";
        const low = g.toLowerCase();
        
        // Normalisierung (Thrash, Death, Black etc.)
        if (low.includes("thrash")) g = "Thrash Metal";
        else if (low.includes("death") && !low.includes("core")) g = "Death Metal";
        else if (low.includes("black")) g = "Black Metal";
        else if (low.includes("power")) g = "Power Metal";
        else if (low.includes("heavy") || low === "metal") g = "Heavy Metal";
        else if (low.includes("core")) g = "Core (Metal/Death)";
        else if (low.includes("prog")) g = "Progressive";
        else if (low.includes("folk") || low.includes("pagan")) g = "Folk / Pagan";
        
        counts[g] = (counts[g] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted.length > 0 ? sorted[0][1] : 0;

    sorted.forEach(([name, count]) => {
        const perc = (count / max) * 100;
        const row = document.createElement('div');
        row.className = 'genre-row';
        row.innerHTML = `
            <div class="genre-info"><span>${name}</span><span>${count} Bands</span></div>
            <div class="genre-bar-bg"><div class="genre-bar-fill" style="width: ${perc}%"></div></div>
        `;
        genreContent.appendChild(row);
    });
}

/**
 * 6. FAVORITEN LOGIK
 */
function toggleFavorite(name) {
    if (favorites.includes(name)) {
        favorites = favorites.filter(n => n !== name);
    } else {
        favorites.push(name);
    }
    localStorage.setItem(`favs_${currentFestival.id}`, JSON.stringify(favorites));
    renderTable();
}

// APP START
initApp();