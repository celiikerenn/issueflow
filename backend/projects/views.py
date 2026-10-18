from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions

from .models import Issue, Project, ProjectMembership
from .permissions import IsProjectOwner
from .serializers import (
    IssueSerializer,
    ProjectMemberSerializer,
    ProjectSerializer,
)


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(
            memberships__user=self.request.user
        ).distinct()

    @transaction.atomic
    def perform_create(self, serializer):
        project = serializer.save(owner=self.request.user)
        ProjectMembership.objects.get_or_create(
            project=project,
            user=self.request.user,
            defaults={"role": ProjectMembership.Role.ADMIN},
        )


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectOwner]

    def get_queryset(self):
        return Project.objects.filter(
            memberships__user=self.request.user
        ).distinct()


class ProjectMembersView(generics.ListAPIView):
    serializer_class = ProjectMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs["project_id"]
        project = get_object_or_404(
            Project.objects.filter(memberships__user=self.request.user).distinct(),
            pk=project_id,
        )
        return ProjectMembership.objects.filter(
            project=project
        ).select_related("user").order_by("user__username")


class IssueListCreateView(generics.ListCreateAPIView):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Issue.objects.filter(
            project__memberships__user=self.request.user
        ).select_related(
            "project", "reporter", "assignee"
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)


class IssueDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Issue.objects.filter(
            project__memberships__user=self.request.user
        ).select_related(
            "project", "reporter", "assignee"
        ).distinct()
