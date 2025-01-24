document.addEventListener("DOMContentLoaded", () => {
    const languageSearchButton = document.getElementById("language-search-button");
    const languageSelector = document.getElementById("language-selector");
    const languageSearch = document.getElementById("language-search");
    const languageList = document.getElementById("language-list");

    let languages = [];

    // Toggle visibility of the language selector
    languageSearchButton.addEventListener("click", () => {
        languageSelector.style.display =
            languageSelector.style.display === "none" || !languageSelector.style.display
                ? "block"
                : "none";
    });

    // Fetch supported languages from the backend
    async function fetchLanguages() {
        try {
            const response = await fetch('/api/supported_languages/');
            if (!response.ok) {
                throw new Error("Failed to fetch languages");
            }
            const data = await response.json();
            languages = data.languages;
        } catch (error) {
            console.error("Error fetching languages:", error);
        }
    }

    // Populate suggestions based on search input
    languageSearch.addEventListener("input", () => {
        const query = languageSearch.value.toLowerCase();
        const filteredLanguages = languages.filter(lang =>
            lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)
        );

        // Clear previous suggestions
        languageList.innerHTML = "";

        // Add new suggestions
        filteredLanguages.forEach(lang => {
            const listItem = document.createElement("li");
            listItem.textContent = `${lang.name} (${lang.code})`;
            listItem.dataset.langCode = lang.code;

            // Handle language selection
            listItem.addEventListener("click", () => {
                const selectedLanguage = lang.code;
                window.location.href = `/translated_page/?lang=${selectedLanguage}`;
            });

            languageList.appendChild(listItem);
        });

        // Show the list if there are results
        languageList.style.display = filteredLanguages.length > 0 ? "block" : "none";
    });

    // Fetch languages on page load
    fetchLanguages();
});
