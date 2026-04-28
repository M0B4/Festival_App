/**
 * FESTIVAL GUIDE 2026 - ULTIMATE MASTER
 * Features: Sortable Festival Table, Auto-Hide Nav, 
 * Persistent Metrics, Deduplication.
 */

const BASE_PATH = 'festivaldata/';
const MASTER_DATA_PATH = 'bands_master_data.json';

let allFestivalsData = {};
let bandMasterData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// --- PERSISTENTE EINSTELLUNGEN ---
let currentSortMode = 'listeners';
let isSortAsc = false;
let currentMetric = localStorage.getItem('pref_metric') || 'listeners';

// --- NEU: FESTIVAL TAB SORTIERUNG ---
let festSortMode = 'name';
let festSortAsc = true;

const selector = document.getElementById('festival-selector');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const contentArea = document.querySelector('.content-area');
const searchContainer = document.getElementById('search-container');
const searchToggle = document.getElementById('search-toggle-btn');

function formatGenre(str) {
    if (!str || str === '-' || str === 'Unknown') return '-';
    return str.split(' ').map(function(word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "k";
    return num;
}

async function initApp() {
    try {
        if (typeof festivalRegistry !== 'undefined') {
            festivalRegistry.sort(function(a, b) { return a.name.localeCompare(b.name); });
        }
        setupUI();
        setupSwipeHandlers();
        try {
            const masterRes = await fetch(MASTER_DATA_PATH);
            if (masterRes.ok) bandMasterData = await masterRes.json();
        } catch (e) { console.warn("Master-Daten nicht verfügbar."); }

        const loads = festivalRegistry.map(async(fest) => {
            try {
                const res = await fetch(BASE_PATH + fest.file);
                if (res.ok) allFestivalsData[fest.id] = await res.json();
            } catch (e) { console.error("Fehler bei " + fest.file); }
        });

        await Promise.all(loads);
        if (festivalRegistry.length > 0) {
            currentFestival = festivalRegistry[0];
            loadFestival(currentFestival);
        }
    } catch (err) { console.error("Kritischer Fehler:", err); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function() {});
}

function switchTab(targetViewId) {
    const target = document.getElementById(targetViewId);
    if (!target) return;
    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector('[data-target="' + targetViewId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    target.classList.add('active');

    // UI-LOGIK: Nav verstecken in Settings UND Festivals
    const isLineup = targetViewId === 'lineup-view';
    const isSettings = targetViewId === 'settings-view';
    const isFestTab = targetViewId === 'festivals-view';

    document.body.classList.toggle('hide-search', !isLineup);
    document.body.classList.toggle('hide-nav', isSettings || isFestTab);

    if (searchContainer) {
        searchContainer.classList.add('collapsed');
        if (searchToggle) searchToggle.classList.remove('active');
    }

    if (targetViewId === 'stats-view') renderGenreStats();
    if (targetViewId === 'festivals-view') renderFestivalsView();
}

function handleSort(mode) {
    if (currentSortMode === mode) isSortAsc = !isSortAsc;
    else {
        currentSortMode = mode;
        isSortAsc = (mode === 'name' || mode === 'genre');
    }
    renderTable();
}

// NEU: Sortierung für die Festival-Tabelle
function handleFestSort(mode) {
    if (festSortMode === mode) festSortAsc = !festSortAsc;
    else {
        festSortMode = mode;
        festSortAsc = (mode === 'name');
    }
    renderFestivalsView();
}

function setupUI() {
    if (selector) {
        festivalRegistry.forEach(fest => {
            const opt = document.createElement('option');
            opt.value = fest.id;
            opt.textContent = fest.name;
            selector.appendChild(opt);
        });
        selector.onchange = (e) => loadFestival(festivalRegistry.find(f => f.id === e.target.value));
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.target);
    });

    // Lineup Sortierung
    if (document.getElementById('sort-name')) document.getElementById('sort-name').onclick = () => handleSort('name');
    if (document.getElementById('sort-listeners')) document.getElementById('sort-listeners').onclick = () => handleSort('listeners');
    if (document.getElementById('sort-genre')) document.getElementById('sort-genre').onclick = () => handleSort('genre');

    // NEU: Festival Sortierung
    if (document.getElementById('fest-sort-name')) document.getElementById('fest-sort-name').onclick = () => handleFestSort('name');
    if (document.getElementById('fest-sort-bands')) document.getElementById('fest-sort-bands').onclick = () => handleFestSort('bands');
    if (document.getElementById('fest-sort-metric')) document.getElementById('fest-sort-metric').onclick = () => handleFestSort('metric');

    const metricSelector = document.getElementById('metric-selector');
    if (metricSelector) {
        metricSelector.value = currentMetric;
        metricSelector.oninput = function() {
            currentMetric = this.value;
            localStorage.setItem('pref_metric', currentMetric);
            renderTable();
            if (document.getElementById('festivals-view').classList.contains('active')) renderFestivalsView();
        };
    }

    if (searchToggle) {
        searchToggle.onclick = () => {
            const isCollapsed = searchContainer.classList.toggle('collapsed');
            searchToggle.classList.toggle('active', !isCollapsed);
            if (!isCollapsed && searchInput) setTimeout(() => searchInput.focus(), 300);
            else {
                if (searchInput) {
                    searchInput.value = "";
                    renderTable();
                }
            }
        };
    }
    const exclBtn = document.getElementById('exclusive-btn');
    if (exclBtn) exclBtn.onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };
    if (searchInput) searchInput.oninput = renderTable;

    const updateBtn = document.getElementById('update-app-btn');
    if (updateBtn) {
        updateBtn.onclick = async function() {
            this.textContent = "Updating...";
            this.style.background = "#555";

            try {
                // 1. Alle Caches löschen
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(name => caches.delete(name))
                    );
                }

                // 2. Alle Service Worker finden und unregistrieren
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                    }
                }

                // 3. Kurze Pause für das System
                await new Promise(resolve => setTimeout(resolve, 500));

                // 4. Hard Reload mit Cache-Busting-Parameter
                // Das fügt ?v=TIMESTAMP an die URL an, was das Handy zwingt, alles neu zu laden
                const cleanURL = window.location.href.split('?')[0];
                window.location.replace(cleanURL + '?update=' + Date.now());

            } catch (e) {
                // Notfall-Fallback
                window.location.reload(true);
            }
        };
    }
}

