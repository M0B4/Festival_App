const BASE_PATH = 'festivaldata/';

let allFestivalsData = {};
let currentFestival = null;
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false;

// UI Elemente
const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const genreContent = document.getElementById('genre-stats-content');
const tableWrapper = document.querySelector('.table-wrapper');

async function initApp() {
    // 1. Festivals im Registry alphabetisch sortieren
    festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));

    setupUI();
    stats.textContent = "Lade Lineups...";

    try {
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            let data = await res.json();
            // 2. Bands alphabetisch sortieren
            data.sort((a, b) => a.name.localeCompare(b.name));
            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);

        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);
    } catch (err) {
        console.error("Ladefehler:", err);
        stats.textContent = "Fehler beim Laden der Daten.";
    }

    // Service Worker für PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(console.error);
        });
    }
}

function setupUI() {
    festivalRegistry.forEach(fest => {
        const opt = document.createElement('option');
        opt.value = fest.id;
        opt.textContent = fest.name;
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        const selected = festivalRegistry.find(f => f.id === e.target.value);
        loadFestival(selected);
    });

    // Tab-Switching (Bands vs. Genre)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            // Suche in Statistik ausblenden (App-Style)
            if (btn.dataset.target === 'stats-view') {
                document.body.classList.add('hide-search');
                renderGenreStats();
            } else {
                document.body.classList.remove('hide-search');
                renderTable();
            }
        };
    });

    document.getElementById('exclusive-btn').onclick = function() {
        showExclusiveOnly = !showExclusiveOnly;
        this.classList.toggle('active');
        renderTable();
    };

    searchInput.addEventListener('input', renderTable);
}

function loadFestival(fest) {
    currentFestival = fest;
    selector.value = fest.id;
    title.textContent = fest.name;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

    if (tableWrapper) tableWrapper.scrollTop = 0;
    renderTable();

    if (document.getElementById('stats-view').classList.contains('active')) renderGenreStats();
}

function renderGenreStats() {
    genreContent.innerHTML = `<h2 style="color:var(--accent-color); text-align:center; margin-top:0;">Top 10 Genres</h2>`;

    const genreCounts = {};
    currentBands.forEach(band => {
        let g = band.genres[0] || "Unbekannt";
        const low = g.toLowerCase();

        // Genre-Normalisierung
        if (low.includes("thrash")) g = "Thrash Metal";
        else if (low.includes("death") && !low.includes("core")) g = "Death Metal";
        else if (low.includes("black")) g = "Black Metal";
        else if (low.includes("power")) g = "Power Metal";
        else if (low.includes("heavy") || low === "metal") g = "Heavy Metal";
        else if (low.includes("core")) g = "Core (Metal/Death)";
        else if (low.includes("prog")) g = "Progressive";
        else if (low.includes("folk") || low.includes("pagan")) g = "Folk / Pagan";

        genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
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

function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";
    let overlaps = 0;

    const filtered = currentBands.filter(band => {
        const matchesTerm = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);
        const matches = [];
        for (const [id, bands] of Object.entries(allFestivalsData)) {
            if (id !== currentFestival.id && bands.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                matches.push(festivalRegistry.find(f => f.id === id).name);
            }
        }
        if (matches.length > 0) overlaps++;
        if (showExclusiveOnly && matches.length > 0) return false;
        band.currentMatches = matches.sort((a, b) => a.localeCompare(b));
        return matchesTerm;
    });

    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--accent-color)">${overlaps}</span> Overlaps`;

    filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');
                const iso = countryCodes[band.origin.toLowerCase()] || null;
                const flag = iso ? `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20">` : "🏳️ ";

                tr.innerHTML = `
            <td class="col-fav"><span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span></td>
            <td class="band-cell">
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flag} <span>${band.name}</span></div>
                    <div class="badge-container">${band.currentMatches.map(m => `<span class="fest-badge">${m}</span>`).join('')}</div>
                </div>
            </td>
            <td class="genre-cell">${band.genres[0] || '-'}</td>
        `;
        tr.onclick = () => toggleFavorite(band.name);
        tbody.appendChild(tr);
    });
}

function toggleFavorite(name) {
    favorites = favorites.includes(name) ? favorites.filter(n => n !== name) : [...favorites, name];
    localStorage.setItem(`favs_${currentFestival.id}`, JSON.stringify(favorites));
    renderTable();
}

initApp();