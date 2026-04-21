const BASE_PATH = 'festivaldata/';

let currentFestival = festivalRegistry[0];
let currentBands = [];
let favorites = [];

const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const tableWrapper = document.querySelector('.table-wrapper');

// 1. Initialisiere das Festival-Auswahlmenü
function setupSelector() {
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
}

// 2. Daten für das gewählte Festival laden
async function loadFestival(fest) {
    currentFestival = fest;
    title.textContent = fest.name;

    // Tabelle beim Wechsel nach oben scrollen
    if (tableWrapper) tableWrapper.scrollTop = 0;
    searchInput.value = ""; // Suchfeld leeren

    try {
        const response = await fetch(BASE_PATH + fest.file);
        if (!response.ok) throw new Error('File not found');

        currentBands = await response.json();

        // Spezifische Favoriten für dieses Festival laden
        favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

        renderTable();
    } catch (error) {
        console.error("Fehler beim Laden:", error);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">Datei ${fest.file} nicht im Ordner festivaldata gefunden!</td></tr>`;
        stats.textContent = "Ladefehler";
    }
}

// 3. Die Tabelle generieren
function renderTable() {
    const term = searchInput.value.toLowerCase();
    tbody.innerHTML = "";

    const filtered = currentBands.filter(b => {
        const pool = `${b.name} ${b.origin} ${b.genres.join(' ')}`.toLowerCase();
        return pool.includes(term);
    });

    stats.textContent = `${filtered.length} Bands gefunden`;

    filtered.forEach(band => {
        const isFav = favorites.includes(band.name);
        const tr = document.createElement('tr');
        if (isFav) tr.classList.add('is-fav');

        // ISO-Code für Flagge ermitteln
        const countryLower = band.origin.toLowerCase();
        const iso = countryCodes[countryLower] || null;

        const flagHtml = iso ?
            `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="20" alt="${band.origin}">` :
            `<span class="flag-icon">🏳️</span>`;

        tr.innerHTML = `
            <td class="col-fav">
                <span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span>
            </td>
            <td class="band-cell">
                ${flagHtml}
                <span>${band.name}</span>
            </td>
            <td class="genre-cell">${band.genres[0] || '-'}</td>
        `;

        tr.onclick = (e) => {
            toggleFavorite(band.name);
        };

        tbody.appendChild(tr);
    });
}

// 4. Favoriten umschalten und speichern
function toggleFavorite(name) {
    if (favorites.includes(name)) {
        favorites = favorites.filter(n => n !== name);
    } else {
        favorites.push(name);
    }
    localStorage.setItem(`favs_${currentFestival.id}`, JSON.stringify(favorites));
    renderTable();
}

// Suche bei Eingabe ausführen
searchInput.addEventListener('input', renderTable);

// App starten
setupSelector();
loadFestival(currentFestival);