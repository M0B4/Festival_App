const BASE_PATH = 'festivaldata/';

let allFestivalsData = {};
let currentFestival = festivalRegistry[0];
let currentBands = [];
let favorites = [];
let showExclusiveOnly = false; // Neuer Filter-Status

const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const tableWrapper = document.querySelector('.table-wrapper');

// 1. Initialisierung
async function initApp() {
    setupUI();
    stats.textContent = "Lade alle Lineups...";

    try {
        const loads = festivalRegistry.map(async(fest) => {
            const res = await fetch(BASE_PATH + fest.file);
            const data = await res.json();
            allFestivalsData[fest.id] = data;
        });
        await Promise.all(loads);
        loadFestival(currentFestival);
    } catch (err) {
        console.error("Fehler:", err);
        stats.textContent = "Datenfehler!";
    }
}

function setupUI() {
    // Selector füllen
    festivalRegistry.forEach(fest => {
        const opt = document.createElement('option');
        opt.value = fest.id;
        opt.textContent = fest.name;
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        const selected = festivalRegistry.find(f => f.id === e.target.value);
        showExclusiveOnly = false; // Filter zurücksetzen bei Wechsel
        document.getElementById('exclusive-btn').classList.remove('active');
        loadFestival(selected);
    });

    // Exklusiv-Button Event
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
    title.textContent = fest.name;
    currentBands = allFestivalsData[fest.id] || [];
    favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

    if (tableWrapper) tableWrapper.scrollTop = 0;
    renderTable();
}

function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";

    let overlapTotalCount = 0;

    // Wir filtern erst die gesamte Liste
    const filtered = currentBands.filter(band => {
        const matchesTerm = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase().includes(term);

        // Check Überschneidungen für die Statistik
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
        if (hasOverlap) overlapTotalCount++;

        // Exklusiv-Filter Logik: Wenn Filter aktiv, zeige nur Bands OHNE Overlap
        if (showExclusiveOnly && hasOverlap) return false;

        band.currentMatches = otherFests; // Zwischenspeichern für den Render
        return matchesTerm;
    });

    // Statistik Anzeige
    stats.innerHTML = `
        <b>${filtered.length}</b> Bands angezeigt | 
        <span style="color: var(--accent-color)">${overlapTotalCount}</span> haben Überschneidungen
    `;

    filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');

                const iso = countryCodes[band.origin.toLowerCase()] || null;
                const flagHtml = iso ?
                    `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20">` :
                    `<span class="flag-icon">🏳️</span>`;

                let otherFestsHtml = "";
                if (band.currentMatches.length > 0) {
                    otherFestsHtml = `<div class="badge-container">
                ${band.currentMatches.map(name => `<span class="fest-badge">${name}</span>`).join('')}
            </div>`;
        }

        tr.innerHTML = `
            <td class="col-fav">
                <span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span>
            </td>
            <td class="band-cell">
                <div class="band-info-wrapper">
                    <div class="band-main-line">
                        ${flagHtml} <span>${band.name}</span>
                    </div>
                    ${otherFestsHtml}
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