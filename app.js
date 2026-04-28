const BASE_PATH = 'festivaldata/';
const MASTER_DATA_PATH = 'bands_master_data.json';

let allFestivalsData = {};
let bandMasterData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;
let currentSortMode = 'listeners';

const selector = document.getElementById('festival-selector');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const contentArea = document.querySelector('.content-area');
const searchContainer = document.getElementById('search-container');
const searchToggle = document.getElementById('search-toggle-btn');

async function initApp() {
    try {
        if (typeof festivalRegistry !== 'undefined') {
            festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
        }

        setupUI();
        setupSwipeHandlers();

        // Master Daten laden
        try {
            const masterRes = await fetch(MASTER_DATA_PATH);
            if (masterRes.ok) {
                bandMasterData = await masterRes.json();
            }
        } catch (e) {
            console.warn("Master-Daten nicht verfügbar.");
        }

        const loads = festivalRegistry.map(async(fest) => {
            try {
                const res = await fetch(BASE_PATH + fest.file);
                if (res.ok) {
                    allFestivalsData[fest.id] = await res.json();
                }
            } catch (e) { console.error("Fehler beim Laden von " + fest.file); }
        });

        await Promise.all(loads);
        if (festivalRegistry.length > 0) {
            currentFestival = festivalRegistry[0];
            loadFestival(currentFestival);
        }

    } catch (err) { console.error("Kritischer Fehler:", err); }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(function() {});
    }
}

function switchTab(targetViewId) {
    const target = document.getElementById(targetViewId);
    if (!target) return;

    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector('[data-target="' + targetViewId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    target.classList.add('active');

    document.body.classList.toggle('hide-search', targetViewId !== 'lineup-view');
    document.body.classList.toggle('hide-nav', targetViewId === 'settings-view');

    if (searchContainer) {
        searchContainer.classList.add('collapsed');
        if (searchToggle) searchToggle.classList.remove('active');
    }

    if (targetViewId === 'stats-view') renderGenreStats();
}

function setupUI() {
    if (selector) {
        festivalRegistry.forEach(fest => {
            const opt = document.createElement('option');
            opt.value = fest.id;
            opt.textContent = fest.name;
            selector.appendChild(opt);
        });
        selector.onchange = (e) => {
            const fest = festivalRegistry.find(f => f.id === e.target.value);
            loadFestival(fest);
        };
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.target);
    });

    const sortBtnName = document.getElementById('sort-name');
    const sortBtnList = document.getElementById('sort-listeners');

    if (sortBtnName) sortBtnName.onclick = () => { currentSortMode = 'name';
        renderTable(); };
    if (sortBtnList) sortBtnList.onclick = () => { currentSortMode = 'listeners';
        renderTable(); };

    if (searchToggle) {
        searchToggle.onclick = () => {
            const isCollapsed = searchContainer.classList.toggle('collapsed');
            searchToggle.classList.toggle('active', !isCollapsed);
            if (!isCollapsed && searchInput) {
                setTimeout(() => searchInput.focus(), 300);
            } else {
                if (searchInput) {
                    searchInput.value = "";
                    renderTable();
                }
            }
        };
    }

    const exclBtn = document.getElementById('exclusive-btn');
    if (exclBtn) {
        exclBtn.onclick = function() {
            showExclusiveOnly = !showExclusiveOnly;
            this.classList.toggle('active', showExclusiveOnly);
            renderTable();
        };
    }

    if (searchInput) searchInput.oninput = renderTable;

    const updateBtn = document.getElementById('update-app-btn');
    if (updateBtn) {
        updateBtn.onclick = async function() {
            this.textContent = "Updating...";
            try {
                if ('caches' in window) {
                    const names = await caches.keys();
                    for (let name of names) await caches.delete(name);
                }
                window.location.replace(window.location.href.split('?')[0] + '?u=' + Date.now());
            } catch (e) { window.location.reload(true); }
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

function renderTable() {
    if (!tbody) return;
    const term = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : "";
    tbody.innerHTML = "";

    const sortBtnName = document.getElementById('sort-name');
    const sortBtnList = document.getElementById('sort-listeners');
    if (sortBtnName) sortBtnName.classList.toggle('active-sort', currentSortMode === 'name');
    if (sortBtnList) sortBtnList.classList.toggle('active-sort', currentSortMode === 'listeners');

    let overlaps = 0;
    let filtered = currentBands.filter(band => {
        const match = (band.name + " " + band.origin).toLowerCase().includes(term);
        const fests = [];
        for (const id in allFestivalsData) {
            if (id !== currentFestival.id) {
                const isThere = allFestivalsData[id].some(b => b.name.toLowerCase() === band.name.toLowerCase());
                if (isThere) {
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
        if (currentSortMode === 'listeners') {
            const mDataA = bandMasterData[a.name.toLowerCase()];
            const mDataB = bandMasterData[b.name.toLowerCase()];
            const lA = mDataA ? mDataA.listeners : 0;
            const lB = mDataB ? mDataB.listeners : 0;
            return lB - lA || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
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
        const lCount = mData ? mData.listeners : 0;
        let lDisplay = "-";
        if (lCount >= 1000000) lDisplay = (lCount / 1000000).toFixed(1) + "M";
        else if (lCount >= 1000) lDisplay = (lCount / 1000).toFixed(0) + "k";

        const genre = (mData && mData.genres && mData.genres[0]) ? mData.genres[0] : (band.genres[0] || '-');

        tr.innerHTML = "<td><span style='color:" + (isFav ? 'var(--acc)' : '#333') + "'>" + (isFav ? '★' : '☆') + "</span></td>" +
            "<td><div class='band-info-wrapper'><div class='band-main-line'>" + flagHtml + " <span>" + band.name + "</span></div>" +
            "<div>" + band.currentMatches.map(m => "<span class='fest-badge'>" + m + "</span>").join('') + "</div></div></td>" +
            "<td class='listener-cell'>" + lDisplay + "</td>" +
            "<td class='genre-cell'>" + genre + "</td>";

        tr.onclick = () => {
            if (favorites.includes(band.name)) {
                favorites = favorites.filter(n => n !== band.name);
            } else {
                favorites.push(band.name);
            }
            localStorage.setItem('favs_' + currentFestival.id, JSON.stringify(favorites));
            renderTable();
        };
        tbody.appendChild(tr);
    });
}

function setupSwipeHandlers() {
    if (!contentArea) return;
    let touchStartX = 0;
    const views = ['lineup-view', 'stats-view', 'settings-view'];
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
        let g = (mData && mData.genres && mData.genres[0]) ? mData.genres[0] : (b.genres[0] || "Unknown");
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