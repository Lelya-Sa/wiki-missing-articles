document.addEventListener("DOMContentLoaded", () => {
    const articleLanguageSearchInput = document.getElementById("article-language-search");
    const articleLanguageList = document.getElementById("article-language-list");
    const selectedLanguageInput = document.getElementById("selected-language");
    const categoryDropdown = document.getElementById("category");
    const feedbackMessage = document.getElementById("feedback-message");
    const theSelectedLang = document.getElementById("the_selected_lang");
    const responseData = document.getElementById("response_data");
    const populateOptions = document.getElementById("populate_options");

    let languages = [];

    // Fetch languages
    async function fetchLanguages() {
        articleLanguageList.innerHTML = "<li>Loading languages...</li>";
        console.log("DEBUG: Fetching languages...");

        try {
            const response = await fetch("/api/supported_languages/");
            if (!response.ok) throw new Error("Failed to fetch languages");
            const data = await response.json();
            languages = data.languages;

            console.log("DEBUG: Fetched languages:", languages);
            populateLanguageList();
        } catch (error) {
            articleLanguageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
            console.error("DEBUG: Error fetching languages:", error);
        }
    }

    // Populate language dropdown
    function populateLanguageList(query = "") {
        const filteredLanguages = languages.filter((lang) =>
            lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)
        );

        console.log("DEBUG: Filtering languages with query:", query);
        articleLanguageList.innerHTML = ""; // Clear the list

        if (!filteredLanguages.length) {
            articleLanguageList.innerHTML = "<li>No results found</li>";
            console.log("DEBUG: No languages match the query.");
            return;
        }

        filteredLanguages.forEach((lang) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${lang.name} (${lang.code})`;
            listItem.dataset.langCode = lang.code;
            listItem.addEventListener("click", () => {
                console.log("DEBUG: Selected language:", lang);

                selectedLanguageInput.value = lang.code;
                articleLanguageSearchInput.value = `${lang.name} (${lang.code})`;
                articleLanguageList.innerHTML = ""; // Clear the dropdown
                fetchCategories(lang.code);
            });
            articleLanguageList.appendChild(listItem);
        });
    }

    // Fetch categories
    async function fetchCategories(languageCode) {
        if (!languageCode) return;

        console.log("DEBUG: Fetching categories for language:", languageCode);
        theSelectedLang.innerHTML = `DEBUG: Selected language is ${languageCode}`;
        categoryDropdown.innerHTML = "<option>Loading categories...</option>";
        categoryDropdown.disabled = true;

        try {
            const response = await fetch(`/get_categories/${languageCode}`);
            responseData.innerHTML = `DEBUG: Category response is in: <a href='/get_categories/${languageCode}'>URL</a>`;
            if (!response.ok) throw new Error("Failed to fetch categories");

            const data = await response.json();
            console.log("DEBUG: Fetched categories:", data.categories);
            populateCategoryDropdown(data.categories);
        } catch (error) {
            console.error("DEBUG: Error fetching categories:", error);
            categoryDropdown.innerHTML = "<option>Failed to load categories</option>";
        }
    }

    // Populate category dropdown
    function populateCategoryDropdown(categories) {
        categoryDropdown.innerHTML = ""; // Clear options
        console.log("DEBUG: Populating category dropdown...");

        if (!categories || !categories.length) {
            console.log("DEBUG: No categories available for this language.");
            populateOptions.innerHTML = "DEBUG: No categories available.";
            categoryDropdown.innerHTML = "<option>No categories available</option>";
            categoryDropdown.disabled = true;
            return;
        }

        populateOptions.innerHTML = "DEBUG: Categories found:<br>";
        categories.forEach((category) => {
            console.log("DEBUG: Adding category:", category);
            populateOptions.innerHTML += `PageID: ${category.pageid}, NS: ${category.ns}, Title: ${category.title}<br>`;

            const option = document.createElement("option");
            option.value = category.pageid; // Use the category's ID for the value
            option.textContent = category.title; // Use the category's name for display
            categoryDropdown.appendChild(option);
        });

        categoryDropdown.disabled = false;
    }

    // Handle input changes
    articleLanguageSearchInput.addEventListener("input", () => {
        const query = articleLanguageSearchInput.value.toLowerCase();
        console.log("DEBUG: Search input changed, query:", query);
        populateLanguageList(query);
    });

    // Close dropdown on outside click
    document.addEventListener("click", (event) => {
        if (!articleLanguageList.contains(event.target) && event.target !== articleLanguageSearchInput) {
            console.log("DEBUG: Click outside, closing language dropdown.");
            articleLanguageList.innerHTML = ""; // Clear the dropdown
        }
    });

    fetchLanguages(); // Initialize language fetch
});
