const DATA_PATH = 'festivaldata/wacken_2026_raw_bands.json';

async function initApp() {
    try {
        const response = await fetch(DATA_PATH);
        const bands = await response.json();

        const tbody = document.getElementById('table-body');
        const searchInput = document.getElementById('search');
        const stats = document.getElementById('stats');

        let favorites = JSON.parse(localStorage.getItem('wacken_2026_favs')) || [];

        function renderTable(filterTerm = "") {
            tbody.innerHTML = "";

            const filteredBands = bands.filter(band => {
                const searchPool = `${band.name} ${band.origin} ${band.genres.join(' ')}`.toLowerCase();
                return searchPool.includes(filterTerm.toLowerCase());
            });

            stats.innerText = `${filteredBands.length} Bands im Lineup`;

            filteredBands.forEach(band => {
                const isFav = favorites.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.classList.add('is-fav');

                // Flaggen-Logik aus countries.js
                const countryLower = band.origin.toLowerCase();
                const isoCode = countryCodes[countryLower] || null;
                const flagHtml = isoCode ?
                    `<img src="https://flagcdn.com/w40/${isoCode}.png" class="flag-icon" width="20" alt="${band.origin}">` :
                    `<span class="flag-icon">🏳️</span>`;

                tr.innerHTML = `
                    <td class="col-fav">
                        <span class="fav-star ${isFav ? '' : 'dimmed-star'}">${isFav ? '★' : '☆'}</span>
                    </td>
                    <td class="col-band">
                        ${flagHtml}
                        <span>${band.name}</span>
                    </td>
                    <td class="col-genre">${band.genres[0] || '-'}</td>
                `;

                tr.onclick = () => toggleFavorite(band.name);
                tbody.appendChild(tr);
            });
        }

        function toggleFavorite(bandName) {
            if (favorites.includes(bandName)) {
                favorites = favorites.filter(name => name !== bandName);
            } else {
                favorites.push(bandName);
            }
            localStorage.setItem('wacken_2026_favs', JSON.stringify(favorites));
            renderTable(searchInput.value);
        }

        searchInput.addEventListener('input', (e) => renderTable(e.target.value));

        // Initialer Render
        renderTable();

    } catch (error) {
        console.error("Fehler beim Laden der Daten:", error);
        document.getElementById('stats').innerText = "Daten konnten nicht geladen werden!";
    }
}

initApp();