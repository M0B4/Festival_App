/**
 * FESTIVAL GUIDE 2026 - REPAIR EDITION
 * Fixes: Alphabetical Registry, Flags in Overview, Genre Stats.
 */

const BASE_PATH = 'festivaldata/';
const MASTER_DATA_PATH = 'bands_master_data.json';

// Daten-Container
var allFestivalsData = {};
var bandMasterData = {};
var currentFestival = null;
var currentBands = [];
var favorites = [];
var showExclusiveOnly = false;

// Einstellungen (A-Z Standard)
var currentSortMode = 'name';
var isSortAsc = true;
var currentMetric = localStorage.getItem('pref_metric') || 'listeners';
var festSortMode = 'name';
var festSortAsc = true;

/**
 * Farblogik für Badges
 */
function getAutoColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var goldenRatioConjugate = 0.618033988749895;
    var h = (Math.abs(hash) * goldenRatioConjugate) % 1;
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
 * Tab-Steuerung & Exklusiv-Button Sichtbarkeit
 */
function switchTab(targetViewId) {
    var targetEl = document.getElementById(targetViewId);
    if (!targetEl) return;

    document.querySelectorAll('.tab-btn, .view-container').forEach(function(el) {
        el.classList.remove('active');
    });

    var activeBtn = document.querySelector('[data-target="' + targetViewId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    targetEl.classList.add('active');

    var isLineup = (targetViewId === 'lineup-view');
    document.body.classList.toggle('hide-search', !isLineup);

    var exBtn = document.getElementById('exclusive-btn');
    if (exBtn) {
        exBtn.style.display = isLineup ? 'inline-block' : 'none';
    }

    if (targetViewId === 'stats-view') renderGenreStats();
    if (targetViewId === 'festivals-view') renderFestivalsView();
}

/**
 * Festival laden & Ansichten triggern
 */
function loadFestival(fest) {
    if (!fest) return;
    currentFestival = fest;

    var sel = document.getElementById('festival-selector');
    if (sel) sel.value = fest.id;

    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem('favs_' + fest.id)) || [];

    renderTable();
    renderGenreStats();
}

/**
 * Rendering: Lineup-Tabelle
 */
