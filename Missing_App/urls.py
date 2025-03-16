
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('search_by_q', views.search_by_q, name='search_by_q'),
    path('api/supported_languages/', views.get_supported_languages, name='supported_languages'),
    path('translated_page/', views.translated_page, name='translated_page'),
    path('missing_articles/', views.missing_articles, name='missing_articles'),
    path('get_categories/<str:lang>/', views.get_main_categories, name='get_categories'),
    path('get_articles_from_other_languages/', views.get_articles_from_other_languages,
         name='get_articles_from_other_languages'),
    path('get_portals/<str:lang>/', views.get_portals, name='get_portals'),
    path('get_categories_with_query/<str:lang>/<str:query>/', views.get_categories_with_query,
         name='get_categories_with_query'),   # endpoint
    path('get_missing_articles/<str:edit_lang>/<str:category>/<str:refer_lang>/',
         views.get_missing_articles, name='get_missing_articles'), # endpoint


]
