// Konfiguration
const DATA_PATH = 'festivaldata/wacken_2026_raw_bands.json';

async function initApp() {
    try {
        const response = await fetch(DATA_PATH);
        const data = await response.json();

        const grid = document.getElementById('band-grid');
        const searchInput = document.getElementById('search');
        const stats = document.getElementById('stats');

        // Favoriten aus dem Speicher laden
        let favorites = JSON.parse(localStorage.getItem('wacken_favs')) || [];

        function render(filter = "") {
            grid.innerHTML = "";
            const filtered = data.filter(b =>
                b.name.toLowerCase().includes(filter.toLowerCase())
            );

            stats.innerText = `${filtered.length} von 153 Bands angezeigt`;

            filtered.forEach(band => {
                const isFav = favorites.includes(band.name);
                const card = document.createElement('div');
                card.className = `band-card ${isFav ? 'is-favorite' : ''}`;

                card.innerHTML = `
                    <div class="fav-star">${isFav ? '★' : '☆'}</div>
                    <span class="band-name">${band.name}</span>
                    <span class="origin">🚩 ${band.origin}</span>
                    <div class="genre-tag">${band.genres[0] || 'Metal'}</div>
                `;

                // Klick-Event für Favoriten
                card.onclick = () => toggleFavorite(band.name);
                grid.appendChild(card);
            });
        }

        function toggleFavorite(name) {
            if (favorites.includes(name)) {
                favorites = favorites.filter(n => n !== name);
            } else {
                favorites.push(name);
            }
            localStorage.setItem('wacken_favs', JSON.stringify(favorites));
            render(searchInput.value);
        }

        searchInput.oninput = (e) => render(e.target.value);
        render();

    } catch (err) {
        console.error("Daten konnten nicht geladen werden:", err);
        document.getElementById('stats').innerText = "Fehler beim Laden der JSON!";
    }
}

initApp();