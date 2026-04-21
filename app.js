const DATA_PATH = 'festivaldata/wacken_2026_raw_bands.json';

// Der countryCodes Block ist hier jetzt entfernt!

async function init() {
    try {
        const res = await fetch(DATA_PATH);
        const bands = await res.json();

        const tbody = document.getElementById('table-body');
        const searchInput = document.getElementById('search');

        let favs = JSON.parse(localStorage.getItem('wacken_favs')) || [];

        function render(term = "") {
            tbody.innerHTML = "";
            const filtered = bands.filter(b => {
                const searchStr = `${b.name} ${b.origin} ${b.genres.join(' ')}`.toLowerCase();
                return searchStr.includes(term.toLowerCase());
            });

            filtered.forEach(band => {
                const isFav = favs.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.className = 'is-fav';

                // Greift direkt auf countryCodes aus countries.js zu
                const countryLower = band.origin.toLowerCase();
                const iso = countryCodes[countryLower] || null;

                const flagHtml = iso ?
                    `<img src="https://flagcdn.com/w40/${iso}.png" width="22" alt="${band.origin}" style="margin-right: 10px; border-radius: 2px;">` :
                    "🏳️ ";

                tr.innerHTML = `
                    <td class="fav-btn">${isFav ? '★' : '☆'}</td>
                    <td>${band.name}</td>
                    <td class="origin-cell">${flagHtml} <span>${band.origin}</span></td>
                    <td>${band.genres[0] || '-'}</td>
                `;

                tr.onclick = () => {
                    toggleFav(band.name);
                    render(searchInput.value);
                };
                tbody.appendChild(tr);
            });
        }

        function toggleFav(name) {
            favs = favs.includes(name) ? favs.filter(n => n !== name) : [...favs, name];
            localStorage.setItem('wacken_favs', JSON.stringify(favs));
        }

        searchInput.oninput = (e) => render(e.target.value);
        render();

    } catch (e) {
        console.error("Fehler:", e);
    }
}

init();