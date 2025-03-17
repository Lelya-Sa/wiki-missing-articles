document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("missing-articles-form");
    const articlesList = document.getElementById("articles");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const edit_lang = document.getElementById("article-language-search").value.trim();
        const refer_lang = document.getElementById("article-refer-language-search").value.trim();
        const category = document.getElementById("all-category-search").value.trim();

        if (!edit_lang || !category || !refer_lang ) {
            alert("Please select both a language and a category.");
            return;
        }

        articlesList.innerHTML = "<li>Loading missing articles...</li>";

        try {
            console.log("Submitting request: edit_lang:", edit_lang,
                        ", refer_lang", refer_lang, "category:", category);

            // Extract language code (inside parentheses)
            const languageCode = edit_lang.match(/\((.*?)\)/)?.[1];
            if (!languageCode) {
                alert("Invalid language selection. Please select a valid language.");
                return;
            }
                        // Extract language code (inside parentheses)
            const referlanguageCode = refer_lang.match(/\((.*?)\)/)?.[1];
            if (!referlanguageCode) {
                alert("Invalid language selection. Please select a valid language.");
                return;
            }

            console.log("Extracted language code in submission.js:", languageCode);

            // Fetch missing articles
            // const response = await fetch(
            //     `/get_missing_articles/${languageCode}/${encodeURIComponent(category)}/${referlanguageCode}/`);
            //
            const response = await fetch(
                `/get_articles_from_other_languages/${languageCode}/${category}/${referlanguageCode}/`);
            const data = await response.json();
            // console.log("json response:", data);

            // Clear previous results
            articlesList.innerHTML = "";

            if (data.articles && data.articles.length > 0) {
                data.articles.forEach(article => {
                    const articleLink = document.createElement("li");
                    const wikiUrl = `https://${referlanguageCode}.wikipedia.org/wiki/${encodeURIComponent(article)}`;
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
