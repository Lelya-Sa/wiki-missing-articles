import json

from django.shortcuts import render, redirect
from django.db import connection
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import render
from django.http import JsonResponse
import requests
from django.core.cache import cache  # Import Django's caching framework


from django.shortcuts import render


def custom_404(request, exception):
    # The requested resource could not be found.
    return render(request, '404.html', status=404)


def dictfetchall(cursor):
    # Return all rows from a cursor as a dict
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
# Create your views here.


def index(request):
    return render(request, 'index.html')


WIKI_API_URL = "https://{lang}.wikipedia.org/w/api.php"
WIKIDATA_URL = "https://www.wikidata.org/wiki/Special:EntityData/{qcode}.json"

from django.shortcuts import redirect

def translated_page(request):
    lang = request.GET.get("lang", "en")  # Default to English if no language is selected
    wikipedia_url = f"https://{lang}.wikipedia.org"  # Construct the Wikipedia URL for the selected language
    return redirect(wikipedia_url)

# Fetch supported languages (with caching)
def get_supported_languages(request):
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
                languages.append({"code": value['code'], "name": name})

        # Cache the result for 24 hours (86400 seconds)
        cache.set("supported_languages", languages, timeout=86400)

        # Return the list of languages as a JSON response
        return JsonResponse({"languages": languages})

    except requests.RequestException as e:
        result_message = f"An error occurred while searching for language: {e}"
        return JsonResponse({"error": "Failed to fetch data from Wikipedia. Please try again later."}, status=500)


def get_categories(request, lang=None):
    lang = lang or request.GET.get("lang")  # Fallback to query parameter if `lang` isn't in the path
    if not lang:
        return JsonResponse({"error": "Language not specified."}, status=400)

    try:
        # Fetch the Q-code for "Category:Contents"
        contents_qcode = "Q4587687"  # Q-code for "Category:Contents" in English
        response = requests.get(WIKIDATA_URL.format(qcode=contents_qcode))
        response.raise_for_status()
        wikidata = response.json()

        # data = json.loads(wikidata)
        # print(wikidata)  # Check if the "categories" key exists
        # Get the name of "Category:Contents" in the selected language
        category_title = wikidata['entities'][contents_qcode]['labels'].get(lang, {}).get('value', 'Category:Contents')
        # print(category_title)
        # Use the dynamically fetched category title for the selected language
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category_title,  # Now using the correct translated category title
            "cmtype": "subcat",  # Get subcategories
            "cmlimit": 50,  # Limit to top-level categories
            "format": "json",
        }
        url = WIKI_API_URL.format(lang=lang)
        category_response = requests.get(url, params=params)
        category_response.raise_for_status()
        category_data = category_response.json()

        # Extract the top-level categories under 'Category:Contents'
        # print(category_data)
        categories = [
            category for category in category_data['query']['categorymembers']
        ]

        if not categories:
            return JsonResponse({"error": f"No categories found for {category_title} in this language."}, status=500)

        return JsonResponse({"categories": categories})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def get_localized_category_names(qcode):
    try:
        # Query Wikidata to get translations for the Q code
        wikidata_url = f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={qcode}&props=labels&languages=en,fr,de,es,it,ru,ja,zh,pt,ar&format=json"
        response = requests.get(wikidata_url)
        response.raise_for_status()
        data = response.json()

        # Extract and return the localized category names
        localized_names = {}
        for lang, label in data['entities'][qcode]['labels'].items():
            localized_names[lang] = label['value']

        return localized_names
    except Exception as e:
        print(f"Error fetching localized category names for {qcode}: {e}")
        return None


def get_category_qcode(category):
    try:
        # Query Wikidata to get the Q code for the category
        wikidata_url = f"https://www.wikidata.org/w/api.php?action=wbsearchentities&search={category}&language=en&limit=1&format=json"
        response = requests.get(wikidata_url)
        response.raise_for_status()
        data = response.json()

        if data['search']:
            # Return the Q code of the first search result (should be the correct category)
            return data['search'][0]['id']
        else:
            raise ValueError(f"Category {category} not found on Wikidata.")
    except Exception as e:
        print(f"Error fetching Q code for category {category}: {e}")
        return None


