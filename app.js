const DATA_PATH = 'festivaldata/wacken_2026_raw_bands.json';

async function init() {
    try {
        const res = await fetch(DATA_PATH);
        const bands = await res.json();

        const tbody = document.getElementById('table-body');
        const searchInput = document.getElementById('search');
        const stats = document.getElementById('stats');

        let favs = JSON.parse(localStorage.getItem('wacken_favs')) || [];

        function render(term = "") {
            tbody.innerHTML = "";
            const filtered = bands.filter(b => {
                const searchStr = `${b.name} ${b.origin} ${b.genres.join(' ')}`.toLowerCase();
                return searchStr.includes(term.toLowerCase());
            });

            stats.innerText = `${filtered.length} Bands gefunden`;

            filtered.forEach(band => {
                const isFav = favs.includes(band.name);
                const tr = document.createElement('tr');
                if (isFav) tr.className = 'is-fav';

                tr.innerHTML = `
                    <td class="fav-btn">${isFav ? '★' : '☆'}</td>
                    <td>${band.name}</td>
                    <td>🚩 ${band.origin}</td>
                    <td>${band.genres[0] || '-'}</td>
                `;

                // Favorit umschalten bei Klick auf die Zeile oder den Stern
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
        console.error("Datenfehler:", e);
        stats.innerText = "Fehler beim Laden!";
    }
}

init();