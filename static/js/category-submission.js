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
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            const pageId = Object.keys(data.query.pages)[0];  // Get the page ID
            const page = data.query.pages[pageId];

            if (page.langlinks) {
                return 1; // page exists
            } else {
                return 0; // page does not exist
            }
        } catch (error) {
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
        const wiki = `${lang}.wikipedia.org`; // language + project

        // "Basic information about the page."
        const xToolInfoUrl = `https://xtools.wmcloud.org/api/page/pageinfo/${wiki}/${encodeURIComponent(title)}`;

        // "Get statistics about the prose (characters, word count, etc.) and referencing of a page."
        // (more info in xToolPage wikimedia cloud).
        const xToolProseStatisticsUrl = `https://xtools.wmcloud.org/api/page/prose/${wiki}/${encodeURIComponent(title)}`;

        // Counts of in and outgoing links, external links, and redirects.
        const xToolLinksUrl = `https://xtools.wmcloud.org/api/page/links/${wiki}/${encodeURIComponent(title)}`;

        try {
            // Step 1: Basic info
            const infoResponse = await fetch(xToolInfoUrl);
            if (!infoResponse.ok) throw new Error("infoResponse API request failed");
            const infoData = await infoResponse.json();
            /**
             * https://xtools.wmcloud.org/api/page/articleinfo/ar.wikipedia.org/%D8%A8%D9%88%D8%A7%D8%A8%D8%A9%3A%D8%B5%D8%AD%D8%A9
             * {
             *   "warning": [
             *     "In XTools 3.21, the last_edit_id property will be removed. Use the modified_rev_id property instead.",
             *     "In XTools 3.21, the author and author_editcount properties will be removed. Instead, use creator and creator_editcount, respectively.",
             *     "In XTools 3.21, the ip_edits property will be removed. Use the anon_edits property instead."
             *   ],
             *   "project": "ar.wikipedia.org",
             *   "page": "بوابة:صحة",
             *   "watchers": null,
             *   "pageviews": 64,
             *   "pageviews_offset": 30,
             *   "revisions": 11,
             *   "editors": 8,
             *   "anon_edits": 0,
             *   "minor_edits": 6,
             *   "creator": "محمد القنة",
             *   "creator_editcount": 16354,
             *   "created_at": "2017-08-05T07:28:48Z",
             *   "created_rev_id": 24054701,
             *   "modified_at": "2024-09-20T16:18:01Z",
             *   "secs_since_last_edit": 17133578,
             *   "modified_rev_id": 67905581,
             *   "assessment": {
             *     "badge": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Symbol_question.svg",
             *     "color": "",
             *     "category": "تصنيف:مقالات غير مقيمة",
             *     "value": "???"
             *   },
             *   "last_edit_id": 67905581,
             *   "author": "محمد القنة",
             *   "author_editcount": 16354,
             *   "ip_edits": 0,
             *   "elapsed_time": 0.152
             *
             * **/
            const pageviews =  infoData.pageviews? infoData.pageviews : 0;

            // Step 2: Fetch revisions
            const revisions = infoData.revisions? infoData.revisions : 0;

            const editors = infoData.editors ? infoData.editors : 0;

            const created_at = infoData.created_at ? infoData.created_at : 0;

            const secs_since_last_edit = infoData.secs_since_last_edit ? infoData.secs_since_last_edit : 0;

            const proseResponse = await fetch(xToolProseStatisticsUrl);
            if (!proseResponse.ok) throw new Error("proseResponse API request failed");
            const proseData = await proseResponse.json();

            const references = proseData.references ? proseData.references : 0;

            const words = proseData.words ? proseData.words : 0;

            const bytesSize = proseData.bytes ? proseData.bytes : 0;

            let words_bytes_ratio;
            if(bytesSize!==0){
                words_bytes_ratio = words / bytesSize;
            }
            else{
                words_bytes_ratio = 0;
            }

            // Step 3: Basic info
            const infoParams = new URLSearchParams({
                action: "query",
                prop: "info|pageviews",
                titles: title,
                format: "json",
                origin: "*"
            });

            const baseInfoResponse = await fetch(`${baseUrl}?${infoParams}`);
            const baseInfoData = await baseInfoResponse.json();
            const pageId = Object.keys(baseInfoData.query.pages)[0];
            /**
            * https://ar.wikipedia.org/w/api.php?action=query&titles=%D8%A7%D9%84%D9%84%D9%88%D8%B2+%D8%A7%D9%84%D9%85%D8%B1&prop=info
             * */

            if (pageId === "-1") {
                return null;
            }
            // Step 4: Fetch langlinks
            const langlinks = await fetchAllFromApi(baseUrl, {
                action: "query",
                prop: "langlinks",
                titles: title,
                lllimit: "50",
                format: "json"
            }, "langlinks");

            // Step 5: Fetch templates
            const templates = await fetchAllFromApi(baseUrl, {
                action: "query",
                prop: "templates",
                titles: title,
                tllimit: "50",
                format: "json"
            }, "templates");

            // Step 5: Fetch in links and out links
            const linkResponse = await fetch(xToolLinksUrl);
            if (!linkResponse.ok) throw new Error(" linkResponse API request failed");
            const linkData = await linkResponse.json();

            const links_in = linkData.links_in ? linkData.links_in : 0;

            const links_ext_count = linkData.links_ext_count ? linkData.links_ext_count : 0;

            const out_links_count = linkData.links_out ? linkData.links_out : 0;

            return {
                title: title,
                views: pageviews,
                langlinks: langlinks.length,
                editCount: revisions,
                firstEdit: created_at,
                references: references,
                editWars: revisions / editors,
                words_bytes_ratio: words_bytes_ratio,
                templates: templates.length,
                in_links_Count: links_in + links_ext_count,
                out_links_count: out_links_count,
                secs_since_last_edit: secs_since_last_edit,
                pageRank: 0, // TODO still placeholder
            };

        } catch (error) {
            console.error("Error fetching article metadata:", error);
            return {
            }
            ;
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
            metadata.normTemplates * weights.templates +
            metadata.norm_in_links_Count * weights.in_links_Count +
            metadata.norm_out_links_Count * weights.out_Links_count +
            metadata.norm_words_bytes_ratio * weights.words_bytes_ratio +
            metadata.norm_secs_since_last_edit * weights.secs_since_last_edit +
            metadata.pageRank * weights.pageRank
        );
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        tableBody.innerHTML = "";
        articles_msg.innerHTML = "";

        const edit_lang = document.getElementById("article-language-search").value.trim();
        const refer_lang = document.getElementById("article-refer-language-search").value.trim();
        const category = document.getElementById("all-category-search").value.trim();

        if (!edit_lang || !category || !refer_lang ) {
            alert("Please select both a language and a category.");
            return;
        }

        articles_msg.innerHTML = "Loading missing articles...";  // Clear previous rows

        ranked_res_spinner.style.display = "inline-block";

        try {
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

            // Fetch missing articles
            const response = await fetch(
                `/get_articles_from_other_languages/${languageCode}/${category}/${referLanguageCode}/`);
            const data = await response.json();

            if(data.noCatError){
                throw new Error("noCatError");
            }

            else if(data.noQCode){
                throw new Error("noQCode");
            }

            // Check if each reference article exists in the edit language and rank them
            if (data.articles && data.articles.length > 0) {
                articles_msg.innerHTML = "found articles under category, now filtering missing articles and fetching metadata...";

                const checkPromises = data.articles.map(async (article) => {
                    const exists = await checkPageInLanguage(article, referLanguageCode, languageCode);

                    if (exists === 1) {
                    }
                    else {
                        return getArticleMetadata(article, referLanguageCode);
                    }
                });

                // Filter out nulls (existing pages)
                const filteredMetadataList = (await Promise.all(checkPromises)).filter(Boolean);

                articles_msg.innerHTML = "Ranking...";
                tableBody.innerHTML = "";
                if(filteredMetadataList.length === 0){
                    articles_msg.innerHTML = "Search completed, No missing article found under this category";
                    ranked_res_spinner.style.display = "none";
                    return
                }

                filteredMetadataList.forEach((meta,index) => {
                    const wikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodeURIComponent(meta.title)}`;

                    const row = document.createElement("tr");
                    row.innerHTML = `
                                    <td style="border: 1px solid #ccc; padding: 8px;">${index + 1}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${meta.title}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        <a href="${wikiUrl}" target="_blank">View Article</a>
                                    </td>
                    `;
                    tableBody.appendChild(row);
                });

                // Compute maximum values for each metric across all articles
                const maxValues = {
                  views: Math.max(...filteredMetadataList.map(m => m.views)),
                  langlinks: Math.max(...filteredMetadataList.map(m => m.langlinks)),
                  editCount: Math.max(...filteredMetadataList.map(m => m.editCount)),
                  references: Math.max(...filteredMetadataList.map(m => m.references)),
                  editWars: Math.max(...filteredMetadataList.map(m => m.editWars)),
                  templates: Math.max(...filteredMetadataList.map(m => m.templates)),
                  in_links_Count: Math.max(...filteredMetadataList.map(m => m.in_links_Count)),
                  out_links_count: Math.max(...filteredMetadataList.map(m => m.out_links_count)),
                  words_bytes_ratio: Math.max(...filteredMetadataList.map(m => m.words_bytes_ratio)),
                  secs_since_last_edit: Math.max(...filteredMetadataList.map(m => m.secs_since_last_edit))
                };

                function safe_division(numerator, denominators){
                    if(denominators===0){
                        return 0;
                    }
                    else {
                        return numerator/denominators;
                    }
                }

                // Normalize each metric for every article
                filteredMetadataList.forEach(m => {

                  m.normViews = maxValues.views ? safe_division( m.views , maxValues.views) : 0;

                  m.normLanglinks = maxValues.langlinks ? safe_division( m.langlinks , maxValues.langlinks) : 0;

                  m.normEditCount = maxValues.editCount ? 1- safe_division( m.editCount , maxValues.editCount) : 0;

                  // If higher references should lower the score because it needs more editing
                  m.normReferences = maxValues.references ?
                                                        1- safe_division(m.references , maxValues.references) : 0;

                  m.normEditWars = maxValues.editWars ?
                                                        safe_division(m.editWars , maxValues.editWars) : 0;

                  // If higher template usage then should lower the score because it needs more editing
                  m.normTemplates = maxValues.templates ? 1 -
                                                        safe_division(m.templates , maxValues.templates) : 0;

                  m.norm_in_links_Count = maxValues.in_links_Count ?
                                                safe_division(m.in_links_Count , maxValues.in_links_Count) : 0;

                  m.norm_out_links_Count = maxValues.out_links_count ?
                                        safe_division(m.out_links_count, maxValues.out_links_count) : 0;

                  m.norm_words_bytes_ratio = maxValues.words_bytes_ratio ?
                      1 - safe_division(m.words_bytes_ratio,maxValues.words_bytes_ratio) : 0;

                  m.norm_secs_since_last_edit = maxValues.secs_since_last_edit ?
                    safe_division(m.secs_since_last_edit,maxValues.secs_since_last_edit) : 0;

                    // m.page_rank = maxValues.page_rank ? m.page_rank / maxValues.page_rank : 0;
                });

                // Compute scores and sort
                filteredMetadataList.forEach(meta => meta.score = computeRankingScore(meta, weights));
                filteredMetadataList.sort((a, b) => b.score - a.score);

                // Display sorted missing articles
                tableBody.innerHTML = "";  // Clear previous rows
                articles_msg.innerHTML = "";

                filteredMetadataList.forEach((meta,index) => {
                    const encodedTitle = encodeURIComponent(meta.title);

                    const referenceWikiUrl = `https://${referLanguageCode}.wikipedia.org/wiki/${encodeURIComponent(meta.title)}`;
                    const wikiUrl =
                        `https://${languageCode}.wikipedia.org/w/index.php?title=${encodedTitle}&action=edit`;

                    const row = document.createElement("tr");
                    row.innerHTML = `
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        ${index + 1}
                                    </td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        ${meta.title} 
                                        - Score: ${meta.score.toFixed(2)} 
                                    </td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        <a href="${referenceWikiUrl}" target="_blank">View Article</a> 
                                        - 
                                        <a href="${wikiUrl}" target="_blank">Edit Article</a>
                                    </td>
                    `;
                    tableBody.appendChild(row);
                });
                articles_msg.innerHTML = "";

            } else {
                articles_msg.innerHTML = "Search completed, No missing articles found under this category";
            }
            ranked_res_spinner.style.display = "none";

        } catch (error) {
            articles_msg.innerHTML ="";
            if (error.message === "noCatError"){
                    articles_msg.innerHTML = `<span style="color: red; font-weight: bold;">
                                        category not found
                                        </span>
                                         in reference language`;
                    ranked_res_spinner.style.display = "none";
                    console.error("category not found in reference language.: ", error);

            }

            else if (error.message === "noQCode"){
                    articles_msg.innerHTML =`This category 
                                            <span style="color: red; font-weight: bold;">
                                                does not exist OR is a red link
                                            </span> ,                                         
                                            <a href="https://en.wikipedia.org/wiki/Wikipedia:Red_link" 
                                                target="_blank" rel="noopener noreferrer">
                                            click here for info about red links
                                            </a>
                    `;
                    ranked_res_spinner.style.display = "none";
            }

            else{
                articles_msg.innerHTML = `<span style="color: red; font-weight: bold;">
                                                Error loading missing articles. Please try again later.
                                        </span>`;
                ranked_res_spinner.style.display = "none";
                console.error("Error fetching articles:", error);
            }
        }
    }
    );
});
