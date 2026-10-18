from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Issue, Project, ProjectMembership

User = get_user_model()


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "key",
            "description",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "created_at", "updated_at"]



class ProjectMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMembership
        fields = [
            "id",
            "user",
            "username",
            "display_name",
            "role",
            "joined_at",
        ]
        read_only_fields = fields

    def get_display_name(self, obj):
        full_name = obj.user.get_full_name().strip()
        return full_name or obj.user.username



class IssueSerializer(serializers.ModelSerializer):
    reporter = serializers.ReadOnlyField(source="reporter.username")
    assignee_username = serializers.CharField(
        source="assignee.username", read_only=True, allow_null=True
    )
    assignee_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            "id",
            "project",
            "title",
            "description",
            "status",
            "priority",
            "reporter",
            "assignee",
            "assignee_username",
            "assignee_display_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "assignee_username",
            "assignee_display_name",
            "created_at",
            "updated_at",
        ]

    def get_assignee_display_name(self, obj):
        if not obj.assignee:
            return None
        full_name = obj.assignee.get_full_name().strip()
        return full_name or obj.assignee.username

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = attrs.get("project", getattr(self.instance, "project", None))
        assignee = attrs.get("assignee", getattr(self.instance, "assignee", None))

        if assignee and project:
            is_member = ProjectMembership.objects.filter(
                project=project, user=assignee
            ).exists()
            if not is_member:
                raise serializers.ValidationError({
                    "assignee": "Assignee must be a member of the selected project."
                })
        return attrs
