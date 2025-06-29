document.addEventListener("DOMContentLoaded", () => {
    const articleLanguageSearchInput = document.getElementById("article-language-search");
    const articleLanguageList = document.getElementById("article-language-list");
    const selectedLanguageInput = document.getElementById("article-language-search");
    let languages = [];
    const articleReferLanguageSearchInput = document.getElementById("article-refer-language-search");
    const articleReferLanguageList = document.getElementById("article-refer-language-list");
    const selectedReferLanguageInput = document.getElementById("article-refer-language-search");

    const allCategorySearchInput = document.getElementById("all-category-search");
    const selectedAllCategorySearchInput = document.getElementById("all-category-search");
    const allCategoryList = document.getElementById("all-category-list");
    const all_cat_spinner = document.getElementById("all-category-spinner");
    const all_cat_feedbackMessage = document.getElementById("all-cat-feedback-message");

    let allCategories = []; // Store fetched categories
    let isFetching = false; // Prevent multiple fetches

    let debounceTimer;
    // Debounce function to prevent excessive API calls
    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func(...args), delay);
        };
    }

    const submitButton = document.querySelector("button[type='submit']");
    submitButton.disabled = true;

    function checkInputs() {
        if(selectedLanguageInput.value.trim() !== ""
            && selectedReferLanguageInput.value.trim() !== ""
            && selectedAllCategorySearchInput.value.trim() !== ""
        ) {
            submitButton.disabled = false;
        } else {
            submitButton.disabled = true;
        }
    }

    selectedLanguageInput.addEventListener("input", checkInputs);
    selectedReferLanguageInput.addEventListener("input", checkInputs);
    selectedAllCategorySearchInput.addEventListener("input", checkInputs);

    allCategoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";

    // Fetch languages
    async function fetchLanguages() {
        articleLanguageList.innerHTML = "<li>Loading languages...</li>";

        try {
            const response = await fetch("/api/supported_languages/");
            if (!response.ok) throw new Error("Failed to fetch languages");
            const data = await response.json();
            languages = data.languages;

            populateLanguageList(""); // Populate list initially
        } catch (error) {
            articleLanguageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
            console.error("Error fetching languages:", error);
        }
    }
    async function fetchReferLanguages() {
        articleReferLanguageList.innerHTML = "<li>Loading languages...</li>";
        try {
            const response = await fetch("/api/supported_languages/");
            if (!response.ok) throw new Error("Failed to fetch languages");
            const data = await response.json();
            languages = data.languages;

            populateReferLanguageList(""); // Populate list initially
        } catch (error) {
            articleReferLanguageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
            console.error("Error fetching languages:", error);
        }
    }

    // Populate language dropdown
    function populateLanguageList(query = "") {
        const normalizedQuery = query.toLowerCase();

        const filteredLanguages =
            query ?
                languages.filter((lang) =>
                        (lang.name && lang.name.toLowerCase().includes(normalizedQuery)) ||
                        (lang.native_name && lang.native_name.toLowerCase().includes(normalizedQuery)) ||
                    (lang.code && lang.code.toLowerCase().includes(normalizedQuery)))
            : languages
        ;

        articleLanguageList.innerHTML = ""; // Clear the list

        if (!filteredLanguages.length) {
            articleLanguageList.innerHTML = "<li>No results found</li>";
            return;
        }

        filteredLanguages.forEach((lang) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${lang.name} - ${lang.native_name ? lang.native_name : ""} (${lang.code})`;
            listItem.dataset.langCode = lang.code;
            listItem.addEventListener("click", () => {
                selectedLanguageInput.value = `${lang.name} (${lang.code})`;

                articleLanguageList.innerHTML = ""; // Clear the dropdown

                fetchAllCategories(lang.code); // Fetch all categories for selected language
            });
            articleLanguageList.appendChild(listItem);
        });
    }

    function populateReferLanguageList(query = "") {
        const normalizedQuery = query.toLowerCase();

        const filteredLanguages =
            query ?
                languages.filter((lang) =>
                        (lang.name && lang.name.toLowerCase().includes(normalizedQuery)) ||
                        (lang.native_name && lang.native_name.toLowerCase().includes(normalizedQuery)) ||
                    (lang.code && lang.code.toLowerCase().includes(normalizedQuery)))
            : languages
        ;

        articleReferLanguageList.innerHTML = ""; // Clear the list

        if (!filteredLanguages.length) {
            articleReferLanguageList.innerHTML = "<li>No results found</li>";
            return;
        }

        filteredLanguages.forEach((lang) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${lang.name} - ${lang.native_name ? lang.native_name : ""} (${lang.code})`;
            listItem.dataset.langCode = lang.code;
            listItem.addEventListener("click", () => {
                selectedReferLanguageInput.value = `${lang.name} (${lang.code})`;

                articleReferLanguageList.innerHTML = ""; // Clear the dropdown

            });
            articleReferLanguageList.appendChild(listItem);
        });
    }

    // Handle input changes for filtering, Event listener for the language input field
    articleLanguageSearchInput.addEventListener("input", () => {
        const query = articleLanguageSearchInput.value.toLowerCase();
        populateLanguageList(query);
    });

        // Handle input changes for filtering, Event listener for the language input field
    articleReferLanguageSearchInput.addEventListener("input", () => {
        const query = articleReferLanguageSearchInput.value.toLowerCase();
        populateReferLanguageList(query);
    });

    // Fetch languages on page load
    fetchLanguages();
    fetchReferLanguages();

    // Function to fetch all categories
    async function fetchAllCategories(lang, query = "") {

        if (!lang) {
            all_cat_feedbackMessage.textContent = "Please select a language first.";
            return;
        }

        if (isFetching) return;

        // Default to empty string if query is not provided
        const searchQuery = document.getElementById("all-category-search").value;

        isFetching = true;
        allCategoryList.innerHTML = "<li><img src='/static/images/spinner.gif' alt='Loading...' /></li>";
        all_cat_spinner.style.display = "inline-block";
        all_cat_feedbackMessage.textContent = "";

        try {
            const response = await fetch(`/get_categories_with_query/${lang}/${searchQuery}/`);
            const data = await response.json();

            if (data.categories) {
                allCategories = data.categories;
            } else {
                all_cat_feedbackMessage.textContent = "No categories found.";
            }
        } catch (error) {
            if (!query) {
                all_cat_feedbackMessage.textContent = "write your category.";

            }else{
                console.error("Error fetching categories:", error);
                all_cat_feedbackMessage.textContent = "Failed to load categories. Try again.";
            }
        } finally {
            all_cat_spinner.style.display = "none";
            isFetching = false;
        }
    }

    // Function to filter and display categories
    async function displayFilteredAllCategories(query) {

        allCategoryList.innerHTML = ""; // Clear previous results

        if (!query) {
            all_cat_feedbackMessage.textContent = "write your category.";
            allCategoryList.style.display = "none";
            return;
        }
        // Ensure the category data exists
        if (!allCategories.length) {
            all_cat_feedbackMessage.textContent = "No categories available.";
            return;
        }

        const filteredCategories = allCategories.filter(cat =>
            cat.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredCategories.length === 0) {
            all_cat_feedbackMessage.textContent = "No matching categories found.";
        } else {
            all_cat_feedbackMessage.textContent = "";
            filteredCategories.forEach(category => {
                const li = document.createElement("li");
                li.textContent = category;
                li.addEventListener("click", () => {
                    selectedAllCategorySearchInput.value = category;
                    allCategorySearchInput.value = category; // Set the selected category in the input
                });
                allCategoryList.appendChild(li);
            });

            allCategoryList.style.display = "block"; // Show the filtered list
        }
    }

    // Event listener with debounce for category search input
    allCategorySearchInput.addEventListener("input", debounce((e) => {
        const query = e.target.value.trim();
        const selectedLanguage = document.getElementById("article-language-search").value;
        const languageCode = selectedLanguage.match(/\((.*)\)/)?.[1]; // Extract language code

        const selectedReferLanguage = document.getElementById("article-refer-language-search").value;
        const referLanguageCode = selectedReferLanguage.match(/\((.*)\)/)?.[1]; // Extract language code

        if (!languageCode) {
            all_cat_feedbackMessage.textContent = "Please select a language first.";
            allCategoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
            return;
        }
        if (languageCode === referLanguageCode) {
            all_cat_feedbackMessage.textContent = "The selected languages are the same!";
            allCategoryList.innerHTML = "<li style='color: red;'> </li>";
            return;
        }

        fetchAllCategories(languageCode, query).then(() => {displayFilteredAllCategories(query);    });
    }, 300)); // Debounce delay of 500ms

});
