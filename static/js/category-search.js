$(document).ready(function () {
    const languageSelect = $('#language');
    const languageSpinner = $('#language-spinner');
    const categorySelect = $('#category');
    const categorySpinner = $('#category-spinner');
    const feedbackMessage = $('#feedback-message');
    const articlesList = $('#articles');

    // Show spinner initially for languages
    languageSpinner.show();
    console.log("Fetching languages...");

    // Fetch supported languages
    $.getJSON('/get_languages/', function (data) {
        console.log("Languages fetched:", data);
        languageSpinner.hide(); // Hide spinner after data is loaded
        languageSelect.empty(); // Clear existing options

        if (data && Array.isArray(data.languages) && data.languages.length > 0) {
            data.languages.forEach(lang => {
                languageSelect.append(`<option value="${lang.code}">${lang.name} (${lang.code})</option>`);
                console.log(`Added language: ${lang.name} (${lang.code})`);
            });
        } else {
            languageSelect.append('<option value="" disabled>No languages found</option>');
        }
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to fetch languages:", textStatus, errorThrown);
        languageSpinner.hide();
        languageSelect.append('<option value="" disabled>Error loading languages</option>');
    });

    // Fetch categories based on selected language
    $('#language').on('change', function () {
        const lang = $(this).val();
        feedbackMessage.text('').hide(); // Clear feedback messages
        categorySelect.empty().prop('disabled', true).append('<option value="" disabled>Loading categories...</option>');

        if (lang) {
            categorySpinner.show(); // Show spinner for categories
            console.log(`Fetching categories for language: ${lang}`);

            $.getJSON(`/get_categories/${lang}/`, function (data) {
                categorySpinner.hide();
                categorySelect.empty().prop('disabled', false);

                if (data.categories && data.categories.length > 0) {
                    data.categories.forEach(category => {
                        categorySelect.append(`<option value="${category}">${category}</option>`);
                        console.log(`Added category: ${category}`);
                    });
                } else {
                    categorySelect.append('<option value="" disabled>No categories available</option>');
                    feedbackMessage.text('No categories found for this language. Please try another language.').show();
                }
            }).fail(function (jqXHR, textStatus, errorThrown) {
                categorySpinner.hide();
                console.error("Error fetching categories:", textStatus, errorThrown);
                categorySelect.empty().prop('disabled', true).append('<option value="" disabled>Error loading categories</option>');
                feedbackMessage.text('There was an error fetching categories. Please try again later.').show();
            });
        } else {
            categorySelect.empty().prop('disabled', true).append('<option value="" disabled>Select a language first</option>');
        }
    });

    // Handle form submission for missing articles
    $('#selection-form').on('submit', function (e) {
        e.preventDefault();

        const lang = $('#language').val();
        const category = $('#category').val();
        const articlesSpinner = $('#articles-spinner');

        articlesList.empty(); // Clear existing articles
        feedbackMessage.text('').hide(); // Clear feedback messages

        if (lang && category) {
            console.log(`Fetching missing articles for language: ${lang}, category: ${category}`);
            articlesSpinner.show(); // Show spinner for articles

            $.getJSON(`/get_missing_articles/`, { lang, category }, function (data) {
                articlesSpinner.hide();

                if (data.articles && data.articles.length > 0) {
                    data.articles.forEach(article => {
                        articlesList.append(`<li><a href="https://${lang}.wikipedia.org/wiki/${article}" target="_blank">${article}</a></li>`);
                        console.log(`Added article: ${article}`);
                    });
                } else {
                    articlesList.append('<li>No missing articles found</li>');
                }
            }).fail(function (jqXHR, textStatus, errorThrown) {
                articlesSpinner.hide();
                console.error("Error fetching missing articles:", textStatus, errorThrown);
                articlesList.append('<li>Error loading articles. Please try again later.</li>');
            });
        } else {
            feedbackMessage.text('Please select a language and category before submitting.').show();
        }
    });
});
