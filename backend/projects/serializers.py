from rest_framework import serializers

from .models import Project


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

        
from .models import Issue


class IssueSerializer(serializers.ModelSerializer):
    reporter = serializers.ReadOnlyField(source="reporter.username")

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "created_at",
            "updated_at",
        ]
