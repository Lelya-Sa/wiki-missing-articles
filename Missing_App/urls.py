
from django.urls import path
from . import views
from .views import fetch_categories, fetch_articles_in_category

urlpatterns = [
    path('', views.index, name='index'),
    path('search_by_q', views.search_by_q, name='search_by_q'),
    path('select_language', views.select_language, name='select_language'),
    # path('fetch-categories/<str:language_code>/', fetch_categories, name='fetch_categories'),
    # path('fetch-articles/<str:language_code>/<str:category_name>/',
    #      fetch_articles_in_category,
    #      name='fetch_articles_in_category'),
    path('fetch-categories', views.fetch_categories, name='fetch_categories'),
    path('fetch-articles',
         views.fetch_articles_in_category,
         name='fetch_articles_in_category'),

]
