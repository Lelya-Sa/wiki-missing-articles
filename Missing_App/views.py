import sys
sys.stdout.reconfigure(encoding='utf-8')  # Ensures proper encoding for print output

import json
from django.http import JsonResponse
import requests
from django.core.cache import cache  # Import Django's caching framework


WIKI_API_URL = "https://{lang}.wikipedia.org/w/api.php"
WIKIDATA_URL = "https://www.wikidata.org/wiki/Special:EntityData/{qcode}.json"

from django.shortcuts import redirect
from django.shortcuts import render


def dictfetchall(cursor):
    # Return all rows from a cursor as a dict
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
# Create your views here.


def index(request):
    """
        the entrance page of the tool
    """
    return render(request, 'index.html')


def missing_articles_by_category(request):
    """
        page used for: searching for missing articles by entering category and language.
        uses get_articles_from_other_languages function
    :param request:
    :return:
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

        print("in missing_articles language: ", edit_lang, ", category:", category)
        get_articles_from_other_languages(edit_lang, category, refer_lang)

    return render(request, "missing_articles_by_category.html")


def translated_page(request):  # TODO (not mandatory) currently redirects into language wikipedia
    """
         translates the tool page into given language.
    """
    lang = request.GET.get("lang", "en")  # Default to English if no language is selected
    wikipedia_url = f"https://{lang}.wikipedia.org"  # Construct the Wikipedia URL for the selected language
    return redirect(wikipedia_url)


def get_prefix(lang="en", type="category"):
    """
    Get the correct category namespace prefix for a given Wikipedia language.
    example : https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=namespaces&format=json

    :param lang: Wikipedia's language code (default: 'en' for English)
    :return: Category namespace prefix (e.g., 'Category:', 'تصنيف:', 'Kategorie:')
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


