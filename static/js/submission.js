document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("missing-articles-form");
    const articlesList = document.getElementById("articles");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const lang = document.getElementById("article-language-search").value.trim();
        const category = document.getElementById("all-category-search").value.trim();

        if (!lang || !category) {
            alert("Please select both a language and a category.");
            return;
        }

        articlesList.innerHTML = "<li>Loading missing articles...</li>";

        try {
            console.log("Submitting request: lang:", lang, "category:", category);

            // Extract language code (inside parentheses)
            const languageCode = lang.match(/\((.*?)\)/)?.[1];
            if (!languageCode) {
                alert("Invalid language selection. Please select a valid language.");
                return;
            }

            console.log("Extracted language code:", languageCode);

            // Fetch missing articles
            const response = await fetch(`/get_missing_articles/${languageCode}/${encodeURIComponent(category)}`);
            const data = await response.json();

            // Clear previous results
            articlesList.innerHTML = "";

            if (data.articles && data.articles.length > 0) {
                data.articles.forEach(article => {
                    const articleLink = document.createElement("li");
                    const wikiUrl = `https://${languageCode}.wikipedia.org/wiki/${encodeURIComponent(article)}`;
                    articleLink.innerHTML = `<a href="${wikiUrl}" target="_blank">${article}</a>`;
                    articlesList.appendChild(articleLink);
                });
            } else {
                articlesList.innerHTML = "<li>No missing articles found.</li>";
            }
        } catch (error) {
            console.error("Error fetching articles:", error);
            articlesList.innerHTML = "<li>Error loading missing articles. Please try again later.</li>";
        }
    });
});
