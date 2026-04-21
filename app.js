/**
 * FESTIVAL GUIDE 2026 - MASTER LOGIC
 * Features: Collapsible Search, Nuclear Update, Swipe Navigation, 
 * Special Flags (EU/World), UI-Hiding in Settings.
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
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const contentArea = document.querySelector('.content-area');
const searchContainer = document.getElementById('search-container');
const searchToggle = document.getElementById('search-toggle-btn');

/**
 * 1. INITIALISIERUNG
 */
async function initApp() {
    if (typeof festivalRegistry !== 'undefined') {
        festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
    }

    setupUI();
    setupSwipeHandlers();

    try {
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            if (!res.ok) throw new Error(`Fetch failed: ${fest.file}`);
            let data = await res.json();
            data.sort((a, b) => a.name.localeCompare(b.name));
            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);
        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);
    } catch (err) {
        console.error("Datenbank-Fehler:", err);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    }
}

/**
 * 2. TAB-STEUERUNG
 */
function switchTab(targetViewId) {
    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));

    const activeBtn = document.querySelector(`[data-target="${targetViewId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    document.getElementById(targetViewId).classList.add('active');

    const isLineup = targetViewId === 'lineup-view';
    const isSettings = targetViewId === 'settings-view';

    // UI-Elemente je nach Tab ein/ausblenden
    document.body.classList.toggle('hide-search', !isLineup);
    document.body.classList.toggle('hide-nav', isSettings);

    // Suche schließen, wenn man den Tab wechselt
    if (!isLineup) {
        searchContainer.classList.add('collapsed');
        searchToggle.classList.remove('active');
    }

    if (targetViewId === 'stats-view') renderGenreStats();
}

/**
 * 3. SWIPE NAVIGATION
 */
function setupSwipeHandlers() {
    let touchStartX = 0;
    const views = ['lineup-view', 'stats-view', 'settings-view'];

    contentArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    contentArea.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const threshold = 80;
        const currentIndex = views.indexOf(document.querySelector('.view-container.active').id);

        if (touchEndX < touchStartX - threshold && currentIndex < views.length - 1) {
            switchTab(views[currentIndex + 1]);
        }
        if (touchEndX > touchStartX + threshold && currentIndex > 0) {
            switchTab(views[currentIndex - 1]);
        }
    }, { passive: true });
}

/**
 * 4. UI SETUP
 */
function setupUI() {
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

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.target);
    });

    // SUCHE TOGGLE
    searchToggle.onclick = () => {
        const isCollapsed = searchContainer.classList.toggle('collapsed');
        searchToggle.classList.toggle('active', !isCollapsed);
        if (!isCollapsed) {
            setTimeout(() => searchInput.focus(), 300);
        } else {
            searchInput.value = "";
            renderTable();
        }
    };

    document.getElementById('exclusive-btn').onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };

    searchInput.oninput = renderTable;

    // NUCLEAR UPDATE
    document.getElementById('update-app-btn').onclick = async function() {
        this.textContent = "Updating...";
        this.disabled = true;
        try {
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            }
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) { await reg.unregister(); }
            }
            const url = new URL(window.location.href);
            url.searchParams.set('u', Date.now());
            window.location.replace(url.toString());
        } catch (e) { window.location.reload(true); }
    };

    document.getElementById('reset-favs-btn').onclick = () => {
        if (confirm("Alle Favoriten löschen?")) {
            Object.keys(localStorage).forEach(key => { if (key.startsWith('favs_')) localStorage.removeItem(key); });
            loadFestival(currentFestival);
        }
    };
}

/**
 * 5. RENDERING
 */
function loadFestival(fest) {
    currentFestival = fest;
    selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];
    renderTable();
}

function renderTable() {
    const term = searchInput.value.toLowerCase().trim();
    tbody.innerHTML = "";
    let overlaps = 0;

    const filtered = currentBands.filter(band => {
        const match = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);
        const fests = [];
        for (const [id, data] of Object.entries(allFestivalsData)) {
            if (id !== currentFestival.id && data.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                fests.push(festivalRegistry.find(f => f.id === id).name);
            }
        }
        if (fests.length > 0) overlaps++;
        if (showExclusiveOnly && fests.length > 0) return false;
        band.currentMatches = fests;
        return match;
    });

    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--acc)">${overlaps}</span> Overlaps`;

    filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');

                const originClean = (band.origin || "").toLowerCase().trim();
                const iso = countryCodes[originClean] || null;

                let flagHtml = "🏳️ ";
                if (iso === "world") {
                    flagHtml = `<span style="font-size: 1.2rem; margin-right: 10px;">🌎</span>`;
                } else if (iso) {
                    flagHtml = `<img src="https://flagcdn.com/w40/${iso}.png" width="20" style="margin-right:10px; border-radius:2px;">`;
                }

                tr.innerHTML = `
            <td><span style="color:${isFav ? 'var(--acc)' : '#333'}">${isFav ? '★' : '☆'}</span></td>
            <td>
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flagHtml} <span>${band.name}</span></div>
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
    genreContent.innerHTML = `<h2 style="color:var(--acc); text-align:center; font-size: 1rem; margin: 20px 0;">Top 10 Genres</h2>`;
    const counts = {};
    currentBands.forEach(b => {
        let g = b.genres[0] || "Unknown";
        const low = g.toLowerCase();
        if (low.includes("thrash")) g = "Thrash Metal";
        else if (low.includes("death")) g = "Death Metal";
        else if (low.includes("black")) g = "Black Metal";
        else if (low.includes("power")) g = "Power Metal";
        else if (low.includes("heavy")) g = "Heavy Metal";
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