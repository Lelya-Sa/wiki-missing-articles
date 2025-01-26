document.addEventListener("DOMContentLoaded", () => {
    const articleLanguageSearchInput = document.getElementById("article-language-search");
    const articleLanguageList = document.getElementById("article-language-list");
    const selectedLanguageInput = document.getElementById("article-language-search");
    const categoryDropdown = document.getElementById("category");
    const theSelectedLang = document.getElementById("the_selected_lang");
    const responseData = document.getElementById("response_data");
    const populateOptions = document.getElementById("populate_options");

    let languages = [];

    // Fetch languages
    async function fetchLanguages() {
        articleLanguageList.innerHTML = "<li>Loading languages...</li>";

        try {
            const response = await fetch("/api/supported_languages/");
            if (!response.ok) throw new Error("Failed to fetch languages");
            const data = await response.json();
            languages = data.languages;

            populateLanguageList(); // Populate list initially
        } catch (error) {
            articleLanguageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
            console.error("Error fetching languages:", error);
        }
    }

    // Populate language dropdown
    function populateLanguageList(query = "") {
        const filteredLanguages = languages.filter((lang) =>
            lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)
        );

        articleLanguageList.innerHTML = ""; // Clear the list

        if (!filteredLanguages.length) {
            articleLanguageList.innerHTML = "<li>No results found</li>";
            return;
        }

        filteredLanguages.forEach((lang) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${lang.name} (${lang.code})`;
            listItem.dataset.langCode = lang.code;
            listItem.addEventListener("click", () => {
                selectedLanguageInput.value = `${lang.name} (${lang.code})`;
                articleLanguageList.innerHTML = ""; // Clear the dropdown
                fetchCategories(lang.code);
            });
            articleLanguageList.appendChild(listItem);
        });
    }

    // Fetch categories
    async function fetchCategories(languageCode) {
        if (!languageCode) return;

        theSelectedLang.innerHTML = `Selected language is ${languageCode}`;
        categoryDropdown.innerHTML = "<option>Loading categories...</option>";
        categoryDropdown.disabled = true;

        try {
            const response = await fetch(`/get_categories/${languageCode}`);
            responseData.innerHTML = `Category response is in: <a href='/get_categories/${languageCode}'>URL</a>`;
            if (!response.ok) throw new Error("Failed to fetch categories");

            const data = await response.json();
            populateCategoryDropdown(data.categories);
        } catch (error) {
            console.error("Error fetching categories:", error);
            categoryDropdown.innerHTML = "<option>Failed to load categories</option>";
        }
    }

    // Populate category dropdown
    function populateCategoryDropdown(categories) {
        categoryDropdown.innerHTML = ""; // Clear options

        if (!categories || !categories.length) {
            populateOptions.innerHTML = "No categories available.";
            categoryDropdown.innerHTML = "<option>No categories available</option>";
            categoryDropdown.disabled = true;
            return;
        }

        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category.pageid;
            option.textContent = category.title;
            categoryDropdown.appendChild(option);
        });

        categoryDropdown.disabled = false;
    }

    // Handle input changes for filtering
    articleLanguageSearchInput.addEventListener("input", () => {
        const query = articleLanguageSearchInput.value.toLowerCase();
        populateLanguageList(query);
    });

    // Fetch languages on page load
    fetchLanguages();
});
