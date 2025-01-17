
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    #בשביל שנידע בהמשך איך נוסיף קבצי html לפה

    # path('QueryResults', views.QueryResults, name='QueryResults'),
    # path('AddTransaction', views.AddTransaction, name='AddTransaction'),
    # path('BuyStocks', views.BuyStocks, name='BuyStocks')
]
