
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Issue, Project, ProjectMembership

from .models import Project, ProjectMembership

User = get_user_model()


class ProjectTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="eren_dev",
            email="eren@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)
        self.url = "/api/v1/projects/"

    def test_user_can_create_project(self):
        response = self.client.post(
            self.url,
            {
                "name": "Test Project",
                "key": "TEST",
                "description": "A test project.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Project.objects.count(), 1)
        self.assertEqual(Project.objects.first().owner, self.user)

    def test_project_owner_becomes_admin_member(self):
        response = self.client.post(
            self.url,
            {
                "name": "Test Project",
                "key": "TEST",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        membership = ProjectMembership.objects.get(
            project_id=response.data["id"],
            user=self.user,
        )
        self.assertEqual(membership.role, ProjectMembership.Role.ADMIN)

    def test_unauthenticated_user_cannot_create_project(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.url,
            {
                "name": "Test Project",
                "key": "TEST",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )


    def test_non_owner_cannot_update_project(self):
        other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="TestPass123!",
        )

        project = Project.objects.create(
            name="Original Project",
            key="ORIG",
            owner=self.user,
        )

        ProjectMembership.objects.create(
            project=project,
            user=self.user,
            role=ProjectMembership.Role.ADMIN,
        )

        ProjectMembership.objects.create(
            project=project,
            user=other_user,
            role=ProjectMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=other_user)

        response = self.client.patch(
            f"{self.url}{project.id}/",
            {"name": "Hacked Project"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        project.refresh_from_db()
        self.assertEqual(project.name, "Original Project")

    def test_non_owner_cannot_delete_project(self):
        other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="TestPass123!",
        )

        project = Project.objects.create(
            name="Protected Project",
            key="SAFE",
            owner=self.user,
        )

        ProjectMembership.objects.create(
            project=project,
            user=self.user,
            role=ProjectMembership.Role.ADMIN,
        )

        ProjectMembership.objects.create(
            project=project,
            user=other_user,
            role=ProjectMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=other_user)

        response = self.client.delete(
            f"{self.url}{project.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertTrue(
            Project.objects.filter(id=project.id).exists()
        )


class IssueTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="issue_owner",
            email="issue_owner@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            name="Issue Test Project",
            key="ITEST",
            owner=self.user,
        )

        ProjectMembership.objects.create(
            project=self.project,
            user=self.user,
            role=ProjectMembership.Role.ADMIN,
        )

        self.url = "/api/v1/projects/issues/"

    def test_user_can_create_issue(self):
        response = self.client.post(
            self.url,
            {
                "project": self.project.id,
                "title": "Test issue",
                "priority": "HIGH",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test issue")
        self.assertEqual(response.data["reporter"], self.user.username)

    def test_user_cannot_access_issue_from_another_project(self):
        other_user = User.objects.create_user(
            username="other_owner",
            email="other_owner@example.com",
            password="TestPass123!",
        )

        other_project = Project.objects.create(
            name="Private Project",
            key="PRIV",
            owner=other_user,
        )

        issue = Issue.objects.create(
            project=other_project,
            title="Private issue",
            reporter=other_user,
        )

        response = self.client.get(
            f"{self.url}{issue.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
