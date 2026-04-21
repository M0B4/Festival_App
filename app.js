const BASE_PATH = 'festivaldata/';

let currentFestival = festivalRegistry[0];
let currentBands = [];
let favorites = [];

const selector = document.getElementById('festival-selector');
const title = document.getElementById('festival-title');
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');

// 1. Selector füllen
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

// 2. Festival Daten laden
async function loadFestival(fest) {
    currentFestival = fest;
    title.textContent = fest.name;

    try {
        const response = await fetch(BASE_PATH + fest.file);
        currentBands = await response.json();

        // Favoriten spezifisch für dieses Festival laden
        favorites = JSON.parse(localStorage.getItem(`favs_${fest.id}`)) || [];

        renderTable();
    } catch (error) {
        console.error("Ladefehler:", error);
        stats.textContent = "Datei nicht gefunden!";
    }
}

// 3. Tabelle zeichnen
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

        const iso = countryCodes[band.origin.toLowerCase()] || null;
        const flagHtml = iso ?
            `<img src="https://flagcdn.com/w40/${iso}.png" class="flag-icon" width="18">` :
            "🏳️ ";

        tr.innerHTML = `
            <td class="col-fav">
                <span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span>
            </td>
            <td>${flagHtml} ${band.name}</td>
            <td style="color:#888; font-size:0.8rem">${band.genres[0] || '-'}</td>
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

searchInput.addEventListener('input', renderTable);

// Start
setupSelector();
loadFestival(currentFestival);