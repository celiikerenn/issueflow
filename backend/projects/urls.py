
from django.urls import path

from .views import (
    IssueDetailView,
    IssueListCreateView,
    ProjectDetailView,
    ProjectListCreateView,
    ProjectMemberDeleteView,
    ProjectAvailableMembersView,
    ProjectMembersView,
)

urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="project-list-create"),
    path("<int:project_id>/members/", ProjectMembersView.as_view(), name="project-members"),
    path("<int:project_id>/members/<int:user_id>/", ProjectMemberDeleteView.as_view(), name="project-member-delete"),
    path("<int:project_id>/available-members/", ProjectAvailableMembersView.as_view(), name="project-available-members"),
    path("<int:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("issues/", IssueListCreateView.as_view(), name="issue-list-create"),
    path("issues/<int:pk>/", IssueDetailView.as_view(), name="issue-detail"),
]
