document.addEventListener("DOMContentLoaded", () => {
  const languageSearchButton = document.getElementById("language-search-button");
  const languageSelector = document.getElementById("language-selector");
  const languageSearch = document.getElementById("language-search");
  const languageList = document.getElementById("language-list");

  let languages = [];
  let isLoading = true;


  function changeLanguage(langCode) {
    // Redirect to the translated view with ?lang=xx
    const next = window.location.pathname;
    window.location.href = `/translated_page/?lang=${langCode}&next=${next}`;
  }

  function showLoading() {
    languageList.innerHTML = ""; 
    const loadingItem = document.createElement("li");
    loadingItem.textContent = "Loading languages...";
    loadingItem.style.color = "#555";
    languageList.appendChild(loadingItem);
  }

  async function fetchUpperLanguages() {
    showLoading(); 
    try {
      // 1️⃣ Fetch the available codes from translatedpaget
      const translatedResponse = await fetch("/get_page_translation_supported_languages");
      if (!translatedResponse.ok) throw new Error("Failed to fetch translated page languages");
      const translatedData = await translatedResponse.json(); // flat object { code: name }
      availableCodes = translatedData;

      // 2️⃣ Fetch full languages with native names
      const response = await fetch("/api/supported_languages/");
      if (!response.ok) throw new Error("Failed to fetch supported languages");
      const data = await response.json(); // { languages: [ { code, name, native_name } ] }

      // Filter only codes that exist in translatedData
      languages = data.languages
        .filter(lang => lang.code in availableCodes)
        .map(lang => ({
          code: lang.code,
          name: availableCodes[lang.code], // use the name from translatedpaget
          native_name: lang.native_name || ""
        }));

    } catch (error) {
      console.error("Error fetching languages:", error);
      languageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
    } finally {
      isLoading = false;
      populateLanguages(); 
    }
  }

async function populateLanguages(query = "") {
    const currentLang = document.documentElement.lang; // current <html lang="...">
    const normalizedQuery = query.toLowerCase();

    let languageList = document.getElementById("language-list");
    languageList.innerHTML = ""; // clear previous list

   const filteredLanguages = query
      ? languages.filter(lang =>
          (lang.name && lang.name.toLowerCase().includes(normalizedQuery)) ||
          (lang.native_name && lang.native_name.toLowerCase().includes(normalizedQuery)) ||
          (lang.code && lang.code.toLowerCase().includes(normalizedQuery))
        )
      : languages;

    if (filteredLanguages.length === 0) {
      const noResults = document.createElement("li");
      noResults.textContent = "No results found.";
      noResults.style.color = "#555";
      languageList.appendChild(noResults);
      return;
    }

    filteredLanguages.forEach(lang => {
      const li = document.createElement("li");
      li.textContent = `${lang.name} - ${lang.native_name} (${lang.code})`;
      li.dataset.langCode = lang.code;
      if (lang.code === currentLang) {
        li.style.fontWeight = "bold";
        li.style.color = "#3366cb";
        li.title = "Currently selected";
      }
      li.onclick = () => changeLanguage(lang.code);
      languageList.appendChild(li);
    });
  }


  // Toggle dropdown visibility
languageSearchButton.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent document click from triggering
  const isActive = languageSelector.classList.contains("active");

  if (!isActive) {
    // Show the dropdown
    languageSelector.classList.add("active");
    if (isLoading) showLoading(); // Show "Loading..." if still loading
    else populateLanguages(); // Populate the list with all languages if loaded
    languageSearch.focus(); // Focus the search bar
    languageList.style.display = "block";  // Make sure the list is visible
  } else {
    // Hide the dropdown
    languageSelector.classList.remove("active");
  }
});

  // Handle search input
  languageSearch.addEventListener("input", () => {
    const query = languageSearch.value.trim().toLowerCase();
    populateLanguages(query);
    languageList.style.display = "block"; // Ensure list is visible
  });

  // Keep dropdown open when interacting with the input or list
  languageSelector.addEventListener("click", (e) => e.stopPropagation());

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    languageSelector.classList.remove("active");
  });

  // Fetch languages on load
  fetchUpperLanguages();
});