function renderTable() {
    var tBody = document.getElementById('table-body');
    if (!tBody) return;

    var sInp = document.getElementById('search');
    var term = sInp ? sInp.value.toLowerCase().trim() : "";
    tBody.innerHTML = "";

    var arrow = isSortAsc ? " ▲" : " ▼";
    var sortHeader = document.getElementById('sort-name');
    if (sortHeader) sortHeader.innerHTML = "Band" + (currentSortMode === 'name' ? arrow : " ↕");

    var filtered = currentBands.filter(function(band) {
        var matches = [];
        for (var id in allFestivalsData) {
            if (id !== currentFestival.id) {
                var otherBands = allFestivalsData[id] || [];
                var found = otherBands.some(function(b) {
                    return b.name.toLowerCase() === band.name.toLowerCase();
                });
                if (found) {
                    var fInfo = festivalRegistry.find(function(f) { return f.id === id; });
                    if (fInfo) matches.push(fInfo);
                }
            }
        }
        band.currentMatches = matches;
        var nameMatch = band.name.toLowerCase().indexOf(term) !== -1;
        if (showExclusiveOnly && matches.length > 0) return false;
        return nameMatch;
    });

    var statsEl = document.getElementById('stats');
    if (statsEl) {
        if (showExclusiveOnly) {
            statsEl.innerHTML = "<b>" + filtered.length + "</b> Exklusive Bands";
        } else {
            var overlaps = currentBands.filter(function(b) { return (b.currentMatches || []).length > 0; }).length;
            statsEl.innerHTML = "<b>" + filtered.length + "</b> Bands | <span style='color:var(--acc)'>" + overlaps + "</span> Overlaps";
        }
    }

    filtered.sort(function(a, b) {
        var mDataA = bandMasterData[a.name.toLowerCase()] || {};
        var mDataB = bandMasterData[b.name.toLowerCase()] || {};
        var res = a.name.localeCompare(b.name);
        if (currentSortMode === 'listeners') res = (mDataA[currentMetric] || 0) - (mDataB[currentMetric] || 0);
        return isSortAsc ? res : -res;
    });

    filtered.forEach(function(band) {
        var isFav = favorites.includes(band.name);
        var mData = bandMasterData[band.name.toLowerCase()] || {};

        var flagHtml = "🏳️ ";
        if (typeof countryCodes !== 'undefined') {
            var iso = countryCodes[(band.origin || "").toLowerCase().trim()];
            if (iso) flagHtml = '<img src="https://flagcdn.com/w40/' + iso + '.png" width="18" style="margin-right:8px; border-radius:2px;">';
        }

        var badgesHtml = band.currentMatches.map(function(f) {
            var color = getAutoColor(f.name);
            return '<span class="fest-badge" style="border-color:' + color + '; color:' + color + '; background:' + color + '1a;">' + f.name + '</span>';
        }).join('');

        var genreStr = mData.genres && mData.genres.length > 0 ? mData.genres[0] : (band.genres && band.genres.length > 0 ? band.genres[0] : "-");

        var tr = document.createElement('tr');
        if (isFav) tr.classList.add('is-fav');
        tr.innerHTML = '<td><span style="color:' + (isFav ? 'var(--acc)' : '#333') + '">' + (isFav ? '★' : '☆') + '</span></td>' +
            '<td><div class="band-info-wrapper"><div class="band-main-line">' + flagHtml + '<span>' + band.name + '</span></div>' +
            '<div class="badge-container">' + badgesHtml + '</div></div></td>' +
            '<td class="listener-cell">' + formatNumber(mData[currentMetric] || 0, currentMetric) + '</td>' +
            '<td class="genre-cell">' + formatGenre(genreStr) + '</td>';

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
 * Rendering: Festival-Übersicht (Flaggen repariert)
 */
function renderFestivalsView() {
    var fTbody = document.getElementById('festivals-table-body');
    if (!fTbody) return;
    fTbody.innerHTML = "";

    var festList = festivalRegistry.map(function(fest) {
        var bands = allFestivalsData[fest.id] || [];
        var totalMetric = 0,
            exclusiveCount = 0;

        bands.forEach(function(b) {
            var mData = bandMasterData[b.name.toLowerCase()];
            if (mData) totalMetric += (mData[currentMetric] || 0);

            var isElsewhere = festivalRegistry.some(function(o) {
                if (o.id === fest.id) return false;
                var otherBands = allFestivalsData[o.id] || [];
                return otherBands.some(function(ob) { return ob.name.toLowerCase() === b.name.toLowerCase(); });
            });
            if (!isElsewhere) exclusiveCount++;
        });

        return { id: fest.id, name: fest.name, bandCount: bands.length, exclusiveCount: exclusiveCount, metric: totalMetric, raw: fest };
    });

    festList.forEach(function(item) {
        var autoColor = getAutoColor(item.name);

        // Flaggen-Logik für Übersicht
        var iso = (typeof countryCodes !== 'undefined') ? countryCodes[(item.raw.country || "").toLowerCase()] : null;
        var flagHtml = iso ? '<img src="https://flagcdn.com/w40/' + iso + '.png" width="18" style="margin-right:8px; border-radius:2px; vertical-align:middle;">' : "🏳️ ";

        var tr = document.createElement('tr');
        tr.innerHTML = '<td><div style="display:flex; align-items:center;"><div style="background:' + autoColor + '; width:4px; height:18px; margin-right:10px; border-radius:2px;"></div>' + flagHtml + '<span>' + item.name + '</span></div></td>' +
            '<td style="text-align:right;">' + item.bandCount + '</td>' +
            '<td style="text-align:right; color:var(--acc); font-weight:bold;">' + item.exclusiveCount + '</td>' +
            '<td class="listener-cell">' + formatNumber(item.metric, currentMetric) + '</td>';
        tr.onclick = function() { loadFestival(item.raw);
            switchTab('lineup-view'); };
        fTbody.appendChild(tr);
    });
}

/**
 * Rendering: Genre-Statistik (Tab gefixt)
 */
function renderGenreStats() {
    var genreContent = document.getElementById('genre-stats-content');
    if (!genreContent) return;
    genreContent.innerHTML = "<h2 style='color:var(--acc); text-align:center; font-size:1rem; margin:20px 0;'>Top 10 Genres</h2>";

    var counts = {};
    currentBands.forEach(function(b) {
        var mData = bandMasterData[b.name.toLowerCase()] || {};
        var g = mData.genres && mData.genres.length > 0 ? mData.genres[0] : (b.genres && b.genres.length > 0 ? b.genres[0] : "Unknown");
        var formatted = formatGenre(g);
        counts[formatted] = (counts[formatted] || 0) + 1;
    });

    var sorted = Object.keys(counts).map(function(key) {
        return [key, counts[key]];
    }).sort(function(a, b) {
        return b[1] - a[1];
    }).slice(0, 10);

    var max = sorted[0] ? sorted[0][1] : 1;

    sorted.forEach(function(item) {
        var p = (item[1] / max) * 100;
        var row = document.createElement('div');
        row.className = 'genre-row';
        row.innerHTML = '<div class="genre-info"><span>' + item[0] + '</span><span>' + item[1] + '</span></div>' +
            '<div class="genre-bar-bg"><div class="genre-bar-fill" style="width:' + p + '%"></div></div>';
        genreContent.appendChild(row);
    });
}

function handleSort(mode) {
    if (currentSortMode === mode) isSortAsc = !isSortAsc;
    else { currentSortMode = mode;
        isSortAsc = true; }
    renderTable();
}

/**
 * Setup & Initialisierung (A-Z Sortierung Registry)
 */
function setupUI() {
    var sel = document.getElementById('festival-selector');
    if (sel && typeof festivalRegistry !== 'undefined') {
        // Alphabetische Sortierung der Registry für das Dropdown
        festivalRegistry.sort(function(a, b) { return a.name.localeCompare(b.name); });

        sel.innerHTML = "";
        festivalRegistry.forEach(function(fest) {
            var opt = document.createElement('option');
            opt.value = fest.id;
            opt.textContent = fest.name;
            sel.appendChild(opt);
        });
        sel.onchange = function(e) {
            var f = festivalRegistry.find(function(f) { return f.id === e.target.value; });
            loadFestival(f);
        };
    }

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.onclick = function() { switchTab(btn.dataset.target); };
    });

    var sName = document.getElementById('sort-name');
    if (sName) sName.onclick = function() { handleSort('name'); };

    var exBtn = document.getElementById('exclusive-btn');
    if (exBtn) {
        exBtn.onclick = function() {
            showExclusiveOnly = !showExclusiveOnly;
            this.classList.toggle('active', showExclusiveOnly);
            renderTable();
        };
    }
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