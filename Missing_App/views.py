
from django.shortcuts import render
from django.db import connection
import requests



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




