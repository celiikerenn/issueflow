from django.db import transaction
from rest_framework import generics, permissions

from .models import Project, ProjectMembership
from .permissions import IsProjectOwner
from .serializers import ProjectSerializer
from .models import Issue
from .serializers import IssueSerializer
from django.shortcuts import get_object_or_404


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

        ProjectMembership.objects.create(
            project=project,
            user=self.request.user,
            role=ProjectMembership.Role.ADMIN,
        )


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsProjectOwner,
    ]

    def get_queryset(self):
        return Project.objects.filter(
            memberships__user=self.request.user
        ).distinct()



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
