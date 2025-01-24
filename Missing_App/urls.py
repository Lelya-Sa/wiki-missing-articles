
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('search_by_q', views.search_by_q, name='search_by_q'),
    path('search_by_name', views.search_by_name, name='search_by_name'),
    path('api/supported_languages/', views.get_supported_languages, name='supported_languages'),
    path('translated_page/', views.translated_page, name='translated_page'),
    path('missing_articles', views.missing_articles, name='missing_articles'),
    path('get_categories/<str:lang>/', views.get_categories, name='get_categories'),
    path('get_missing_articles/', views.get_missing_articles, name='get_missing_articles'),
    path('get_articles_from_other_languages/', views.get_articles_from_other_languages,
         name='get_articles_from_other_languages'),

]
