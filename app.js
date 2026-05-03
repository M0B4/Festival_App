/**
 * FESTIVAL GUIDE 2026 - ROBUST EDITION
 */

const BASE_PATH = 'festivaldata/';
const MASTER_DATA_PATH = 'bands_master_data.json';

let allFestivalsData = {};
let bandMasterData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

let currentSortMode = 'name';
let isSortAsc = true;
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
const exclBtn = document.getElementById('exclusive-btn');

function getAutoColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const goldenRatioConjugate = 0.618033988749895;
    let h = (Math.abs(hash) * goldenRatioConjugate) % 1;
    h = Math.floor(h * 360);
    h = Math.floor(h / 30) * 30;
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

async function initApp() {
    try {
        if (typeof festivalRegistry !== 'undefined') {
            festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
        }
        setupUI();
        setupSwipeHandlers();

        const masterRes = await fetch(MASTER_DATA_PATH + '?v=' + Date.now());
        if (masterRes.ok) bandMasterData = await masterRes.json();

        const loads = festivalRegistry.map(async(fest) => {
            try {
                const res = await fetch(BASE_PATH + fest.file + '?v=' + Date.now());
                if (res.ok) allFestivalsData[fest.id] = await res.json();
            } catch (e) { console.error("Ladefehler: " + fest.file); }
        });

        await Promise.all(loads);
        if (festivalRegistry.length > 0) {
            currentFestival = festivalRegistry[0];
            loadFestival(currentFestival);
        }
    } catch (err) { console.error("Init-Fehler:", err); }
}

function switchTab(targetViewId) {
    const targetEl = document.getElementById(targetViewId);
    if (!targetEl) return; // Sicherheitsscheck

    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector('[data-target="' + targetViewId + '"]');

    if (activeBtn) activeBtn.classList.add('active');
    targetEl.classList.add('active');

    const isLineup = (targetViewId === 'lineup-view');
    document.body.classList.toggle('hide-search', !isLineup);

    if (exclBtn) {
        exclBtn.style.display = isLineup ? 'inline-block' : 'none';
    }

    if (searchContainer) searchContainer.classList.add('collapsed');

    if (targetViewId === 'stats-view') renderGenreStats();
    if (targetViewId === 'festivals-view') renderFestivalsView();
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

    document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => switchTab(btn.dataset.target));

    const safeSetClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };

    safeSetClick('sort-name', () => handleSort('name'));
    safeSetClick('sort-listeners', () => handleSort('listeners'));
    safeSetClick('sort-genre', () => handleSort('genre'));
    safeSetClick('fest-sort-name', () => handleFestSort('name'));
    safeSetClick('fest-sort-bands', () => handleFestSort('bands'));
    safeSetClick('fest-sort-exclusive', () => handleFestSort('exclusive'));
    safeSetClick('fest-sort-metric', () => handleFestSort('metric'));

    if (searchToggle) {
        searchToggle.onclick = () => {
            const coll = searchContainer.classList.toggle('collapsed');
            searchToggle.classList.toggle('active', !coll);
        };
    }

    if (exclBtn) {
        exclBtn.onclick = function() {
            showExclusiveOnly = !showExclusiveOnly;
            this.classList.toggle('active', showExclusiveOnly);
            renderTable();
        };
    }
    if (searchInput) searchInput.oninput = renderTable;
}

function loadFestival(fest) {
    if (!fest) return;
    currentFestival = fest;
    if (selector) selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem('favs_' + fest.id)) || [];

    renderTable();
    renderGenreStats();

    const activeView = document.querySelector('.view-container.active');
    if (activeView && activeView.id === 'festivals-view') renderFestivalsView();
}

