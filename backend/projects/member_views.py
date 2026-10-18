# BACKEND: Project member listing endpoint
# Save as: backend/projects/member_views.py
# Assumes existing ProjectMembership model has fields `project`, `user`, `role`.
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import PermissionDenied
from .models import ProjectMembership

class ProjectMemberSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ("id", "username", "role")

class ProjectMemberListView(generics.ListAPIView):
    serializer_class = ProjectMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs["project_id"]
        if not ProjectMembership.objects.filter(project_id=project_id, user=self.request.user).exists():
            raise PermissionDenied("You are not a member of this project.")
        return ProjectMembership.objects.filter(project_id=project_id).select_related("user").order_by("user__username")
