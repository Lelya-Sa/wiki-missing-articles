document.addEventListener("DOMContentLoaded", () => {
  const languageSearchButton = document.getElementById("language-search-button");
  const languageSelector = document.getElementById("language-selector");
  const languageSearch = document.getElementById("language-search");
  const languageList = document.getElementById("language-list");

  let languages = [];

  // Fetch supported languages from the backend
  async function fetchLanguages() {
    try {
      const response = await fetch('/api/supported_languages/');
      if (!response.ok) throw new Error('Failed to fetch languages');
      const data = await response.json();
      languages = data.languages;
    } catch (error) {
      console.error('Error fetching languages:', error);
    }
  }

  // Populate the language list
  function populateLanguages(query = '') {
    const filteredLanguages = languages.filter(lang =>
      lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)
    );

    languageList.innerHTML = ''; // Clear the list

    if (filteredLanguages.length === 0) {
      const noResults = document.createElement('li');
      noResults.textContent = 'No results found.';
      noResults.style.color = '#555';
      languageList.appendChild(noResults);
      return;
    }

    filteredLanguages.forEach(lang => {
      const listItem = document.createElement('li');
      listItem.textContent = `${lang.name} (${lang.code})`;
      listItem.dataset.langCode = lang.code;
      listItem.addEventListener('click', () => {
        window.location.href = `/translated_page/?lang=${lang.code}`;
      });
      languageList.appendChild(listItem);
    });
  }

  // Show/Hide dropdown logic
  languageSearchButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click
    const isHidden = languageSelector.style.display === 'none' || !languageSelector.style.display;
    languageSelector.style.display = isHidden ? 'block' : 'none';
    if (isHidden) languageSearch.focus(); // Focus input
  });

  // Search functionality
  languageSearch.addEventListener('input', () => {
    const query = languageSearch.value.trim().toLowerCase();
    populateLanguages(query);
    languageList.style.display = query || languages.length ? 'block' : 'none';
  });

  // Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    const isClickInsideSelector = languageSelector.contains(e.target);
    const isClickOnButton = languageSearchButton.contains(e.target);

    if (!isClickInsideSelector && !isClickOnButton) {
        languageSelector.style.display = "none";
    }
});


  // Prevent propagation when interacting with dropdown
  languageSelector.addEventListener('click', (e) => e.stopPropagation());
    languageSearch.addEventListener("focus", () => {
        languageSelector.style.display = "block";
    });

    languageList.addEventListener("mouseenter", () => {
        languageSelector.style.display = "block";
    });

  // Fetch languages on load
  fetchLanguages();
});
