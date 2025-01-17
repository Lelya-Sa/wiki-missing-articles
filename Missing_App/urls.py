
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('search_by_q', views.search_by_q, name='search_by_q')

]
