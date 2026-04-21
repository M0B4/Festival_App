/**
 * FESTIVAL GUIDE 2026 - ULTIMATIVE MASTER-LOGIK
 * Features: 3-Tab-System, Swipe-Navigation, Overlap-Check, Genre-Stats, 
 * Nuclear-Hard-Update, Case-Insensitive Flag-Logic (incl. EU & World).
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

/**
 * 1. INITIALISIERUNG
 */
async function initApp() {
    // Festivals im Menü alphabetisch sortieren
    if (typeof festivalRegistry !== 'undefined') {
        festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
    }

    setupUI();
    setupSwipeHandlers();

    try {
        // Alle Festival-JSONs parallel laden
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            if (!res.ok) throw new Error(`Fetch failed for ${fest.file}`);

            let data = await res.json();
            // Bands innerhalb der Liste sortieren
            data.sort((a, b) => a.name.localeCompare(b.name));

            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);

        // Erstes Festival als Start-Ansicht
        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);

    } catch (err) {
        console.error("Datenbank-Fehler:", err);
    }

    // Service Worker registrieren (für Offline-Nutzung)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
    }
}

/**
 * 2. ZENTRALE TAB-STEUERUNG
 */
function switchTab(targetViewId) {
    document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));

    const activeBtn = document.querySelector(`[data-target="${targetViewId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const targetView = document.getElementById(targetViewId);
    if (targetView) targetView.classList.add('active');

    // UI-Anpassung: Suche & Exklusiv-Button nur im Lineup zeigen
    const isLineup = targetViewId === 'lineup-view';
    document.body.classList.toggle('hide-search', !isLineup);

    if (targetViewId === 'stats-view') {
        renderGenreStats();
    } else if (isLineup) {
        renderTable();
    }
}

/**
 * 3. SWIPE-GESTEN LOGIK (Drei-Wege-Navigation)
 */
function setupSwipeHandlers() {
    let touchStartX = 0;
    const views = ['lineup-view', 'stats-view', 'settings-view'];

    contentArea.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    contentArea.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const threshold = 80;
        const currentViewId = document.querySelector('.view-container.active').id;
        const currentIndex = views.indexOf(currentViewId);

        // Nach links wischen (vorwärts)
        if (touchEndX < touchStartX - threshold && currentIndex < views.length - 1) {
            switchTab(views[currentIndex + 1]);
        }
        // Nach rechts wischen (rückwärts)
        if (touchEndX > touchStartX + threshold && currentIndex > 0) {
            switchTab(views[currentIndex - 1]);
        }
    }, { passive: true });
}

/**
 * 4. UI SETUP & AKTIONEN
 */
function setupUI() {
    // Menü füllen
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

    document.getElementById('exclusive-btn').onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active', showExclusiveOnly);
        renderTable();
    };

    searchInput.oninput = renderTable;

    // --- NUCLEAR HARD UPDATE ---
    document.getElementById('update-app-btn').onclick = async function() {
        const btn = this;
        btn.textContent = "Bereinige...";
        btn.disabled = true;

        try {
            // 1. Alle Caches plattmachen
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            // 2. Service Worker entlassen
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let reg of registrations) { await reg.unregister(); }
            }
            // 3. Reload mit Cache-Buster Zeitstempel
            const url = new URL(window.location.href);
            url.searchParams.set('update', Date.now());
            window.location.replace(url.toString());
        } catch (e) {
            window.location.reload(true);
        }
    };

    // FAVORITEN RESET
    document.getElementById('reset-favs-btn').onclick = () => {
        if (confirm("Wirklich ALLE Favoriten von allen Festivals löschen?")) {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('favs_')) localStorage.removeItem(key);
            });
            loadFestival(currentFestival);
        }
    };
}

/**
 * 5. RENDERING LOGIK
 */
function loadFestival(fest) {
    currentFestival = fest;
    selector.value = fest.id;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

    const activeScrollBox = document.querySelector('.view-container.active .scroll-box');
    if (activeScrollBox) activeScrollBox.scrollTop = 0;

    renderTable();
    if (document.body.classList.contains('hide-search') &&
        document.querySelector('#stats-view').classList.contains('active')) {
        renderGenreStats();
    }
}

function renderTable() {
    const term = searchInput.value.toLowerCase().trim();
    tbody.innerHTML = "";
    let overlapsCount = 0;

    const filtered = currentBands.filter(band => {
        const matchesSearch = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);

        const otherFests = [];
        for (const [id, data] of Object.entries(allFestivalsData)) {
            if (id !== currentFestival.id && data.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
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

                // FLAGGEN-HANDLING (Case-Insensitive & Spezialfälle)
                const originClean = (band.origin || "").toLowerCase().trim();
                const iso = countryCodes[originClean] || null;

                let flagHtml = "🏳️ ";
                if (iso === "world") {
                    flagHtml = `<span class="flag-icon" style="font-size: 1.2rem; margin-right: 10px;">🌎</span>`;
                } else if (iso) {
                    flagHtml = `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20" style="margin-right:10px; border-radius:2px;">`;
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

function renderGenreStats() {
    genreContent.innerHTML = `<h2 style="color:var(--acc); text-align:center; font-size: 1rem; margin: 20px 0;">TOP 10 GENRES</h2>`;
    const counts = {};
    
    currentBands.forEach(b => {
        let g = b.genres[0] || "Unknown";
        const low = g.toLowerCase();
        if (low.includes("thrash")) g = "Thrash Metal";
        else if (low.includes("death") && !low.includes("core")) g = "Death Metal";
        else if (low.includes("black")) g = "Black Metal";
        else if (low.includes("power")) g = "Power Metal";
        else if (low.includes("heavy") || low === "metal") g = "Heavy Metal";
        else if (low.includes("core")) g = "Core (Metal/Death)";
        counts[g] = (counts[g] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
    const max = sorted[0] ? sorted[0][1] : 0;

    sorted.forEach(([n, c]) => {
        const p = (c/max)*100;
        genreContent.innerHTML += `
            <div class="genre-row">
                <div class="genre-info"><span>${n}</span><span>${c}</span></div>
                <div class="genre-bar-bg"><div class="genre-bar-fill" style="width:${p}%"></div></div>
            </div>`;
    });
}

initApp();