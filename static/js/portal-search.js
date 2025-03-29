document.addEventListener("DOMContentLoaded", () => {
    const articleLanguageSearchInput = document.getElementById("article-language-search");
    const articleLanguageList = document.getElementById("article-language-list");
    const selectedLanguageInput = document.getElementById("article-language-search");
    let languages = [];
    const articleReferLanguageSearchInput = document.getElementById("article-refer-language-search");
    const articleReferLanguageList = document.getElementById("article-refer-language-list");
    const selectedReferLanguageInput = document.getElementById("article-refer-language-search");

    const allPortalSearchInput = document.getElementById("all-portal-search");
    const selectedAllPortalSearchInput = document.getElementById("all-portal-search");
    const allPortalList = document.getElementById("all-portal-list");
    const all_portal_spinner = document.getElementById("all-portal-spinner");
    const all_portal_feedbackMessage = document.getElementById("all-portal-feedback-message");

    let allPortal = []; // Store fetched categories
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
            && selectedAllPortalSearchInput.value.trim() !== ""
        ) {
            submitButton.disabled = false;
        } else {
            submitButton.disabled = true;
        }
    }

    selectedLanguageInput.addEventListener("input", checkInputs);
    selectedReferLanguageInput.addEventListener("input", checkInputs);
    selectedAllPortalSearchInput.addEventListener("input", checkInputs);


    // categoryList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";
    allPortalList.innerHTML = "<li style='color: red;'>Please select a language first.</li>";

    // Fetch languages
    async function fetchLanguages() {
        articleLanguageList.innerHTML = "<li>Loading languages...</li>";
        articleReferLanguageList.innerHTML = "<li>Loading languages...</li>";

        try {
            const response = await fetch("/api/supported_languages/");
            if (!response.ok) throw new Error("Failed to fetch languages");
            const data = await response.json();
            languages = data.languages;

            populateLanguageList(""); // Populate list initially
        } catch (error) {
            articleLanguageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
            articleReferLanguageList.innerHTML = "<li style='color: red;'>Failed to load languages.</li>";
            console.error("Error fetching languages:", error);
        }
    }

    // Populate language dropdown
    function populateLanguageList(query = "") {
        const filteredLanguages = languages.filter((lang) =>
            lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)
        );

        articleLanguageList.innerHTML = ""; // Clear the list
        articleReferLanguageList.innerHTML = ""; // Clear the list

        if (!filteredLanguages.length) {
            articleLanguageList.innerHTML = "<li>No results found</li>";
            articleReferLanguageList.innerHTML = "<li>No results found</li>";
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
                fetchAllCategories(lang.code); // Fetch all categories for selected language
            });
            articleLanguageList.appendChild(listItem);

        });
        filteredLanguages.forEach((lang) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${lang.name} (${lang.code})`;
            listItem.dataset.langCode = lang.code;
            listItem.addEventListener("click", () => {
                selectedReferLanguageInput.value = `${lang.name} (${lang.code})`;

                articleReferLanguageList.innerHTML = ""; // Clear the dropdown

                console.log("in populateReferLanguages: ", lang.code);

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
        populateLanguageList(query);
    });

    // Fetch languages on page load
    fetchLanguages();

    async function fetchPortals(languageCode, query = "") {
        portalList.innerHTML = "<li><img src='/static/images/spinner.gif' alt='Loading...' /></li>";

        if (!languageCode) return;

        portalList.innerHTML = "<li>Loading portals...</li>"; // Show loading state

        try {
            const response = await fetch(`/get_portals/${languageCode}?query=${query}`);
            if (!response.ok) throw new Error("Failed to fetch portals");

            const data = await response.json();
            populatePortalList(data.portals); // Populate fetched portals
        } catch (error) {
            console.error("Error fetching portals:", error);
            portalList.innerHTML = "<li style='color: red;'>Failed to load portals</li>";
        }
    }

    // Populate portal list with suggestions
    function populatePortalList(portals) {
        portalList.innerHTML = ""; // Clear previous suggestions

        if (!portals || !portals.length) {
            portalList.innerHTML = "<li>No portals available</li>";
            return;
        }

        portals.forEach((portal) => {
            const listItem = document.createElement("li");
            listItem.textContent = portal.title;
            listItem.dataset.pageid = portal.pageid;

            listItem.addEventListener("click", () => {

                portalSearchInput.value = portal.title; // Set selected portal
                portalList.innerHTML = ""; // Clear dropdown
                console.log(`Selected portal: ${portal.title} (Page ID: ${portal.pageid})`);
            });

            portalList.appendChild(listItem);
        });
    }


    // Event listener with debounce for category search input
    allPortalSearchInput.addEventListener("input", debounce((e) => {

        const query = allPortalSearchInput.value.toLowerCase();
        const selectedLanguage = document.getElementById("article-language-search").value;

        if (selectedLanguage) {
            const languageCode = selectedLanguage.match(/\((.*)\)/)?.[1]; // Extract language code
            fetchPortals(languageCode, query); // Fetch portals for the language and query
        } else {
            portalList.innerHTML = "<li style='color: red;'>Please select a language first</li>";
        }
        }, 300)); // Debounce delay of 500ms


});
