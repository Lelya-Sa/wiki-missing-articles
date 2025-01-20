
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('search_by_name', views.search_by_name, name='search_by_name')

]
