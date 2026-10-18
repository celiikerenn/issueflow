from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

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

    def post(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id)
        membership = ProjectMembership.objects.filter(
            project=project, user=request.user
        ).first()
        if project.owner_id != request.user.id and not (
            membership and membership.role == ProjectMembership.Role.ADMIN
        ):
            return Response({"detail": "Only project admins can manage members."}, status=403)

        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"user_id": "This field is required."}, status=400)
        user = get_object_or_404(get_user_model(), pk=user_id)
        member, created = ProjectMembership.objects.get_or_create(
            project=project, user=user,
            defaults={"role": ProjectMembership.Role.MEMBER},
        )
        data = ProjectMemberSerializer(member).data
        return Response(data, status=201 if created else 200)


class ProjectMemberDeleteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, project_id, user_id):
        project = get_object_or_404(Project, pk=project_id)
        membership = ProjectMembership.objects.filter(
            project=project, user=request.user
        ).first()
        if project.owner_id != request.user.id and not (
            membership and membership.role == ProjectMembership.Role.ADMIN
        ):
            return Response({"detail": "Only project admins can manage members."}, status=403)
        if project.owner_id == user_id:
            return Response({"detail": "The project owner cannot be removed."}, status=400)
        target = get_object_or_404(ProjectMembership, project=project, user_id=user_id)
        with transaction.atomic():
            Issue.objects.filter(project=project, assignee_id=user_id).update(assignee=None)
            target.delete()
        return Response(status=204)


class ProjectAvailableMembersView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project = get_object_or_404(Project, pk=self.kwargs["project_id"])
        membership = ProjectMembership.objects.filter(
            project=project, user=self.request.user
        ).first()
        if project.owner_id != self.request.user.id and not (
            membership and membership.role == ProjectMembership.Role.ADMIN
        ):
            raise PermissionDenied("Only project admins can manage members.")
        User = get_user_model()
        return User.objects.exclude(
            project_memberships__project=project
        ).order_by("username")

    def list(self, request, *args, **kwargs):
        users = self.get_queryset()
        return Response([{
            "id": user.id,
            "username": user.username,
            "display_name": user.get_full_name().strip() or user.username,
        } for user in users])


class IssueListCreateView(generics.ListCreateAPIView):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Issue.objects.filter(
            project__memberships__user=self.request.user
        ).select_related(
            "project", "reporter", "assignee"
        ).distinct()
        assignee = self.request.query_params.get("assignee")
        if assignee == "UNASSIGNED":
            queryset = queryset.filter(assignee__isnull=True)
        elif assignee:
            if not assignee.isdecimal():
                raise ValidationError({"assignee": "Use a user ID or UNASSIGNED."})
            queryset = queryset.filter(assignee_id=assignee)
        return queryset

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
