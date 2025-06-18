document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("missing-articles-form");

    const ranked_res_spinner = document.getElementById("ranked_res_spinner");

    const articles_msg = document.getElementById("articles_msg");

    const tableBody = document.getElementById("articles-table-body");

    // weight values of the metrics
    const weights = {
        views: 0.35, // how many people watched the page in 30 days
        langlinks: 0.35, // how many languages that has this article
        editCount: 0.025, // how many times this article was edited (including reversed edits)
        references: 0.025, // number of references in this page
        editWars: 0.025, // how many edits per editor, avg edit_count for each editor
        templates: 0.025, // number of templates used
        in_links_Count: 0.1, // number of pages link to this page
        out_Links_count: 0.1, //  number of pages link out from page
        words_bytes_ratio:0, // number of words per byte.
        secs_since_last_edit: 0, // time in seconds since last edit
        pageRank: 0, //TODO simple pageRank algorithm
    };

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
        const timeout = 10000; // 10 secondes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(apiUrl, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json();

            const pageId = Object.keys(data.query.pages)[0];  // Get the page ID
            const page = data.query.pages[pageId];

            if (page.langlinks) {
                return 1; // page exists
            } else {
                return 0; // page does not exist
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Request timed out');
            }
            console.error("Error checking Wikipedia page:", error);
            return -1; // Error occurred
        }
    }

    async function fetchAllFromApi(baseUrl, params, dataKey) {
    let results = [];
    let continueParams = {};
    let shouldContinue = true;

    while (shouldContinue) {
        const queryParams = new URLSearchParams({ ...params, ...continueParams, origin: '*' });
        const response = await fetch(`${baseUrl}?${queryParams}`);
        const data = await response.json();

        if (data?.query?.pages) {
            const page = Object.values(data.query.pages)[0];
            if (page[dataKey]) {
                results = results.concat(page[dataKey]);
            }
        }

        if (data.continue) {
            continueParams = data.continue;
        } else {
            shouldContinue = false;
        }
    }

    return results;
}


    async function getArticleMetadata(title, lang) {
        const baseUrl = `https://${lang}.wikipedia.org/w/api.php`;
        const wiki = `${lang}.wikipedia.org`;

        // "Basic information about the page."
        const xToolInfoUrl = `https://xtools.wmcloud.org/api/page/pageinfo/${wiki}/${encodeURIComponent(title)}`;
        const xToolProseStatisticsUrl = `https://xtools.wmcloud.org/api/page/prose/${wiki}/${encodeURIComponent(title)}`;
        const xToolLinksUrl = `https://xtools.wmcloud.org/api/page/links/${wiki}/${encodeURIComponent(title)}`;

        const timeout = 10000; // 10 secondes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Step 1: Basic info
            console.log(`\n=== Fetching metadata for article: ${title} ===`);
            const infoResponse = await fetch(xToolInfoUrl, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!infoResponse.ok) {
                console.error(`Info API failed for ${title}:`, infoResponse.status);
                throw new Error("infoResponse API request failed");
            }
            const infoData = await infoResponse.json();
            console.log(`Raw info data for ${title}:`, infoData);

            const pageviews = infoData.pageviews ? infoData.pageviews : 0;
            const revisions = infoData.revisions ? infoData.revisions : 0;
            const editors = infoData.editors ? infoData.editors : 0;
            const created_at = infoData.created_at ? infoData.created_at : 0;
            const secs_since_last_edit = infoData.secs_since_last_edit ? infoData.secs_since_last_edit : 0;

            // Step 2: Prose statistics
            const proseResponse = await fetch(xToolProseStatisticsUrl, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!proseResponse.ok) {
                console.error(`Prose API failed for ${title}:`, proseResponse.status);
                throw new Error("proseResponse API request failed");
            }
            const proseData = await proseResponse.json();
            console.log(`Raw prose data for ${title}:`, proseData);

            const references = proseData.references ? proseData.references : 0;
            const words = proseData.words ? proseData.words : 0;
            const bytesSize = proseData.bytes ? proseData.bytes : 0;

            let words_bytes_ratio = bytesSize !== 0 ? words / bytesSize : 0;

            // Step 3: Links
            const linkResponse = await fetch(xToolLinksUrl, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!linkResponse.ok) {
                console.error(`Links API failed for ${title}:`, linkResponse.status);
                throw new Error("linkResponse API request failed");
            }
            const linkData = await linkResponse.json();
            console.log(`Raw links data for ${title}:`, linkData);

            const links_in = linkData.links_in ? linkData.links_in : 0;
            const links_ext_count = linkData.links_ext_count ? linkData.links_ext_count : 0;
            const out_links_count = linkData.links_out ? linkData.links_out : 0;

            // Step 4: Langlinks
            const langlinks = await fetchAllFromApi(baseUrl, {
                action: "query",
                prop: "langlinks",
                titles: title,
                lllimit: "50",
                format: "json"
            }, "langlinks");

            // Step 5: Templates
            const templates = await fetchAllFromApi(baseUrl, {
                action: "query",
                prop: "templates",
                titles: title,
                tllimit: "50",
                format: "json"
            }, "templates");

            const metadata = {
                title: title,
                views: pageviews,
                langlinks: langlinks.length,
                editCount: revisions,
                firstEdit: created_at,
                references: references,
                editWars: editors !== 0 ? revisions / editors : 0,
                words_bytes_ratio: words_bytes_ratio,
                templates: templates.length,
                in_links_Count: links_in + links_ext_count,
                out_links_count: out_links_count,
                secs_since_last_edit: secs_since_last_edit,
                pageRank: 0,
            };
            

            console.log(`\nFinal metadata for ${title}:`, metadata);
            return metadata;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Request timed out');
            }
            console.error(`Error fetching metadata for ${title}:`, error);
            return {};
        }
    }

    // Function to compute ranking score
    function computeRankingScore(metadata, weights) {
        const scoreComponents = {
            views: metadata.normViews * weights.views,
            langlinks: metadata.normLanglinks * weights.langlinks,
            editCount: metadata.normEditCount * weights.editCount,
            references: metadata.normReferences * weights.references,
            editWars: metadata.normEditWars * weights.editWars,
            templates: metadata.normTemplates * weights.templates,
            in_links: metadata.norm_in_links_Count * weights.in_links_Count,
            out_links: metadata.norm_out_links_Count * weights.out_Links_count,
            words_bytes: metadata.norm_words_bytes_ratio * weights.words_bytes_ratio,
            last_edit: metadata.norm_secs_since_last_edit * weights.secs_since_last_edit,
            pageRank: metadata.pageRank * weights.pageRank
        };

        const totalScore = Object.values(scoreComponents).reduce((a, b) => a + b, 0);

        console.log(`\n=== Score calculation for ${metadata.title} ===`);
        console.log('Score components:', scoreComponents);
        console.log('Total score:', totalScore);

        return totalScore;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        tableBody.innerHTML = "";
        articles_msg.innerHTML = "";

        const edit_lang = document.getElementById("article-language-search").value.trim();
        const refer_lang = document.getElementById("article-refer-language-search").value.trim();
        const category = document.getElementById("all-category-search").value.trim();

        if (!edit_lang || !category || !refer_lang) {
            alert("Please select both a language and a category.");
            return;
        }

        articles_msg.innerHTML = "Loading missing articles...";
        ranked_res_spinner.style.display = "inline-block";

        try {
            const languageCode = edit_lang.match(/\((.*?)\)/)?.[1];
            const referLanguageCode = refer_lang.match(/\((.*?)\)/)?.[1];
            if (!languageCode || !referLanguageCode) {
                alert("Invalid language selection. Please select a valid language.");
                return;
            }

            // Fetch missing articles
            const response = await fetch(
                `/get_articles_from_other_languages/${languageCode}/${category}/${referLanguageCode}/`);
            const data = await response.json();

            if (data.noCatError) {
                throw new Error("noCatError");
            } else if (data.noQCode) {
                throw new Error("noQCode");
            }

            if (data.articles && data.articles.length > 0) {
                // ÉTAPE 1: Afficher les articles sans score
                displayArticlesWithoutScores(data.articles, referLanguageCode, languageCode);
                
                articles_msg.innerHTML = "fetching metadata and compute relevance score of missing articles found";

                // ÉTAPE 2: Traitement hybride avec affichage progressif
                await processArticlesHybrid(data.articles, referLanguageCode, languageCode);
                
                articles_msg.innerHTML = "";
                ranked_res_spinner.style.display = "none";
            } else {
                articles_msg.innerHTML = "Search completed, No missing articles found under this category";
                ranked_res_spinner.style.display = "none";
            }

        } catch (error) {
            handleError(error);
        }
    });

    // Fonction pour afficher les articles sans score
    function displayArticlesWithoutScores(articles, referLanguageCode, languageCode) {
        tableBody.innerHTML = "";
        articles.forEach((title, index) => {
            const encodedTitle = encodeURIComponent(title);
            const referenceWikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodedTitle}`;
            const wikiUrl = `https://${languageCode}.wikipedia.org/w/index.php?title=${encodedTitle}&action=edit`;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: 8px;">
                    ${index + 1}
                </td>
                <td style="border: 1px solid #ccc; padding: 8px;">
                    ${title}
                    <span class="score-placeholder">Score: calculating...</span>
                </td>
                <td style="border: 1px solid #ccc; padding: 8px;">
                    <a href="${referenceWikiUrl}" target="_blank">View Article</a>
                    -
                    <a href="${wikiUrl}" target="_blank">Edit Article</a>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Fonction principale pour le traitement hybride
    async function processArticlesHybrid(articles, referLanguageCode, languageCode) {
        const BATCH_SIZE = 10; // Nombre d'articles pour commencer le calcul des scores
        const filteredMetadataList = [];
        const processedArticles = new Set();
        
        // Traiter les articles par batch
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            const batch = articles.slice(i, i + BATCH_SIZE);
            
            // Traiter le batch actuel
            for (const article of batch) {
                if (processedArticles.has(article)) continue;
                
                const exists = await checkPageInLanguage(article, referLanguageCode, languageCode);
                if (exists !== 1) {
                    const metadata = await getArticleMetadata(article, referLanguageCode);
                    if (metadata) {
                        filteredMetadataList.push(metadata);
                        processedArticles.add(article);
                    }
                    await sleep(100);
                }
            }
            
            // Si on a assez d'articles, calculer et afficher les scores
            if (filteredMetadataList.length >= BATCH_SIZE || i + BATCH_SIZE >= articles.length) {
                await calculateAndDisplayScores(filteredMetadataList, referLanguageCode, languageCode, false);
            }
        }
        
        // ÉTAPE 3: Calcul final avec tous les articles
        articles_msg.innerHTML = "Ranking...";
        await calculateAndDisplayScores(filteredMetadataList, referLanguageCode, languageCode, true);
    }

    // Fonction pour calculer et afficher les scores
    async function calculateAndDisplayScores(metadataList, referLanguageCode, languageCode, isFinal = false) {
        if (metadataList.length === 0) {
            articles_msg.innerHTML = "Search completed, No missing article found under this category";
            return;
        }

        // Calculer les max_values
        const maxValues = {
            views: Math.max(...metadataList.map(m => Number(m.views)).filter(v => !isNaN(v))),
            langlinks: Math.max(...metadataList.map(m => Number(m.langlinks)).filter(v => !isNaN(v))),
            editCount: Math.max(...metadataList.map(m => Number(m.editCount)).filter(v => !isNaN(v))),
            references: Math.max(...metadataList.map(m => Number(m.references)).filter(v => !isNaN(v))),
            editWars: Math.max(...metadataList.map(m => Number(m.editWars)).filter(v => !isNaN(v))),
            templates: Math.max(...metadataList.map(m => Number(m.templates)).filter(v => !isNaN(v))),
            in_links_Count: Math.max(...metadataList.map(m => Number(m.in_links_Count)).filter(v => !isNaN(v))),
            out_links_count: Math.max(...metadataList.map(m => Number(m.out_links_count)).filter(v => !isNaN(v))),
            words_bytes_ratio: Math.max(...metadataList.map(m => Number(m.words_bytes_ratio)).filter(v => !isNaN(v))),
            secs_since_last_edit: Math.max(...metadataList.map(m => Number(m.secs_since_last_edit)).filter(v => !isNaN(v)))
        };

        // Normaliser et calculer les scores
        metadataList.forEach(m => {
            m.normViews = maxValues.views ? safe_division(m.views, maxValues.views) : 0;
            m.normLanglinks = maxValues.langlinks ? safe_division(m.langlinks, maxValues.langlinks) : 0;
            m.normEditCount = maxValues.editCount ? 1 - safe_division(m.editCount, maxValues.editCount) : 0;
            m.normReferences = maxValues.references ? 1 - safe_division(m.references, maxValues.references) : 0;
            m.normEditWars = maxValues.editWars ? safe_division(m.editWars, maxValues.editWars) : 0;
            m.normTemplates = maxValues.templates ? 1 - safe_division(m.templates, maxValues.templates) : 0;
            m.norm_in_links_Count = maxValues.in_links_Count ? safe_division(m.in_links_Count, maxValues.in_links_Count) : 0;
            m.norm_out_links_Count = maxValues.out_links_count ? safe_division(m.out_links_count, maxValues.out_links_count) : 0;
            m.norm_words_bytes_ratio = maxValues.words_bytes_ratio ? 1 - safe_division(m.words_bytes_ratio, maxValues.words_bytes_ratio) : 0;
            m.norm_secs_since_last_edit = maxValues.secs_since_last_edit ? safe_division(m.secs_since_last_edit, maxValues.secs_since_last_edit) : 0;
            
            m.score = computeRankingScore(m, weights);
        });

        // Trier par score décroissant
        metadataList.sort((a, b) => b.score - a.score);

        // Afficher les résultats
        displayArticlesWithScores(metadataList, referLanguageCode, languageCode, isFinal);
    }

    // Fonction pour afficher les articles avec scores
    function displayArticlesWithScores(sortedMetadataList, referLanguageCode, languageCode, isFinal = false) {
        tableBody.innerHTML = "";
        sortedMetadataList.forEach((meta, index) => {
            const encodedTitle = encodeURIComponent(meta.title);
            const referenceWikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodedTitle}`;
            const wikiUrl = `https://${languageCode}.wikipedia.org/w/index.php?title=${encodedTitle}&action=edit`;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: 8px;">
                    ${index + 1}
                </td>
                <td style="border: 1px solid #ccc; padding: 8px;">
                    ${meta.title}
                    - Score: ${meta.score.toFixed(2)}
                    ${!isFinal ? ' <span style="color: orange;">(provisional)</span>' : ''}
                </td>
                <td style="border: 1px solid #ccc; padding: 8px;">
                    <a href="${referenceWikiUrl}" target="_blank">View Article</a>
                    -
                    <a href="${wikiUrl}" target="_blank">Edit Article</a>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Fonction helper pour la division sécurisée
    function safe_division(numerator, denominator) {
        return denominator === 0 ? 0 : numerator / denominator;
    }

    // Fonction pour gérer les erreurs
    function handleError(error) {
        articles_msg.innerHTML = "";
        if (error.message === "noCatError") {
            articles_msg.innerHTML = `<span style="color: red; font-weight: bold;">
                category not found
                </span>
                in reference language`;
        } else if (error.message === "noQCode") {
            articles_msg.innerHTML = `This category 
                <span style="color: red; font-weight: bold;">
                    does not exist OR is a red link
                </span>,                                         
                <a href="https://en.wikipedia.org/wiki/Wikipedia:Red_link" 
                    target="_blank" rel="noopener noreferrer">
                click here for info about red links
                </a>`;
        } else {
            articles_msg.innerHTML = `<span style="color: red; font-weight: bold;">
                Error loading missing articles. Please try again later.
                </span>`;
            console.error("Error fetching articles:", error);
        }
        ranked_res_spinner.style.display = "none";
    }
});
