
from django.shortcuts import render, redirect
from django.db import connection
import requests
from django.http import HttpResponse
from django.http import JsonResponse

def fetch_wikipedia_api(api_url, params):
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"API request failed: {e}")


def fetch_paginated_data(api_url, params, key):
    data = []
    while True:
        response = fetch_wikipedia_api(api_url, params)
        data.extend(response.get("query", {}).get(key, []))
        if "continue" not in response:
            break
        params.update(response["continue"])
    return data


def dictfetchall(cursor):
    # Return all rows from a cursor as a dict
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
# Create your views here.

def index(request):
    return render(request, 'index.html')


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

# Step 1: Select Language
def select_language(request):
    if request.method == "POST":
        language_code = request.POST.get("language_code")
        return fetch_categories(request, language_code)
    return render(request, "select_language.html")

# Step 2: Fetch Categories for Selected Language
# def fetch_categories(request, language_code):
#     api_url = f"https://{language_code}.wikipedia.org/w/api.php"
#     try:
#         category_params = {
#             "action": "query",
#             "list": "allcategories",
#             "aclimit": 50,  # Limit to 50 categories
#             "format": "json"
#         }
#         response = requests.get(api_url, params=category_params)
#         response.raise_for_status()
#         categories = response.json().get("query", {}).get("allcategories", [])
#     except requests.exceptions.RequestException as e:
#         return HttpResponse(f"Error fetching categories for language '{language_code}': {e}", status=500)
#
#     return render(request, "fetch_categories.html", {
#         "categories": categories,
#         "language_code": language_code,
#     })


def fetch_categories(request, language_code):
    if request.method == "POST":
        category_name = request.POST.get("category_name")
        if category_name:
            # Render the categories on the page
            return render(request, "fetch_articles_in_category.html", {
                "categories": [],
                "language_code": language_code,
                "category_name": category_name,
            })
        api_url = f"https://{language_code}.wikipedia.org/w/api.php"
        try:
            # Define the API parameters for fetching categories
            category_params = {
                "action": "query",
                "list": "allcategories",
                "aclimit": 5000,  # Limit to 5000 categories
                "format": "json"
            }

            # Make the API request
            response = requests.get(api_url, params=category_params)
            response.raise_for_status()  # Raise an exception for HTTP errors

            # Process the response and extract categories
            data = response.json()
            raw_categories = data.get("query", {}).get("allcategories", [])

            # If no categories are found
            if not raw_categories:
                return HttpResponse(f"No categories found for language '{language_code}'.", status=404)

            # Convert raw categories into a list of dictionaries with 'name' key
            categories = [{"name": cat.get("*", "Unknown")} for cat in raw_categories]
            # if category_name:
            #     # Render the categories on the page
            #     return render(request, "fetch_articles_in_category.html", {
            #         "categories": categories,
            #         "language_code": language_code,
            #         "category_name": category_name,
            #     })
            return render(request, "fetch_categories.html", {
                "language_code": language_code,
                "categories": categories,
            })

        except requests.exceptions.RequestException as e:
            # If there's an error in the request, return a helpful message
            return HttpResponse(f"Error fetching categories for language '{language_code}': {e}", status=500)
        except ValueError:
            # Handle JSON decoding error
            return HttpResponse("Error decoding response from Wikipedia API.", status=500)


    return render(request, "fetch_categories.html", {
            "language_code": language_code,
        })
#
# def fetch_articles_in_category(request, language_code, category_name):
#     api_url = f"https://{language_code}.wikipedia.org/w/api.php"
#     articles = []
#
#     try:
#         # Fetch articles in the selected category
#         category_params = {
#             "action": "query",
#             "list": "categorymembers",
#             "cmtitle": f"Category:{category_name}",
#             "cmlimit": 5000,  # Limit the number of results
#             "format": "json"
#         }
#
#         response = requests.get(api_url, params=category_params)
#         response.raise_for_status()
#
#         # Extract articles from the response
#         raw_articles = response.json().get("query", {}).get("categorymembers", [])
#         articles = [{"title": article["title"]} for article in raw_articles]
#
#     except requests.exceptions.RequestException as e:
#         return HttpResponse(f"Error fetching articles in category '{category_name}': {e}", status=500)
#
#     return render(request, "fetch_articles_in_category.html", {
#         "articles": articles,
#         "category_name": category_name,
#         "language_code": language_code
#     })

def set_language_and_category(request):
    if request.method == "POST":
        language_code = request.POST.get("language_code")
        category_name = request.POST.get("category_name")
        request.session["language_code"] = language_code
        request.session["category_name"] = category_name
        return redirect("fetch_articles_in_category")

def fetch_articles_in_category(request, categories, language_code,category_name):
    # Step 1: Retrieve inputs from the request
    # language_code = request.GET.get('language_code') or request.POST.get('language_code')
    # category_name = request.GET.get('category_name') or request.POST.get('category_name')

    # # Step 2: Validate inputs
    # if not language_code or not category_name:
    #     return JsonResponse({"error": "Language code and category name are required."}, status=400)

    # Step 2: Validate inputs
    if not language_code or not categories:
        return JsonResponse({"error": "There are no categories."}, status=400)

    # Step 3: Build the Wikipedia API request
    wikipedia_api_url = f"https://{language_code}.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{category_name}",
        "cmlimit": 50,
        "format": "json",
    }

    try:
        # Step 4: Make the API call
        response = requests.get(wikipedia_api_url, params=params)
        response.raise_for_status()

        data = response.json()

        # Step 5: Process API response
        if "query" in data and "categorymembers" in data["query"]:
            articles = [
                {
                    "title": article["title"],
                    "pageid": article["pageid"],
                }
                for article in data["query"]["categorymembers"]
            ]
            return JsonResponse({"articles": articles}, status=200)

        # Handle cases with no results
        return JsonResponse({"error": f"No articles found in category '{category_name}'."}, status=404)

    except requests.exceptions.RequestException as e:
        # Handle errors
        return JsonResponse({"error": f"Failed to fetch articles: {str(e)}"}, status=500)



