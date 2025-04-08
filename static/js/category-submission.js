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
        secs_since_last_edit: 0, // TODO time since last edit
        pageRank: 0, //TODO simple pageRank algorithm
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
                // return [1,page.langlinks[0]["*"]]; // page exists
                return 1; // page exists
            } else {
                // return [0, `Page does NOT exist in ${targetLang}`]; // page does not exist
                return 0; // page does not exist
            }
        } catch (error) {
            console.error("Error checking Wikipedia page:", error);
            // return [-1,'Err'] // Error occurred
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

        // "Get assessment data of the given pages, including the overall quality classifications, along with a list of the
        // WikiProjects and their classifications and importance levels."
        // const xToolAssessmentsUrl = `https://xtools.wmcloud.org/api/page/assessments/${wiki}/${encodeURIComponent(title)}`;

        // Counts of in and outgoing links, external links, and redirects.
        const xToolLinksUrl = `https://xtools.wmcloud.org/api/page/links/${wiki}/${encodeURIComponent(title)}`;

        // Get the XTools Page Assessments configuration:
        // const xToolAssessmentUrl = `https://xtools.wmcloud.org/api/project/assessments`;

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
            // console.log("Pageviews (1 months):", pageviews);

            // Step 2: Fetch revisions
            const revisions = infoData.revisions? infoData.revisions : 0;
            // console.log("revisions count:", revisions);

            const editors = infoData.editors ? infoData.editors : 0;
            // console.log("editors count:", editors);

            const created_at = infoData.created_at ? infoData.created_at : 0;
            // console.log("created_at :", created_at); // ex. 2017-08-05T07:28:48Z

            const secs_since_last_edit = infoData.secs_since_last_edit ? infoData.secs_since_last_edit : 0;
            // console.log("secs_since_last_edit", secs_since_last_edit);

            // TODO under development
            // const assessmentsResponse = await fetch(xToolInfoUrl);
            // if (!assessmentsResponse.ok) throw new Error("API request failed");
            // const assessmentsData = await assessmentsResponse.json();
            // if(Object.keys(infoData).includes("assessment")){
            //     if(Object.keys(infoData.assessment).includes("value")){
            //         if (infoData.assessment.value){
            //             const value = infoData.assessment.value;
            //             switch(value){
            //                 case "???":{
            //                     const assessment = 0;
            //                 }
            //                 case ""
            //             }
            //         }
            //     }
            // }
            // else {
            //     const assessment = 0;
            // }
            // const assessment = infoData.assessment ? infoData.assessment.value : 0;
            // console.log("assessment", assessment);

            const proseResponse = await fetch(xToolProseStatisticsUrl);
            if (!proseResponse.ok) throw new Error("proseResponse API request failed");
            const proseData = await proseResponse.json();

            const references = proseData.references ? proseData.references : 0;
            // console.log(title , " Page references :", references);

            const words = proseData.words ? proseData.words : 0;
            // console.log(title , " Page word count:", words);

            const bytesSize = proseData.bytes ? proseData.bytes : 0;
            // console.log(title , " Page size:", bytesSize);

            let words_bytes_ratio;
            if(bytesSize!==0){
                words_bytes_ratio = words / bytesSize;
            }
            else{
                words_bytes_ratio = 0;
            }
            // console.log(title , " words_bytes_ratio :", words_bytes_ratio);

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
                // console.log(title, " pageID = -1")
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
            // console.log(title, "  langlinks=", langlinks );

            // Step 5: Fetch templates
            const templates = await fetchAllFromApi(baseUrl, {
                action: "query",
                prop: "templates",
                titles: title,
                tllimit: "50",
                format: "json"
            }, "templates");
            // console.log(title, "  templates=", templates );

            // Step 5: Fetch in links and out links
            const linkResponse = await fetch(xToolLinksUrl);
            if (!linkResponse.ok) throw new Error(" linkResponse API request failed");
            const linkData = await linkResponse.json();

            const links_in = linkData.links_in ? linkData.links_in : 0;
            // console.log(title,"links_in to page:", links_in);

            const links_ext_count = linkData.links_ext_count ? linkData.links_ext_count : 0;
            // console.log(title,"links_ext_count to page:", links_ext_count);

            const links_out = linkData.links_out ? linkData.links_out : 0;
            // console.log(title,"links_out from page:", links_out);

            // const redirects = linkData.redirects ? linkData.redirects : 0;
            // console.log(title,"Redirects:", redirects);

            return {
                title: title,
                views: pageviews,
                langlinks: langlinks.length,
                editCount: revisions,
                firstEdit: created_at,
                references: references,
                editWars: revisions / editors,
                words_bytes_ratio: words_bytes_ratio,
                // quality: assessment,
                templates: templates.length,
                in_links_Count: links_in + links_ext_count,
                out_links_count: links_out,
                secs_since_last_edit: secs_since_last_edit,
                // backlinks: backlinks,
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
            // metadata.secs_since_last_edit * weights.secs_since_last_edit +
            metadata.pageRank * weights.pageRank
        );
    }


    // function computePageRank(articlesData, articlesBacklinksData, articlesLinksData){
    //     // edge data
    //     const linksData = {
    //         // article title : [titles of articles it links to]
    //         "ArticleA": ["ArticleB", "ArticleC"],
    //         "ArticleB": ["ArticleC"],
    //         "ArticleC": ["ArticleA"]
    //     };
    //
    //     const backlinksData = {
    //         // article title : [titles of articles that link to it]
    //         "ArticleA": ["ArticleC"],
    //         "ArticleB": ["ArticleA"],
    //         "ArticleC": ["ArticleA", "ArticleB"]
    //     };
    //
    //     // Create a mapping from article title to index
    //     const indexMap = {};
    //     articlesData.forEach((title, idx) => { indexMap[title] = idx; });
    //
    //     // Build the graph: For each article, combine its outgoing links and backlinks
    //     const N = articlesData.length;
    //     // Using an array of sets for unique outgoing edges
    //     const graph = Array.from({ length: N }, () => new Set());
    //
    //     // Helper: add edge if both nodes are in our dataset
    //     function addEdge(from, to) {
    //         if (indexMap.hasOwnProperty(from) && indexMap.hasOwnProperty(to)) {
    //             graph[indexMap[from]].add(indexMap[to]);
    //         }
    //     }
    //
    //     // Process outgoing links (linksData)
    //     for (let [article, outLinks] of Object.entries(linksData)) {
    //         outLinks.forEach(target => addEdge(article, target));
    //     }
    //
    //     // Process backlinks (backlinksData)
    //     for (let [article, inLinks] of Object.entries(backlinksData)) {
    //         // For each backlink, create an edge from the linking article to this article.
    //         inLinks.forEach(source => addEdge(source, article));
    //     }
    //
    //     // Convert graph sets to arrays for easier processing
    //     const adjacencyList = graph.map(neighbors => Array.from(neighbors));
    //
    //     // Compute outdegree for each node
    //     const outDegrees = adjacencyList.map(neighbors => neighbors.length);
    //
    //     // PageRank's computation using power iteration
    //     const dampingFactor = 0.85;
    //     const tolerance = 1.0e-6;
    //     const maxIterations = 100;
    //     let rank = new Array(N).fill(1 / N);
    //
    //     for (let iter = 0; iter < maxIterations; iter++) {
    //         let newRank = new Array(N).fill((1 - dampingFactor) / N);
    //
    //         // Distribute rank from each node
    //         for (let j = 0; j < N; j++) {
    //             if (outDegrees[j] > 0) {
    //                 const contribution = dampingFactor * rank[j] / outDegrees[j];
    //                 // For each neighbor of node j, add the contribution
    //                 adjacencyList[j].forEach(i => {
    //                     newRank[i] += contribution;
    //                 });
    //             } else {
    //                 // Dangling nodes: distribute uniformly to all nodes
    //                 const contribution = dampingFactor * rank[j] / N;
    //                 for (let i = 0; i < N; i++) {
    //                     newRank[i] += contribution;
    //                 }
    //             }
    //         }
    //
    //         // Check convergence (using L1 norm)
    //         let diff = newRank.reduce((sum, r, i) => sum + Math.abs(r - rank[i]), 0);
    //         rank = newRank;
    //         if (diff < tolerance) break;
    //     }
    //     return rank;
    // }


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
            // console.log("Submitting request: edit_lang:", edit_lang,
            //             ", refer_lang", refer_lang, "category:", category);

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

            // console.log("Extracted language codes in category-submission.js:",'edit:', languageCode,
            //     ' , refer',referLanguageCode);

            // Fetch missing articles
            const response = await fetch(
                `/get_articles_from_other_languages/${languageCode}/${category}/${referLanguageCode}/`);
            const data = await response.json();

            console.log("", data);

            if(data.noCatError){
                console.log("noCatError");
                throw new Error("noCatError");
            }

            else if(data.noQCode){
                console.log("noQCode");
                throw new Error("noQCode");
            }

            // Check if each reference article exists in the edit language and rank them
            if (data.articles && data.articles.length > 0) {
                articles_msg.innerHTML = "found articles under category, now filtering missing articles and fetching metadata...";

                const checkPromises = data.articles.map(async (article) => {
                    // const [exists, translatedTitle] = await checkPageInLanguage(article, referLanguageCode, languageCode);
                    const exists = await checkPageInLanguage(article, referLanguageCode, languageCode);

                    if (exists === 1) {
                        // console.log(`Page exists in ${languageCode}:`, translatedTitle);
                    } else {
                        // console.log(`Page does NOT exist in ${languageCode}:`, article);
                        // articlesData.push(article);
                        return getArticleMetadata(article, referLanguageCode);
                    }
                });

                // Filter out nulls (existing pages)
                const filteredMetadataList = (await Promise.all(checkPromises)).filter(Boolean);

                articles_msg.innerHTML = "Ranking...";
                tableBody.innerHTML = "";
                if(filteredMetadataList.length ===0){
                    articles_msg.innerHTML = "Search completed, No missing article found under this category";
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

                // console.log(" the metadataList is ", filteredMetadataList);

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
                  templates: Math.max(...filteredMetadataList.map(m => m.templates)),
                  in_links_Count: Math.max(...filteredMetadataList.map(m => m.in_links_Count)),
                  out_links_count: Math.max(...filteredMetadataList.map(m => m.out_links_count))
                  // secs_since_last_edit: Math.max(...filteredMetadataList.map(m => m.in_links_Count))
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
                  // m.normQuality = maxValues.quality ? 1 - (m.quality / maxValues.quality) : 0;

                  // If higher template usage then should lower the score because it needs more editing
                  m.normTemplates = maxValues.templates ? 1- (m.templates / maxValues.templates) : 0;

                  m.norm_in_links_Count = maxValues.in_links_Count ? m.in_links_Count / maxValues.in_links_Count : 0;

                  m.norm_out_links_Count = maxValues.out_links_count ? m.out_links_count / maxValues.out_links_count : 0;

                  // m.norm_in_links_Count = maxValues.in_links_Count ? m.in_links_Count / maxValues.in_links_Count : 0;
                  // m.norm_in_links_Count = maxValues.in_links_Count ? m.in_links_Count / maxValues.in_links_Count : 0;
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
                                    <td style="border: 1px solid #ccc; padding: 8px;">${index + 1}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${meta.title} 
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
                articles_msg.innerHTML = "Search completed, No articles found under this category";
            }
            ranked_res_spinner.style.display = "none";

        } catch (error) {
            articles_msg.innerHTML ="";
            if (error.message === "noCatError"){
                    // tableBody.innerHTML = "<li>category not found in reference language.</li>";
                    articles_msg.innerHTML = `<style="font-size: large">
                                        category not found in reference language </style> `;
                    ranked_res_spinner.style.display = "none";
                    console.error("category not found in reference language.: ", error);

            }

            else if (error.message === "noQCode"){
                    // tableBody.innerHTML = "<li>there are no pages under this category,or this is a red link</li>";
                    // all_res_spinner.style.display = "none";
                    articles_msg.innerHTML =`This category is a <span style="color: red; font-weight: bold;">red link
                                            </span> ,                                         
                                            <a href="https://en.wikipedia.org/wiki/Wikipedia:Red_link" 
                                                target="_blank" rel="noopener noreferrer">
                                            click here for info about red links
                                            </a>
                    `;
                    ranked_res_spinner.style.display = "none";
                    console.error("this category is a redlink:", error);

            }

            else{
                tableBody.innerHTML = "<li>Error loading missing articles. Please try again later.</li>";
                ranked_res_spinner.style.display = "none";
                console.error("Error fetching articles:", error);
            }
        }
    }
    );
});
