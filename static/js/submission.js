document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("missing-articles-form");
    const articlesList = document.getElementById("articles");
    const referArticlesList = document.getElementById("referArticles");
    const localReferArticlesList = []

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const edit_lang = document.getElementById("article-language-search").value.trim();
        const refer_lang = document.getElementById("article-refer-language-search").value.trim();
        const category = document.getElementById("all-category-search").value.trim();

        if (!edit_lang || !category || !refer_lang ) {
            alert("Please select both a language and a category.");
            return;
        }

        referArticlesList.innerHTML = "<li>Loading missing articles...</li>";
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
            const referLanguageCode = refer_lang.match(/\((.*?)\)/)?.[1];
            if (!referLanguageCode) {
                alert("Invalid language selection. Please select a valid language.");
                return;
            }

            console.log("Extracted language codes in submission.js:",'edit:', languageCode,
                ' , refer',referLanguageCode);

            // Fetch missing articles
            const response = await fetch(
                `/get_articles_from_other_languages/${languageCode}/${category}/${referLanguageCode}/`);
            const data = await response.json();

            // Clear previous results
            articlesList.innerHTML = "";
            referArticlesList.innerHTML= "";

            // list the articles of reference language in the selected category
            if (data.articles && data.articles.length > 0) {
                data.articles.forEach(article => {
                    const articleLink = document.createElement("li");
                    const wikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodeURIComponent(article)}`;
                    articleLink.innerHTML = `<a href="${wikiUrl}" target="_blank">${article}</a>`;
                    referArticlesList.appendChild(articleLink);
                    localReferArticlesList.push(article)
                });
            } else {
                referArticlesList.innerHTML = "<li>No missing articles found.</li>";
            }

            // Debugging
            console.log("in submission.js: localReferenceArticlesList = ",localReferArticlesList);

            // check if each page exists in edit-lage by using the MediaWiki API with the action=query
            // and prop=langlinks parameters.
            async function checkPageInLanguage(title, sourceLang, targetLang) {
                const apiUrl =
                    `https://${sourceLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=langlinks&lllang=${targetLang}&format=json&origin=*`;
                try {
                    const response = await fetch(apiUrl);
                    const data = await response.json();

                    const pageId = Object.keys(data.query.pages)[0];  // Get the page ID
                    const page = data.query.pages[pageId];

                    if (page.langlinks) {
                        return [1,page.langlinks[0]["*"]]; // page exists
                    } else {
                        return [0, `Page does NOT exist in ${targetLang}`]; // page does not exist
                    }
                } catch (error) {
                    console.error("Error checking Wikipedia page:", error);
                    return [-1,'Err'] // Error occurred
                }
            }

            // Check if each reference article exists in the edit language
            if (localReferArticlesList.length > 0) { // FIXED: Used .length
                const checkPromises = localReferArticlesList.map(async (article) => {
                    const [exists, translatedTitle] = await checkPageInLanguage(article, referLanguageCode, languageCode);

                    if (exists === 1) {
                        console.log(`Page exists in ${languageCode}:`, translatedTitle);
                    } else {
                        console.log(`Page does NOT exist in ${languageCode}:`, article);

                        const articleLink = document.createElement("li");
                        const wikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodeURIComponent(article)}`;
                        articleLink.innerHTML = `<a href="${wikiUrl}" target="_blank">${article}</a>`;
                        articlesList.appendChild(articleLink);
                    }
                });

                await Promise.all(checkPromises);
            } else {
                articlesList.innerHTML = "<li>No missing articles found.</li>";
            }

        } catch (error) {
            console.error("Error fetching articles:", error);
            referArticlesList.innerHTML = "<li>Error loading missing articles. Please try again later.</li>";
        }


        // async function checkPageExists(title, lang) {
        //     const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=info&format=json&origin=*`;
        //
        //     try {
        //         const response = await fetch(apiUrl);
        //         const data = await response.json();
        //
        //         const pageId = Object.keys(data.query.pages)[0];
        //         if (pageId !== "-1") {
        //             return `Page "${title}" exists in ${lang}.wikipedia.org`;
        //         } else {
        //             return `Page "${title}" does NOT exist in ${lang}.wikipedia.org`;
        //         }
        //     } catch (error) {
        //         console.error("Error checking Wikipedia page:", error);
        //         return "Error occurred";
        //     }
        // }

        // // Example: Check if "Terre" exists in French Wikipedia
        // checkPageExists("Terre", "fr").then(console.log);

    }

    );
});
