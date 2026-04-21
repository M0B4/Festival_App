async function loadBands() {
    const response = await fetch('raw_bands.json');
    const bands = await response.json();
    const grid = document.getElementById('band-grid');
    const searchInput = document.getElementById('search');

    function displayBands(filter = "") {
        grid.innerHTML = "";
        const filtered = bands.filter(b =>
            b.name.toLowerCase().includes(filter.toLowerCase())
        );

        filtered.forEach(band => {
            const card = document.createElement('div');
            card.className = 'band-card';
            card.innerHTML = `
                <span class="band-name">${band.name}</span>
                <span class="origin">🚩 ${band.origin}</span>
                <div class="genre-tag">${band.genres[0] || 'Metal'}</div>
            `;
            grid.appendChild(card);
        });
    }

    searchInput.addEventListener('input', (e) => displayBands(e.target.value));
    displayBands();
}

loadBands();