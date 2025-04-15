
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/supported_languages/', views.get_supported_languages, name='supported_languages'),
    path('translated_page/', views.translated_page, name='translated_page'),
    path('missing_articles_by_category/', views.missing_articles_by_category, name='missing_articles_by_category'),
    path('get_articles_from_other_languages/<str:edit_lang>/<str:category>/<str:refer_lang>/'
         , views.get_articles_from_other_languages,
         name='get_articles_from_other_languages'),
    path('get_categories_with_query/<str:lang>/<str:query>/', views.get_categories_with_query,
         name='get_categories_with_query'),
]
