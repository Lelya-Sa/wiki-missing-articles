
from django.shortcuts import render, redirect
from django.db import connection
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import render
from django.http import JsonResponse
import requests
from django.core.cache import cache  # Import Django's caching framework


def dictfetchall(cursor):
    # Return all rows from a cursor as a dict
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
# Create your views here.


def index(request):
    return render(request, 'index.html')


WIKI_API_URL = "https://{lang}.wikipedia.org/w/api.php"
WIKIDATA_URL = "https://www.wikidata.org/wiki/Special:EntityData/{qcode}.json"


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


def get_categories(request, lang):
    try:
        # Fetch the Q-code for "Category:Contents"
        contents_qcode = "Q4587687"  # Q-code for "Category:Contents" in English
        response = requests.get(WIKIDATA_URL.format(qcode=contents_qcode))
        response.raise_for_status()
        wikidata = response.json()

        # Get the name of "Category:Contents" in the selected language
        category_title = wikidata['entities'][contents_qcode]['labels'].get(lang, {}).get('value', 'Category:Contents')

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
        categories = [
            category['title'] for category in category_data['query']['categorymembers']
        ]

        if not categories:
            return JsonResponse({"error": f"No categories found for {category_title} in this language."}, status=500)

        return JsonResponse({"categories": categories})

    except Exception as e:
        # Log the error with more detailed information
        # logger.error(f"Error fetching categories for lang: {lang}. Error: {str(e)}")
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


# Fetch articles missing in the selected language (with pagination support)
def get_missing_articles(request):
    lang = request.GET.get("lang")
    category = request.GET.get("category")

    articles = []
    try:
        # Initial request for the first set of articles
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category,
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

        # Return all articles
        return JsonResponse({"articles": articles})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)




def search_by_name(request):
    if request.method == 'POST':
        language_code = request.POST.get('language')  # Example: 'ar' for Arabic
        article_name = request.POST.get('article_name')  # Example: 'Douglas Adams'

        # Step 1: Fetch the Q-value for the given article name using the Wikidata API
        search_url = f"https://www.wikidata.org/w/api.php?action=wbsearchentities&search={article_name}&language=en&format=json"

        try:
            # Query the Wikidata search API for the Q-value
            search_response = requests.get(search_url)
            search_response.raise_for_status()
            search_data = search_response.json()

            # Get the first search result's Q-value
            search_results = search_data.get('search', [])
            if not search_results:
                return render(request, 'search_by_name.html', {
                    'result_message': f"No Q-value found for the article name '{article_name}'. Please try a different name.",
                })

            # Get the Q-value from the first search result
            q_value = search_results[0]['id']  # Example: 'Q42' for Douglas Adams

            # Step 2: Fetch the sitelinks for the Q-value
            api_url = f"https://www.wikidata.org/wiki/Special:EntityData/{q_value}.json"
            q_response = requests.get(api_url)
            q_response.raise_for_status()


            # Parse the Q-value data
            q_data = q_response.json()
            entity_data = q_data.get('entities', {}).get(q_value, {})
            sitelinks = entity_data.get('sitelinks', {})

            # Construct the sitelink key for the language (e.g., 'arwiki' for Arabic)
            sitelink_key = f"{language_code}wiki"

            # Check if the sitelink exists
            is_found = sitelink_key in sitelinks

            # Prepare the result message
            if is_found:
                result_message = f"The article '{article_name}' (Q-value: {q_value}) is already found in the '{language_code}' language."
            else:
                result_message = f"The article '{article_name}' (Q-value: {q_value}) is NOT found in the '{language_code}' language."

        except requests.exceptions.RequestException as e:
            result_message = f"An error occurred while searching for '{article_name}': {e}"

        # Pass the result to the context
        context = {
            'article_name': article_name,
            'language': language_code,
            'result_message': result_message,
        }
        return render(request, 'search_by_name.html', context)

    return render(request, 'search_by_name.html')



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
        return render(request, 'search_by_q.html', context)

    return render(request, 'search_by_q.html')


def missing_articles(request):
    return render(request, 'missing_articles.html')
