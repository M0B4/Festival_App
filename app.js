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
    // Festivals alphabetisch sortieren
    festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));

    setupUI();
    stats.textContent = "Lade Lineups...";

    try {
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            let data = await res.json();
            // Bands innerhalb des Festivals sortieren
            data.sort((a, b) => a.name.localeCompare(b.name));
            allFestivalsData[fest.id] = data;
        });

        await Promise.all(loads);

        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);
    } catch (err) {
        console.error("Initialisierungsfehler:", err);
        stats.textContent = "Fehler beim Laden der Datenbank.";
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
        showExclusiveOnly = false;
        document.getElementById('exclusive-btn').classList.remove('active');
        loadFestival(selected);
    });

    // Tab-Switch Logik
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            // Suche in Statistik ausblenden
            document.body.classList.toggle('hide-search', btn.dataset.target === 'stats-view');
            if (btn.dataset.target === 'stats-view') renderGenreStats();
        };
    });

    const exclBtn = document.getElementById('exclusive-btn');
    exclBtn.onclick = () => {
        showExclusiveOnly = !showExclusiveOnly;
        exclBtn.classList.toggle('active', showExclusiveOnly);
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

    // Scrollt im Lineup-Tab nach oben
    if (tableWrapper) tableWrapper.scrollTop = 0;

    renderTable();

    // Falls wir gerade im Statistik-Tab sind, auch diesen updaten
    if (document.getElementById('stats-view').classList.contains('active')) renderGenreStats();
}

function renderGenreStats() {
    genreContent.innerHTML = `<h2 style="color:var(--accent-color); text-align:center; margin-top:0;">Top 10 Genres</h2>`;

    const genreCounts = {};

    currentBands.forEach(band => {
        let g = band.genres[0] || "Unbekannt";
        const lowerG = g.toLowerCase();

        // Normalisierung der Genres
        if (lowerG.includes("thrash")) g = "Thrash Metal";
        else if (lowerG.includes("death") && !lowerG.includes("core")) g = "Death Metal";
        else if (lowerG.includes("black")) g = "Black Metal";
        else if (lowerG.includes("power")) g = "Power Metal";
        else if (lowerG.includes("heavy") || lowerG === "metal") g = "Heavy Metal";
        else if (lowerG.includes("core")) g = "Core (Metal/Death)";
        else if (lowerG.includes("prog")) g = "Progressive";
        else if (lowerG.includes("folk") || lowerG.includes("pagan")) g = "Folk / Pagan";

        genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const maxCount = sortedGenres.length > 0 ? sortedGenres[0][1] : 0;

    sortedGenres.forEach(([name, count]) => {
        const percentage = (count / maxCount) * 100;
        const row = document.createElement('div');
        row.className = 'genre-row';
        row.innerHTML = `
            <div class="genre-info">
                <span>${name}</span>
                <span>${count} Bands</span>
            </div>
            <div class="genre-bar-bg">
                <div class="genre-bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        genreContent.appendChild(row);
    });
}

function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";
    let overlapCount = 0;

    const filtered = currentBands.filter(band => {
        const matchesTerm = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);

        const otherFests = [];
        for (const [festId, bands] of Object.entries(allFestivalsData)) {
            if (festId !== currentFestival.id) {
                if (bands.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                    const festInfo = festivalRegistry.find(f => f.id === festId);
                    otherFests.push(festInfo.name);
                }
            }
        }

        const hasOverlap = otherFests.length > 0;
        if (hasOverlap) overlapCount++;
        if (showExclusiveOnly && hasOverlap) return false;

        band.currentMatches = otherFests.sort((a, b) => a.localeCompare(b));
        return matchesTerm;
    });

    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--accent-color)">${overlapCount}</span> Overlaps`;

    filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');

                const iso = countryCodes[band.origin.toLowerCase()] || null;
                const flagHtml = iso ?
                    `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20">` :
                    `<span class="flag-icon">🏳️</span>`;

                let badgesHtml = "";
                if (band.currentMatches.length > 0) {
                    badgesHtml = `<div class="badge-container">
                ${band.currentMatches.map(name => `<span class="fest-badge">${name}</span>`).join('')}
            </div>`;
        }

        tr.innerHTML = `
            <td class="col-fav"><span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span></td>
            <td class="band-cell">
                <div class="band-info-wrapper">
                    <div class="band-main-line">${flagHtml} <span>${band.name}</span></div>
                    ${badgesHtml}
                </div>
            </td>
            <td class="genre-cell">${band.genres[0] || '-'}</td>
        `;

        tr.onclick = () => toggleFavorite(band.name);
        tbody.appendChild(tr);
    });
}

function toggleFavorite(name) {
    if (favorites.includes(name)) {
        favorites = favorites.filter(n => n !== name);
    } else {
        favorites.push(name);
    }
    localStorage.setItem(`favs_${currentFestival.id}`, JSON.stringify(favorites));
    renderTable();
}

initApp();