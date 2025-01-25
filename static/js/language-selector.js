document.addEventListener("DOMContentLoaded", () => {
  const languageSearchButton = document.getElementById("language-search-button");
  const languageSelector = document.getElementById("language-selector");
  const languageSearch = document.getElementById("language-search");
  const languageList = document.getElementById("language-list");

  let languages = [];
  let isLoading = true; // Track loading state

  // Display "Loading..." feedback in the language list
  function showLoading() {
    languageList.innerHTML = ""; // Clear the list
    const loadingItem = document.createElement("li");
    loadingItem.textContent = "Loading languages...";
    loadingItem.style.color = "#555";
    languageList.appendChild(loadingItem);
  }

  // Hide "Loading..." and populate the language list
  async function fetchLanguages() {
    showLoading(); // Show loading message
    try {
      const response = await fetch("/api/supported_languages/");
      if (!response.ok) throw new Error("Failed to fetch languages");
      const data = await response.json();
      languages = data.languages;
    } catch (error) {
      console.error("Error fetching languages:", error);
      languageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
    } finally {
      isLoading = false;
      populateLanguages(); // Populate with all languages once fetched
    }
  }

  // Populate the language list based on search query
  function populateLanguages(query = "") {
    const filteredLanguages = query
      ? languages.filter((lang) =>
          lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)
        )
      : languages; // If no query, show all languages

    languageList.innerHTML = ""; // Clear previous list

    if (filteredLanguages.length === 0) {
      const noResults = document.createElement("li");
      noResults.textContent = "No results found.";
      noResults.style.color = "#555";
      languageList.appendChild(noResults);
      return;
    }

    filteredLanguages.forEach((lang) => {
      const listItem = document.createElement("li");
      listItem.textContent = `${lang.name} (${lang.code})`;
      listItem.dataset.langCode = lang.code;
      listItem.addEventListener("click", () => {
        window.location.href = `/translated_page/?lang=${lang.code}`;
      });
      languageList.appendChild(listItem);
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
  fetchLanguages();
});
