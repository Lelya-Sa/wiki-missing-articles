"""
Django Views for Wikipedia Missing Articles Tool

This module implements the main backend logic for the Wikipedia Missing Articles tool. It provides endpoints and helper functions to:
- Render the main and category search pages
- Dynamically fetch supported Wikipedia languages and categories
- Retrieve missing articles in a target language by comparing categories across languages
- Handle translation and language switching for the tool interface
- Interact with the Wikipedia and Wikidata APIs to fetch category, article, and language data
- Use caching to optimize repeated queries for supported languages

Key Endpoints:
- index: Renders the main landing page of the tool
- missing_articles_by_category: Renders the category search page and handles POST form submissions (not used in AJAX flow)
- get_supported_languages: Returns a JSON list of supported Wikipedia languages (with caching)
- get_categories_with_query: Returns a filtered list of categories for a given language and query string
- get_articles_from_other_languages: Main AJAX endpoint to fetch missing articles in a target language, given a category and reference language. Handles subcategory recursion and deduplication.
- translated_page: Handles switching the UI language of the tool
- custom_404: Custom 404 error page

Implementation Notes:
- Uses requests to interact with Wikipedia and Wikidata APIs for live data
- Uses Django's cache framework to store supported languages for 24 hours
- Handles Unicode and encoding issues for multilingual support
- Recursively fetches subcategories up to a user-specified depth
- Deduplicates articles by title, keeping the first found source

"""
import sys
sys.stdout.reconfigure(encoding='utf-8')  # Ensures proper encoding for print output

import json
from django.http import JsonResponse
import requests
from django.core.cache import cache  # Import Django's caching framework
from django.conf import settings
from django.utils import translation

WIKI_API_URL = "https://{lang}.wikipedia.org/w/api.php"
WIKIDATA_URL = "https://www.wikidata.org/wiki/Special:EntityData/{qcode}.json"

from django.shortcuts import redirect
from django.shortcuts import render


def dictfetchall(cursor):
    """
    Return all rows from a cursor as a list of dictionaries.

    :param cursor: Database cursor
    :return: List of dictionaries, one per row
    """
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def index(request):
    """
    Render the main entrance page of the tool.

    :param request: Django HTTP request
    :return: Rendered index.html page
    """
    lang = request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME, "en")
    translation.activate(lang)
    return render(request, 'index.html')


def missing_articles_by_category(request):
    """
    Render the category search page and handle POST form submissions for missing articles by category.

    :param request: Django HTTP request
    :return: Rendered missing_articles_by_category.html page
    """
    if request.method == "POST":
        edit_lang = request.POST.get("article-language-search")  # Get the selected language
        category = request.POST.get("all-category-search")  # Get the selected category
        refer_lang = request.POST.get("article-refer-language-search")  # Get the selected language

        if not edit_lang or not category or not refer_lang:
            return render(
                request,
                "missing_articles_by_category.html",
                {"error": "Please select both a language and a category."},
            )

        get_articles_from_other_languages(edit_lang, category, refer_lang)

    return render(request, "missing_articles_by_category.html")


def translated_page(request):  # TODO support translation to wikipedia languages
    """
    Translate the tool page into the given language and redirect to the next URL.

    :param request: Django HTTP request
    :return: Redirect response with language cookie set
    """
    lang = request.GET.get("lang", "en")

    next_url = request.GET.get("next", "/")  # Default fallback to index
    if lang not in dict(settings.LANGUAGES):
        lang = "en"  # Fallback

    translation.activate(lang)  # Set the active language
    request.LANGUAGE_CODE = lang
    response = redirect(next_url)
    response.set_cookie(settings.LANGUAGE_COOKIE_NAME, lang)
    return response


def get_prefix(lang="en", type="category"):
    """
    Get the correct category or portal namespace prefix for a given Wikipedia language.

    :param lang: Wikipedia language code (default: 'en')
    :param type: Namespace type ('category' or 'portal')
    :return: Namespace prefix string (e.g., 'Category:', 'تصنيف:')
    """
    base_url = f"https://{lang}.wikipedia.org/w/api.php"

    params = {
        "action": "query",
        "meta": "siteinfo",
        "siprop": "namespaces",
        "format": "json"
    }

    response = requests.get(base_url, params=params)
    response.raise_for_status()
    data = response.json()

    if (type == "category"):
        # Namespace ID for categories is always 14
        prefix = data["query"]["namespaces"]["14"]["*"]
    else:
        prefix = data["query"]["namespaces"]["100"]["*"]

    return prefix


