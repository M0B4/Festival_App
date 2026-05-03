/**
 * FESTIVAL GUIDE 2026 - STABLE EDITION
 * Keine Verwendung von ?. oder ?? für maximale Kompatibilität.
 */

const BASE_PATH = 'festivaldata/';
const MASTER_DATA_PATH = 'bands_master_data.json';

// Daten-Container
let allFestivalsData = {};
let bandMasterData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// Einstellungen (A-Z Standard)
let currentSortMode = 'name';
let isSortAsc = true;
let currentMetric = localStorage.getItem('pref_metric') || 'listeners';
let festSortMode = 'name';
let festSortAsc = true;

/**
 * Farblogik mit Goldenem Schnitt
 */
function getAutoColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const goldenRatioConjugate = 0.618033988749895;
    let h = (Math.abs(hash) * goldenRatioConjugate) % 1;
    h = Math.floor(h * 360);
    h = Math.floor(h / 30) * 30;
    return "hsl(" + h + ", 75%, 60%)";
}

function formatNumber(num, metric) {
    if (metric === 'spotify_popularity') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "k";
    return num;
}

function formatGenre(str) {
    if (!str || str === '-' || str === 'Unknown') return '-';
    return str.split(' ').map(function(word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

/**
 * Kernfunktion: Tabs wechseln
 */
function switchTab(targetViewId) {
    const targetEl = document.getElementById(targetViewId);
    if (!targetEl) return;

    document.querySelectorAll('.tab-btn, .view-container').forEach(function(el) {
        el.classList.remove('active');
    });

    const activeBtn = document.querySelector('[data-target="' + targetViewId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    targetEl.classList.add('active');

    const isLineup = (targetViewId === 'lineup-view');
    document.body.classList.toggle('hide-search', !isLineup);

    // Exklusiv-Button Sichtbarkeit
    const exBtn = document.getElementById('exclusive-btn');
    if (exBtn) {
        exBtn.style.display = isLineup ? 'inline-block' : 'none';
    }

    if (targetViewId === 'stats-view') renderGenreStats();
    if (targetViewId === 'festivals-view') renderFestivalsView();
}

/**
 * Ein Festival laden
 */
function loadFestival(fest) {
    if (!fest) return;
    currentFestival = fest;

    const sel = document.getElementById('festival-selector');
    if (sel) sel.value = fest.id;

    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem('favs_' + fest.id)) || [];

    renderTable();
    renderGenreStats();
}

/**
 * Rendering: Lineup-Liste
 */
function renderTable() {
    const tBody = document.getElementById('table-body');
    if (!tBody) return;

    const sInp = document.getElementById('search');
    const term = sInp ? sInp.value.toLowerCase().trim() : "";
    tBody.innerHTML = "";

    const arrow = isSortAsc ? " ▲" : " ▼";
    const sortHeader = document.getElementById('sort-name');
    if (sortHeader) sortHeader.innerHTML = "Band" + (currentSortMode === 'name' ? arrow : " ↕");

    const filtered = currentBands.filter(function(band) {
        const matches = [];
        for (let id in allFestivalsData) {
            if (id !== currentFestival.id) {
                const otherBands = allFestivalsData[id] || [];
                const found = otherBands.some(function(b) {
                    return b.name.toLowerCase() === band.name.toLowerCase();
                });
                if (found) {
                    const fInfo = festivalRegistry.find(function(f) { return f.id === id; });
                    if (fInfo) matches.push(fInfo);
                }
            }
        }
        band.currentMatches = matches;
        const nameMatch = band.name.toLowerCase().indexOf(term) !== -1;
        if (showExclusiveOnly && matches.length > 0) return false;
        return nameMatch;
    });

    const statsEl = document.getElementById('stats');
    if (statsEl) {
        if (showExclusiveOnly) {
            statsEl.innerHTML = "<b>" + filtered.length + "</b> Exklusive Bands";
        } else {
            const overlaps = currentBands.filter(function(b) { return (b.currentMatches || []).length > 0; }).length;
            statsEl.innerHTML = "<b>" + filtered.length + "</b> Bands | <span style='color:var(--acc)'>" + overlaps + "</span> Overlaps";
        }
    }

    filtered.sort(function(a, b) {
        const mDataA = bandMasterData[a.name.toLowerCase()] || {};
        const mDataB = bandMasterData[b.name.toLowerCase()] || {};
        let res = a.name.localeCompare(b.name);
        if (currentSortMode === 'listeners') res = (mDataA[currentMetric] || 0) - (mDataB[currentMetric] || 0);
        return isSortAsc ? res : -res;
    });

    filtered.forEach(function(band) {
        const isFav = favorites.includes(band.name);
        const mData = bandMasterData[band.name.toLowerCase()] || {};
        const iso = (typeof countryCodes !== 'undefined') ? countryCodes[(band.origin || "").toLowerCase().trim()] : null;
        let flagHtml = iso ? '<img src="https://flagcdn.com/w40/' + iso + '.png" width="18" style="margin-right:8px; border-radius:2px;">' : "🏳️ ";

        const badgesHtml = band.currentMatches.map(function(f) {
            const color = getAutoColor(f.name);
            return '<span class="fest-badge" style="border-color:' + color + '; color:' + color + '; background:' + color + '1a;">' + f.name + '</span>';
        }).join('');

        const tr = document.createElement('tr');
        if (isFav) tr.classList.add('is-fav');
        tr.innerHTML =
            '<td><span style="color:' + (isFav ? 'var(--acc)' : '#333') + '">' + (isFav ? '★' : '☆') + '</span></td>' +
            '<td><div class="band-info-wrapper"><div class="band-main-line">' + flagHtml + '<span>' + band.name + '</span></div>' +
            '<div class="badge-container">' + badgesHtml + '</div></div></td>' +
            '<td class="listener-cell">' + formatNumber(mData[currentMetric] || 0, currentMetric) + '</td>' +
            '<td class="genre-cell">' + formatGenre(mData.genres ? mData.genres[0] : (band.genres ? band.genres[0] : '-')) + '</td>';

        tr.onclick = function() {
            if (favorites.includes(band.name)) favorites = favorites.filter(function(n) { return n !== band.name; });
            else favorites.push(band.name);
            localStorage.setItem('favs_' + currentFestival.id, JSON.stringify(favorites));
            renderTable();
        };
        tBody.appendChild(tr);
    });
}

/**
 * Festival-Übersicht
 */
function renderFestivalsView() {
    const fTbody = document.getElementById('festivals-table-body');
    if (!fTbody) return;
    fTbody.innerHTML = "";

    const festList = festivalRegistry.map(function(fest) {
        const bands = allFestivalsData[fest.id] || [];
        let totalMetric = 0,
            exclusiveCount = 0;

        bands.forEach(function(b) {
            const mData = bandMasterData[b.name.toLowerCase()];
            if (mData) totalMetric += (mData[currentMetric] || 0);

            const foundElsewhere = festivalRegistry.some(function(o) {
                if (o.id === fest.id) return false;
                const otherBands = allFestivalsData[o.id] || [];
                return otherBands.some(function(ob) { return ob.name.toLowerCase() === b.name.toLowerCase(); });
            });
            if (!foundElsewhere) exclusiveCount++;
        });

        return { id: fest.id, name: fest.name, bandCount: bands.length, exclusiveCount: exclusiveCount, metric: totalMetric, raw: fest };
    });

    festList.forEach(function(item) {
        const autoColor = getAutoColor(item.name);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td><div style="display:flex; align-items:center;"><div style="background:' + autoColor + '; width:4px; height:18px; margin-right:10px; border-radius:2px;"></div><span>' + item.name + '</span></div></td>' +
            '<td style="text-align:right;">' + item.bandCount + '</td>' +
            '<td style="text-align:right; color:var(--acc); font-weight:bold;">' + item.exclusiveCount + '</td>' +
            '<td class="listener-cell">' + formatNumber(item.metric, currentMetric) + '</td>';
        tr.onclick = function() { loadFestival(item.raw);
            switchTab('lineup-view'); };
        fTbody.appendChild(tr);
    });
}

function handleSort(mode) {
    if (currentSortMode === mode) isSortAsc = !isSortAsc;
    else { currentSortMode = mode;
        isSortAsc = true; }
    renderTable();
}

/**
 * Setup & Initialisierung
 */
function setupUI() {
    const sel = document.getElementById('festival-selector');
    if (sel && typeof festivalRegistry !== 'undefined') {
        sel.innerHTML = "";
        festivalRegistry.forEach(function(fest) {
            const opt = document.createElement('option');
            opt.value = fest.id;
            opt.textContent = fest.name;
            sel.appendChild(opt);
        });
        sel.onchange = function(e) {
            const f = festivalRegistry.find(function(fest) { return fest.id === e.target.value; });
            loadFestival(f);
        };
    }

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.onclick = function() { switchTab(btn.dataset.target); };
    });

    const exBtn = document.getElementById('exclusive-btn');
    if (exBtn) {
        exBtn.onclick = function() {
            showExclusiveOnly = !showExclusiveOnly;
            this.classList.toggle('active', showExclusiveOnly);
            renderTable();
        };
    }
}

function renderGenreStats() {
    if (!genreContent) return;
    genreContent.innerHTML = "<h2 style='color:var(--acc); text-align:center;'>Top Genres</h2>";
    const counts = {};
    currentBands.forEach(function(b) {
        const mData = bandMasterData[b.name.toLowerCase()];
        let g = formatGenre((mData && mData.genres) ? mData.genres[0] : (b.genres ? b.genres[0] : "Unknown"));
        counts[g] = (counts[g] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
    const max = sorted[0] ? sorted[0][1] : 1;
    sorted.forEach(function(item) {
        const p = (item[1] / max) * 100;
        genreContent.innerHTML += '<div class="genre-row"><div class="genre-info"><span>' + item[0] + '</span><span>' + item[1] + '</span></div><div class="genre-bar-bg"><div class="genre-bar-fill" style="width:' + p + '%"></div></div></div>';
    });
}

async function initApp() {
    if (typeof festivalRegistry === 'undefined') return;
    setupUI();

    const masterRes = await fetch(MASTER_DATA_PATH + '?v=' + Date.now());
    if (masterRes.ok) bandMasterData = await masterRes.json();

    const loads = festivalRegistry.map(async function(fest) {
        const res = await fetch(BASE_PATH + fest.file + '?v=' + Date.now());
        if (res.ok) allFestivalsData[fest.id] = await res.json();
    });

    await Promise.all(loads);
    if (festivalRegistry.length > 0) loadFestival(festivalRegistry[0]);
}

initApp();