def get_articles_from_other_languages(request):
    lang = request.GET.get("lang")
    category = request.GET.get("category")
    articles = []

    try:
        # Get the Q code for the category from Wikidata
        qcode = get_category_qcode(category)
        if not qcode:
            return JsonResponse({"error": "Category not found in Wikidata"}, status=400)

        # Get the localized category names for the selected Q code
        localized_category_names = get_localized_category_names(qcode)
        if not localized_category_names:
            return JsonResponse({"error": "Localized category names not found"}, status=400)

        # Get the category name in the selected language
        if lang not in localized_category_names:
            return JsonResponse({"error": f"Category not available in language {lang}"}, status=400)

        selected_category = localized_category_names[lang]

        # Add the articles from the selected language (same process as before)
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": selected_category,
            "cmtype": "page",
            "cmlimit": 50,
            "format": "json",
        }
        url = WIKI_API_URL.format(lang=lang)
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        # Add the articles to the list
        articles.extend(article["title"] for article in data["query"]["categorymembers"])

        # Check if there's more data (pagination)
        while "continue" in data:
            params["cmcontinue"] = data["continue"]["cmcontinue"]
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # Add more articles to the list
            articles.extend(article["title"] for article in data["query"]["categorymembers"])

        # Now, we will fetch articles from the top 10 other languages, excluding the selected language
        common_languages = ['en', 'fr', 'de', 'es', 'it', 'ru', 'ja', 'zh', 'pt', 'ar']  # Most common languages
        common_languages.remove(lang)  # Remove the selected language

        random_articles = []
        for other_lang in common_languages:
            # Get the localized category name for the current language
            if other_lang not in localized_category_names:
                continue  # Skip if category is not available in this language

            other_category = localized_category_names[other_lang]
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": other_category,
                "cmtype": "page",
                "cmlimit": 50,
                "format": "json",
            }
            url = WIKI_API_URL.format(lang=other_lang)
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # Add the articles from the other language to the list if not already in the selected language
            for article in data["query"]["categorymembers"]:
                if article["title"] not in articles:
                    random_articles.append(article["title"])

                if len(random_articles) >= 100:
                    break

            if len(random_articles) >= 100:
                break

        # Ensure we have at least 100 articles
        random_articles = random_articles[:100]

        return JsonResponse({"articles": random_articles})

    except Exception as e:
        # logger.error(f"Error fetching articles from other languages: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


def search_by_q(request):
    if request.method == 'POST':
        language = request.POST.get('language')  # Example: 'he' for Hebrew
        q_value = request.POST.get('q_value')  # Example: 'Q1235487'

        # Query the Wikidata API for the given Q-value
        api_url = f"https://www.wikidata.org/wiki/Special:EntityData/{q_value}.json"

        try:
            response = requests.get(api_url)
            response.raise_for_status()  # Raise exception for HTTP errors

            # Parse the JSON data
            data = response.json()
            entity_data = data.get('entities', {}).get(q_value, {})
            sitelinks = entity_data.get('sitelinks', {})

            # Construct the expected key for the sitelink
            sitelink_key = f"{language}wiki"

            # Check if the sitelink exists
            is_found = sitelink_key in sitelinks

            # Prepare the result message
            if is_found:
                result_message = f"The Q-value '{q_value}' is already found in the '{language}' language."
            else:
                result_message = f"The Q-value '{q_value}' is NOT found in the '{language}' language."

        except requests.exceptions.RequestException as e:
            # Handle API request errors
            result_message = f"An error occurred while fetching data for Q-value '{q_value}': {e}"

        except Exception as e:
            # Handle any other exceptions
            result_message = f"An unexpected error occurred: {e}"

        # Pass the result to the context
        context = {
            'q_value': q_value,
            'language': language,
            'result_message': result_message,
        }
        return context

    return None