# Fetch supported languages (with caching)
def get_supported_languages(request):
    """
    Return a JSON list of supported Wikipedia languages, using cache if available.

    :param request: Django HTTP request
    :return: JsonResponse with list of supported languages
    """
    # Try to get languages from cache first
    cached_languages = cache.get("supported_languages")

    if cached_languages:
        return JsonResponse({"languages": cached_languages})

    # If not cached, fetch from the Wikimedia API
    api_url = "https://www.mediawiki.org/w/api.php?action=sitematrix&format=json&origin=*"
    try:
        response = requests.get(api_url)
        response.raise_for_status()  # Raise an error for bad responses
        data = response.json()

        # Extracting the languages from the API response
        languages = []

        for value in data['sitematrix'].values():
            if isinstance(value, dict) and 'code' in value:

                name = value.get('localname',
                                 'Unknown Language')  # Default to 'Unknown Language' if 'localname' is missing
                native_name = value.get('name',
                                 'Unknown Language')  # Default to 'Unknown Language' if 'localname' is missing
                languages.append({"code": value['code'],
                                  "name": name,
                                  "native_name": native_name
                                  })

        # Cache the result for 24 hours (86400 seconds)
        cache.set("supported_languages", languages, timeout=86400)

        # Return the list of languages as a JSON response
        return JsonResponse({"languages": languages})

    except requests.RequestException as e:
        error_message = f"An error occurred while searching for languages: {e}"
        return JsonResponse({"error": "Failed to fetch data from Wikipedia. Please try again later."}, status=500)


