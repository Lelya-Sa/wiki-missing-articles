document.addEventListener("DOMContentLoaded", () => {
    const articleLanguageSearchInput = document.getElementById("article-language-search");
    const articleLanguageList = document.getElementById("article-language-list");
    const selectedLanguageInput = document.getElementById("article-language-search");
    let languages = [];

    const categorySelector = document.getElementById("category-selector-class");
    const categorySearchInput = document.getElementById("category-search");
    const categoryList = document.getElementById("category-list");
    const selectedCategoryInput = document.getElementById("category-search");
    const spinner = document.getElementById("category-spinner");
    let categories = []; // Store fetched categories
    const feedbackMessage = document.getElementById("feedback-message");

    // const categoryDropdown = document.getElementById("category");
    const theSelectedLang = document.getElementById("the_selected_lang");
    const responseData = document.getElementById("response_data");

    const allCategorySearchInput = document.getElementById("all-category-search");
    const selectedAllCategorySearchInput = document.getElementById("all-category-search");
    const allCategoryList = document.getElementById("all-category-list");
    const all_cat_spinner = document.getElementById("category-spinner");
    const all_cat_feedbackMessage = document.getElementById("all-cat-feedback-message");

    let allCategories = []; // Store fetched categories
    let isFetching = false; // Prevent multiple fetches


    const submitButton = document.querySelector("button[type='submit']");
    submitButton.disabled = true;
    function checkInputs() {
        if(selectedLanguageInput.value.trim() !== "" && selectedAllCategorySearchInput.value.trim() !== "") {
            submitButton.disabled = false;
        } else {
            submitButton.disabled = true;
        }
    }

    selectedLanguageInput.addEventListener("input", checkInputs);
    selectedAllCategorySearchInput.addEventListener("input", checkInputs);


    categoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
    allCategoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
    // all_cat_feedbackMessage.textContent = "Please select a language first.";

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
                console.log("in populateLanguages: ", lang.code);
                fetchCategories(lang.code);
                fetchAllCategories(lang.code); // Fetch all categories for selected language
            });
            articleLanguageList.appendChild(listItem);
        });
    }

    async function fetchCategories(languageCode, query = "") {
        categoryList.innerHTML = "<li><img src='/static/images/spinner.gif' alt='Loading...' /></li>";
        spinner.style.display = "inline-block";
        feedbackMessage.textContent = "";
        if (!languageCode) return;

        try {
            // const response = await fetch(`/get_categories/${languageCode}/?query=${query}`);
            const response = await fetch(`/get_categories/${languageCode}/`);
            if (!response.ok) throw new Error("Failed to fetch categories.");

            const data = await response.json();
            console.log("Fetched categories:", data);

            if (data.categories) {
                // Extract only the titles
                categories = data.categories.map(cat => cat.title);
                console.log("Categories array:", categories);
                populateCategoryList(categories);
            } else {
                feedbackMessage.textContent = "No categories found for this language.";
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
            feedbackMessage.textContent = "Failed to load categories. Try again.";
        } finally {
            spinner.style.display = "none";
        }
    }

    function populateCategoryList(categories) {
        categoryList.innerHTML = "";

        if (!categories.length) {
            categoryList.innerHTML = "<li>No categories available</li>";
            return;
        }

        categories.forEach(category => {
            // console.log(category.title);

            console.log("in populateCategoryList",category) ;

            const listItem = document.createElement("li");
            listItem.textContent = category;
            listItem.addEventListener("click", () => {
                selectedCategoryInput.value = category;
                categorySearchInput.value = category;
                categoryList.innerHTML = "";
            });
            categoryList.appendChild(listItem);
        });
    }

    // Category input listener
    categorySearchInput.addEventListener("input", () => {
        const query = categorySearchInput.value.toLowerCase();
        const selectedLanguage = document.getElementById("article-language-search").value;
        const languageCode = selectedLanguage.match(/\((.*)\)/)?.[1];

        if (languageCode) {
            fetchCategories(languageCode, query);
        } else {
            categoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
        }
    });

    // Handle input changes for filtering, Event listener for the language input field
    articleLanguageSearchInput.addEventListener("input", () => {
        const query = articleLanguageSearchInput.value.toLowerCase();
        populateLanguageList(query);
    });

    // Fetch languages on page load
    fetchLanguages();
    // Fetch categories when the page loads
    // fetchCategories();


    // Function to fetch all categories
    async function fetchAllCategories(lang, query = "") {
        if (!lang) {
            all_cat_feedbackMessage.textContent = "Please select a language first.";
            return;
        }
        if (isFetching) return;
        console.log("in fetch all categories: the selectedinput:", selectedAllCategorySearchInput);
        // Default to empty string if query is not provided
        const searchQuery = document.getElementById("all-category-search").value;
        console.log("in fetch all categories: searchQuery:", searchQuery);

        isFetching = true;
        all_cat_spinner.style.display = "inline-block";
        all_cat_feedbackMessage.textContent = "";

        try {
            const response = await fetch(`/get_categories_with_query/${lang}/${searchQuery}/`);
            const data = await response.json();
            console.log("allCat response:", data);
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
    function displayFilteredAllCategories(query) {
        console.log("All Cat Search query:", query);

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
        console.log("All Cat filteredCategories:", filteredCategories);

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
                    // allCategoryList.style.display = "none"; // Hide the list
                });
                allCategoryList.appendChild(li);
            });

            allCategoryList.style.display = "block"; // Show the filtered list
        }
    }

    // Event listener for input field
    allCategorySearchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        const selectedLanguage = document.getElementById("article-language-search").value;
        const languageCode = selectedLanguage.match(/\((.*)\)/)?.[1]; // Extract language code
        if (selectedLanguage) {
            fetchAllCategories(languageCode, query); // Pass the correct language code and query
        } else {
            all_cat_feedbackMessage.textContent = "Please select a language first.";
            allCategoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
        }


        displayFilteredAllCategories(query);
    });

    // Fetch all categories on page load (for example, English language)
    // fetchAllCategories("en");
});

