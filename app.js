/**
 * FESTIVAL GUIDE 2026 - FINAL APP LOGIC
 */

const BASE_PATH = 'festivaldata/';

// --- GLOBALE ZUSTÄNDE ---
let allFestivalsData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// --- UI REFERENZEN ---
const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const contentArea = document.querySelector('.content-area');

/**
 * 1. INITIALISIERUNG
 */
async function initApp() {
    // Festivals alphabetisch sortieren
    festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));

    setupUI();
    setupSwipeHandlers(); // Swipe-Gesten aktivieren

    stats.textContent = "Lade Lineups...";

    try {
        // Alle Festival-Daten parallel laden
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            if (!res.ok) throw new Error(`Fehler bei ${fest.file}`);

            let data = await res.json();
            // Bands direkt beim Laden sortieren
            data.sort((a, b) => a.name.localeCompare(b.name));

            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);

        // Erstes Festival der Liste als Standard
        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);

    } catch (err) {
        console.error("Datenbank-Fehler:", err);
        stats.innerHTML = `<span style="color:red">Datenfehler: ${err.message}</span>`;
    }

    // PWA Service Worker (Offline-Modus)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
    }
}

/**
 * 2. ZENTRALE TAB-STEUERUNG (Klicken & Wischen)
 */
function switchTab(targetViewId) {
    // Buttons und Container umschalten
    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));

    const activeBtn = document.querySelector(`[data-target="${targetViewId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const targetView = document.getElementById(targetViewId);
    if (targetView) targetView.classList.add('active');

    // Suche ausblenden, wenn wir in der Statistik sind
    const isStatsView = targetViewId === 'stats-view';
    document.body.classList.toggle('hide-search', isStatsView);

    if (isStatsView) {
        renderGenreStats();
    } else {
        renderTable();
    }
}

/**
 * 3. SWIPE-GESTEN LOGIK
 */
function setupSwipeHandlers() {
    let touchStartX = 0;
    let touchEndX = 0;

    contentArea.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    contentArea.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const threshold = 80; // Mindestdistanz für Swipe
        // Nach links wischen -> Genre
        if (touchEndX < touchStartX - threshold) switchTab('stats-view');
        // Nach rechts wischen -> Lineup
        if (touchEndX > touchStartX + threshold) switchTab('lineup-view');
    }
}

/**
 * 4. UI SETUP
 */
function setupUI() {
    // Selector füllen
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

    // Klick-Events für Bottom-Nav
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.target);
    });

    // Exklusiv-Filter
    document.getElementById('exclusive-btn').onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };

    searchInput.oninput = renderTable;
}

/**
 * 5. DATEN LADEN & RENDERN
 */
function loadFestival(fest) {
    currentFestival = fest;
    selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

    // Scroll-Position zurücksetzen
    const activeScrollBox = document.querySelector('.view-container.active .scroll-box');
    if (activeScrollBox) activeScrollBox.scrollTop = 0;

    renderTable();
    if (document.body.classList.contains('hide-search')) renderGenreStats();
}

function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";
    let overlapsCount = 0;

    const filtered = currentBands.filter(band => {
        const matchesSearch = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);

        const otherFests = [];
        for (const [id, bands] of Object.entries(allFestivalsData)) {
            if (id !== currentFestival.id && bands.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                otherFests.push(festivalRegistry.find(f => f.id === id).name);
            }
        }

        if (otherFests.length > 0) overlapsCount++;
        if (showExclusiveOnly && otherFests.length > 0) return false;

        band.currentMatches = otherFests.sort((a, b) => a.localeCompare(b));
        return matchesSearch;
    });

    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--acc)">${overlapsCount}</span> Overlaps`;

    filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');

                const iso = countryCodes[band.origin.toLowerCase()] || null;
                const flag = iso ? `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20">` : "🏳️ ";

                tr.innerHTML = `
            <td><span style="color:${isFav ? 'var(--acc)' : '#333'}">${isFav ? '★' : '☆'}</span></td>
            <td>
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flag} <span>${band.name}</span></div>
                    <div class="badge-container">${band.currentMatches.map(m => `<span class="fest-badge">${m}</span>`).join('')}</div>
                </div>
            </td>
            <td class="genre-cell">${band.genres[0] || '-'}</td>
        `;
        
        tr.onclick = () => {
            favorites = favorites.includes(band.name) ? favorites.filter(n => n !== band.name) : [...favorites, band.name];
            localStorage.setItem(`favs_${currentFestival.id}`, JSON.stringify(favorites));
            renderTable();
        };
        tbody.appendChild(tr);
    });
}

function renderGenreStats() {
    genreContent.innerHTML = `<h2 style="color:var(--acc); text-align:center; font-size: 1rem; margin: 20px 0;">TOP 10 GENRES</h2>`;
    const counts = {};
    currentBands.forEach(b => {
        let g = b.genres[0] || "Unknown";
        const low = g.toLowerCase();
        if (low.includes("thrash")) g = "Thrash Metal";
        else if (low.includes("death")) g = "Death Metal";
        else if (low.includes("black")) g = "Black Metal";
        else if (low.includes("power")) g = "Power Metal";
        else if (low.includes("heavy")) g = "Heavy Metal";
        else if (low.includes("core")) g = "Core (Metal/Death)";
        counts[g] = (counts[g] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
    const max = sorted[0] ? sorted[0][1] : 0;
    sorted.forEach(([n, c]) => {
        const p = (c/max)*100;
        genreContent.innerHTML += `<div class="genre-row"><div class="genre-info"><span>${n}</span><span>${c}</span></div><div class="genre-bar-bg"><div class="genre-bar-fill" style="width:${p}%"></div></div></div>`;
    });
}

initApp();