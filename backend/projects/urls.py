from django.urls import path

from .views import (
    IssueDetailView,
    IssueListCreateView,
    ProjectDetailView,
    ProjectListCreateView,
)

urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="project-list-create"),
    path("<int:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("issues/", IssueListCreateView.as_view(), name="issue-list-create"),
    path("issues/<int:pk>/", IssueDetailView.as_view(), name="issue-detail"),
]