def missing_articles(request):
    if request.method == "POST":
        lang = request.POST.get("article-language-search")  # Get the selected language
        category = request.POST.get("all-category-search")  # Get the selected category

        if not lang or not category:
            return render(
                request,
                "missing_articles.html",
                {"error": "Please select both a language and a category."},
            )

        print("language: ", lang, ", category:", category)
        get_missing_articles(lang, category)

    return render(request, "missing_articles.html")


def get_missing_articles(request, lang, category):
    try:
        # Fetch missing articles using the Wikimedia API (adjust API call as needed)
        url = f"https://{lang}.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": "page",
            "cmlimit": 500,  # Adjust limit as needed
            "format": "json"
        }

        response = requests.get(url, params=params)
        data = response.json()
        articles = [page["title"] for page in data.get("query", {}).get("categorymembers", [])]

        return JsonResponse({"articles": articles})

    except requests.RequestException as e:
        return JsonResponse({"error": f"Failed to fetch categories: {str(e)}"}, status=500)


# def get_missing_articles(request):
#     lang = request.GET.get("lang")  # Selected language code
#     category = request.GET.get("category")  # Selected category title
#
#     if not lang or not category:
#         return JsonResponse({"error": "Language and category are required."}, status=400)
#
#     try:
#         # Step 1: Fetch articles in the selected category and language
#         params = {
#             "action": "query",
#             "list": "categorymembers",
#             "cmtitle": category,
#             "cmtype": "page",
#             "cmlimit": 500,  # Adjust limit as needed
#             "format": "json",
#         }
#         url = WIKI_API_URL.format(lang=lang)
#         response = requests.get(url, params=params)
#         response.raise_for_status()
#         data = response.json()
#
#         existing_articles = {article["title"] for article in data["query"]["categorymembers"]}
#
#         # Step 2: Fetch the Q-code for the category
#         qcode = get_category_qcode(category)
#         if not qcode:
#             return JsonResponse({"error": "Category Q-code not found."}, status=400)
#
#         # Step 3: Get localized category names
#         localized_names = get_localized_category_names(qcode)
#         if not localized_names:
#             return JsonResponse({"error": "Localized category names not found."}, status=400)
#
#         # Step 4: Compare articles across other languages
#         missing_articles_res = []
#         for other_lang, other_category in localized_names.items():
#             if other_lang == lang:  # Skip the selected language
#                 continue
#
#             params["cmtitle"] = other_category
#             url = WIKI_API_URL.format(lang=other_lang)
#             response = requests.get(url, params=params)
#             response.raise_for_status()
#             data = response.json()
#
#             # Compare articles and find missing ones
#             other_articles = {article["title"] for article in data["query"]["categorymembers"]}
#             missing_articles_res.extend(other_articles - existing_articles)
#
#         return JsonResponse({"missing_articles": missing_articles_res})
#
#     except Exception as e:
#         return JsonResponse({"error": str(e)}, status=500)


def get_portals(request, lang):
    """
    Fetch portals for a given language and optional query.
    """
    query = request.GET.get("query", "").strip()
    base_url = f"https://{lang}.wikipedia.org/w/api.php"

    params = {
        "action": "query",
        "list": "search",
        "srnamespace": 100,  # Namespace 100 is for portals
        "srlimit": 10,       # Limit the number of results
        "srsearch": query,   # Add search query if provided
        "format": "json",
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        # Extract portal information
        portals = []
        if "query" in data and "search" in data["query"]:
            for item in data["query"]["search"]:
                portals.append({
                    "title": item["title"],
                    "pageid": item["pageid"]
                })

        return JsonResponse({"portals": portals}, status=200)

    except requests.RequestException as e:
        print(f"Error fetching portals: {e}")
        return JsonResponse({"error": "Failed to fetch portals"}, status=500)


def get_categories_with_query(request, lang, query):
    """
    Fetch categories dynamically based on query, filtering directly in the API request.
    """
    # query = request.GET.get("query", "").strip()

    if not query:
        # If no query is provided, use a default query (e.g., "History" or any other default term)
        query = "History"
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
