
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