function loadFestival(fest) {
    if (!fest) return;
    currentFestival = fest;
    if (selector) selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem('favs_' + fest.id)) || [];
    renderTable();
}

/**
 * ÜBERSICHT RENDERN ALS TABELLE
 */
function renderFestivalsView() {
    const summary = document.getElementById('festivals-summary');
    const fTbody = document.getElementById('festivals-table-body');
    if (!summary || !fTbody) return;

    fTbody.innerHTML = "";
    const uniqueBands = new Set();
    const metricLabel = (currentMetric === 'listeners' ? "Hörer" : "Plays");

    // Header aktualisieren
    const arrow = festSortAsc ? " ▲" : " ▼";
    document.getElementById('fest-sort-name').innerHTML = "Festival" + (festSortMode === 'name' ? arrow : " ↕");
    document.getElementById('fest-sort-bands').innerHTML = "Bands" + (festSortMode === 'bands' ? arrow : " ↕");
    document.getElementById('fest-sort-metric').innerHTML = metricLabel + (festSortMode === 'metric' ? arrow : " ↕");

    // Daten für Sortierung vorbereiten
    let festList = festivalRegistry.map(fest => {
        const bands = allFestivalsData[fest.id] || [];
        let totalMetric = 0;
        bands.forEach(b => {
            uniqueBands.add(b.name.toLowerCase());
            const mData = bandMasterData[b.name.toLowerCase()];
            if (mData) totalMetric += (mData[currentMetric] || 0);
        });
        return { id: fest.id, name: fest.name, bandCount: bands.length, metric: totalMetric, raw: fest };
    });

    // Sortierung anwenden
    festList.sort((a, b) => {
        let res = 0;
        if (festSortMode === 'bands') res = a.bandCount - b.bandCount;
        else if (festSortMode === 'metric') res = a.metric - b.metric;
        else res = a.name.localeCompare(b.name);
        return festSortAsc ? res : -res;
    });

    festList.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${item.name}</td>
            <td style="text-align:right;">${item.bandCount}</td>
            <td class="listener-cell">${formatNumber(item.metric)}</td>
        `;
        tr.onclick = () => {
            loadFestival(item.raw);
            switchTab('lineup-view');
        };
        fTbody.appendChild(tr);
    });

    summary.innerHTML = `
        <span class="summary-sub">Festival Saison 2026</span>
        <span class="summary-big-note">${uniqueBands.size} Eindeutige Bands</span>
    `;
}

function renderTable() {
    if (!tbody) return;
    const term = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";

    const sortBtnName = document.getElementById('sort-name');
    const sortBtnList = document.getElementById('sort-listeners');
    const sortBtnGenre = document.getElementById('sort-genre');

    const arrow = isSortAsc ? " ▲" : " ▼";
    const metricLabel = (currentMetric === 'listeners' ? "Hörer" : "Plays");

    if (sortBtnName) {
        sortBtnName.innerHTML = "Band" + (currentSortMode === 'name' ? arrow : " ↕");
        sortBtnName.classList.toggle('active-sort', currentSortMode === 'name');
    }
    if (sortBtnList) {
        sortBtnList.innerHTML = metricLabel + (currentSortMode === 'listeners' ? arrow : " ↕");
        sortBtnList.classList.toggle('active-sort', currentSortMode === 'listeners');
    }
    if (sortBtnGenre) {
        sortBtnGenre.innerHTML = "Genre" + (currentSortMode === 'genre' ? arrow : " ↕");
        sortBtnGenre.classList.toggle('active-sort', currentSortMode === 'genre');
    }

    let overlaps = 0;
    let filtered = currentBands.filter(band => {
        const match = (band.name + " " + band.origin).toLowerCase().includes(term);
        const fests = [];
        for (const id in allFestivalsData) {
            if (id !== currentFestival.id) {
                if (allFestivalsData[id].some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                    const fInfo = festivalRegistry.find(f => f.id === id);
                    if (fInfo) fests.push(fInfo.name);
                }
            }
        }
        if (fests.length > 0) overlaps++;
        if (showExclusiveOnly && fests.length > 0) return false;
        band.currentMatches = fests;
        return match;
    });

    filtered.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        const mDataA = bandMasterData[nameA];
        const mDataB = bandMasterData[nameB];
        let result = 0;
        if (currentSortMode === 'listeners') {
            const valA = mDataA ? mDataA[currentMetric] : 0;
            const valB = mDataB ? mDataB[currentMetric] : 0;
            result = valA - valB;
        } else if (currentSortMode === 'genre') {
            const gA = formatGenre((mDataA && mDataA.genres && mDataA.genres[0]) ? mDataA.genres[0] : (a.genres && a.genres[0] ? a.genres[0] : '-'));
            const gB = formatGenre((mDataB && mDataB.genres && mDataB.genres[0]) ? mDataB.genres[0] : (b.genres && b.genres[0] ? b.genres[0] : '-'));
            if (gA === '-' && gB !== '-') return 1;
            if (gA !== '-' && gB === '-') return -1;
            result = gA.localeCompare(gB);
        } else result = a.name.localeCompare(b.name);
        if (result === 0) return a.name.localeCompare(b.name);
        return isSortAsc ? result : -result;
    });

    if (stats) stats.innerHTML = "<b>" + filtered.length + "</b> Bands | <span style='color:var(--acc)'>" + overlaps + "</span> Overlaps";

    filtered.forEach(band => {
        const isFav = favorites.includes(band.name);
        const tr = document.createElement('tr');
        if (isFav) tr.classList.add('is-fav');
        const originClean = (band.origin || "").toLowerCase().trim();
        const iso = countryCodes[originClean] || null;
        let flagHtml = "🏳️ ";
        if (iso === "world") flagHtml = "<span style='font-size: 1.1rem; margin-right: 8px;'>🌎</span>";
        else if (iso) flagHtml = "<img src='https://flagcdn.com/w40/" + iso + ".png' width='18' style='margin-right:8px; border-radius:2px;'>";
        const mData = bandMasterData[band.name.toLowerCase()];
        const countValue = mData ? mData[currentMetric] : 0;
        let lDisplay = "-";
        if (countValue >= 1000000) lDisplay = (countValue / 1000000).toFixed(1) + "M";
        else if (countValue >= 1000) lDisplay = (countValue / 1000).toFixed(0) + "k";
        else if (countValue > 0) lDisplay = countValue;
        const genre = formatGenre((mData && mData.genres && mData.genres[0]) ? mData.genres[0] : (band.genres && band.genres[0] ? band.genres[0] : '-'));
        tr.innerHTML = "<td><span style='color:" + (isFav ? 'var(--acc)' : '#333') + "'>" + (isFav ? '★' : '☆') + "</span></td><td><div class='band-info-wrapper'><div class='band-main-line'>" + flagHtml + " <span>" + band.name + "</span></div><div class='badge-container'>" + band.currentMatches.map(m => "<span class='fest-badge'>" + m + "</span>").join('') + "</div></div></td><td class='listener-cell'>" + lDisplay + "</td><td class='genre-cell'>" + genre + "</td>";
        tr.onclick = () => {
            if (favorites.includes(band.name)) favorites = favorites.filter(n => n !== band.name);
            else favorites.push(band.name);
            localStorage.setItem('favs_' + currentFestival.id, JSON.stringify(favorites));
            renderTable();
        };
        tbody.appendChild(tr);
    });
}

function setupSwipeHandlers() {
    if (!contentArea) return;
    let touchStartX = 0;
    const views = ['lineup-view', 'festivals-view', 'stats-view', 'settings-view'];
    contentArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    contentArea.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const threshold = 80;
        const activeView = document.querySelector('.view-container.active');
        if (!activeView) return;
        const currentIndex = views.indexOf(activeView.id);
        if (touchEndX < touchStartX - threshold && currentIndex < views.length - 1) switchTab(views[currentIndex + 1]);
        if (touchEndX > touchStartX + threshold && currentIndex > 0) switchTab(views[currentIndex - 1]);
    }, { passive: true });
}

function renderGenreStats() {
    if (!genreContent) return;
    genreContent.innerHTML = "<h2 style='color:var(--acc); text-align:center; font-size: 1rem; margin: 20px 0;'>Top 10 Genres</h2>";
    const counts = {};
    currentBands.forEach(b => {
        const mData = bandMasterData[b.name.toLowerCase()];
        let g = formatGenre((mData && mData.genres && mData.genres[0]) ? mData.genres[0] : (b.genres && b.genres[0] ? b.genres[0] : "Unknown"));
        const low = g.toLowerCase();
        if (low.includes("thrash")) g = "Thrash Metal";
        else if (low.includes("death")) g = "Death Metal";
        else if (low.includes("black")) g = "Black Metal";
        else if (low.includes("power")) g = "Power Metal";
        else if (low.includes("heavy")) g = "Heavy Metal";
        counts[g] = (counts[g] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted[0] ? sorted[0][1] : 0;
    sorted.forEach(([n, c]) => {
        const p = (c / max) * 100;
        genreContent.innerHTML += "<div class='genre-row'><div class='genre-info'><span>" + n + "</span><span>" + c + "</span></div><div class='genre-bar-bg'><div class='genre-bar-fill' style='width:" + p + "%'></div></div></div>";
    });
}

initApp();