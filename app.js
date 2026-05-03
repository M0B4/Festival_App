/**
 * FESTIVAL GUIDE 2026 - ULTIMATE MASTER EDITION
 * Features: Auto-Color Hashing, Multi-Metric Support, 
 * Country Flags, Sortable Festival Table, Cache-Breaker.
 */

const BASE_PATH = 'festivaldata/';
const MASTER_DATA_PATH = 'bands_master_data.json';

// Globale Daten-Container
let allFestivalsData = {};
let bandMasterData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// Persistente Einstellungen (lokal gespeichert)
let currentSortMode = 'listeners';
let isSortAsc = false;
let currentMetric = localStorage.getItem('pref_metric') || 'listeners';
let festSortMode = 'name';
let festSortAsc = true;

// UI-Elemente
const selector = document.getElementById('festival-selector');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const contentArea = document.querySelector('.content-area');
const searchContainer = document.getElementById('search-container');
const searchToggle = document.getElementById('search-toggle-btn');

/**
 * Hilfsfunktion: Generiert automatisch eine konsistente Farbe für Festival-Badges
 */
/**
 * Generiert Farben mit maximaler Distanz durch den Goldenen Schnitt.
 * Verhindert, dass sich Farben bei ähnlichen Namen zu stark ähneln.
 */
function getAutoColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const goldenRatioConjugate = 0.618033988749895;
    let h = (Math.abs(hash) * goldenRatioConjugate) % 1;
    h = h * 360;

    // Dynamische Quantisierung
    // Wir nehmen die Anzahl der Festivals (mindestens 12 als Puffer)
    const festivalCount = (typeof festivalRegistry !== 'undefined') ? festivalRegistry.length : 12;
    const step = Math.floor(360 / Math.max(festivalCount, 12));

    h = Math.floor(h / step) * step;

    return `hsl(${h}, 75%, 60%)`;
}

function formatGenre(str) {
    if (!str || str === '-' || str === 'Unknown') return '-';
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function formatNumber(num, metric) {
    if (metric === 'spotify_popularity') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "k";
    return num;
}

/**
 * Initialisierung der App
 */
async function initApp() {
    try {
        if (typeof festivalRegistry !== 'undefined') {
            festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
        }
        setupUI();
        setupSwipeHandlers();

        // Master-Daten laden mit Cache-Busting
        const masterRes = await fetch(MASTER_DATA_PATH + '?v=' + Date.now());
        if (masterRes.ok) bandMasterData = await masterRes.json();

        // Alle Festival-JSONs parallel laden
        const loads = festivalRegistry.map(async(fest) => {
            try {
                const res = await fetch(BASE_PATH + fest.file + '?v=' + Date.now());
                if (res.ok) allFestivalsData[fest.id] = await res.json();
            } catch (e) { console.error("Fehler bei " + fest.file); }
        });

        await Promise.all(loads);
        if (festivalRegistry.length > 0) {
            currentFestival = festivalRegistry[0];
            loadFestival(currentFestival);
        }
    } catch (err) { console.error("Start-Fehler:", err); }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

/**
 * Tab-Wechsel Logik mit UI-Anpassung
 */
function switchTab(targetViewId) {
    const target = document.getElementById(targetViewId);
    if (!target) return;

    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector('[data-target="' + targetViewId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    target.classList.add('active');

    const isLineup = (targetViewId === 'lineup-view');
    const isSettings = (targetViewId === 'settings-view');
    const isFestTab = (targetViewId === 'festivals-view');

    // UI-Elemente je nach Tab verstecken oder zeigen
    document.body.classList.toggle('hide-search', !isLineup);
    document.body.classList.toggle('hide-nav', isSettings || isFestTab);

    if (searchContainer) {
        searchContainer.classList.add('collapsed');
        if (searchToggle) searchToggle.classList.remove('active');
    }

    if (targetViewId === 'stats-view') renderGenreStats();
    if (targetViewId === 'festivals-view') renderFestivalsView();
}

/**
 * Event-Listener Setup
 */
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

    // Sortier-Header Klicks
    document.getElementById('sort-name').onclick = () => handleSort('name');
    document.getElementById('sort-listeners').onclick = () => handleSort('listeners');
    document.getElementById('sort-genre').onclick = () => handleSort('genre');

    document.getElementById('fest-sort-name').onclick = () => handleFestSort('name');
    document.getElementById('fest-sort-bands').onclick = () => handleFestSort('bands');
    document.getElementById('fest-sort-metric').onclick = () => handleFestSort('metric');

    // Metrik-Selektor (Settings)
    const metricSelector = document.getElementById('metric-selector');
    if (metricSelector) {
        metricSelector.value = currentMetric;
        metricSelector.oninput = function() {
            currentMetric = this.value;
            localStorage.setItem('pref_metric', currentMetric);
            renderTable();
        };
    }

    // HEAVY DUTY UPDATE BUTTON
    const updateBtn = document.getElementById('update-app-btn');
    if (updateBtn) {
        updateBtn.onclick = async function() {
            this.textContent = "Updating...";
            try {
                if ('caches' in window) {
                    const names = await caches.keys();
                    await Promise.all(names.map(n => caches.delete(n)));
                }
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let r of registrations) await r.unregister();
                }
                window.location.replace(window.location.href.split('?')[0] + '?u=' + Date.now());
            } catch (e) { window.location.reload(true); }
        };
    }

    // Suche & Filter
    if (searchToggle) {
        searchToggle.onclick = () => {
            const isCollapsed = searchContainer.classList.toggle('collapsed');
            searchToggle.classList.toggle('active', !isCollapsed);
            if (!isCollapsed && searchInput) setTimeout(() => searchInput.focus(), 300);
        };
    }
    const exclBtn = document.getElementById('exclusive-btn');
    if (exclBtn) exclBtn.onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };
    if (searchInput) searchInput.oninput = renderTable;
}

