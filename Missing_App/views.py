
from django.shortcuts import render
from django.db import connection
import requests
from django.http import HttpResponse


def dictfetchall(cursor):
    # Return all rows from a cursor as a dict
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
# Create your views here.

def index(request):
    return render(request, 'index.html')

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

    except requests.exceptions.RequestException as e:
        # If there's an error in the request, return a helpful message
        return HttpResponse(f"Error fetching categories for language '{language_code}': {e}", status=500)
    except ValueError:
        # Handle JSON decoding error
        return HttpResponse("Error decoding response from Wikipedia API.", status=500)

    # Render the categories on the page
    return render(request, "fetch_categories.html", {
        "categories": categories,
        "language_code": language_code,
    })

def fetch_articles_in_category(request, language_code, category_name):
    api_url = f"https://{language_code}.wikipedia.org/w/api.php"
    articles = []

    try:
        # Fetch articles in the selected category
        category_params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category_name}",
            "cmlimit": 5000,  # Limit the number of results
            "format": "json"
        }

        response = requests.get(api_url, params=category_params)
        response.raise_for_status()

        # Extract articles from the response
        raw_articles = response.json().get("query", {}).get("categorymembers", [])
        articles = [{"title": article["title"]} for article in raw_articles]

    except requests.exceptions.RequestException as e:
        return HttpResponse(f"Error fetching articles in category '{category_name}': {e}", status=500)

    return render(request, "articles_in_category.html", {
        "articles": articles,
        "category_name": category_name,
        "language_code": language_code
    })