// document.addEventListener("DOMContentLoaded", () => {
//     const portalSearchInput = document.getElementById("portal-search");
//     const portalList = document.getElementById("portal-list");
//     const portalSelector = document.getElementById("portal-selector-class");
//     console.log(window.getComputedStyle(portalSelector).display);
//     portalList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
//
//     // Fetch portals
//     async function fetchPortals(languageCode, query = "") {
//         portalList.innerHTML = "<li><img src='/static/images/spinner.gif' alt='Loading...' /></li>";
//
//         if (!languageCode) return;
//
//         portalList.innerHTML = "<li>Loading portals...</li>"; // Show loading state
//
//         try {
//             const response = await fetch(`/get_portals/${languageCode}?query=${query}`);
//             if (!response.ok) throw new Error("Failed to fetch portals");
//
//             const data = await response.json();
//             populatePortalList(data.portals); // Populate fetched portals
//         } catch (error) {
//             console.error("Error fetching portals:", error);
//             portalList.innerHTML = "<li style='color: red;'>Failed to load portals</li>";
//         }
//     }
//
//     // Populate portal list with suggestions
//     function populatePortalList(portals) {
//         portalList.innerHTML = ""; // Clear previous suggestions
//
//         if (!portals || !portals.length) {
//             portalList.innerHTML = "<li>No portals available</li>";
//             return;
//         }
//
//         portals.forEach((portal) => {
//             const listItem = document.createElement("li");
//             listItem.textContent = portal.title;
//             listItem.dataset.pageid = portal.pageid;
//
//             listItem.addEventListener("click", () => {
//
//                 portalSearchInput.value = portal.title; // Set selected portal
//                 portalList.innerHTML = ""; // Clear dropdown
//                 console.log(`Selected portal: ${portal.title} (Page ID: ${portal.pageid})`);
//             });
//
//             portalList.appendChild(listItem);
//         });
//     }
//
//     // Handle user input for portal search
//     portalSearchInput.addEventListener("input", () => {
//         const query = portalSearchInput.value.toLowerCase();
//         const selectedLanguage = document.getElementById("article-language-search").value;
//
//         if (selectedLanguage) {
//             const languageCode = selectedLanguage.match(/\((.*)\)/)?.[1]; // Extract language code
//             fetchPortals(languageCode, query); // Fetch portals for the language and query
//         } else {
//             portalList.innerHTML = "<li style='color: red;'>Please select a language first</li>";
//         }
//     });
// });