/**
 * Ein spezifisches Festival laden
 */
function loadFestival(fest) {
    if (!fest) return;
    currentFestival = fest;
    if (selector) selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem('favs_' + fest.id)) || [];
    renderTable();
}

/**
 * RENDERING: Das Band-Lineup
 */
function renderTable() {
    if (!tbody) return;
    const term = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";

    // Header-Update
    const arrow = isSortAsc ? " ▲" : " ▼";
    let metricLabel = "Hörer";
    if (currentMetric === 'playcount') metricLabel = "Plays";
    if (currentMetric === 'spotify_listeners') metricLabel = "S-Hörer";
    if (currentMetric === 'spotify_popularity') metricLabel = "Rating";

    document.getElementById('sort-name').innerHTML = "Band" + (currentSortMode === 'name' ? arrow : " ↕");
    document.getElementById('sort-listeners').innerHTML = metricLabel + (currentSortMode === 'listeners' ? arrow : " ↕");
    document.getElementById('sort-genre').innerHTML = "Genre" + (currentSortMode === 'genre' ? arrow : " ↕");

    let overlaps = 0;
    let filtered = currentBands.filter(band => {
        const match = (band.name + " " + band.origin).toLowerCase().includes(term);
        const matches = [];
        for (const id in allFestivalsData) {
            if (id !== currentFestival.id && allFestivalsData[id].some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                const fInfo = festivalRegistry.find(f => f.id === id);
                if (fInfo) matches.push(fInfo);
            }
        }
        if (matches.length > 0) overlaps++;
        if (showExclusiveOnly && matches.length > 0) return false;
        band.currentMatches = matches;
        return match;
    });

    // Sortierung
    filtered.sort((a, b) => {
        const mDataA = bandMasterData[a.name.toLowerCase()] || {};
        const mDataB = bandMasterData[b.name.toLowerCase()] || {};
        let result = 0;
        if (currentSortMode === 'listeners') {
            result = (mDataA[currentMetric] || 0) - (mDataB[currentMetric] || 0);
        } else if (currentSortMode === 'genre') {
            const gA = formatGenre(mDataA.genres ? mDataA.genres[0] : (a.genres ? a.genres[0] : '-'));
            const gB = formatGenre(mDataB.genres ? mDataB.genres[0] : (b.genres ? b.genres[0] : '-'));
            result = gA.localeCompare(gB);
        } else result = a.name.localeCompare(b.name);
        return isSortAsc ? result : -result;
    });

    if (stats) stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--acc)">${overlaps}</span> Overlaps`;

    filtered.forEach(band => {
        const isFav = favorites.includes(band.name);
        const mData = bandMasterData[band.name.toLowerCase()] || {};

        // Flaggen Logik
        const iso = countryCodes[(band.origin || "").toLowerCase().trim()] || null;
        let flagHtml = "🏳️ ";
        if (iso === "world") flagHtml = "🌎 ";
        else if (iso) flagHtml = `<img src="https://flagcdn.com/w40/${iso}.png" width="18" style="margin-right:8px; border-radius:2px;">`;

        // Bunte Badges Logik
        const badgesHtml = band.currentMatches.map(f => {
            const color = getAutoColor(f.name);
            return `<span class="fest-badge" style="border-color:${color}; color:${color}; background:${color}1a;">${f.name}</span>`;
        }).join('');

        const tr = document.createElement('tr');
        if (isFav) tr.classList.add('is-fav');
        tr.innerHTML = `
            <td><span style="color:${isFav ? 'var(--acc)' : '#333'}">${isFav ? '★' : '☆'}</span></td>
            <td>
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flagHtml}<span>${band.name}</span></div>
                    <div class="badge-container">${badgesHtml}</div>
                </div>
            </td>
            <td class="listener-cell">${formatNumber(mData[currentMetric] || 0, currentMetric)}</td>
            <td class="genre-cell">${formatGenre(mData.genres ? mData.genres[0] : (band.genres ? band.genres[0] : '-'))}</td>
        `;
        tr.onclick = () => {
            if (favorites.includes(band.name)) favorites = favorites.filter(n => n !== band.name);
            else favorites.push(band.name);
            localStorage.setItem('favs_' + currentFestival.id, JSON.stringify(favorites));
            renderTable();
        };
        tbody.appendChild(tr);
    });
}

