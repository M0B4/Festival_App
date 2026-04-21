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

async function initApp() {
    festivalRegistry.sort((a, b) => a.name.localeCompare(b.name));
    setupUI();

    try {
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            let data = await res.json();
            data.sort((a, b) => a.name.localeCompare(b.name));
            allFestivalsData[fest.id] = data;
        });
        await Promise.all(loads);
        currentFestival = festivalRegistry[0];
        loadFestival(currentFestival);
    } catch (err) {
        console.error(err);
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

    // Tab Switch Logik
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .view-container').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            // Header anpassen (Suche in Statistik ausblenden)
            document.body.classList.toggle('hide-search', btn.dataset.target === 'stats-view');
            if (btn.dataset.target === 'stats-view') renderGenreStats();
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
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];
    renderTable();
    if (document.getElementById('stats-view').classList.contains('active')) renderGenreStats();
}

function renderGenreStats() {
    genreContent.innerHTML = `<h2 style="color:var(--accent-color); text-align:center;">Top 10 Genres</h2>`;

    const genreCounts = {};
    currentBands.forEach(band => {
        const g = band.genres[0] || "Unbekannt";
        genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    // Sortieren und Top 10 nehmen
    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const maxCount = sortedGenres[0][1];

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

// ... renderTable() und toggleFavorite() Funktionen bleiben wie vorher ...
function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";
    let overlapCount = 0;

    const filtered = currentBands.filter(band => {
        const matchesTerm = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);
        const matches = [];
        for (const [festId, bands] of Object.entries(allFestivalsData)) {
            if (festId !== currentFestival.id && bands.some(b => b.name.toLowerCase() === band.name.toLowerCase())) {
                matches.push(festivalRegistry.find(f => f.id === festId).name);
            }
        }
        if (matches.length > 0) overlapCount++;
        if (showExclusiveOnly && matches.length > 0) return false;
        band.currentMatches = matches;
        return matchesTerm;
    });

    stats.innerHTML = `<b>${filtered.length}</b> Bands | <span style="color:var(--accent-color)">${overlapCount}</span> Overlaps`;

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