function renderTable() {
    if (!tbody) return;
    const term = searchInput ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";

    const arrow = isSortAsc ? " ▲" : " ▼";
    const sortHeader = document.getElementById('sort-name');
    if (sortHeader) {
        sortHeader.innerHTML = "Band" + (currentSortMode === 'name' ? arrow : " ↕");
    }

    let filtered = currentBands.filter(band => {
        const matches = [];
        for (const id in allFestivalsData) {
            if (id !== currentFestival.id && allFestivalsData[id].some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                const fInfo = festivalRegistry.find(f => f.id === id);
                if (fInfo) matches.push(fInfo);
            }
        }
        band.currentMatches = matches;
        const nameMatch = (band.name + " " + (band.origin || "")).toLowerCase().includes(term);
        if (showExclusiveOnly && matches.length > 0) return false;
        return nameMatch;
    });

    if (stats) {
        if (showExclusiveOnly) {
            stats.innerHTML = `<b style="color:var(--acc-bright)">${filtered.length}</b> Exklusive Bands auf ${currentFestival.name}`;
        } else {
            const overlaps = currentBands.filter(b => (b.currentMatches || []).length > 0).length;
            stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--acc-bright)">${overlaps}</span> Overlaps`;
        }
    }

    filtered.sort((a, b) => {
        const mDataA = bandMasterData[a.name.toLowerCase()] || {};
        const mDataB = bandMasterData[b.name.toLowerCase()] || {};
        let res = 0;
        if (currentSortMode === 'listeners') res = (mDataA[currentMetric] || 0) - (mDataB[currentMetric] || 0);
        else if (currentSortMode === 'genre') {
            const gA = formatGenre(mDataA.genres ? mDataA.genres[0] : (a.genres ? a.genres[0] : '-'));
            const gB = formatGenre(mDataB.genres ? mDataB.genres[0] : (b.genres ? b.genres[0] : '-'));
            res = gA.localeCompare(gB);
        } else res = a.name.localeCompare(b.name);
        return isSortAsc ? res : -res;
    });

    filtered.forEach(band => {
        const isFav = favorites.includes(band.name);
        const mData = bandMasterData[band.name.toLowerCase()] || {};
        const iso = countryCodes[(band.origin || "").toLowerCase().trim()] || null;
        let flagHtml = iso ? `<img src="https://flagcdn.com/w40/${iso}.png" width="18" style="margin-right:8px; border-radius:2px;">` : "🏳️ ";

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

function renderFestivalsView() {
    const fTbody = document.getElementById('festivals-table-body');
    if (!fTbody) return;
    fTbody.innerHTML = "";
    const arrow = festSortAsc ? " ▲" : " ▼";

    const exclHeader = document.getElementById('fest-sort-exclusive');
    if (exclHeader) {
        exclHeader.innerHTML = "Exkl." + (festSortMode === 'exclusive' ? arrow : " ↕");
    }

    let festList = festivalRegistry.map(fest => {
        const bands = allFestivalsData[fest.id] || [];
        let totalMetric = 0,
            exclusiveCount = 0;
        bands.forEach(b => {
            const mData = bandMasterData[b.name.toLowerCase()];
            if (mData) totalMetric += (mData[currentMetric] || 0);
            const isExcl = !festivalRegistry.some(o => o.id !== fest.id && allFestivalsData[o.id] ? .some(ob => ob.name.toLowerCase() === b.name.toLowerCase()));
            if (isExcl) exclusiveCount++;
        });
        return { id: fest.id, name: fest.name, bandCount: bands.length, exclusiveCount, metric: totalMetric, raw: fest };
    });

    festList.sort((a, b) => {
        let res = (festSortMode === 'bands') ? a.bandCount - b.bandCount :
            (festSortMode === 'exclusive') ? a.exclusiveCount - b.exclusiveCount :
            (festSortMode === 'metric') ? a.metric - b.metric : a.name.localeCompare(b.name);
        return festSortAsc ? res : -res;
    });

    festList.forEach(item => {
        const autoColor = getAutoColor(item.name);
        const iso = countryCodes[(item.raw.country || "").toLowerCase()] || null;
        let flagHtml = iso ? `<img src="https://flagcdn.com/w40/${iso}.png" width="18" style="margin-right:8px; border-radius:2px; vertical-align:middle;">` : "🏳️ ";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center;">
                    <div class="fest-power-bar" style="background:${autoColor}; width:4px; height:18px; margin-right:10px; border-radius:2px;"></div>
                    ${flagHtml} <span>${item.name}</span>
                </div>
            </td>
            <td style="text-align:right;">${item.bandCount}</td>
            <td style="text-align:right; color:var(--acc-bright); font-weight:bold;">${item.exclusiveCount}</td>
            <td class="listener-cell">${formatNumber(item.metric, currentMetric)}</td>
        `;
        tr.onclick = () => { loadFestival(item.raw);
            switchTab('lineup-view'); };
        fTbody.appendChild(tr);
    });
}

function handleSort(mode) {
    if (currentSortMode === mode) isSortAsc = !isSortAsc;
    else { currentSortMode = mode;
        isSortAsc = (mode === 'name' || mode === 'genre'); }
    renderTable();
}

function handleFestSort(mode) {
    if (festSortMode === mode) festSortAsc = !festSortAsc;
    else { festSortMode = mode;
        festSortAsc = (mode === 'name'); }
    renderFestivalsView();
}

function setupSwipeHandlers() {
    if (!contentArea) return;
    let startX = 0;
    const views = ['lineup-view', 'festivals-view', 'stats-view', 'settings-view'];
    contentArea.addEventListener('touchstart', e => { startX = e.changedTouches[0].screenX; }, { passive: true });
    contentArea.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].screenX - startX;
        const activeView = document.querySelector('.view-container.active');
        if (!activeView) return;
        const activeIdx = views.indexOf(activeView.id);
        if (diff < -80 && activeIdx < views.length - 1) switchTab(views[activeIdx + 1]);
        if (diff > 80 && activeIdx > 0) switchTab(views[activeIdx - 1]);
    }, { passive: true });
}

function renderGenreStats() {
    if (!genreContent) return;
    genreContent.innerHTML = "<h2 style='color:var(--acc); text-align:center; font-size:1rem; margin:20px 0;'>Top 10 Genres</h2>";
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
    const max = sorted[0] ? sorted[0][1] : 1;
    sorted.forEach(([n, c]) => {
        const p = (c / max) * 100;
        genreContent.innerHTML += `<div class="genre-row"><div class="genre-info"><span>${n}</span><span>${c}</span></div><div class="genre-bar-bg"><div class="genre-bar-fill" style="width:${p}%"></div></div></div>`;
    });
}

initApp();