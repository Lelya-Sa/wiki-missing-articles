document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("missing-articles-form");
    const referArticlesList = document.getElementById("referArticles");
    const articlesList = document.getElementById("articles");
    const all_res_spinner = document.getElementById("all_res_spinner");
    const ranked_res_spinner = document.getElementById("ranked_res_spinner");

    // Define weight values
    const weights = {
        views: 0.35,
        langlinks: 0.35,
        editCount: 0.1,
        references: 0.05,
        editWars: 0.025, //TODO
        quality: 0.05,
        templates: 0.025,
        backlinksCount: 0.05,
        wikiLinksCount: 0, // TODO
        pageRank: 0, //TODO
    };

    /**
     * Normalize an array of scores using min–max normalization.
     * @param {number[]} scores - Array of scores to normalize.
     * @returns {number[]} - Normalized scores ranging from 0 to 1.
     */
    function normalizeScores(scores) {
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        // Avoid division by zero if all scores are equal.
        if (maxScore === minScore) {
            return scores.map(() => 0);
        }
        return scores.map(score => (score - minScore) / (maxScore - minScore));
    }

    /** check if each page exists in edit-lage by using the MediaWiki API with the action=query
     and prop=langlinks parameters.
     for example if we asked this : https://ar.wikipedia.org/w/api.php?action=query&titles=%D8%B5%D8%AD%D8%A9&prop=langlinks&format=json&origin=*
     we will get:
     {
     "continue": {
     "llcontinue": "1846|bcl",
     "continue": "||"
     },
     "query": {
        "pages": {
            "1846": {
                 "pageid": 1846,
                 "ns": 0,
                 "title": "صحة",
                 "langlinks": [
                         {
                         "lang": "af",
                         "*": "Gesondheid"
                         },
                     {
                     "lang": "als",
                     "*": "Gesundheit"
                      },
                      {
                        "lang": "am",
                        "*": "ትምህርተ፡ጤና"
                      },
                      {
                        "lang": "an",
                        "*": "Salut"
                      },
                      {
                        "lang": "as",
                        "*": "স্বাস্থ্য"
                      },
                      {
                        "lang": "ast",
                        "*": "Salú"
                      },
                      {
                        "lang": "az",
                        "*": "Sağlamlıq"
                      },
                      {
                        "lang": "azb",
                        "*": "ساغلاملیق"
                      },
                      {
                        "lang": "ba",
                        "*": "Һаулыҡ"
                      },
                      {
                        "lang": "bat-smg",
                        "*": "Svēkata"
                      }
                    ]
                  }
                }
              }
            }
             **/
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

    async function fetchAllBacklinks(title, lang = 'en') {
        const baseUrl = `https://${lang}.wikipedia.org/w/api.php`;
        let backlinks = [];
        let continueToken = null;

        do {
            let url = `${baseUrl}?action=query&list=backlinks&bltitle=${encodeURIComponent(title)}&bllimit=max&format=json&origin=*`;
            if (continueToken) {
                url += `&blcontinue=${encodeURIComponent(continueToken)}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.query && data.query.backlinks) {
                backlinks = backlinks.concat(data.query.backlinks);
            }

            // Check if there's a continuation token.
            continueToken = data.continue ? data.continue.blcontinue : null;
        } while (continueToken);
        return backlinks;
    }

    // Function to fetch metadata for ranking
    async function getArticleMetadata(title, lang) {
        // TODO check each one by using a relevant function that insures fetching all
        //  the data using continue.
        // for example: functions like: getviews(), getrivisions, getlanglinks(), gettemplate(),
        const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=info|pageviews|revisions|langlinks|templates&rvprop=ids|user|content&rvlimit=50&rvslots=main&format=json&origin=*`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            const pageId = Object.keys(data.query.pages)[0];

            if (pageId === "-1") {
                return null;
            }

            const page = data.query.pages[pageId];

            // Count <ref> tags to estimate references
            const revisionContent = page.revisions?.[0]["*"] || "";
            const referenceCount = (revisionContent.match(/<ref>/g) || []).length;

            // Dispute detection (edit wars): Count frequent edits by same users
            const editUsers = page.revisions?.map(rev => rev.user) || [];
            const userEditCounts = editUsers.reduce((acc, user) => {
                acc[user] = (acc[user] || 0) + 1;
                return acc;
                }, {});
            const maxEditsByOneUser = Math.max(...Object.values(userEditCounts), 0);

            // Check for quality-related WikiProject templates
            const qualityIndicators = page.templates ? page.templates.length : 0;


            // fetching backlinks
            let backlinks = {};
            let backlinksCount = 0;
            try{
                fetchAllBacklinks(title, lang).then(thebacklinks => {
                    backlinks = thebacklinks;
                    console.log("Total backlinks fetched:", backlinks.length);
                    console.log(backlinks);
                })
                backlinksCount = backlinks.length;
            }
            catch(error) {
                console.error("Error fetching backlinks:", error);
                // backlinksCount = 0;
            }

            return {
                title: title,
                views: page.pageviews ? Object.values(page.pageviews).reduce((a, b) => a + (b || 0), 0) : 0,
                langlinks: page.langlinks ? page.langlinks.length : 0,
                editCount: page.revisions ? page.revisions.length : 0,
                firstEdit: page.revisions ? page.revisions[page.revisions.length - 1].revid : null,
                references: referenceCount,
                editWars: maxEditsByOneUser,
                quality: qualityIndicators,
                templates: page.templates ? page.templates.length : 0,
                backlinks: backlinks,
                backlinksCount: backlinksCount,
                pageRank: 0,
            };
        } catch (error) {
            console.error("Error fetching article metadata:", error);
            return null;
        }
    }

    // Function to compute ranking score
    function computeRankingScore(metadata, weights) {
        return (
            metadata.normViews * weights.views +
            metadata.normLanglinks * weights.langlinks +
            metadata.normEditCount * weights.editCount +
            metadata.normReferences * weights.references +
            metadata.normEditWars * weights.editWars +
            metadata.normQuality * weights.quality +
            metadata.normTemplates * weights.templates +
            metadata.normBacklinksCount * weights.backlinksCount +
            metadata.pageRank * weights.pageRank
        );
    }

    function computePageRank(articlesData, articlesBacklinksData, articlesLinksData){
        // edge data
        const linksData = {
            // article title : [titles of articles it links to]
            "ArticleA": ["ArticleB", "ArticleC"],
            "ArticleB": ["ArticleC"],
            "ArticleC": ["ArticleA"]
        };

        const backlinksData = {
            // article title : [titles of articles that link to it]
            "ArticleA": ["ArticleC"],
            "ArticleB": ["ArticleA"],
            "ArticleC": ["ArticleA", "ArticleB"]
        };

        // Create a mapping from article title to index
        const indexMap = {};
        articlesData.forEach((title, idx) => { indexMap[title] = idx; });

        // Build the graph: For each article, combine its outgoing links and backlinks
        const N = articlesData.length;
        // Using an array of sets for unique outgoing edges
        const graph = Array.from({ length: N }, () => new Set());

        // Helper: add edge if both nodes are in our dataset
        function addEdge(from, to) {
            if (indexMap.hasOwnProperty(from) && indexMap.hasOwnProperty(to)) {
                graph[indexMap[from]].add(indexMap[to]);
            }
        }

        // Process outgoing links (linksData)
        for (let [article, outLinks] of Object.entries(linksData)) {
            outLinks.forEach(target => addEdge(article, target));
        }

        // Process backlinks (backlinksData)
        for (let [article, inLinks] of Object.entries(backlinksData)) {
            // For each backlink, create an edge from the linking article to this article.
            inLinks.forEach(source => addEdge(source, article));
        }

        // Convert graph sets to arrays for easier processing
        const adjacencyList = graph.map(neighbors => Array.from(neighbors));

        // Compute outdegree for each node
        const outDegrees = adjacencyList.map(neighbors => neighbors.length);

        // PageRank's computation using power iteration
        const dampingFactor = 0.85;
        const tolerance = 1.0e-6;
        const maxIterations = 100;
        let rank = new Array(N).fill(1 / N);

        for (let iter = 0; iter < maxIterations; iter++) {
            let newRank = new Array(N).fill((1 - dampingFactor) / N);

            // Distribute rank from each node
            for (let j = 0; j < N; j++) {
                if (outDegrees[j] > 0) {
                    const contribution = dampingFactor * rank[j] / outDegrees[j];
                    // For each neighbor of node j, add the contribution
                    adjacencyList[j].forEach(i => {
                        newRank[i] += contribution;
                    });
                } else {
                    // Dangling nodes: distribute uniformly to all nodes
                    const contribution = dampingFactor * rank[j] / N;
                    for (let i = 0; i < N; i++) {
                        newRank[i] += contribution;
                    }
                }
            }

            // Check convergence (using L1 norm)
            let diff = newRank.reduce((sum, r, i) => sum + Math.abs(r - rank[i]), 0);
            rank = newRank;
            if (diff < tolerance) break;
        }
        return rank;
    }

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
        ranked_res_spinner.style.display = "inline-block";
        all_res_spinner.style.display = "inline-block";

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

            console.log("Extracted language codes in category-submission.js:",'edit:', languageCode,
                ' , refer',referLanguageCode);

            // Fetch missing articles
            const response = await fetch(
                `/get_articles_from_other_languages/${languageCode}/${category}/${referLanguageCode}/`);
            const data = await response.json();

            console.log( data);

            if(Object.keys(data).includes("noCatError")){
                throw data;
            }
            if(Object.keys(data).includes("noQcode")){
                throw data;
            }

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
                });
            } else {
                referArticlesList.innerHTML = "<li>No missing articles found.</li>";
            }
            all_res_spinner.style.display = "none";

            // articlesData is an array of article titles to rank.
            // const articlesData = []

            // Check if each reference article exists in the edit language and rank them
            if (data.articles.length > 0) {
                const checkPromises = data.articles.map(async (article) => {
                    const [exists, translatedTitle] = await checkPageInLanguage(article, referLanguageCode, languageCode);

                    if (exists === 1) {
                        console.log(`Page exists in ${languageCode}:`, translatedTitle);
                    } else {
                        console.log(`Page does NOT exist in ${languageCode}:`, article);
                        // articlesData.push(article);
                        return getArticleMetadata(article, referLanguageCode);
                    }
                });

                // Filter out nulls (existing pages)
                const filteredMetadataList = (await Promise.all(checkPromises)).filter(Boolean);
                console.log(" the metadataList is ", filteredMetadataList);

                // const rank = computePageRank(articlesData);
                // const normalizedPageRank = normalizeScores(rank);
                // console.log("Normalized PageRank:", normalizedPageRank);
                // // At this point, 'rank' holds the PageRank scores for articles
                // // and normalizedPageRank hold the normalized.
                // console.log("PageRank scores:");
                // articlesData.forEach((title, i) => {
                //   console.log(title, normalizedPageRank[i]);
                //   metadataList[title].pageRank = normalizedPageRank[i];
                // });

                // Compute maximum values for each metric across all articles
                const maxValues = {
                  views: Math.max(...filteredMetadataList.map(m => m.views)),
                  langlinks: Math.max(...filteredMetadataList.map(m => m.langlinks)),
                  editCount: Math.max(...filteredMetadataList.map(m => m.editCount)),
                  references: Math.max(...filteredMetadataList.map(m => m.references)),
                  editWars: Math.max(...filteredMetadataList.map(m => m.editWars)),
                  quality: Math.max(...filteredMetadataList.map(m => m.quality)),
                  templates: Math.max(...filteredMetadataList.map(m => m.templates)),
                  backlinksCount: Math.max(...filteredMetadataList.map(m => m.backlinksCount))
                };

                // Normalize each metric for every article
                filteredMetadataList.forEach(m => {
                  m.normViews = maxValues.views ? m.views / maxValues.views : 0;

                  m.normLanglinks = maxValues.langlinks ? m.langlinks / maxValues.langlinks : 0;

                  m.normEditCount = maxValues.editCount ? m.editCount / maxValues.editCount : 0;

                  // If higher references should lower the score because it needs more editing
                  m.normReferences = maxValues.references ? 1- (m.references / maxValues.references) : 0;

                  m.normEditWars = maxValues.editWars ? m.editWars / maxValues.editWars : 0;

                  // If higher quality should lower the score because it needs more editing
                  m.normQuality = maxValues.quality ? 1 - (m.quality / maxValues.quality) : 0;

                  // If higher template usage then should lower the score because it needs more editing
                  m.normTemplates = maxValues.templates ? 1- (m.templates / maxValues.templates) : 0;

                  m.normBacklinksCount = maxValues.backlinksCount ? m.backlinksCount / maxValues.backlinksCount : 0;
                });

                // Compute scores and sort
                filteredMetadataList.forEach(meta => meta.score = computeRankingScore(meta, weights));
                filteredMetadataList.sort((a, b) => b.score - a.score);

                // Display sorted missing articles
                articlesList.innerHTML = "";
                filteredMetadataList.forEach((meta) => {
                    const articleLink = document.createElement("li");
                    const wikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodeURIComponent(meta.title)}`;
                    articleLink.innerHTML = `<a href="${wikiUrl}" target="_blank">${meta.title}</a> - Score: ${meta.score.toFixed(2)}`;
                    articlesList.appendChild(articleLink);
                });
            } else {
                articlesList.innerHTML = "<li>No missing articles found.</li>";
            }
            ranked_res_spinner.style.display = "none";


        } catch (error) {
            console.error("Error fetching articles:", error);

            if (Object.keys(error).includes("noCatError")){
                    referArticlesList.innerHTML = "<li>category not found in reference language.</li>";
                    articlesList.innerHTML = "<li>category not found in reference language.</li>";
                    all_res_spinner.style.display = "none";
                    ranked_res_spinner.style.display = "none";

            }
            else if (Object.keys(error).includes("noQCode")){
                    referArticlesList.innerHTML = "<li>there are no pages under this category</li>";
                    articlesList.innerHTML = "<li>there are no pages under this category</li>";
                    all_res_spinner.style.display = "none";
                    ranked_res_spinner.style.display = "none";

            }
            else{
                referArticlesList.innerHTML = "<li>Error loading missing articles. Please try again later.</li>";
                articlesList.innerHTML = "<li>Error loading missing articles. Please try again later.</li>";
                ranked_res_spinner.style.display = "none";

            }
        }
    }
    );
});