def get_categories_with_query(request, lang, query):
    """
    Fetch categories dynamically based on a query string, filtering directly in the API request.

    :param request: Django HTTP request
    :param lang: Wikipedia language code
    :param query: Query string for category prefix
    :return: JsonResponse with list of categories or error
    """

    if not query:
        # If no query is provided, return there is no query
        return JsonResponse({"error": "there is no query"}, status=500)

    base_url = f"https://{lang}.wikipedia.org/w/api.php"

    params = {
        "action": "query",
        "list": "allcategories",
        "acprefix": query,  # Direct filtering using query prefix
        "aclimit": 50,  # Limit results to 50 (can be adjusted)
        "format": "json",
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        # Extract filtered categories
        categories = [cat["*"] for cat in data.get("query", {}).get("allcategories", [])]

        return JsonResponse({"categories": categories}, status=200)

    except requests.RequestException as e:
        return JsonResponse({"error": f"Failed to fetch categories: {str(e)}"}, status=500)


def get_qcode(page_name, lang, type="category"):
    """
    Retrieve the universal Wikidata Q-code for a Wikipedia page (category or portal).

    :param page_name: Name of the page
    :param lang: Wikipedia language code
    :param type: Type of page ('category' or 'portal')
    :return: Q-code string or None if not found
    """
    try:
        if type == "category":
            categoryPrefix = get_prefix(lang, "category")
            page_name = categoryPrefix+":"+page_name
        else:
            portalPrefix = get_prefix(lang,"portal")
            page_name = portalPrefix+":"+page_name

        wikipedia_url =\
            f"https://{lang}.wikipedia.org/w/api.php?action=query&titles={page_name}&prop=pageprops&format=json"
        response = requests.get(wikipedia_url)
        response.raise_for_status()
        data = response.json()
        """
        example for response to "Category:art" in english "en"
        https://en.wikipedia.org/w/api.php?action=query&titles=Category:art&prop=pageprops&format=json
        {
          "batchcomplete": "",
          "query": {
            "normalized": [
              {
                "from": "Category:art",
                "to": "Category:Art"
              }
            ],
            "pages": {
              "5344528": {
                "pageid": 5344528,
                "ns": 14,
                "title": "Category:Art",
                "pageprops": {
                  "wikibase_item": "Q9709140"
                }
              }
            }
          }
        }
        """

        """ 
        example for response to "تصنيف:الصحة" in arabic "ar" that does not have a wikipedia pages in any language
        {'batchcomplete': '',
         'query': 
         {'pages':
          {'1056957':
           {'pageid':1056957,
            'ns': 14,
             'title': 'ØªØµÙ†ÙŠÙ:Ø§Ù„ØµØ­Ø©',
             'pageprops': {'expectunusedcategory': '', 'unexpectedUnconnectedPage': '-14'}}}}}
        """

        if data['query']:
            # there is only one-pageID
            pid = next(iter(data['query']['pages']))
            res_qcode = data['query']['pages'][pid]['pageprops'].get('wikibase_item')
            return res_qcode
        else:
            raise ValueError(f"query {page_name} not found on wikipedia.")
    except Exception as e:
        return None


def get_page_name_in_refer_lang(qcode, refer_lang, edit_lang=None):
    """
    Retrieve the localized page name in the reference language using the Wikidata Q-code.

    :param qcode: Wikidata Q-code
    :param refer_lang: Reference Wikipedia language code
    :param edit_lang: (Optional) Contribution language code
    :return: Page name in reference language or None
    """
    try:
        # Query Wikidata to get translations for the Q code
        wikidata_url \
            = (f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={qcode}&props=labels&languages={refer_lang}&format=json")
        response = requests.get(wikidata_url)
        response.raise_for_status()
        data = response.json()
        """
        example of a json response dor Q2 in english:
        #     "entities": {
        #         "Q2": {
        #             "type": "item",
        #             "id": "Q2",
        #             "labels": {
        #                 "en": {
        #                     "language": "en",
        #                     "value": "Earth"
        #                 }
        #             }
        #         }
        #     },
        #     "success": 1
        # }
        """

        # Check if the Q-code exists in the response
        entity = data.get("entities", {}).get(qcode, {})
        labels = entity.get("labels", {})
        if refer_lang in labels:
            the_category_name = labels[refer_lang]["value"]
            return the_category_name
        else:
            return None

    except UnicodeEncodeError as e:
        return None

    except json.JSONDecodeError as e:
        return None

    except Exception as e:
        return None


def get_all_subcategories(lang, category, visited=None, current_depth=0, max_depth=1):
    """
    Recursively retrieve all subcategories of a category up to a maximum depth.

    :param lang: Wikipedia language code
    :param category: Name of the category
    :param visited: Set to avoid cycles
    :param current_depth: Current recursion depth
    :param max_depth: Maximum allowed depth (default 1)
    :return: List of all subcategory names
    """
    if visited is None:
        visited = set()
    
    if current_depth >= max_depth:
        return []
    
    if category in visited:
        return []
    
    visited.add(category)
    subcategories = []
    
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": category,
        "cmtype": "subcat",  
        "cmlimit": 10,
        "format": "json"
    }
    
    url = WIKI_API_URL.format(lang=lang)
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    
    # Ajouter les sous-catégories directes
    for member in data.get("query", {}).get("categorymembers", []):
        subcat = member["title"]
        subcategories.append(subcat)
        subcategories.extend(get_all_subcategories(lang, subcat, visited, current_depth + 1, max_depth))
    
    return subcategories


def get_articles_from_other_languages(request, edit_lang, category, refer_lang):
    """
    Retrieve missing articles in the target language by comparing categories and subcategories with the reference language.

    :param request: Django HTTP request
    :param edit_lang: Contribution language code
    :param category: Category name in contribution language
    :param refer_lang: Reference language code
    :return: JsonResponse with list of missing articles (title, source)
    """
    articles = []
    try:
        # Get the Q code for the category from Wikidata
        qcode = get_qcode(category, edit_lang)
        if not qcode:
            return JsonResponse({"noQCode": "Category not found in wikipedia"})

        # Get the localized category names for the selected Q code
        category_name_in_refer_lang = get_page_name_in_refer_lang(qcode, refer_lang, edit_lang)
        if not category_name_in_refer_lang:
            return JsonResponse({"noCatError": " category names not found"}, status=400)

        max_depth = int(request.GET.get('max_depth',1))
        print("max_depth reçu :", max_depth)
        all_categories = [category_name_in_refer_lang]  # La catégorie principale
        all_categories.extend(get_all_subcategories(refer_lang, category_name_in_refer_lang, max_depth=max_depth))

        for current_category in all_categories:
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": current_category,
                "cmtype": "page", 
                "cmlimit": 20,  
                "format": "json",
            }
            url = WIKI_API_URL.format(lang=refer_lang)
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()


            articles.extend({
                "title": article["title"],
                "source": current_category
            } for article in data["query"]["categorymembers"])

        # Supprimer les doublons par titre (en gardant la première source trouvée)
        seen_titles = set()
        unique_articles = []
        for art in articles:
            if art["title"] not in seen_titles:
                unique_articles.append(art)
                seen_titles.add(art["title"])

        return JsonResponse({"articles": unique_articles})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def custom_404(request, exception):
    """
    Render a custom 404 error page.

    :param request: Django HTTP request
    :param exception: Exception object
    :return: Rendered 404.html page with status 404
    """
    # The requested resource could not be found.
    return render(request, '404.html', status=404)