def get_categories_with_query(request, lang, query):
    """
    Fetch categories dynamically based on query, filtering directly in the API request.
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


def get_main_categories(request, lang=None):
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


def get_qcode(page_name, lang, type="category"):
    """ retrieves the universal qcode of the page from wikidata api

    :param page_name: the page you want its qcode
    :param lang: the language of this page
    :return: the universal qcode of the page
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
             'title': 'ØªØµÙ†ÙŠÙ�:Ø§Ù„ØµØ­Ø©',
             'pageprops': {'expectunusedcategory': '', 'unexpectedUnconnectedPage': '-14'}}}}}
        """

        print("in get_qcode ", data, end="" )
        if data['query']:
            # there is only one-pageID
            pid = next(iter(data['query']['pages']))
            res_qcode = data['query']['pages'][pid]['pageprops'].get('wikibase_item')
            print("the res_qcode is", res_qcode)
            return res_qcode
        else:
            raise ValueError(f"query {page_name} not found on wikipedia.")
    except Exception as e:
        print(f"Error fetching Q code for page_name {page_name}: {e}")
        return None


def get_page_name_in_refer_lang(qcode, refer_lang, edit_lang=None):
    """
     uses a universal qcode of storing data in wikidata, and retrieve the name of the page if existed
      in refer_lang - reference language.
    :param qcode: the universal qcode of the page name
    :param refer_lang:  the page language that you want to know its title
    :param edit_lang:  the page language that you already know its title
    :return:
    """
    try:
        # Query Wikidata to get translations for the Q code
        print("in get_page_name... qcode is ", qcode, " refer_lang", refer_lang)
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
        print("in get_category_name_in_refer_lang: the data is: ", data)
        if refer_lang in labels:
            the_category_name = labels[refer_lang]["value"]
            print("in get_category_name_in_refer_lang: the_category_name is... ",
                  the_category_name.encode('utf-8', 'ignore').decode('utf-8'))
            return the_category_name
        else:
            print(f"Error: Category name not found for language {refer_lang}")
            return None

    except UnicodeEncodeError as e:
        print(f"Encoding error: {e}")
        return None

    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None

    except Exception as e:
        print(f"Unexpected error: {e}")
        return None


def get_articles_from_other_languages(request, edit_lang, category, refer_lang):
    articles = []
    print("in get_articles_from_other_languages")
    try:
        # Get the Q code for the category from Wikidata
        qcode = get_qcode(category, edit_lang)
        if not qcode:
            return JsonResponse({"noQCode": "Category not found in wikipedia"})

        # Get the localized category names for the selected Q code
        category_name_in_refer_lang = get_page_name_in_refer_lang(qcode, refer_lang, edit_lang)
        if not category_name_in_refer_lang:
            return JsonResponse({"noCatError": " category names not found"}, status=400)

        print(
            f"in get_articles_from_other_languages: "
            f"Fetching articles from {refer_lang}.wikipedia.org in category: "
            f"{category_name_in_refer_lang}")  # Debugging

        # Add the articles from the selected language (same process as before)
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"{category_name_in_refer_lang}",
            "cmtype": "page",
            "cmlimit": 50,
            "format": "json",
        }
        url = WIKI_API_URL.format(lang=refer_lang)
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        """ 
            example of a response for تصنيف:صحة for arabic (ar) language: 
            {
              "batchcomplete": "",
              "continue": {
                "cmcontinue": 
                "page|d8a7d984d8a5d8afd8a7d8b1d8a920d8a7d984d8b9d8a7d985d8a920d984d984d8b5d8add8a920d8a7d984d8b9d8b3d983d8b1d98ad8a9|3368070",
                "continue": "-||"
              },
              "query": {
                "categorymembers": [
                  {
                    "pageid": 1846,
                    "ns": 0,
                    "title": "صحة"
                  },
                  {
                    "pageid": 8687431,
                    "ns": 2,
                    "title": "مستخدم:2marwa musa/ملعب"
                  },
                  {
                    "pageid": 9424998,
                    "ns": 2,
                    "title": "مستخدم:Haton123th/4ملعب"
                  },
                  {
                    "pageid": 8970486,
                    "ns": 2,
                    "title": "مستخدم:RAHMA MOHAMMED SALAHUDDIN/ملعب"
                  },
                  {
                    "pageid": 5725344,
                    "ns": 0,
                    "title": "إصحاح بيئي"
                  },
                  {
                    "pageid": 6493745,
                    "ns": 0,
                    "title": "اختلال الميكروبيوم"
                  },
                  {
                    "pageid": 6560302,
                    "ns": 0,
                    "title": "استرات ايثيل حمض أوميجا 3"
                  },
                  {
                    "pageid": 9254410,
                    "ns": 0,
                    "title": "الأثر النفسي للتمييز على الصحة"
                  },
                  {
                    "pageid": 9371273,
                    "ns": 0,
                    "title": "الأخبار الطبية اليوم (موقع)"
                  },
                  {
                    "pageid": 9365188,
                    "ns": 0,
                    "title": "الأسبوع الوطني لعدم التدخين"
                  }
                ]
              }
            }            
        """
        print("in get_articles_from_other_languages, data:", data)

        # Add the articles to the list
        articles.extend(article["title"] for article in data["query"]["categorymembers"])

        # Check if there's more data (pagination)
        while "continue" in data:
            print("in get_articles_from_other_languages, continue?: ", data["continue"]["cmcontinue"])
            params["cmcontinue"] = data["continue"]["cmcontinue"]
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # Add more articles to the list
            articles.extend(article["title"] for article in data["query"]["categorymembers"])

        return JsonResponse({"articles": articles})

    except Exception as e:
        # logger.error(f"Error fetching articles from other languages: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


#
#
#
#
"""
"
"
"
the functions below are not in use right now but maybe will in the future!!!!! 
"
"
"
"""

def custom_404(request, exception):
    # The requested resource could not be found.
    return render(request, '404.html', status=404)

