
from django.urls import path

from .views import (
    IssueDetailView,
    IssueListCreateView,
    ProjectDetailView,
    ProjectListCreateView,
    ProjectMembersView,
)

urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="project-list-create"),
    path("<int:project_id>/members/", ProjectMembersView.as_view(), name="project-members"),
    path("<int:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("issues/", IssueListCreateView.as_view(), name="issue-list-create"),
    path("issues/<int:pk>/", IssueDetailView.as_view(), name="issue-detail"),
]