/**
 * RENDERING: Die Festival-Übersicht (Tabelle)
 */
function renderFestivalsView() {
    const summary = document.getElementById('festivals-summary');
    const fTbody = document.getElementById('festivals-table-body');
    if (!summary || !fTbody) return;
    fTbody.innerHTML = "";
    const uniqueBands = new Set();
    const arrow = festSortAsc ? " ▲" : " ▼";

    document.getElementById('fest-sort-name').innerHTML = "Festival" + (festSortMode === 'name' ? arrow : " ↕");
    document.getElementById('fest-sort-bands').innerHTML = "Bands" + (festSortMode === 'bands' ? arrow : " ↕");
    document.getElementById('fest-sort-metric').innerHTML = "Power" + (festSortMode === 'metric' ? arrow : " ↕");

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

    festList.sort((a, b) => {
        let res = (festSortMode === 'bands') ? a.bandCount - b.bandCount :
            (festSortMode === 'metric') ? a.metric - b.metric : a.name.localeCompare(b.name);
        return festSortAsc ? res : -res;
    });

    festList.forEach(item => {
        const autoColor = getAutoColor(item.name);
        const iso = countryCodes[(item.raw.country || "").toLowerCase()] || null;
        let flagHtml = iso ? `<img src="https://flagcdn.com/w40/${iso}.png" width="18" style="margin-right:8px; border-radius:2px; vertical-align:middle;">` : "🏳️ ";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">
                <div style="display:flex; align-items:center;">
                    <div style="width:4px; height:18px; background:${autoColor}; margin-right:10px; border-radius:2px;"></div>
                    ${flagHtml} <span>${item.name}</span>
                </div>
            </td>
            <td style="text-align:right;">${item.bandCount}</td>
            <td class="listener-cell">${formatNumber(item.metric, currentMetric)}</td>
        `;
        tr.onclick = () => {
            loadFestival(item.raw);
            switchTab('lineup-view');
        };
        fTbody.appendChild(tr);
    });

    summary.innerHTML = `<span class="summary-sub">Festival Saison 2026</span><span class="summary-big-note">${uniqueBands.size} Eindeutige Bands</span>`;
}

function handleSort(mode) {
    if (currentSortMode === mode) isSortAsc = !isSortAsc;
    else {
        currentSortMode = mode;
        isSortAsc = (mode === 'name' || mode === 'genre');
    }
    renderTable();
}

function handleFestSort(mode) {
    if (festSortMode === mode) festSortAsc = !festSortAsc;
    else {
        festSortMode = mode;
        festSortAsc = (mode === 'name');
    }
    renderFestivalsView();
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
        let g = formatGenre((mData && mData.genres) ? mData.genres[0] : (b.genres ? b.genres[0] : "Unknown"));
        if (g.toLowerCase().includes("thrash")) g = "Thrash Metal";
        else if (g.toLowerCase().includes("death")) g = "Death Metal";
        else if (g.toLowerCase().includes("black")) g = "Black Metal";
        counts[g] = (counts[g] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted[0] ? sorted[0][1] : 0;
    sorted.forEach(([n, c]) => {
        const p = (c / max) * 100;
        genreContent.innerHTML += `<div class="genre-row"><div class="genre-info"><span>${n}</span><span>${c}</span></div><div class="genre-bar-bg"><div class="genre-bar-fill" style="width:${p}%"></div></div></div>`;
    });
}

initApp();